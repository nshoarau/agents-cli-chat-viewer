import fs from 'fs/promises';
import path from 'path';
import type { ConversationSummary } from './conversationIndexService.js';

export interface CachedConversationEntry {
  mtimeMs: number;
  size: number;
  summary: ConversationSummary;
}

interface ConversationIndexCacheFile {
  version: 1;
  entries: Record<string, CachedConversationEntry>;
}

export class ConversationIndexCacheService {
  constructor(private readonly cachePath: string) {}

  public async load(): Promise<Map<string, CachedConversationEntry>> {
    try {
      const raw = await fs.readFile(this.cachePath, 'utf-8');
      const parsed = JSON.parse(raw) as ConversationIndexCacheFile;
      if (parsed.version !== 1 || !parsed.entries) {
        return new Map();
      }

      return new Map(Object.entries(parsed.entries));
    } catch {
      return new Map();
    }
  }

  public async save(entries: Map<string, CachedConversationEntry>): Promise<void> {
    await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
    const payload: ConversationIndexCacheFile = {
      version: 1,
      entries: Object.fromEntries(entries.entries()),
    };
    await fs.writeFile(this.cachePath, JSON.stringify(payload));
  }
}
