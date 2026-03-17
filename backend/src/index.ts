import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { apiRouter } from './routes/index.js';
import { WatcherService } from './services/watcherService.js';
import { broadcastLogUpdate } from './routes/events.js';
import { initializeConversationIndex } from './services/conversationRuntime.js';
import { initializeWatchFoldersConfig } from './services/watchFoldersRuntime.js';

dotenv.config();

const WATCHER_VERBOSE_LOGS = process.env.WATCHER_VERBOSE_LOGS === 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const logsDir = process.env.LOGS_DIR || path.join(__dirname, '../logs');
const watchFoldersConfigPath =
  process.env.WATCH_FOLDERS_CONFIG || path.join(__dirname, '../config/watch-folders.json');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

await initializeWatchFoldersConfig(logsDir, watchFoldersConfigPath);
const conversationIndex = await initializeConversationIndex(logsDir);

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Initialize and start log watcher
const watcher = new WatcherService(logsDir);
watcher.on('log-event', async (data) => {
  const event = await conversationIndex.handleFileEvent(data.event, data.filePath);
  if (!event) {
    return;
  }

  if (WATCHER_VERBOSE_LOGS) {
    console.log('Broadcasting log event:', event);
  }
  broadcastLogUpdate(event);
});
watcher.start();

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  console.log(`Watching logs in: ${logsDir}`);
  console.log('Conversation index stats:', conversationIndex.getStats());
  if (!WATCHER_VERBOSE_LOGS) {
    console.log('Watcher event logging is compact. Set WATCHER_VERBOSE_LOGS=true for per-file logs.');
  }
});

export default app;
