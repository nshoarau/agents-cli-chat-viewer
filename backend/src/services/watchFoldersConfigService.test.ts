import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { __testUtils } from './watchFoldersConfigService.js';

describe('watchFoldersConfigService default folder candidates', () => {
  it('includes Claude sessions as an automatic recommendation candidate', () => {
    const homeDir = '/home/tester';

    expect(__testUtils.defaultFolderCandidates(homeDir)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Claude Sessions',
          sourcePath: path.join(homeDir, '.claude/sessions'),
          targetName: 'claude-sessions',
        }),
      ])
    );
  });

  it('uses the current home directory for default Codex discovery', () => {
    const homeSpy = vi.spyOn(os, 'homedir').mockReturnValue('/tmp/example-home');

    expect(__testUtils.defaultFolderCandidates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Codex Sessions',
          sourcePath: '/tmp/example-home/.codex/sessions',
          targetName: 'codex-sessions',
        }),
      ])
    );

    homeSpy.mockRestore();
  });

  it('rejects empty folders that are not conversation-relevant', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'watch-folders-empty-'));

    await fs.mkdir(path.join(tempDir, 'nested'));
    await fs.writeFile(path.join(tempDir, 'nested', 'notes.txt'), 'not a conversation');

    await expect(__testUtils.hasRelevantConversationFiles(tempDir)).resolves.toBe(false);
  });

  it('accepts folders that contain supported conversation files', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'watch-folders-relevant-'));

    await fs.mkdir(path.join(tempDir, '2026', '03', '19'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, '2026', '03', '19', 'rollout-2026-03-19T13-46.jsonl'),
      '{"type":"session_meta"}\n'
    );

    await expect(__testUtils.hasRelevantConversationFiles(tempDir)).resolves.toBe(true);
  });
});
