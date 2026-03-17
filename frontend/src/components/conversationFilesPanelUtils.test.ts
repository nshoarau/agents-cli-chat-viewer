import { describe, expect, it } from 'vitest';
import type { Conversation } from '../types';
import { buildConversationFileGroups } from './conversationFilesPanelUtils';

const makeConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'conv-files',
  agentType: 'codex',
  timestamp: '2026-03-17T12:00:00.000Z',
  title: 'Files',
  status: 'active',
  filePath: '/tmp/session.jsonl',
  project: 'viewer',
  projectPath: '/tmp/viewer',
  messages: [],
  sessionActivity: {
    commands: [],
    filesTouched: [],
    toolCalls: [],
  },
  ...overrides,
});

describe('buildConversationFileGroups', () => {
  it('groups files by folder and tracks prompt/activity sources', () => {
    const groups = buildConversationFileGroups(
      makeConversation({
        messages: [
          {
            sender: 'user',
            content: 'Inspect [app.ts](src/app.ts) and also src/utils/date.ts.',
            timestamp: '2026-03-17T12:00:00.000Z',
          },
          {
            sender: 'agent',
            content: 'Updated src/app.ts.',
            timestamp: '2026-03-17T12:00:02.000Z',
          },
        ],
        sessionActivity: {
          commands: ['cat src/app.ts', 'cat src/utils/date.ts'],
          filesTouched: ['src/app.ts', 'src/utils/date.ts', 'README.md'],
          toolCalls: [
            {
              name: 'read_file',
              kind: 'read',
              timestamp: '2026-03-17T12:00:01.000Z',
              filePath: 'src/app.ts',
            },
            {
              name: 'edit_file',
              kind: 'write',
              timestamp: '2026-03-17T12:00:03.000Z',
              filePath: 'src/app.ts',
            },
          ],
        },
      })
    );

    expect(groups.map((group) => group.folderPath)).toEqual(['src', 'src/utils', '(root)']);
    expect(groups[0]?.files[0]).toMatchObject({
      filePath: 'src/app.ts',
      source: 'both',
      frequency: 4,
    });
    expect(groups[1]?.files[0]).toMatchObject({
      filePath: 'src/utils/date.ts',
      source: 'both',
      frequency: 2,
    });
    expect(groups[2]?.files[0]).toMatchObject({
      filePath: 'README.md',
      source: 'activity',
      frequency: 1,
    });
  });

  it('normalizes project-absolute paths to the same preview path used by message links', () => {
    const groups = buildConversationFileGroups(
      makeConversation({
        messages: [
          {
            sender: 'user',
            content: 'Inspect [app.ts](src/app.ts).',
            timestamp: '2026-03-17T12:00:00.000Z',
          },
        ],
        sessionActivity: {
          commands: ['cat /tmp/viewer/src/app.ts'],
          filesTouched: ['/tmp/viewer/src/app.ts'],
          toolCalls: [
            {
              name: 'read_file',
              kind: 'read',
              timestamp: '2026-03-17T12:00:01.000Z',
              filePath: '/tmp/viewer/src/app.ts',
            },
          ],
        },
      })
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.files[0]).toMatchObject({
      filePath: '/tmp/viewer/src/app.ts',
      displayPath: 'src/app.ts',
      source: 'both',
      frequency: 2,
    });
  });

  it('prefers a working relative preview path when mixed with a mismatched absolute variant', () => {
    const groups = buildConversationFileGroups(
      makeConversation({
        projectPath: '/tmp/viewer',
        messages: [
          {
            sender: 'user',
            content: 'Inspect [app.ts](src/app.ts).',
            timestamp: '2026-03-17T12:00:00.000Z',
          },
        ],
        sessionActivity: {
          commands: ['cat /mnt/other-root/src/app.ts'],
          filesTouched: ['/mnt/other-root/src/app.ts'],
          toolCalls: [
            {
              name: 'read_file',
              kind: 'read',
              timestamp: '2026-03-17T12:00:01.000Z',
              filePath: '/mnt/other-root/src/app.ts',
            },
          ],
        },
      })
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.files[0]).toMatchObject({
      filePath: '/mnt/other-root/src/app.ts',
      displayPath: 'src/app.ts',
      source: 'both',
      frequency: 3,
    });
  });

  it('keeps an absolute open path when a matching relative activity path is also present', () => {
    const groups = buildConversationFileGroups(
      makeConversation({
        projectPath: '/tmp/viewer/frontend',
        messages: [
          {
            sender: 'user',
            content: 'Inspect /tmp/viewer/frontend/src/components/conversationFilesPanelUtils.ts.',
            timestamp: '2026-03-17T12:00:00.000Z',
          },
        ],
        sessionActivity: {
          commands: ['cat src/components/conversationFilesPanelUtils.ts'],
          filesTouched: ['src/components/conversationFilesPanelUtils.ts'],
          toolCalls: [
            {
              name: 'read_file',
              kind: 'read',
              timestamp: '2026-03-17T12:00:01.000Z',
              filePath: 'src/components/conversationFilesPanelUtils.ts',
            },
          ],
        },
      })
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.files[0]).toMatchObject({
      filePath: '/tmp/viewer/frontend/src/components/conversationFilesPanelUtils.ts',
      displayPath: 'src/components/conversationFilesPanelUtils.ts',
      source: 'both',
      frequency: 2,
    });
  });
});
