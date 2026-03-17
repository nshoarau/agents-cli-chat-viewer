import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

export interface WatchFolderEntry {
  id: string;
  label: string;
  sourcePath: string;
  targetName: string;
  kind: 'default' | 'custom' | 'legacy';
}

interface WatchFoldersConfigFile {
  version: 1;
  folders: WatchFolderEntry[];
}

const DEFAULT_CONFIG: WatchFoldersConfigFile = {
  version: 1,
  folders: [],
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'watch-folder';

const randomId = (): string => crypto.randomBytes(6).toString('hex');

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const defaultFolderCandidates = () => {
  const homeDir = os.homedir();

  return [
    {
      label: 'Claude Projects',
      sourcePath: path.join(homeDir, '.claude/projects'),
      targetName: 'claude-projects',
      kind: 'default' as const,
    },
    {
      label: 'Codex Sessions',
      sourcePath: path.join(homeDir, '.codex/sessions'),
      targetName: 'codex-sessions',
      kind: 'default' as const,
    },
    {
      label: 'Gemini Chats',
      sourcePath: path.join(homeDir, '.gemini/tmp'),
      targetName: 'gemini-chats',
      kind: 'default' as const,
    },
  ];
};

export class WatchFoldersConfigService {
  private config: WatchFoldersConfigFile = DEFAULT_CONFIG;

  constructor(
    private readonly logsDir: string,
    private readonly configPath: string
  ) {}

  public async initialize(): Promise<void> {
    this.config = await this.loadConfig();
    this.config.folders = await this.mergeDiscoveredFolders(this.config.folders);
    await this.ensureLinks();
    await this.saveConfig();
  }

  public listFolders(): WatchFolderEntry[] {
    return [...this.config.folders].sort((left, right) => left.label.localeCompare(right.label));
  }

  public async addFolder(sourcePath: string, label?: string): Promise<WatchFolderEntry> {
    const absoluteSourcePath = path.resolve(sourcePath);
    const stats = await fs.stat(absoluteSourcePath);
    if (!stats.isDirectory() && !stats.isFile()) {
      throw new Error('Path must be a file or directory');
    }

    const existing = this.config.folders.find(
      (entry) => path.resolve(entry.sourcePath) === absoluteSourcePath
    );
    if (existing) {
      return existing;
    }

    const entry: WatchFolderEntry = {
      id: randomId(),
      label: label?.trim() || path.basename(absoluteSourcePath),
      sourcePath: absoluteSourcePath,
      targetName: this.createUniqueTargetName(label?.trim() || path.basename(absoluteSourcePath)),
      kind: 'custom',
    };

    this.config.folders.push(entry);
    await this.ensureLink(entry);
    await this.saveConfig();
    return entry;
  }

  public async removeFolder(id: string): Promise<boolean> {
    const entry = this.config.folders.find((folder) => folder.id === id);
    if (!entry) {
      return false;
    }

    const targetPath = path.join(this.logsDir, entry.targetName);
    if (await pathExists(targetPath)) {
      await fs.unlink(targetPath);
    }

    this.config.folders = this.config.folders.filter((folder) => folder.id !== id);
    await this.saveConfig();
    return true;
  }

  private async loadConfig(): Promise<WatchFoldersConfigFile> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw) as WatchFoldersConfigFile;
      if (!Array.isArray(parsed.folders)) {
        return { ...DEFAULT_CONFIG };
      }

      return {
        version: 1,
        folders: parsed.folders,
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  private async saveConfig(): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  private async mergeDiscoveredFolders(existingEntries: WatchFolderEntry[]): Promise<WatchFolderEntry[]> {
    const merged = [...existingEntries];

    for (const candidate of defaultFolderCandidates()) {
      if (!(await pathExists(candidate.sourcePath))) {
        continue;
      }

      const alreadyTracked = merged.some(
        (entry) => path.resolve(entry.sourcePath) === path.resolve(candidate.sourcePath)
      );
      if (alreadyTracked) {
        continue;
      }

      merged.push({
        id: randomId(),
        ...candidate,
      });
    }

    const directChildren = await fs.readdir(this.logsDir, { withFileTypes: true });
    for (const child of directChildren) {
      if (!child.isSymbolicLink()) {
        continue;
      }

      const targetName = child.name;
      const targetPath = path.join(this.logsDir, targetName);
      let sourcePath: string;
      try {
        sourcePath = await fs.realpath(targetPath);
      } catch {
        continue;
      }
      const alreadyTracked = merged.some((entry) => entry.targetName === targetName);
      if (alreadyTracked) {
        continue;
      }

      merged.push({
        id: randomId(),
        label: targetName,
        sourcePath,
        targetName,
        kind: 'legacy',
      });
    }

    return merged;
  }

  private async ensureLinks(): Promise<void> {
    await Promise.all(this.config.folders.map(async (entry) => this.ensureLink(entry)));
  }

  private async ensureLink(entry: WatchFolderEntry): Promise<void> {
    const targetPath = path.join(this.logsDir, entry.targetName);
    const sourceExists = await pathExists(entry.sourcePath);
    if (!sourceExists) {
      return;
    }

    if (await pathExists(targetPath)) {
      const realTarget = await fs.realpath(targetPath).catch(() => null);
      if (realTarget === path.resolve(entry.sourcePath)) {
        return;
      }

      const targetStats = await fs.lstat(targetPath);
      if (targetStats.isSymbolicLink()) {
        await fs.unlink(targetPath);
      } else {
        return;
      }
    }

    const sourceStats = await fs.stat(entry.sourcePath);
    await fs.symlink(entry.sourcePath, targetPath, sourceStats.isDirectory() ? 'dir' : 'file');
  }

  private createUniqueTargetName(label: string): string {
    const base = slugify(label);
    const existing = new Set(this.config.folders.map((entry) => entry.targetName));

    if (!existing.has(base)) {
      return base;
    }

    let suffix = 2;
    while (existing.has(`${base}-${suffix}`)) {
      suffix += 1;
    }

    return `${base}-${suffix}`;
  }
}
