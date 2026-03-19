import fs from 'fs/promises';
import path from 'path';
import type { AgentType, Conversation } from '../schemas/logSchemas.js';
import {
  ConversationIndexCacheService,
  type CachedConversationEntry,
} from './conversationIndexCacheService.js';
import { ParserService, type ParsedConversationSummary } from './parserService.js';
import {
  createOpenCodeSessionVirtualPath,
  isOpenCodeDatabasePath,
  OpenCodeDbService,
  parseOpenCodeSessionVirtualPath,
} from './openCodeDbService.js';
import { isCursorChatDatabasePath } from './cursorChatDbService.js';

export interface ConversationSummary extends ParsedConversationSummary {
  id: string;
  status: 'active' | 'archived';
  project: string;
  projectPath: string;
  relativePath: string;
}

export interface ConversationLogEvent {
  event: 'add' | 'change' | 'unlink';
  id?: string;
  conversation?: ConversationSummary;
}

export interface ConversationListPage {
  items: ConversationSummary[];
  total: number;
  nextOffset: number | null;
}

export interface ConversationIndexStats {
  scanDurationMs: number;
  totalFiles: number;
  indexedFiles: number;
  parsedFiles: number;
  cacheHits: number;
}

interface UpsertResult {
  source: 'parsed' | 'cache-hit';
  summary: ConversationSummary;
}

interface ProjectData {
  project: string;
  projectPath: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.json', '.jsonl', '.md']);
const IGNORED_DIRECTORY_NAMES = new Set([
  'subagents',
  'debug',
  'telemetry',
  'usage-data',
  'file-history',
  'downloads',
  'memory',
  'node_modules',
  'plans',
  '.git',
]);

export const encodeConversationId = (relativePath: string): string =>
  Buffer.from(relativePath, 'utf-8').toString('base64url');

export const decodeConversationId = (id: string): string => {
  try {
    return Buffer.from(id, 'base64url').toString('utf-8');
  } catch {
    return Buffer.from(id, 'base64').toString('utf-8');
  }
};

const isSupportedLogFile = (filePath: string): boolean => {
  const normalizedPath = path.resolve(filePath);

  if (normalizedPath.includes(`${path.sep}storage${path.sep}message${path.sep}`)) {
    return false;
  }

  return (
    isOpenCodeDatabasePath(filePath) ||
    isCursorChatDatabasePath(filePath) ||
    SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase())
  );
};

const getProjectData = (
  relativePath: string,
  workspacePath: string | undefined,
  agentType: AgentType
): ProjectData => {
  const pathParts = relativePath.split(path.sep);
  const watchRoot = pathParts[0];
  const nestedProject = pathParts[1];

  if (watchRoot === 'claude-projects' && nestedProject) {
    return {
      project: nestedProject,
      projectPath: workspacePath || nestedProject,
    };
  }

  if (workspacePath) {
    return {
      project: path.basename(workspacePath),
      projectPath: workspacePath,
    };
  }

  if (watchRoot === 'gemini-chats' && nestedProject) {
    return {
      project: nestedProject,
      projectPath: nestedProject,
    };
  }

  if (watchRoot === 'codex-sessions') {
    return {
      project: 'codex',
      projectPath: 'codex',
    };
  }

  if (watchRoot === 'opencode-projects') {
    return {
      project: 'opencode',
      projectPath: 'opencode',
    };
  }

  if (watchRoot === 'cursor-chats') {
    return {
      project: 'cursor',
      projectPath: 'cursor',
    };
  }

  return {
    project: pathParts.length > 1 ? pathParts[0] : agentType,
    projectPath: pathParts.length > 1 ? pathParts[0] : agentType,
  };
};

async function getFiles(dir: string, visited = new Set<string>()): Promise<string[]> {
  const realPath = await fs.realpath(dir);
  if (visited.has(realPath)) {
    return [];
  }

  visited.add(realPath);

  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    dirents.map(async (dirent) => {
      const entryPath = path.resolve(dir, dirent.name);

      try {
        const stats = await fs.stat(entryPath);
        if (stats.isDirectory()) {
          if (IGNORED_DIRECTORY_NAMES.has(dirent.name)) {
            return [];
          }
          return getFiles(entryPath, visited);
        }
      } catch {
        return [];
      }

      return entryPath;
    })
  );

  return nestedFiles.flat();
}

export class ConversationIndexService {
  private readonly summaries = new Map<string, ConversationSummary>();
  private readonly statusStore = new Map<string, 'active' | 'archived'>();
  private readonly persistedEntries = new Map<string, CachedConversationEntry>();
  private lastStats: ConversationIndexStats = {
    scanDurationMs: 0,
    totalFiles: 0,
    indexedFiles: 0,
    parsedFiles: 0,
    cacheHits: 0,
  };

  constructor(
    private readonly logsDir: string,
    private readonly cacheService: ConversationIndexCacheService
  ) {}

