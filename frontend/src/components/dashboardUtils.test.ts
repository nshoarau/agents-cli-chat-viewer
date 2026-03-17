import { describe, expect, it } from 'vitest';
import { getNextConversationIdAfterDelete } from './dashboardUtils';
import type { ConversationSummary } from '../types';

const conversations: ConversationSummary[] = [
  {
    id: 'a',
    agentType: 'codex',
    timestamp: '2026-03-17T10:00:00.000Z',
    title: 'A',
    status: 'active',
    filePath: '/tmp/a.json',
    project: 'Test',
    projectPath: '/tmp',
    relativePath: 'a.json',
    messageCount: 1,
  },
  {
    id: 'b',
    agentType: 'codex',
    timestamp: '2026-03-17T11:00:00.000Z',
    title: 'B',
    status: 'active',
    filePath: '/tmp/b.json',
    project: 'Test',
    projectPath: '/tmp',
    relativePath: 'b.json',
    messageCount: 1,
  },
  {
    id: 'c',
    agentType: 'codex',
    timestamp: '2026-03-17T12:00:00.000Z',
    title: 'C',
    status: 'active',
    filePath: '/tmp/c.json',
    project: 'Test',
    projectPath: '/tmp',
    relativePath: 'c.json',
    messageCount: 1,
  },
];

describe('getNextConversationIdAfterDelete', () => {
  it('returns the next visible conversation when available', () => {
    expect(getNextConversationIdAfterDelete(conversations, 'b')).toBe('c');
  });

  it('falls back to the previous conversation for the last item', () => {
    expect(getNextConversationIdAfterDelete(conversations, 'c')).toBe('b');
  });

  it('returns undefined when the deleted conversation is missing', () => {
    expect(getNextConversationIdAfterDelete(conversations, 'missing')).toBeUndefined();
  });
});
