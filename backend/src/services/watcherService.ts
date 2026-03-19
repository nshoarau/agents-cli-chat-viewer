import { watch, FSWatcher } from 'chokidar';
import path from 'path';
import EventEmitter from 'events';

const WATCHER_VERBOSE_LOGS = process.env.WATCHER_VERBOSE_LOGS === 'true';
const IGNORED_PATH_SEGMENTS = new Set([
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

export class WatcherService extends EventEmitter {
  private watcher: FSWatcher | null = null;

  constructor(private logsDir: string) {
    super();
  }

  public start() {
    if (this.watcher) return;

    console.log(`Watching directory: ${this.logsDir}`);

    this.watcher = watch(this.logsDir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      ignoreInitial: true,
      persistent: true,
      depth: 5, // Increase depth to see into symlinked folders and subfolders
      followSymlinks: true,
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange('add', filePath))
      .on('change', (filePath) => this.handleFileChange('change', filePath))
      .on('unlink', (filePath) => this.handleFileChange('unlink', filePath))
      .on('error', (error) => console.error(`Watcher error: ${error}`));
  }

  public stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private handleFileChange(event: 'add' | 'change' | 'unlink', filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    const isOpenCodeDb = path.basename(filePath) === 'opencode.db';
    const isCursorChatDb =
      path.basename(filePath) === 'store.db' &&
      (
        filePath.includes(`${path.sep}.cursor${path.sep}chats${path.sep}`) ||
        filePath.includes(`${path.sep}cursor-chats${path.sep}`)
      );
    const segments = filePath.split(path.sep);
    const hasIgnoredSegment = segments.some((segment) => IGNORED_PATH_SEGMENTS.has(segment));

    if (!hasIgnoredSegment && (['.json', '.jsonl', '.md'].includes(ext) || isOpenCodeDb || isCursorChatDb)) {
      if (WATCHER_VERBOSE_LOGS) {
        console.log(`File ${event}: ${filePath}`);
      }
      this.emit('log-event', { event, filePath, fileName: path.basename(filePath) });
    }
  }
}