  public async initialize(): Promise<void> {
    const startedAt = Date.now();
    this.summaries.clear();
    this.persistedEntries.clear();

    const loadedCache = await this.cacheService.load();
    loadedCache.forEach((value, key) => {
      this.persistedEntries.set(key, value);
    });

    const allFiles = await getFiles(this.logsDir);
    const supportedFiles = allFiles.filter(isSupportedLogFile);
    let parsedFiles = 0;
    let cacheHits = 0;

    await Promise.all(
      supportedFiles.map(async (filePath) => {
        const result = await this.upsertFile(filePath);
        if (result?.source === 'parsed') {
          parsedFiles += 1;
        } else if (result?.source === 'cache-hit') {
          cacheHits += 1;
        }
      })
    );

    await this.persistCache();
    this.lastStats = {
      scanDurationMs: Date.now() - startedAt,
      totalFiles: allFiles.length,
      indexedFiles: this.summaries.size,
      parsedFiles,
      cacheHits,
    };
  }

  public async rebuild(): Promise<void> {
    await this.initialize();
  }

  public listConversations(
    agentType?: AgentType,
    offset = 0,
    limit = 200
  ): ConversationListPage {
    const filtered = Array.from(this.summaries.values())
      .filter((conversation) => !agentType || conversation.agentType === agentType)
      .sort((left, right) => {
        return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
      });

    const normalizedOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 200;
    const items = filtered.slice(normalizedOffset, normalizedOffset + normalizedLimit);

    return {
      items,
      total: filtered.length,
      nextOffset:
        normalizedOffset + normalizedLimit < filtered.length
          ? normalizedOffset + normalizedLimit
          : null,
    };
  }

  public getStats(): ConversationIndexStats {
    return this.lastStats;
  }

  public async getConversation(id: string, includeProject: boolean): Promise<Conversation | null> {
    const summary = this.summaries.get(id);
    if (!summary) {
      return null;
    }

    if (!includeProject || summary.project === 'General') {
      return this.getSingleConversation(summary);
    }

    const projectConversations = Array.from(this.summaries.values())
      .filter((conversation) => conversation.project === summary.project)
      .sort((left, right) => {
        return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
      });

    const conversations = await Promise.all(
      projectConversations.map(async (conversationSummary) => {
        const conversation = await this.getSingleConversation(conversationSummary);
        return conversation;
      })
    );

    const validConversations = conversations.filter(
      (conversation): conversation is Conversation => conversation !== null
    );

    const combinedMessages = validConversations.flatMap((conversation) =>
      this.sortMessagesNewestFirst(conversation.messages).map((message, index) => ({
        ...message,
        content: index === 0 ? `### From: ${conversation.title}\n---\n${message.content}` : message.content,
        timestamp: message.timestamp || conversation.timestamp,
      }))
    );

    const baseConversation = await this.getSingleConversation(summary);
    if (!baseConversation) {
      return null;
    }

    return {
      ...baseConversation,
      title: `Project: ${summary.project}`,
      messages: combinedMessages,
    };
  }

  public updateStatus(id: string, status: 'active' | 'archived'): boolean {
    const summary = this.summaries.get(id);
    if (!summary) {
      return false;
    }

    this.statusStore.set(id, status);
    this.summaries.set(id, { ...summary, status });
    return true;
  }

  public async deleteConversation(id: string): Promise<boolean> {
    const summary = this.summaries.get(id);
    if (!summary) {
      return false;
    }

    if (parseOpenCodeSessionVirtualPath(summary.filePath)) {
      return false;
    }

    await fs.unlink(summary.filePath);
    this.summaries.delete(id);
    this.statusStore.delete(id);
    return true;
  }

  public async addFolder(folderPath: string): Promise<{ folderName: string; symlinkPath: string }> {
    const folderName = path.basename(folderPath);
    const symlinkPath = path.join(this.logsDir, folderName);

    await fs.symlink(folderPath, symlinkPath, 'dir');
    return { folderName, symlinkPath };
  }

  public async removeFolder(name: string): Promise<void> {
    const symlinkPath = path.join(this.logsDir, name);
    await fs.unlink(symlinkPath);
  }

  public async handleFileEvent(event: 'add' | 'change' | 'unlink', filePath: string): Promise<ConversationLogEvent | null> {
    if (!isSupportedLogFile(filePath)) {
      return null;
    }

    if (isOpenCodeDatabasePath(filePath)) {
      if (event === 'unlink') {
        const removedIds = this.removeOpenCodeDatabaseSummaries(filePath);
        await this.persistCache();
        return removedIds.length > 0 ? { event, id: removedIds[0] } : null;
      }

      await this.upsertOpenCodeDatabase(filePath);
      await this.persistCache();
      return { event };
    }

    if (event === 'unlink') {
      const relativePath = path.relative(path.resolve(this.logsDir), path.resolve(filePath));
      const id = encodeConversationId(relativePath);
      this.summaries.delete(id);
      this.statusStore.delete(id);
      this.persistedEntries.delete(filePath);
      ParserService.evict(filePath);
      await this.persistCache();
      return { event, id };
    }

    const result = await this.upsertFile(filePath);
    if (!result) {
      return null;
    }

    return {
      event,
      id: result.summary.id,
      conversation: result.summary,
    };
  }

