import express from 'express';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getConversationMock = vi.fn();
const listConversationsMock = vi.fn();

vi.mock('../services/conversationRuntime.js', () => ({
  getConversationIndex: () => ({
    getConversation: getConversationMock,
    listConversations: listConversationsMock,
    updateStatus: vi.fn(),
    deleteConversation: vi.fn(),
    addFolder: vi.fn(),
    removeFolder: vi.fn(),
  }),
}));

describe('conversationRouter file preview route', () => {
  let tempDir: string;
  let conversationRouter: typeof import('./conversations.js').conversationRouter;

  const expectedEditorPath = (filePath: string): string =>
    process.env.WSL_DISTRO_NAME
      ? `\\\\wsl.localhost\\${process.env.WSL_DISTRO_NAME}${filePath.replace(/\//g, '\\')}`
      : filePath;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'viewer-preview-'));
    conversationRouter = (await import('./conversations.js')).conversationRouter;
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const withServer = async (run: (baseUrl: string) => Promise<void>) => {
    const app = express();
    app.use('/api/conversations', conversationRouter);

    const server = await new Promise<import('node:http').Server>((resolve) => {
      const nextServer = app.listen(0, () => resolve(nextServer));
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to start test server.');
    }

    try {
      await run(`http://127.0.0.1:${address.port}`);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };

  it('returns an allowed project file preview', async () => {
    const projectDir = path.join(tempDir, 'project');
    const sourceDir = path.join(projectDir, 'src');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');
    const filePath = path.join(sourceDir, 'app.ts');

    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(filePath, 'export const answer = 42;\n');
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath: projectDir,
      sessionActivity: {
        filesTouched: ['src/app.ts'],
        toolCalls: [],
      },
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/content?path=${encodeURIComponent('src/app.ts')}`
      );

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toEqual({
        filePath,
        editorPath: expectedEditorPath(filePath),
        content: 'export const answer = 42;\n',
        truncated: false,
        previewStatus: 'ready',
        rawUrl: `/api/conversations/conv-1/files/raw?path=${encodeURIComponent('src/app.ts')}`,
        mimeType: 'text/typescript',
      });
    });
  });

  it('accepts opencode as a list filter agent type', async () => {
    listConversationsMock.mockReturnValue({
      items: [],
      total: 0,
      nextOffset: null,
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations?agentType=${encodeURIComponent('opencode')}`
      );

      expect(response.status).toBe(200);
      expect(listConversationsMock).toHaveBeenCalledWith('opencode', 0, 200);
    });
  });

  it('prefers an existing authorized project-relative candidate over a missing root-absolute variant', async () => {
    const projectPath = path.join(tempDir, 'frontend', 'src');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');
    const filePath = path.join(projectPath, 'components', 'conversationFilesPanelUtils.test.ts');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(filePath, 'export const fromExistingCandidate = true;\n');
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath,
      messages: [
        {
          sender: 'user',
          content: `Inspect ${filePath}.`,
        },
      ],
      sessionActivity: {
        commands: [],
        filesTouched: ['/components/conversationFilesPanelUtils.test.ts'],
        toolCalls: [
          {
            name: 'read_file',
            kind: 'read',
            filePath: '/components/conversationFilesPanelUtils.test.ts',
          },
        ],
      },
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/content?path=${encodeURIComponent('/components/conversationFilesPanelUtils.test.ts')}`
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        filePath,
        editorPath: expectedEditorPath(filePath),
        content: 'export const fromExistingCandidate = true;\n',
        previewStatus: 'ready',
      });
    });
  });

  it('rejects files that were not part of the conversation activity', async () => {
    const projectDir = path.join(tempDir, 'project');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');

    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath: projectDir,
      sessionActivity: {
        filesTouched: ['src/app.ts'],
        toolCalls: [],
      },
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/content?path=${encodeURIComponent('src/secret.ts')}`
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: 'File is not referenced in this conversation.',
      });
    });
  });

  it('allows files referenced directly in a prompt message', async () => {
    const projectDir = path.join(tempDir, 'project');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');
    const filePath = path.join(projectDir, 'src', 'prompt.ts');

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(filePath, 'export const promptLinked = true;\n');
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath: projectDir,
      messages: [
        {
          sender: 'user',
          content: 'Please inspect [prompt.ts](src/prompt.ts) before you continue.',
        },
      ],
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/content?path=${encodeURIComponent('src/prompt.ts')}`
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        filePath,
        editorPath: expectedEditorPath(filePath),
        content: 'export const promptLinked = true;\n',
        truncated: false,
        previewStatus: 'ready',
        rawUrl: `/api/conversations/conv-1/files/raw?path=${encodeURIComponent('src/prompt.ts')}`,
        mimeType: 'text/typescript',
      });
    });
  });

  it('allows prompt file references that include line anchors', async () => {
    const projectDir = path.join(tempDir, 'project');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');
    const filePath = path.join(projectDir, 'src', 'prompt.ts');

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(filePath, 'export const anchored = true;\n');
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath: projectDir,
      messages: [
        {
          sender: 'user',
          content: 'Please inspect [prompt.ts](src/prompt.ts#L12) before you continue.',
        },
      ],
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/content?path=${encodeURIComponent('src/prompt.ts#L12')}`
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        filePath,
        editorPath: expectedEditorPath(filePath),
        content: 'export const anchored = true;\n',
        truncated: false,
        previewStatus: 'ready',
        rawUrl: `/api/conversations/conv-1/files/raw?path=${encodeURIComponent('src/prompt.ts#L12')}`,
        mimeType: 'text/typescript',
      });
    });
  });

  it('does not authorize bare hosts, git refs, or folders from prompt text', async () => {
    const projectDir = path.join(tempDir, 'project');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');

    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath: projectDir,
      messages: [
        {
          sender: 'user',
          content: 'Ignore origin/main, src/components, and 127.0.0.1/api.',
        },
      ],
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/content?path=${encodeURIComponent('src/components')}`
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        error: 'File is not referenced in this conversation.',
      });
    });
  });

  it('reports oversized file previews with a raw fallback', async () => {
    const projectDir = path.join(tempDir, 'project');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');
    const filePath = path.join(projectDir, 'large.txt');
    const largeContent = 'a'.repeat(220_000);

    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(filePath, largeContent);
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath: projectDir,
      sessionActivity: {
        filesTouched: [filePath],
        toolCalls: [],
      },
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/content?path=${encodeURIComponent(filePath)}`
      );

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.filePath).toBe(filePath);
      expect(body.editorPath).toBe(expectedEditorPath(filePath));
      expect(body.truncated).toBe(false);
      expect(body.previewStatus).toBe('too_large');
      expect(body.previewMessage).toBe('File is too large to preview inline. Open the raw file instead.');
      expect(body.rawUrl).toBe(`/api/conversations/conv-1/files/raw?path=${encodeURIComponent(filePath)}`);
      expect(body.content).toBe('');
    });
  });

  it('reports binary file previews with a raw fallback', async () => {
    const projectDir = path.join(tempDir, 'project');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');
    const filePath = path.join(projectDir, 'image.bin');

    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath: projectDir,
      sessionActivity: {
        filesTouched: ['image.bin'],
        toolCalls: [],
      },
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/content?path=${encodeURIComponent('image.bin')}`
      );

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.previewStatus).toBe('binary');
      expect(body.previewMessage).toBe('Binary files cannot be previewed as text. Open the raw file instead.');
      expect(body.rawUrl).toBe(`/api/conversations/conv-1/files/raw?path=${encodeURIComponent('image.bin')}`);
    });
  });

  it('reports encoding errors with a raw fallback', async () => {
    const projectDir = path.join(tempDir, 'project');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');
    const filePath = path.join(projectDir, 'latin1.txt');

    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(filePath, Buffer.from([0x63, 0x61, 0x66, 0xe9]));
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath: projectDir,
      sessionActivity: {
        filesTouched: ['latin1.txt'],
        toolCalls: [],
      },
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/content?path=${encodeURIComponent('latin1.txt')}`
      );

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.previewStatus).toBe('encoding_error');
      expect(body.previewMessage).toBe('This file could not be decoded as UTF-8 text. Open the raw file instead.');
      expect(body.rawUrl).toBe(`/api/conversations/conv-1/files/raw?path=${encodeURIComponent('latin1.txt')}`);
    });
  });

  it('returns 404 when an authorized preview target no longer exists', async () => {
    const projectDir = path.join(tempDir, 'project');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');

    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath: projectDir,
      messages: [
        {
          sender: 'user',
          content: 'Please inspect [missing.ts](src/missing.ts).',
        },
      ],
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/content?path=${encodeURIComponent('src/missing.ts')}`
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: 'Referenced file no longer exists.',
      });
    });
  });

  it('serves the raw file for authorized requests', async () => {
    const projectDir = path.join(tempDir, 'project');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');
    const filePath = path.join(projectDir, 'src', 'app.ts');

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(filePath, 'export const answer = 42;\n');
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath: projectDir,
      sessionActivity: {
        filesTouched: ['src/app.ts'],
        toolCalls: [],
      },
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/raw?path=${encodeURIComponent('src/app.ts')}`
      );

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe('export const answer = 42;\n');
    });
  });

  it('returns 404 for missing raw files that were referenced by the conversation', async () => {
    const projectDir = path.join(tempDir, 'project');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');

    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath: projectDir,
      messages: [
        {
          sender: 'user',
          content: 'Please inspect [missing.ts](src/missing.ts).',
        },
      ],
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/raw?path=${encodeURIComponent('src/missing.ts')}`
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: 'Referenced file no longer exists.',
      });
    });
  });

  it('returns a WSL UNC path for editor links when running inside WSL', async () => {
    vi.stubEnv('WSL_DISTRO_NAME', 'Ubuntu-24.04');
    vi.resetModules();
    conversationRouter = (await import('./conversations.js')).conversationRouter;

    const projectDir = path.join(tempDir, 'project');
    const conversationLog = path.join(tempDir, 'logs', 'session.jsonl');
    const filePath = path.join(projectDir, 'src', 'app.ts');

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.mkdir(path.dirname(conversationLog), { recursive: true });
    await fs.writeFile(filePath, 'export const answer = 42;\n');
    await fs.writeFile(conversationLog, '{}\n');

    getConversationMock.mockResolvedValue({
      id: 'conv-1',
      filePath: conversationLog,
      projectPath: projectDir,
      sessionActivity: {
        filesTouched: ['src/app.ts'],
        toolCalls: [],
      },
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/conversations/conv-1/files/content?path=${encodeURIComponent('src/app.ts')}`
      );

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.editorPath).toBe(`\\\\wsl.localhost\\Ubuntu-24.04${filePath.replace(/\//g, '\\')}`);
    });
  });
});
