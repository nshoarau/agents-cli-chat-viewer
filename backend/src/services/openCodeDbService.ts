import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { ActivityToolCall, Conversation, Message, SessionActivity } from '../schemas/logSchemas.js';

const execFileAsync = promisify(execFile);
const OPEN_CODE_DB_NAME = 'opencode.db';
const SESSION_MARKER = '#session=';

interface RawOpenCodeSessionSummary {
  id: string;
  title: string;
  timestamp: string;
  workspacePath?: string;
  messageCount: number;
}

interface RawOpenCodeSessionData extends RawOpenCodeSessionSummary {
  messages: Array<{
    id: string;
    role: string;
    timeCreated?: string;
    contentParts: string[];
    toolParts: Array<Record<string, unknown>>;
  }>;
}

export interface OpenCodeSessionSummary {
  sessionId: string;
  title: string;
  timestamp: string;
  workspacePath?: string;
  messageCount: number;
}

const jsonScript = String.raw`
import json
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime, timezone

db_path = sys.argv[1]
mode = sys.argv[2]
session_id = sys.argv[3] if len(sys.argv) > 3 else None

def to_iso(value):
    if value is None:
        return None
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        return None

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

if mode == "list":
    cur.execute("""
        SELECT
          s.id AS id,
          s.title AS title,
          s.directory AS directory,
          s.time_updated AS time_updated,
          s.time_created AS time_created,
          COUNT(m.id) AS message_count
        FROM session s
        LEFT JOIN message m ON m.session_id = s.id
        GROUP BY s.id
        ORDER BY s.time_updated DESC, s.time_created DESC
    """)
    rows = []
    for row in cur.fetchall():
        rows.append({
            "id": row["id"],
            "title": row["title"] or row["id"],
            "timestamp": to_iso(row["time_updated"]) or to_iso(row["time_created"]),
            "workspacePath": row["directory"] or None,
            "messageCount": int(row["message_count"] or 0),
        })
    print(json.dumps(rows))
elif mode == "session":
    cur.execute("""
        SELECT
          s.id AS id,
          s.title AS title,
          s.directory AS directory,
          s.time_updated AS time_updated,
          s.time_created AS time_created
        FROM session s
        WHERE s.id = ?
        LIMIT 1
    """, (session_id,))
    session = cur.fetchone()
    if session is None:
        print(json.dumps(None))
        sys.exit(0)

    cur.execute("""
        SELECT id, time_created, data
        FROM message
        WHERE session_id = ?
        ORDER BY time_created ASC
    """, (session_id,))
    messages = []
    for message in cur.fetchall():
        try:
            message_data = json.loads(message["data"])
        except Exception:
            message_data = {}

        cur.execute("""
            SELECT data
            FROM part
            WHERE message_id = ?
            ORDER BY time_created ASC
        """, (message["id"],))
        parts = []
        for (raw_data,) in cur.fetchall():
            try:
                parts.append(json.loads(raw_data))
            except Exception:
                continue

        content_parts = []
        tool_parts = []
        for part in parts:
            part_type = part.get("type")
            if part_type == "text" and isinstance(part.get("text"), str):
                content_parts.append(part.get("text"))
            elif part_type == "tool":
                tool_parts.append(part)

        messages.append({
            "id": message["id"],
            "role": message_data.get("role") or "user",
            "timeCreated": to_iso(message["time_created"]),
            "contentParts": content_parts,
            "toolParts": tool_parts,
        })

    print(json.dumps({
        "id": session["id"],
        "title": session["title"] or session["id"],
        "timestamp": to_iso(session["time_updated"]) or to_iso(session["time_created"]),
        "workspacePath": session["directory"] or None,
        "messageCount": len(messages),
        "messages": messages,
    }))
else:
    raise SystemExit(f"Unsupported mode: {mode}")
`;

const parseJson = <T>(value: string): T => JSON.parse(value) as T;