  private async getSingleConversation(summary: ConversationSummary): Promise<Conversation | null> {
    try {
      const conversation = await ParserService.parseFile(summary.filePath);
      return {
        ...conversation,
        messages: this.sortMessagesNewestFirst(conversation.messages),
        id: summary.id,
        status: summary.status,
        project: summary.project,
        projectPath: summary.projectPath,
      };
    } catch {
      return null;
    }
  }

  private async upsertFile(filePath: string): Promise<UpsertResult | null> {
    if (isOpenCodeDatabasePath(filePath)) {
      await this.upsertOpenCodeDatabase(filePath);
      return null;
    }

    try {
      const relativePath = path.relative(path.resolve(this.logsDir), path.resolve(filePath));
      const id = encodeConversationId(relativePath);
      const stats = await fs.stat(filePath);
      const cachedEntry = this.persistedEntries.get(filePath);
      let parsed: ParsedConversationSummary;
      let source: 'parsed' | 'cache-hit' = 'parsed';

      if (cachedEntry && cachedEntry.mtimeMs === stats.mtimeMs && cachedEntry.size === stats.size) {
        parsed = cachedEntry.summary;
        source = 'cache-hit';
      } else {
        parsed = await ParserService.parseSummary(filePath);
      }

      const { project, projectPath } = getProjectData(
        relativePath,
        parsed.workspacePath,
        parsed.agentType
      );

      const summary: ConversationSummary = {
        ...parsed,
        id,
        status: this.statusStore.get(id) || 'active',
        project,
        projectPath,
        relativePath,
      };

      this.summaries.set(id, summary);
      this.persistedEntries.set(filePath, {
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        summary,
      });
      return {
        source,
        summary,
      };
    } catch {
      return null;
    }
  }

  private removeOpenCodeDatabaseSummaries(filePath: string): string[] {
    const resolvedDbPath = path.resolve(filePath);
    const removedIds: string[] = [];

    Array.from(this.summaries.entries()).forEach(([id, summary]) => {
      const parsedPath = parseOpenCodeSessionVirtualPath(summary.filePath);
      if (!parsedPath || path.resolve(parsedPath.dbPath) !== resolvedDbPath) {
        return;
      }

      this.summaries.delete(id);
      this.statusStore.delete(id);
      this.persistedEntries.delete(summary.filePath);
      ParserService.evict(summary.filePath);
      removedIds.push(id);
    });

    this.persistedEntries.delete(filePath);
    ParserService.evict(filePath);

    return removedIds;
  }

  private async upsertOpenCodeDatabase(filePath: string): Promise<void> {
    const resolvedDbPath = path.resolve(filePath);
    const stats = await fs.stat(resolvedDbPath);
    const sessions = await OpenCodeDbService.listSessions(resolvedDbPath);
    const activeVirtualPaths = new Set<string>();

    sessions.forEach((session) => {
      const virtualPath = createOpenCodeSessionVirtualPath(resolvedDbPath, session.sessionId);
      activeVirtualPaths.add(virtualPath);

      const relativePath = path.relative(path.resolve(this.logsDir), virtualPath);
      const id = encodeConversationId(relativePath);
      const parsed: ParsedConversationSummary = {
        agentType: 'opencode',
        timestamp: session.timestamp,
        title: session.title,
        filePath: virtualPath,
        messageCount: session.messageCount,
        workspacePath: session.workspacePath,
      };
      const { project, projectPath } = getProjectData(
        relativePath,
        parsed.workspacePath,
        parsed.agentType
      );

      const summary: ConversationSummary = {
        ...parsed,
        id,
        status: this.statusStore.get(id) || 'active',
        project,
        projectPath,
        relativePath,
      };

      this.summaries.set(id, summary);
      this.persistedEntries.set(virtualPath, {
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        summary,
      });
    });

    Array.from(this.summaries.entries()).forEach(([id, summary]) => {
      const parsedPath = parseOpenCodeSessionVirtualPath(summary.filePath);
      if (!parsedPath || path.resolve(parsedPath.dbPath) !== resolvedDbPath) {
        return;
      }

      if (activeVirtualPaths.has(summary.filePath)) {
        return;
      }

      this.summaries.delete(id);
      this.statusStore.delete(id);
      this.persistedEntries.delete(summary.filePath);
      ParserService.evict(summary.filePath);
    });
  }

  private async persistCache(): Promise<void> {
    await this.cacheService.save(this.persistedEntries);
  }

  private sortMessagesNewestFirst<T extends { timestamp?: string }>(messages: T[]): T[] {
    return [...messages]
      .map((message, index) => ({ message, index }))
      .sort((left, right) => {
        const leftTime = left.message.timestamp ? new Date(left.message.timestamp).getTime() : 0;
        const rightTime = right.message.timestamp ? new Date(right.message.timestamp).getTime() : 0;

        if (leftTime === rightTime) {
          return right.index - left.index;
        }

        return rightTime - leftTime;
      })
      .map((entry) => entry.message);
  }
}
