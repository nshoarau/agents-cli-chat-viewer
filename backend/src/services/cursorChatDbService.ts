import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { Conversation, Message } from '../schemas/logSchemas.js';

const execFileAsync = promisify(execFile);
const CURSOR_CHAT_DB_NAME = 'store.db';

interface RawCursorChatMeta {
  agentId: string;
  latestRootBlobId?: string;
  name?: string;
  mode?: string;
  createdAt?: number;
  lastUsedModel?: string;
}

interface RawCursorBlob {
  rowId: number;
  id: string;
  text: string;
}

interface RawCursorConversation {
  meta: RawCursorChatMeta;
  blobs: RawCursorBlob[];
}

const dumpScript = String.raw`
import json
import sqlite3
import sys

db_path = sys.argv[1]
conn = sqlite3.connect(db_path)
cur = conn.cursor()

meta = {}
for key, value in cur.execute("SELECT key, value FROM meta ORDER BY key ASC"):
    try:
        meta[key] = json.loads(bytes.fromhex(value).decode("utf-8"))
    except Exception:
        meta[key] = value

blobs = []
for rowid, blob_id, data in cur.execute("SELECT rowid, id, data FROM blobs ORDER BY rowid ASC"):
    if data is None:
        continue
    try:
        text = data.decode("utf-8")
    except Exception:
        continue
    blobs.append({
        "rowId": rowid,
        "id": blob_id,
        "text": text,
    })

print(json.dumps({
    "meta": meta.get("0") or {},
    "blobs": blobs,
}))
`;

const parseJson = <T>(value: string): T => JSON.parse(value) as T;

const toIsoTimestamp = (value?: number): string | undefined => {
  if (!value || !Number.isFinite(value)) {
    return undefined;
  }

  return new Date(value).toISOString();
};

const extractTextContent = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const record = item as Record<string, unknown>;
      if (record.type === 'text' && typeof record.text === 'string') {
        return [record.text.trim()];
      }

      return [];
    })
    .filter(Boolean)
    .join('\n\n');
};

const shouldIgnoreMessage = (role: string, content: string): boolean => {
  if (!content) {
    return true;
  }

  if (role === 'system') {
    return true;
  }

  if (
    role === 'user' &&
    content.includes('<user_info>') &&
    content.includes('<agent_transcripts>')
  ) {
    return true;
  }

  return false;
};

export const isCursorChatDatabasePath = (filePath: string): boolean => {
  const normalizedPath = path.resolve(filePath).toLowerCase();
  if (path.basename(normalizedPath) !== CURSOR_CHAT_DB_NAME) {
    return false;
  }

  return (
    normalizedPath.includes(`${path.sep}.cursor${path.sep}chats${path.sep}`) ||
    normalizedPath.includes(`${path.sep}cursor-chats${path.sep}`)
  );
};

export class CursorChatDbService {
  public static async parseConversation(dbPath: string): Promise<Conversation> {
    const { stdout } = await execFileAsync('python3', ['-c', dumpScript, dbPath], {
      maxBuffer: 8 * 1024 * 1024,
    });
    const raw = parseJson<RawCursorConversation>(stdout.trim());

    const messages: Message[] = raw.blobs.flatMap((blob) => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(blob.text) as Record<string, unknown>;
      } catch {
        return [];
      }

      const role = typeof parsed.role === 'string' ? parsed.role : '';
      if (role !== 'user' && role !== 'assistant') {
        return [];
      }

      const content = extractTextContent(parsed.content);
      if (shouldIgnoreMessage(role, content)) {
        return [];
      }

      return [
        {
          id: typeof parsed.id === 'string' ? parsed.id : blob.id,
          sender: role === 'assistant' ? 'agent' : 'user',
          content,
        },
      ];
    });

    return {
      id: raw.meta.agentId || path.basename(path.dirname(dbPath)),
      agentType: 'cursor',
      timestamp: toIsoTimestamp(raw.meta.createdAt) || new Date().toISOString(),
      title: raw.meta.name?.trim() || path.basename(path.dirname(dbPath)),
      status: 'active',
      filePath: dbPath,
      messages,
    };
  }
}