const runPython = async <T>(dbPath: string, mode: 'list' | 'session', sessionId?: string): Promise<T> => {
  const args = ['-c', jsonScript, dbPath, mode];
  if (sessionId) {
    args.push(sessionId);
  }

  try {
    const { stdout } = await execFileAsync('python3', args, {
      maxBuffer: 8 * 1024 * 1024,
    });
    return parseJson<T>(stdout.trim() || 'null');
  } catch (error) {
    throw new Error(`Failed to read OpenCode database at ${dbPath}: ${String(error)}`);
  }
};

const normalizeTextParts = (parts: string[]): string =>
  parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');

const summarizeQuestionTool = (input: Record<string, unknown>, output: string | undefined): string => {
  const questions = Array.isArray(input.questions) ? input.questions : [];
  const prompts = questions
    .map((question) =>
      question && typeof question === 'object' && typeof (question as Record<string, unknown>).question === 'string'
        ? (question as Record<string, unknown>).question as string
        : null
    )
    .filter((question): question is string => Boolean(question));

  const base = prompts.length > 0 ? `Asked: ${prompts.join(' / ')}` : 'Asked a question';
  if (!output?.trim()) {
    return base;
  }

  return `${base}\n${trimPreview(output.trim(), 600)}`;
};

const summarizeToolPart = (
  toolName: string,
  input: Record<string, unknown>,
  output: string | undefined,
  workspacePath?: string
): string => {
  const filePath = extractToolFilePath(input, workspacePath);
  const command = extractCommand(input);
  const normalized = toolName.toLowerCase();

  if (normalized === 'bash' && command) {
    return `$ ${command}`;
  }
  if (normalized === 'question') {
    return summarizeQuestionTool(input, output);
  }
  if (normalized === 'read' && filePath) {
    return `Read ${filePath}`;
  }
  if ((normalized === 'write' || normalized === 'edit') && filePath) {
    return `Updated ${filePath}`;
  }
  if (normalized === 'todowrite') {
    return 'Updated todo list';
  }
  if (filePath) {
    return `${toolName}: ${filePath}`;
  }
  if (command) {
    return `${toolName}: ${command}`;
  }

  return output?.trim() ? `${toolName}\n${trimPreview(output.trim(), 600)}` : toolName;
};

const synthesizeToolOnlyMessage = (
  toolParts: Array<Record<string, unknown>>,
  workspacePath?: string
): string => {
  return toolParts
    .map((part) => {
      const toolName = typeof part.tool === 'string' ? part.tool : 'tool';
      const state =
        typeof part.state === 'object' && part.state !== null
          ? (part.state as Record<string, unknown>)
          : {};
      const input =
        typeof state.input === 'object' && state.input !== null
          ? (state.input as Record<string, unknown>)
          : {};
      const output = typeof state.output === 'string' ? state.output : undefined;

      return summarizeToolPart(toolName, input, output, workspacePath);
    })
    .filter(Boolean)
    .join('\n');
};

const trimPreview = (value: string | undefined, maxLength = 2000): string | undefined => {
  if (!value) {
    return undefined;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
};

const toMessageSender = (role: string): Message['sender'] =>
  role.toLowerCase() === 'assistant' ? 'agent' : 'user';

const getToolKind = (toolName: string): ActivityToolCall['kind'] => {
  const normalized = toolName.toLowerCase();
  if (normalized === 'bash' || normalized === 'command') {
    return 'command';
  }
  if (/(read|view|cat)/.test(normalized)) {
    return 'read';
  }
  if (/(write|edit|replace|patch|create|delete|move)/.test(normalized)) {
    return 'write';
  }
  if (/(search|grep|find|glob)/.test(normalized)) {
    return 'search';
  }
  return 'other';
};

const extractCommand = (input: Record<string, unknown>): string | undefined => {
  const command = input.command;
  return typeof command === 'string' && command.trim() ? command : undefined;
};

const extractToolFilePath = (input: Record<string, unknown>, workspacePath?: string): string | undefined => {
  const candidates = [
    input.filePath,
    input.file_path,
    input.path,
    input.target,
    input.to,
    input.from,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) {
      continue;
    }

    if (path.isAbsolute(candidate) || !workspacePath) {
      return candidate;
    }

    return path.resolve(workspacePath, candidate);
  }

  return undefined;
};

