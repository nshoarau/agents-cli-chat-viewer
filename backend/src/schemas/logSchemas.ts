import { z } from 'zod';

export const MessageSchema = z.object({
  id: z.string().optional(),
  sender: z.enum(['user', 'agent']),
  content: z.string(),
  timestamp: z.string().optional(),
});

export const ActivityToolCallSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  kind: z.enum(['command', 'read', 'write', 'search', 'other']),
  timestamp: z.string().optional(),
  status: z.string().optional(),
  summary: z.string().optional(),
  command: z.string().optional(),
  filePath: z.string().optional(),
  outputPreview: z.string().optional(),
  diffPreview: z.string().optional(),
});

export const SessionActivitySchema = z.object({
  commands: z.array(z.string()),
  filesTouched: z.array(z.string()),
  toolCalls: z.array(ActivityToolCallSchema),
});

export const AgentTypeSchema = z.enum([
  'gemini',
  'claude',
  'codex',
  'copilot',
  'cursor',
  'opencode',
]);

export const BaseConversationSchema = z.object({
  id: z.string(),
  agentType: AgentTypeSchema,
  timestamp: z.string(),
  title: z.string().optional(),
  status: z.enum(['active', 'archived']).default('active'),
  filePath: z.string(),
  messages: z.array(MessageSchema),
  project: z.string().optional(),
  projectPath: z.string().optional(),
  sessionActivity: SessionActivitySchema.optional(),
});

// Specific schemas for different agent log formats can be added here
// if they differ significantly before parsing into the Base format.
export type Message = z.infer<typeof MessageSchema>;
export type ActivityToolCall = z.infer<typeof ActivityToolCallSchema>;
export type SessionActivity = z.infer<typeof SessionActivitySchema>;
export type Conversation = z.infer<typeof BaseConversationSchema>;
export type AgentType = z.infer<typeof AgentTypeSchema>;
