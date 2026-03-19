import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'url';
import { ParserService } from './parserService.js';
import { createOpenCodeSessionVirtualPath } from './openCodeDbService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, '__fixtures__');

describe('ParserService', () => {
  const createOpenCodeDatabase = async (dbPath: string) => {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'python3',
        [
          '-c',
          `
import json
import sqlite3
import sys

db_path = sys.argv[1]
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.executescript("""
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_id TEXT,
  slug TEXT NOT NULL,
  directory TEXT NOT NULL,
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  share_url TEXT,
  summary_additions INTEGER,
  summary_deletions INTEGER,
  summary_files INTEGER,
  summary_diffs TEXT,
  revert TEXT,
  permission TEXT,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL,
  time_compacting INTEGER,
  time_archived INTEGER,
  workspace_id TEXT
);
CREATE TABLE message (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE part (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL,
  data TEXT NOT NULL
);
""")
cur.execute(
  "INSERT INTO session (id, project_id, parent_id, slug, directory, title, version, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ("ses_test_1", "global", None, "nimble-nebula", "/tmp/opencode-project", "OpenCode DB session", "1.2.27", 1773849257412, 1773850353211),
)
cur.execute(
  "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)",
  ("msg_user", "ses_test_1", 1773849257433, 1773849257433, json.dumps({"role": "user"})),
)
cur.execute(
  "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)",
  ("msg_tool_only", "ses_test_1", 1773849260000, 1773849262416, json.dumps({"role": "assistant"})),
)
cur.execute(
  "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)",
  ("msg_assistant", "ses_test_1", 1773849262493, 1773849264748, json.dumps({"role": "assistant"})),
)
cur.execute(
  "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)",
  ("prt_user_text", "msg_user", "ses_test_1", 1773849257438, 1773849257438, json.dumps({"type": "text", "text": "init"})),
)
cur.execute(
  "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)",
  ("prt_tool", "msg_tool_only", "ses_test_1", 1773849262212, 1773849262416, json.dumps({
    "type": "tool",
    "callID": "call_function_bash_1",
    "tool": "bash",
    "state": {
      "status": "completed",
      "input": {"command": "ls -la", "description": "List files"},
      "output": "total 8\\n",
    },
  })),
)
cur.execute(
  "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?, ?)",
  ("prt_agent_text", "msg_assistant", "ses_test_1", 1773849264747, 1773849264748, json.dumps({"type": "text", "text": "The directory is empty. What would you like to initialize?"})),
)
conn.commit()
conn.close()
          `,
          dbPath,
        ],
        { stdio: 'ignore' }
      );
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`python exited with ${code}`))));
      child.on('error', reject);
    });
  };

  const createCursorChatDatabase = async (dbPath: string) => {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'python3',
        [
          '-c',
          `
import json
import sqlite3
import sys

db_path = sys.argv[1]
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.executescript("""
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE blobs (
  id TEXT PRIMARY KEY,
  data BLOB
);
""")

meta = {
  "agentId": "cursor-agent-1",
  "latestRootBlobId": "root-blob-1",
  "name": "Cursor CLI Review",
  "createdAt": 1773925838511,
}

cur.execute("INSERT INTO meta (key, value) VALUES (?, ?)", ("0", json.dumps(meta).encode("utf-8").hex()))
cur.execute("INSERT INTO blobs (id, data) VALUES (?, ?)", ("system-1", json.dumps({"role": "system", "content": "system prompt"}).encode("utf-8")))
cur.execute("INSERT INTO blobs (id, data) VALUES (?, ?)", ("bootstrap-1", json.dumps({"role": "user", "content": "<user_info>ctx</user_info>\\n<agent_transcripts>x</agent_transcripts>"}).encode("utf-8")))
cur.execute("INSERT INTO blobs (id, data) VALUES (?, ?)", ("user-1", json.dumps({"role": "user", "content": [{"type": "text", "text": "<user_query>\\nPlease resume\\n</user_query>"}]}).encode("utf-8")))
cur.execute("INSERT INTO blobs (id, data) VALUES (?, ?)", ("assistant-1", json.dumps({"role": "assistant", "content": [{"type": "reasoning", "text": "thinking"}, {"type": "text", "text": "I\\u2019ll inspect the project and resume from there."}]}).encode("utf-8")))
cur.execute("INSERT INTO blobs (id, data) VALUES (?, ?)", ("assistant-2", json.dumps({"role": "assistant", "content": [{"type": "tool-call", "toolName": "Read"}, {"type": "text", "text": "I found the current work in progress."}]}).encode("utf-8")))
conn.commit()
conn.close()
          `,
          dbPath,
        ],
        { stdio: 'ignore' }
      );
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`python exited with ${code}`))));
      child.on('error', reject);
    });
  };

  it('extracts Gemini session activity from fixture data', async () => {
    const fixturePath = path.join(fixturesDir, 'gemini-session.json');

    const conversation = await ParserService.parseFile(fixturePath);

    expect(conversation.agentType).toBe('gemini');
    expect(conversation.sessionActivity).toBeDefined();
    expect(conversation.sessionActivity?.commands).toContain('ls -la src');
    expect(conversation.sessionActivity?.filesTouched).toContain('/tmp/project/README.md');
    expect(conversation.sessionActivity?.toolCalls).toHaveLength(3);
    expect(
      conversation.sessionActivity?.toolCalls.some(
        (toolCall) =>
          toolCall.name === 'write_file' && toolCall.diffPreview?.includes('+++ new')
      )
    ).toBe(true);
  });

  it('extracts Codex session activity from fixture data', async () => {
    const fixturePath = path.join(fixturesDir, 'codex-session.jsonl');

    const conversation = await ParserService.parseFile(fixturePath);

    expect(conversation.agentType).toBe('codex');
    expect(conversation.sessionActivity).toBeDefined();
    expect(conversation.sessionActivity?.commands).toContain('cat src/app.ts');
    expect(conversation.sessionActivity?.filesTouched).toContain('src/app.ts');
    expect(
      conversation.sessionActivity?.toolCalls.some(
        (toolCall) => toolCall.outputPreview?.includes("console.log('hello')")
      )
    ).toBe(true);
    expect(
      conversation.sessionActivity?.toolCalls.some(
        (toolCall) =>
          toolCall.name === 'replace' && toolCall.diffPreview?.includes('hello world')
      )
    ).toBe(true);
  });

  it('extracts Claude session activity from fixture data', async () => {
    const fixturePath = path.join(fixturesDir, 'claude-session.jsonl');

    const conversation = await ParserService.parseFile(fixturePath);

    expect(conversation.agentType).toBe('claude');
    expect(conversation.sessionActivity).toBeDefined();
    expect(conversation.sessionActivity?.commands).toContain('npm test');
    expect(conversation.sessionActivity?.filesTouched).toContain('/tmp/claude-project/src/app.ts');
    expect(
      conversation.sessionActivity?.toolCalls.some(
        (toolCall) =>
          toolCall.name === 'Edit' && toolCall.diffPreview?.includes('+++ new')
      )
    ).toBe(true);
  });

  it('parses GitHub Copilot session fixtures', async () => {
    const fixturePath = path.join(fixturesDir, 'copilot-session.json');

    const conversation = await ParserService.parseFile(fixturePath);

    expect(conversation.agentType).toBe('copilot');
    expect(conversation.title).toBe('Refactor sidebar filters');
    expect(conversation.messages).toHaveLength(4);
    expect(conversation.messages[0]?.sender).toBe('user');
    expect(conversation.messages[1]?.sender).toBe('agent');
  });

  it('parses OpenCode session fixtures', async () => {
    const fixturePath = path.join(fixturesDir, 'opencode-session.json');

    const conversation = await ParserService.parseFile(fixturePath);

    expect(conversation.agentType).toBe('opencode');
    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[1]?.content).toContain('harden detection first');
  });

  it('parses OpenCode SQLite-backed sessions via virtual paths', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-db-parser-'));
    const dbPath = path.join(tempDir, 'opencode.db');
    await createOpenCodeDatabase(dbPath);

    try {
      const conversation = await ParserService.parseFile(
        createOpenCodeSessionVirtualPath(dbPath, 'ses_test_1')
      );

      expect(conversation.agentType).toBe('opencode');
      expect(conversation.title).toBe('OpenCode DB session');
      expect(conversation.messages).toHaveLength(3);
      expect(conversation.messages[0]?.content).toBe('init');
      expect(conversation.messages[1]?.content).toContain('$ ls -la');
      expect(conversation.messages[2]?.content).toContain('What would you like to initialize?');
      expect(conversation.sessionActivity?.commands).toContain('ls -la');
      expect(conversation.sessionActivity?.toolCalls[0]?.name).toBe('bash');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('parses Cursor markdown export fixtures', async () => {
    const fixturePath = path.join(fixturesDir, 'cursor-export.md');

    const conversation = await ParserService.parseFile(fixturePath);

    expect(conversation.agentType).toBe('cursor');
    expect(conversation.messages).toHaveLength(4);
    expect(conversation.messages[0]?.sender).toBe('user');
    expect(conversation.messages[1]?.sender).toBe('agent');
  });

  it('parses Cursor CLI SQLite chat stores', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cursor-chat-parser-'));
    const chatDir = path.join(tempDir, '.cursor', 'chats', 'workspace-1', 'chat-1');
    const dbPath = path.join(chatDir, 'store.db');
    await fs.mkdir(chatDir, { recursive: true });
    await createCursorChatDatabase(dbPath);

    try {
      const conversation = await ParserService.parseFile(dbPath);

      expect(conversation.agentType).toBe('cursor');
      expect(conversation.title).toBe('Cursor CLI Review');
      expect(conversation.messages).toHaveLength(3);
      expect(conversation.messages[0]?.sender).toBe('user');
      expect(conversation.messages[0]?.content).toContain('Please resume');
      expect(conversation.messages[1]?.sender).toBe('agent');
      expect(conversation.messages[1]?.content).toContain('inspect the project');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('prefers Gemini absolute file paths recovered from tool output', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemini-parser-'));
    const sessionPath = path.join(tempDir, 'session.json');

    await fs.writeFile(
      sessionPath,
      JSON.stringify({
        sessionId: 'gemini-relative-paths',
        messages: [
          {
            id: 'agent-1',
            timestamp: '2026-03-18T13:36:37.100Z',
            type: 'gemini',
            toolCalls: [
              {
                id: 'read-file-1',
                name: 'read_file',
                args: {
                  file_path: 'pokemon_card_valuator.html',
                },
                result: [
                  {
                    functionResponse: {
                      id: 'read-file-1',
                      name: 'read_file',
                      response: {
                        output:
                          'Read from /home/nicolas/dev/unlinkit/pokemon_card_valuator.html successfully.',
                      },
                    },
                  },
                ],
                status: 'success',
              },
            ],
          },
        ],
      }),
      'utf-8'
    );

    try {
      const conversation = await ParserService.parseFile(sessionPath);

      expect(conversation.sessionActivity?.filesTouched).toContain(
        '/home/nicolas/dev/unlinkit/pokemon_card_valuator.html'
      );
      expect(conversation.sessionActivity?.toolCalls[0]?.filePath).toBe(
        '/home/nicolas/dev/unlinkit/pokemon_card_valuator.html'
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