const buildToolSummary = (toolName: string, command?: string, filePath?: string): string | undefined => {
  if (command) {
    return command;
  }
  if (filePath) {
    return `${toolName} ${filePath}`;
  }
  return toolName;
};

const buildSessionActivity = (
  rawMessages: RawOpenCodeSessionData['messages'],
  workspacePath?: string
): SessionActivity | undefined => {
  const commands: string[] = [];
  const filesTouched = new Set<string>();
  const toolCalls: ActivityToolCall[] = [];

  rawMessages.forEach((message) => {
    message.toolParts.forEach((part) => {
      const toolName = typeof part.tool === 'string' ? part.tool : 'tool';
      const state =
        typeof part.state === 'object' && part.state !== null
          ? (part.state as Record<string, unknown>)
          : {};
      const input =
        typeof state.input === 'object' && state.input !== null
          ? (state.input as Record<string, unknown>)
          : {};
      const command = extractCommand(input);
      const filePath = extractToolFilePath(input, workspacePath);

      if (command) {
        commands.push(command);
      }
      if (filePath) {
        filesTouched.add(filePath);
      }

      toolCalls.push({
        id: typeof part.callID === 'string' ? part.callID : undefined,
        name: toolName,
        kind: getToolKind(toolName),
        timestamp: message.timeCreated,
        status: typeof state.status === 'string' ? state.status : undefined,
        summary: buildToolSummary(toolName, command, filePath),
        command,
        filePath,
        outputPreview:
          typeof state.output === 'string'
            ? trimPreview(state.output)
            : undefined,
      });
    });
  });

  if (commands.length === 0 && filesTouched.size === 0 && toolCalls.length === 0) {
    return undefined;
  }

  return {
    commands,
    filesTouched: [...filesTouched],
    toolCalls,
  };
};

export const isOpenCodeDatabasePath = (filePath: string): boolean =>
  path.basename(filePath) === OPEN_CODE_DB_NAME;

export const createOpenCodeSessionVirtualPath = (dbPath: string, sessionId: string): string =>
  `${dbPath}${SESSION_MARKER}${sessionId}`;

export const parseOpenCodeSessionVirtualPath = (
  filePath: string
): { dbPath: string; sessionId: string } | null => {
  const markerIndex = filePath.indexOf(SESSION_MARKER);
  if (markerIndex === -1) {
    return null;
  }

  return {
    dbPath: filePath.slice(0, markerIndex),
    sessionId: filePath.slice(markerIndex + SESSION_MARKER.length),
  };
};

export class OpenCodeDbService {
  public static async listSessions(dbPath: string): Promise<OpenCodeSessionSummary[]> {
    const sessions = await runPython<RawOpenCodeSessionSummary[]>(dbPath, 'list');
    return sessions.map((session) => ({
      sessionId: session.id,
      title: session.title,
      timestamp: session.timestamp,
      workspacePath: session.workspacePath,
      messageCount: session.messageCount,
    }));
  }

  public static async parseConversation(virtualPath: string): Promise<Conversation | null> {
    const parsedPath = parseOpenCodeSessionVirtualPath(virtualPath);
    if (!parsedPath) {
      return null;
    }

    const session = await runPython<RawOpenCodeSessionData | null>(
      parsedPath.dbPath,
      'session',
      parsedPath.sessionId
    );
    if (!session) {
      return null;
    }

    const messages = session.messages
      .map((message): Message | null => {
        const content =
          normalizeTextParts(message.contentParts) ||
          synthesizeToolOnlyMessage(message.toolParts, session.workspacePath);
        if (!content) {
          return null;
        }

        return {
          id: message.id,
          sender: toMessageSender(message.role),
          content,
          timestamp: message.timeCreated,
        };
      })
      .filter((message): message is Message => Boolean(message));

    return {
      id: session.id,
      agentType: 'opencode',
      timestamp: session.timestamp,
      title: session.title,
      status: 'active',
      filePath: virtualPath,
      messages,
      sessionActivity: buildSessionActivity(session.messages, session.workspacePath),
    };
  }
}
