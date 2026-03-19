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
});
