import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../types';
import {
  buildActivitySummary,
  buildTranscriptMarkdown,
  CONVERSATION_DETAIL_PREFERENCES_KEY,
  getDefaultConversationDetailPreferences,
  loadConversationDetailPreferences,
  persistConversationDetailPreferences,
  toConversationExportFileStem,
} from './conversationDetailUtils';

const makeConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'conv-1',
  agentType: 'codex',
  timestamp: '2026-03-17T12:00:00.000Z',
  title: 'Refactor delete flow',
  status: 'active',
  filePath: '/tmp/session.jsonl',
  project: 'viewer',
  projectPath: '/tmp/viewer',
  messages: [
    {
      sender: 'user',
      content: 'Please refactor the delete flow.',
      timestamp: '2026-03-17T11:58:00.000Z',
    },
    {
      sender: 'agent',
      content: 'I updated the state handling.',
      timestamp: '2026-03-17T12:00:00.000Z',
    },
  ],
  sessionActivity: {
    commands: ['npm test'],
    filesTouched: ['src/dashboard.tsx'],
    toolCalls: [
      {
        name: 'replace',
        kind: 'write',
        status: 'completed',
        filePath: 'src/dashboard.tsx',
        command: 'apply_patch',
      },
    ],
  },
  ...overrides,
});

describe('conversationDetailUtils', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads default preferences when localStorage is empty or invalid', () => {
    expect(loadConversationDetailPreferences()).toEqual(getDefaultConversationDetailPreferences());

    window.localStorage.setItem(CONVERSATION_DETAIL_PREFERENCES_KEY, '{bad json');
    expect(loadConversationDetailPreferences()).toEqual(getDefaultConversationDetailPreferences());
  });

  it('persists and restores conversation detail preferences', () => {
    const preferences = {
      sessionActivityVisibility: { 'conv-1': false },
      agentActivityVisibility: { 'conv-1:2': true },
      filesPanelVisibility: { 'conv-1': true },
      searchQuery: { 'conv-1': 'retry' },
      promptNavigationIndex: { 'conv-1': 1 },
      searchNavigationIndex: { 'conv-1': 2 },
      editorSelection: 'cursor' as const,
      jetbrainsProduct: 'php-storm' as const,
      jetbrainsProjectName: 'UnlinkIt',
      headerCollapsed: true,
      sidebarCollapsed: true,
    };

    persistConversationDetailPreferences(preferences);

    expect(loadConversationDetailPreferences()).toEqual(preferences);
  });

  it('builds markdown transcript export content', () => {
    const result = buildTranscriptMarkdown(makeConversation());

    expect(result).toContain('# Refactor delete flow');
    expect(result).toContain('## Transcript');
    expect(result).toContain('Please refactor the delete flow.');
    expect(result).toContain('I updated the state handling.');
  });

  it('builds activity summary export content', () => {
    const result = buildActivitySummary(makeConversation());

    expect(result).toContain('Commands (1)');
    expect(result).toContain('- npm test');
    expect(result).toContain('Files Touched (1)');
    expect(result).toContain('Tool Calls (1)');
    expect(result).toContain('replace | write | completed | src/dashboard.tsx | apply_patch');
  });

  it('creates a readable export file stem from the conversation title', () => {
    expect(
      toConversationExportFileStem(makeConversation({ title: 'Refactor delete flow / dashboard' }))
    ).toBe('refactor-delete-flow-dashboard');
  });
});
