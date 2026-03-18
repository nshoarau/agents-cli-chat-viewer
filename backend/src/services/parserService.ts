import fs from 'fs/promises';
import path from 'path';
import type {
  ActivityToolCall,
  Conversation,
  Message,
  AgentType,
  SessionActivity,
} from '../schemas/logSchemas.js';

export interface ParsedConversationSummary {
  agentType: AgentType;
  timestamp: string;
  title: string;
  filePath: string;
  messageCount: number;
  workspacePath?: string;
}

interface ParseCacheEntry<T> {
  mtimeMs: number;
  value: T;
}

export class ParserService {
  private static readonly conversationCache = new Map<string, ParseCacheEntry<Conversation>>();
  private static readonly summaryCache = new Map<string, ParseCacheEntry<ParsedConversationSummary>>();

  public static async parseFile(filePath: string): Promise<Conversation> {
    const { content, id, ext, timestamp, mtimeMs } = await this.readFileSnapshot(filePath);
    const cachedConversation = this.conversationCache.get(filePath);

    if (cachedConversation?.mtimeMs === mtimeMs) {
      return cachedConversation.value;
    }

    // Path-based agent detection (folders like .codex or .claude)
    let pathAgent: AgentType | undefined;
    const absolutePath = path.resolve(filePath);
    if (absolutePath.includes('.codex')) {
      pathAgent = 'codex';
    } else if (absolutePath.includes('.claude')) {
      pathAgent = 'claude';
    }

    if (ext === '.json' || ext === '.jsonl') {
      try {
        if (ext === '.jsonl') {
          const lines = content.split('\n').filter(l => l.trim());
          // Check if it's an event-stream style log (multiple JSON objects)
          // or just a single JSON object that happens to have a .jsonl extension
          const allData = [];
          for (const line of lines) {
            try {
              allData.push(JSON.parse(line));
            } catch (e) {
              // Skip invalid lines
            }
          }

          if (allData.length > 1) {
            // It's likely an event stream (like Codex rollouts)
            const conversation = this.parseEventStream(id, allData, filePath, timestamp, pathAgent);
            this.storeConversationCache(filePath, mtimeMs, conversation);
            return conversation;
          } else if (allData.length === 1) {
            const conversation = this.parseJson(id, allData[0], filePath, timestamp, pathAgent);
            this.storeConversationCache(filePath, mtimeMs, conversation);
            return conversation;
          }
          throw new Error('No valid JSON in jsonl file');
        } else {
          const data = JSON.parse(content);
          const conversation = this.parseJson(id, data, filePath, timestamp, pathAgent);
          this.storeConversationCache(filePath, mtimeMs, conversation);
          return conversation;
        }
      } catch (e) {
        throw new Error(`Failed to parse JSON/JSONL: ${filePath}`);
      }
    } else if (ext === '.md') {
      const conversation = this.parseMarkdown(id, content, filePath, timestamp, pathAgent);
      this.storeConversationCache(filePath, mtimeMs, conversation);
      return conversation;
    }

    throw new Error(`Unsupported file format: ${ext}`);
  }

