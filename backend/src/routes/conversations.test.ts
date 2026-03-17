import express from 'express';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getConversationMock = vi.fn();

vi.mock('../services/conversationRuntime.js', () => ({
  getConversationIndex: () => ({
    getConversation: getConversationMock,
    listConversations: vi.fn(),
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
        error: 'File is not available for this conversation preview.',
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
        error: 'File is not available for this conversation preview.',
      });
    });
  });

  it('truncates oversized file previews', async () => {
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
      expect(body.truncated).toBe(true);
      expect(body.content).toHaveLength(200_000);
      expect(body.content).toBe(largeContent.slice(0, 200_000));
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
