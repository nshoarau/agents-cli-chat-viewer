import type { EditorOptionId, JetBrainsProductId } from './fileEditorLink';
import type { ActivityToolCall, Conversation } from '../types';

export interface ConversationDetailPreferences {
  sessionActivityVisibility: Record<string, boolean>;
  agentActivityVisibility: Record<string, boolean>;
  filesPanelVisibility: Record<string, boolean>;
  promptNavigationIndex: Record<string, number>;
  searchNavigationIndex: Record<string, number>;
  editorSelection: EditorOptionId;
  jetbrainsProduct: JetBrainsProductId;
  jetbrainsProjectName: string;
  headerCollapsed: boolean;
  sidebarCollapsed: boolean;
  sidebarMode: 'full' | 'reduced' | 'hidden';
}

export const CONVERSATION_DETAIL_PREFERENCES_KEY = 'conversation-detail-preferences-v1';

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeBooleanRecord = (value: unknown): Record<string, boolean> => {
  if (!isObjectRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
  );
};

const normalizeNumberRecord = (value: unknown): Record<string, number> => {
  if (!isObjectRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])
    )
  );
};

export const getDefaultConversationDetailPreferences = (): ConversationDetailPreferences => ({
  sessionActivityVisibility: {},
  agentActivityVisibility: {},
  filesPanelVisibility: {},
  promptNavigationIndex: {},
  searchNavigationIndex: {},
  editorSelection: 'default',
  jetbrainsProduct: 'idea',
  jetbrainsProjectName: '',
  headerCollapsed: false,
  sidebarCollapsed: false,
  sidebarMode: 'full',
});

export const loadConversationDetailPreferences = (): ConversationDetailPreferences => {
  if (typeof window === 'undefined') {
    return getDefaultConversationDetailPreferences();
  }

  try {
    const raw = window.localStorage.getItem(CONVERSATION_DETAIL_PREFERENCES_KEY);
    if (!raw) {
      return getDefaultConversationDetailPreferences();
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isObjectRecord(parsed)) {
      return getDefaultConversationDetailPreferences();
    }

    return {
      sessionActivityVisibility: normalizeBooleanRecord(parsed.sessionActivityVisibility),
      agentActivityVisibility: normalizeBooleanRecord(parsed.agentActivityVisibility),
      filesPanelVisibility: normalizeBooleanRecord(parsed.filesPanelVisibility),
      promptNavigationIndex: normalizeNumberRecord(parsed.promptNavigationIndex),
      searchNavigationIndex: normalizeNumberRecord(parsed.searchNavigationIndex),
      editorSelection:
        parsed.editorSelection === 'none' ||
        parsed.editorSelection === 'vscode' ||
        parsed.editorSelection === 'cursor' ||
        parsed.editorSelection === 'zed' ||
        parsed.editorSelection === 'windsurf'
          || parsed.editorSelection === 'jetbrains'
          ? parsed.editorSelection
          : 'default',
      jetbrainsProduct:
        parsed.jetbrainsProduct === 'php-storm' ||
        parsed.jetbrainsProduct === 'web-storm' ||
        parsed.jetbrainsProduct === 'pycharm' ||
        parsed.jetbrainsProduct === 'goland' ||
        parsed.jetbrainsProduct === 'rubymine'
          ? parsed.jetbrainsProduct
          : 'idea',
      jetbrainsProjectName: typeof parsed.jetbrainsProjectName === 'string' ? parsed.jetbrainsProjectName : '',
      headerCollapsed: parsed.headerCollapsed === true,
      sidebarCollapsed: parsed.sidebarCollapsed === true,
      sidebarMode:
        parsed.sidebarMode === 'reduced' || parsed.sidebarMode === 'hidden' || parsed.sidebarMode === 'full'
          ? parsed.sidebarMode
          : parsed.sidebarCollapsed === true
            ? 'hidden'
            : 'full',
    };
  } catch {
    return getDefaultConversationDetailPreferences();
  }
};

export const persistConversationDetailPreferences = (
  preferences: ConversationDetailPreferences
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CONVERSATION_DETAIL_PREFERENCES_KEY, JSON.stringify(preferences));
};

const formatMessageHeading = (sender: string, timestamp?: string): string => {
  const label = sender === 'user' ? 'User' : 'Agent';
  return timestamp ? `### ${label} (${new Date(timestamp).toLocaleString()})` : `### ${label}`;
};

export const buildTranscriptMarkdown = (conversation: Conversation): string => {
  const sections = [
    `# ${conversation.title}`,
    '',
    `- Agent: ${conversation.agentType}`,
    `- Timestamp: ${new Date(conversation.timestamp).toLocaleString()}`,
    `- Status: ${conversation.status}`,
    `- File: ${conversation.filePath}`,
  ];

  if (conversation.project) {
    sections.push(`- Project: ${conversation.project}`);
  }

  sections.push('', '## Transcript', '');

  conversation.messages.forEach((message) => {
    sections.push(formatMessageHeading(message.sender, message.timestamp), '', message.content, '');
  });

  return sections.join('\n').trim();
};

const formatToolCallLine = (toolCall: ActivityToolCall): string => {
  const parts = [
    toolCall.name,
    toolCall.kind,
    toolCall.status,
    toolCall.filePath,
    toolCall.command,
  ].filter(Boolean);

  return `- ${parts.join(' | ')}`;
};

export const buildActivitySummary = (conversation: Conversation): string => {
  const sessionActivity = conversation.sessionActivity;
  const sections = [
    `Conversation: ${conversation.title}`,
    `Agent: ${conversation.agentType}`,
    `Timestamp: ${new Date(conversation.timestamp).toLocaleString()}`,
    `Source: ${conversation.filePath}`,
  ];

  if (!sessionActivity) {
    sections.push('', 'No session activity was captured for this conversation.');
    return sections.join('\n');
  }

  sections.push(
    '',
    `Commands (${sessionActivity.commands.length})`,
    ...sessionActivity.commands.map((command) => `- ${command}`),
    '',
    `Files Touched (${sessionActivity.filesTouched.length})`,
    ...sessionActivity.filesTouched.map((filePath) => `- ${filePath}`),
    '',
    `Tool Calls (${sessionActivity.toolCalls.length})`,
    ...sessionActivity.toolCalls.map(formatToolCallLine)
  );

  return sections.join('\n');
};

export const toConversationExportFileStem = (conversation: Conversation): string => {
  const normalized = conversation.title.trim().toLocaleLowerCase();
  const sanitized = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return sanitized || conversation.id;
};