  public static async parseSummary(filePath: string): Promise<ParsedConversationSummary> {
    const { content, id, ext, timestamp, mtimeMs } = await this.readFileSnapshot(filePath);
    const cachedSummary = this.summaryCache.get(filePath);
    if (cachedSummary?.mtimeMs === mtimeMs) {
      return cachedSummary.value;
    }

    const cachedConversation = this.conversationCache.get(filePath);
    if (cachedConversation?.mtimeMs === mtimeMs) {
      const summary = this.toSummary(cachedConversation.value);
      this.summaryCache.set(filePath, { mtimeMs, value: summary });
      return summary;
    }

    let pathAgent: AgentType | undefined;
    const absolutePath = path.resolve(filePath);
    if (absolutePath.includes('.codex')) {
      pathAgent = 'codex';
    } else if (absolutePath.includes('.claude')) {
      pathAgent = 'claude';
    }

    let summary: ParsedConversationSummary;

    if (ext === '.json' || ext === '.jsonl') {
      if (ext === '.jsonl') {
        const lines = content.split('\n').filter((line) => line.trim());
        const allData: any[] = [];
        for (const line of lines) {
          try {
            allData.push(JSON.parse(line));
          } catch {
            // Ignore malformed lines when indexing metadata.
          }
        }

        if (allData.length > 1) {
          summary = this.parseEventStreamSummary(id, allData, filePath, timestamp, pathAgent);
        } else if (allData.length === 1) {
          summary = this.parseJsonSummary(id, allData[0], filePath, timestamp, pathAgent);
        } else {
          throw new Error(`Failed to parse JSON/JSONL: ${filePath}`);
        }
      } else {
        const data = JSON.parse(content);
        summary = this.parseJsonSummary(id, data, filePath, timestamp, pathAgent);
      }
    } else if (ext === '.md') {
      summary = {
        agentType: pathAgent || 'gemini',
        timestamp,
        title: id,
        filePath,
        messageCount: 1,
      };
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    this.summaryCache.set(filePath, { mtimeMs, value: summary });
    return summary;
  }

  public static evict(filePath: string): void {
    this.conversationCache.delete(filePath);
    this.summaryCache.delete(filePath);
  }

  private static async readFileSnapshot(filePath: string) {
    const fileName = path.basename(filePath);
    const id = fileName.replace(/\.[^/.]+$/, '');
    const ext = path.extname(filePath).toLowerCase();
    const [content, stats] = await Promise.all([
      fs.readFile(filePath, 'utf-8'),
      fs.stat(filePath),
    ]);

    return {
      content,
      id,
      ext,
      timestamp: stats.mtime.toISOString(),
      mtimeMs: stats.mtimeMs,
    };
  }

  private static storeConversationCache(filePath: string, mtimeMs: number, conversation: Conversation) {
    this.conversationCache.set(filePath, { mtimeMs, value: conversation });
    this.summaryCache.set(filePath, {
      mtimeMs,
      value: this.toSummary(conversation),
    });
  }

  private static toSummary(conversation: Conversation): ParsedConversationSummary {
    return {
      agentType: conversation.agentType,
      timestamp: conversation.timestamp,
      title: conversation.title || path.basename(conversation.filePath).replace(/\.[^/.]+$/, ''),
      filePath: conversation.filePath,
      messageCount: conversation.messages.length,
      workspacePath: undefined,
    };
  }

  private static parseEventStream(id: string, allData: any[], filePath: string, fileTimestamp: string, pathAgent?: AgentType): Conversation {
    let agentType: AgentType = pathAgent || 'codex';
    let messages: Message[] = [];
    let title = id;
    let timestamp = fileTimestamp;
    let sessionActivity: SessionActivity | undefined;

    // First pass to detect agent type if not already known
    if (!pathAgent) {
      for (const entry of allData) {
        if (entry.version?.startsWith('2.') || entry.type === 'progress' || entry.sessionId) {
          agentType = 'claude';
          break;
        }
      }
    }

    for (const entry of allData) {
      // Metadata extraction
      if (entry.type === 'session_meta') {
        if (entry.payload?.id) title = entry.payload.id;
        if (entry.payload?.timestamp) timestamp = entry.payload.timestamp;
      } else if (entry.sessionId && !title.includes('-')) {
        title = entry.sessionId;
      }

      // Codex style: response_item
      if (entry.type === 'response_item' && entry.payload?.type === 'message') {
        const payload = entry.payload;
        const sender = (payload.role === 'assistant' || payload.role === 'agent') ? 'agent' : 'user';
        if (payload.role === 'developer') continue;

        let content = '';
        if (Array.isArray(payload.content)) {
          content = payload.content
            .map((c: any) => this.extractTextContent(c))
            .join('\n');
        } else {
          content = this.extractTextContent(payload.content);
        }

        if (content) {
          messages.push({ sender, content, timestamp: entry.timestamp });
        }
      } 
      // Claude style: direct user/assistant types
      else if (entry.type === 'user' || entry.type === 'assistant') {
        const msgData = entry.message;
        if (!msgData) continue;

        const sender = (entry.type === 'assistant' || msgData.role === 'assistant' || msgData.role === 'agent') ? 'agent' : 'user';
        let content = '';

        if (Array.isArray(msgData.content)) {
          content = msgData.content
            .filter((c: any) => c.type === 'text' || c.type === 'input_text' || c.type === 'output_text')
            .map((c: any) => this.extractTextContent(c))
            .join('\n');
          
          // If no text content but has tool use, maybe label it
          if (!content && msgData.content.some((c: any) => c.type === 'tool_use')) {
            content = `*Used tool: ${msgData.content.find((c: any) => c.type === 'tool_use')?.name}*`;
          }
        } else {
          content = this.extractTextContent(msgData.content);
        }

        if (content) {
          messages.push({ sender, content, timestamp: entry.timestamp || msgData.timestamp });
        }
      }
    }

    if (agentType === 'codex') {
      sessionActivity = this.extractCodexSessionActivity(allData);
    } else if (agentType === 'claude') {
      sessionActivity = this.extractClaudeSessionActivity(allData);
    }

    return {
      id,
      agentType,
      timestamp,
      title,
      status: 'active',
      filePath,
      messages,
      sessionActivity,
    };
  }

  private static parseEventStreamSummary(
    id: string,
    allData: any[],
    filePath: string,
    fileTimestamp: string,
    pathAgent?: AgentType
  ): ParsedConversationSummary {
    let agentType: AgentType = pathAgent || 'codex';
    let title = id;
    let timestamp = fileTimestamp;
    let messageCount = 0;
    let workspacePath: string | undefined;

    if (!pathAgent) {
      for (const entry of allData) {
        if (entry.version?.startsWith('2.') || entry.type === 'progress' || entry.sessionId) {
          agentType = 'claude';
          break;
        }
      }
    }

    for (const entry of allData) {
      if (entry.type === 'session_meta') {
        if (entry.payload?.id) {
          title = entry.payload.id;
        }
        if (entry.payload?.timestamp) {
          timestamp = entry.payload.timestamp;
        }
        if (entry.payload?.cwd) {
          workspacePath = entry.payload.cwd;
        }
      } else if (entry.sessionId && !title.includes('-')) {
        title = entry.sessionId;
      } else if (entry.cwd && typeof entry.cwd === 'string') {
        workspacePath = entry.cwd;
      }

      if (entry.type === 'response_item' && entry.payload?.type === 'message' && entry.payload.role !== 'developer') {
        messageCount += 1;
      } else if (entry.type === 'user' || entry.type === 'assistant') {
        messageCount += 1;
      }
    }

    return {
      agentType,
      timestamp,
      title,
      filePath,
      messageCount,
      workspacePath,
    };
  }

  private static parseJson(id: string, data: any, filePath: string, timestamp: string, pathAgent?: AgentType): Conversation {
    // Basic heuristic to determine agent type from JSON structure
    let agentType: AgentType = pathAgent || 'gemini';
    let messages: Message[] = [];
    let sessionActivity: SessionActivity | undefined;

    const isClaude = data.agent === 'claude' || (typeof data.model === 'string' && data.model.includes('claude')) || (Array.isArray(data.messages) && data.messages.some((m: any) => m.role === 'assistant'));
    const isCodex = data.agent === 'codex' || Array.isArray(data.turns);

    if (!pathAgent) {
      if (isClaude) agentType = 'claude';
      else if (isCodex) agentType = 'codex';
    }

    if (agentType === 'claude') {
      messages = (data.messages || []).map((m: any) => ({
        sender: (m.role === 'assistant' || m.role === 'agent' || m.sender === 'agent') ? 'agent' : 'user',
        content: this.extractTextContent(m.content || m.text || ''),
        timestamp: m.timestamp,
      }));
    } else if (agentType === 'codex') {
      const sourceMessages = data.turns || data.messages || [];
      messages = sourceMessages.map((t: any) => ({
        sender: (t.role === 'agent' || t.role === 'assistant' || t.sender === 'agent') ? 'agent' : 'user',
        content: this.extractTextContent(t.content || t.text || ''),
        timestamp: t.timestamp,
      }));
    } else {
      // Default to Gemini format
      messages = (data.conversations || data.messages || []).map((m: any) => ({
        sender:
          m.type === 'gemini' ||
          m.role === 'model' ||
          m.role === 'assistant' ||
          m.role === 'agent' ||
          m.sender === 'agent'
            ? 'agent'
            : 'user',
        content: this.extractTextContent(m.content || m.text || ''),
        timestamp: m.timestamp,
      }));
      sessionActivity = this.extractGeminiSessionActivity(data);
    }

    return {
      id,
      agentType,
      timestamp: data.timestamp || timestamp,
      title: data.title || id,
      status: 'active',
      filePath,
      messages,
      sessionActivity,
    };
  }

  private static parseJsonSummary(
    id: string,
    data: any,
    filePath: string,
    timestamp: string,
    pathAgent?: AgentType
  ): ParsedConversationSummary {
    let agentType: AgentType = pathAgent || 'gemini';

    const isClaude =
      data.agent === 'claude' ||
      (typeof data.model === 'string' && data.model.includes('claude')) ||
      (Array.isArray(data.messages) && data.messages.some((message: any) => message.role === 'assistant'));
    const isCodex = data.agent === 'codex' || Array.isArray(data.turns);

    if (!pathAgent) {
      if (isClaude) {
        agentType = 'claude';
      } else if (isCodex) {
        agentType = 'codex';
      }
    }

    const messageCount = Array.isArray(data.turns)
      ? data.turns.length
      : Array.isArray(data.messages)
        ? data.messages.length
        : Array.isArray(data.conversations)
          ? data.conversations.length
          : 0;

    return {
      agentType,
      timestamp: data.timestamp || timestamp,
      title: data.title || id,
      filePath,
      messageCount,
      workspacePath:
        (typeof data.cwd === 'string' && data.cwd) ||
        (typeof data.projectPath === 'string' && data.projectPath) ||
        undefined,
    };
  }

  private static parseMarkdown(id: string, content: string, filePath: string, timestamp: string, pathAgent?: AgentType): Conversation {
    return {
      id,
      agentType: pathAgent || 'gemini',
      timestamp,
      title: id,
      status: 'active',
      filePath,
      messages: [
        {
          sender: 'agent',
          content: content,
          timestamp: timestamp,
        },
      ],
    };
  }

  private static extractCodexSessionActivity(allData: any[]): SessionActivity | undefined {
    const functionCalls = new Map<
      string,
      {
        timestamp?: string;
        name: string;
        arguments: Record<string, unknown>;
      }
    >();
    const commands: string[] = [];
    const filesTouched = new Set<string>();
    const toolCalls: ActivityToolCall[] = [];

    for (const entry of allData) {
      const payload = entry?.payload;
      if (!payload || entry.type !== 'response_item') {
        continue;
      }

      if (payload.type === 'function_call') {
        const parsedArguments = this.parseJsonObject(payload.arguments);
        const call = {
          timestamp: entry.timestamp,
          name: typeof payload.name === 'string' ? payload.name : 'tool',
          arguments: parsedArguments,
        };
        if (typeof payload.call_id === 'string') {
          functionCalls.set(payload.call_id, call);
        }
      } else if (payload.type === 'function_call_output' && typeof payload.call_id === 'string') {
        const call = functionCalls.get(payload.call_id);
        if (!call) {
          continue;
        }

        const command = this.getToolCommand(call.arguments);
        if (command) {
          commands.push(command);
        }

        this.extractFilePathsFromTool(call.name, call.arguments, command).forEach((filePath) =>
          filesTouched.add(filePath)
        );

        toolCalls.push({
          id: payload.call_id,
          name: call.name,
          kind: this.getToolKind(call.name, call.arguments),
          timestamp: call.timestamp,
          summary: this.describeToolCall(call.name, call.arguments, command),
          command,
          filePath: this.getPrimaryFilePath(call.name, call.arguments, command),
          outputPreview: this.trimPreview(this.extractTextContent(payload.output)),
          diffPreview: this.trimPreview(
            this.extractDiffPreview(call.name, call.arguments, payload.output)
          ),
        });
      }
    }

    return this.buildSessionActivity(commands, filesTouched, toolCalls);
  }

  private static extractGeminiSessionActivity(data: any): SessionActivity | undefined {
    const commands: string[] = [];
    const filesTouched = new Set<string>();
    const toolCalls: ActivityToolCall[] = [];

    for (const message of data.messages || []) {
      for (const toolCall of message.toolCalls || []) {
        const parsedArgs = toolCall.args || {};
        const command = this.getToolCommand(parsedArgs);
        const resolvedFilePaths = this.resolveToolFilePaths(
          toolCall.name,
          parsedArgs,
          command,
          toolCall.resultDisplay,
          toolCall.result
        );
        if (command) {
          commands.push(command);
        }

        resolvedFilePaths.forEach((filePath) => filesTouched.add(filePath));

        toolCalls.push({
          id: toolCall.id,
          name: toolCall.name,
          kind: this.getToolKind(toolCall.name, parsedArgs),
          timestamp: toolCall.timestamp || message.timestamp,
          status: typeof toolCall.status === 'string' ? toolCall.status : undefined,
          summary: this.describeToolCall(toolCall.name, parsedArgs, command),
          command,
          filePath: this.pickResolvedPrimaryFilePath(
            this.getPrimaryFilePath(toolCall.name, parsedArgs, command),
            resolvedFilePaths
          ),
          outputPreview: this.trimPreview(
            this.extractToolOutputPreview(toolCall.resultDisplay, toolCall.result)
          ),
          diffPreview: this.trimPreview(
            this.extractDiffPreview(toolCall.name, parsedArgs, toolCall.resultDisplay)
          ),
        });
      }
    }

    return this.buildSessionActivity(commands, filesTouched, toolCalls);
  }

  private static extractClaudeSessionActivity(allData: any[]): SessionActivity | undefined {
    const pendingToolUses = new Map<
      string,
      {
        timestamp?: string;
        name: string;
        input: Record<string, unknown>;
      }
    >();
    const commands: string[] = [];
    const filesTouched = new Set<string>();
    const toolCalls: ActivityToolCall[] = [];

    for (const entry of allData) {
      const contentItems = Array.isArray(entry?.message?.content) ? entry.message.content : [];
      if (contentItems.length === 0) {
        continue;
      }

      for (const item of contentItems) {
        if (item?.type === 'tool_use') {
          const input = this.parseJsonObject(item.input);
          if (typeof item.id === 'string') {
            pendingToolUses.set(item.id, {
              timestamp: entry.timestamp || entry.message?.timestamp,
              name: typeof item.name === 'string' ? item.name : 'tool',
              input,
            });
          }
          continue;
        }

        if (item?.type !== 'tool_result' || typeof item.tool_use_id !== 'string') {
          continue;
        }

        const toolUse = pendingToolUses.get(item.tool_use_id);
        if (!toolUse) {
          continue;
        }

        const command = this.getToolCommand(toolUse.input);
        if (command) {
          commands.push(command);
        }

        this.extractFilePathsFromTool(toolUse.name, toolUse.input, command).forEach((filePath) =>
          filesTouched.add(filePath)
        );

        toolCalls.push({
          id: item.tool_use_id,
          name: toolUse.name,
          kind: this.getToolKind(toolUse.name, toolUse.input),
          timestamp: toolUse.timestamp,
          status:
            typeof item.is_error === 'boolean' ? (item.is_error ? 'error' : 'success') : undefined,
          summary: this.describeToolCall(toolUse.name, toolUse.input, command),
          command,
          filePath: this.getPrimaryFilePath(toolUse.name, toolUse.input, command),
          outputPreview: this.trimPreview(this.extractTextContent(item.content)),
          diffPreview: this.trimPreview(this.extractDiffPreview(toolUse.name, toolUse.input, item.content)),
        });
      }
    }

    return this.buildSessionActivity(commands, filesTouched, toolCalls);
  }

  private static buildSessionActivity(
    commands: string[],
    filesTouched: Set<string>,
    toolCalls: ActivityToolCall[]
  ): SessionActivity | undefined {
    const dedupedCommands = [...new Set(commands.map((command) => command.trim()).filter(Boolean))];
    const dedupedFiles = [...filesTouched].filter(Boolean).sort((left, right) =>
      left.localeCompare(right)
    );

    if (dedupedCommands.length === 0 && dedupedFiles.length === 0 && toolCalls.length === 0) {
      return undefined;
    }

    return {
      commands: dedupedCommands,
      filesTouched: dedupedFiles,
      toolCalls,
    };
  }

  private static parseJsonObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }
    }

    return {};
  }

  private static getToolKind(
    toolName: string,
    args: Record<string, unknown>
  ): ActivityToolCall['kind'] {
    if (
      toolName === 'exec_command' ||
      toolName === 'run_shell_command' ||
      toolName === 'Bash' ||
      typeof args.command === 'string' ||
      typeof args.cmd === 'string'
    ) {
      return 'command';
    }
    if (toolName === 'read_file' || toolName === 'list_directory' || toolName === 'Read') {
      return 'read';
    }
    if (toolName === 'replace' || toolName === 'write_file' || toolName === 'Write' || toolName === 'Edit') {
      return 'write';
    }
    if (toolName === 'grep_search' || toolName === 'Grep') {
      return 'search';
    }
    return 'other';
  }

  private static getToolCommand(args: Record<string, unknown>): string | undefined {
    if (typeof args.cmd === 'string') {
      return args.cmd;
    }
    if (typeof args.command === 'string') {
      return args.command;
    }
    return undefined;
  }

  private static describeToolCall(
    toolName: string,
    args: Record<string, unknown>,
    command: string | undefined
  ): string {
    if (command) {
      return command;
    }
    if (typeof args.file_path === 'string') {
      return `${toolName} ${args.file_path}`;
    }
    if (typeof args.dir_path === 'string') {
      return `${toolName} ${args.dir_path}`;
    }
    if (typeof args.pattern === 'string') {
      return `${toolName} ${args.pattern}`;
    }
    return toolName;
  }

  private static getPrimaryFilePath(
    toolName: string,
    args: Record<string, unknown>,
    command: string | undefined
  ): string | undefined {
    if (typeof args.file_path === 'string') {
      return args.file_path;
    }
    if (typeof args.dir_path === 'string') {
      return args.dir_path;
    }
    return this.extractFilePathsFromTool(toolName, args, command)[0];
  }

  private static extractFilePathsFromTool(
    toolName: string,
    args: Record<string, unknown>,
    command: string | undefined
  ): string[] {
    const filePaths = new Set<string>();

    ['file_path', 'dir_path'].forEach((key) => {
      const value = args[key];
      if (typeof value === 'string') {
        filePaths.add(value);
      }
    });

    if (typeof args.files === 'string') {
      filePaths.add(args.files);
    }

    if (command) {
      this.extractPathsFromCommand(command).forEach((filePath) => filePaths.add(filePath));
    }

    if (toolName === 'grep_search' && typeof args.query === 'string') {
      this.extractPathsFromCommand(args.query).forEach((filePath) => filePaths.add(filePath));
    }

    return [...filePaths];
  }

  private static resolveToolFilePaths(
    toolName: string,
    args: Record<string, unknown>,
    command: string | undefined,
    resultDisplay?: unknown,
    result?: unknown
  ): string[] {
    const filePaths = new Set(this.extractFilePathsFromTool(toolName, args, command));

    [this.extractTextContent(resultDisplay), this.extractTextContent(result)]
      .filter(Boolean)
      .forEach((text) => {
        this.extractPathsFromCommand(text).forEach((filePath) => filePaths.add(filePath));
      });

    return [...filePaths];
  }

  private static pickResolvedPrimaryFilePath(
    primaryFilePath: string | undefined,
    filePaths: string[]
  ): string | undefined {
    if (!primaryFilePath) {
      return filePaths.find((filePath) => path.isAbsolute(filePath)) ?? filePaths[0];
    }

    if (path.isAbsolute(primaryFilePath)) {
      return primaryFilePath;
    }

    const absoluteMatch = filePaths.find(
      (filePath) =>
        path.isAbsolute(filePath) &&
        (filePath.endsWith(`/${primaryFilePath}`) || path.basename(filePath) === path.basename(primaryFilePath))
    );

    return absoluteMatch ?? primaryFilePath;
  }

  private static extractPathsFromCommand(command: string): string[] {
    const filePaths = new Set<string>();
    const absolutePathMatches = command.match(/(?:\/[\w.@-]+)+/g) || [];
    absolutePathMatches.forEach((match) => {
      if (this.looksLikePath(match)) {
        filePaths.add(match);
      }
    });

    const relativePathMatches = command.match(/(?:^|\s)([\w./-]+\.[A-Za-z0-9]+)\b/g) || [];
    relativePathMatches.forEach((match) => {
      const normalized = match.trim();
      if (this.looksLikePath(normalized)) {
        filePaths.add(normalized);
      }
    });

    return [...filePaths];
  }

  private static looksLikePath(value: string): boolean {
    return (
      value.includes('/') &&
      !value.startsWith('//') &&
      !value.startsWith('http') &&
      !value.includes('&&') &&
      !value.includes('|')
    );
  }

  private static extractToolOutputPreview(resultDisplay: unknown, result: unknown): string {
    const directDisplay = this.extractTextContent(resultDisplay);
    if (directDisplay) {
      return directDisplay;
    }
    return this.extractTextContent(result);
  }

  private static extractDiffPreview(
    toolName: string,
    input: Record<string, unknown>,
    resultDisplay?: unknown
  ): string | undefined {
    const directFileDiff = this.extractTextContent(
      typeof resultDisplay === 'object' && resultDisplay
        ? (resultDisplay as Record<string, unknown>).fileDiff
        : undefined
    );
    if (directFileDiff) {
      return directFileDiff;
    }

    if (toolName === 'Edit') {
      const oldString = typeof input.old_string === 'string' ? input.old_string : '';
      const newString = typeof input.new_string === 'string' ? input.new_string : '';
      if (!oldString && !newString) {
        return undefined;
      }
      return `--- old\n${oldString}\n+++ new\n${newString}`;
    }

    if (toolName === 'Write') {
      const content = typeof input.content === 'string' ? input.content : '';
      return content ? `+++ created\n${content}` : undefined;
    }

    if (toolName === 'replace') {
      const oldString = typeof input.old_string === 'string' ? input.old_string : '';
      const newString = typeof input.new_string === 'string' ? input.new_string : '';
      if (!oldString && !newString) {
        return undefined;
      }
      return `--- old\n${oldString}\n+++ new\n${newString}`;
    }

    if (toolName === 'write_file') {
      const content = typeof input.content === 'string' ? input.content : '';
      return content ? `+++ created\n${content}` : undefined;
    }

    return undefined;
  }

  private static trimPreview(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    return trimmed.length > 1200 ? `${trimmed.slice(0, 1200)}...` : trimmed;
  }

  private static extractTextContent(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((entry) => this.extractTextContent(entry))
        .filter(Boolean)
        .join('\n');
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const directText = [
        record.text,
        record.content,
        record.input_text,
        record.output_text,
        record.resultDisplay,
        record.output,
        record.fileDiff,
        record.originalContent,
        record.response,
        record.functionResponse,
      ]
        .map((entry) => this.extractTextContent(entry))
        .filter(Boolean)
        .join('\n');

      if (directText) {
        return directText;
      }

      if (Array.isArray(record.parts)) {
        return this.extractTextContent(record.parts);
      }
    }

    return '';
  }
}
