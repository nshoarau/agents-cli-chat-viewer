export type AgentType = 'gemini' | 'claude' | 'codex';

export interface Message {
  id?: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp?: string;
}

export interface ActivityToolCall {
  id?: string;
  name: string;
  kind: 'command' | 'read' | 'write' | 'search' | 'other';
  timestamp?: string;
  status?: string;
  summary?: string;
  command?: string;
  filePath?: string;
  outputPreview?: string;
  diffPreview?: string;
}

export interface SessionActivity {
  commands: string[];
  filesTouched: string[];
  toolCalls: ActivityToolCall[];
}

export interface Conversation {
  id: string;
  agentType: AgentType;
  timestamp: string;
  title: string;
  status: 'active' | 'archived';
  filePath: string;
  messages: Message[];
  project?: string;
  projectPath?: string;
  sessionActivity?: SessionActivity;
}

export interface ConversationSummary {
  id: string;
  agentType: AgentType;
  timestamp: string;
  title: string;
  status: 'active' | 'archived';
  filePath: string;
  project: string;
  projectPath: string;
  relativePath: string;
  messageCount: number;
}

export interface ConversationListResponse {
  items: ConversationSummary[];
  total: number;
  nextOffset: number | null;
}

export interface ConversationLogEvent {
  event: 'add' | 'change' | 'unlink';
  id?: string;
  conversation?: ConversationSummary;
}

export interface WatchFolderEntry {
  id: string;
  label: string;
  sourcePath: string;
  targetName: string;
  kind: 'default' | 'custom' | 'legacy';
}

export interface ConversationFilePreview {
  filePath: string;
  editorPath?: string;
  content: string;
  truncated: boolean;
  previewStatus?: 'ready' | 'binary' | 'too_large' | 'encoding_error';
  previewMessage?: string;
  rawUrl?: string;
  mimeType?: string;
}
