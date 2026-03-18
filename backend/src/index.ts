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
import { getRuntimePaths } from './config/runtimePaths.js';

dotenv.config();

const WATCHER_VERBOSE_LOGS = process.env.WATCHER_VERBOSE_LOGS === 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const runtimePaths = getRuntimePaths(backendRoot);

const app = express();
const port = process.env.PORT || 3000;
const logsDir = runtimePaths.logsDir;
const watchFoldersConfigPath = runtimePaths.watchFoldersConfigPath;

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

await initializeWatchFoldersConfig(logsDir, watchFoldersConfigPath);
const conversationIndex = await initializeConversationIndex(logsDir, runtimePaths.conversationIndexCachePath);

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

if (fs.existsSync(runtimePaths.frontendDistDir)) {
  app.use(express.static(runtimePaths.frontendDistDir));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }

    res.sendFile(path.join(runtimePaths.frontendDistDir, 'index.html'));
  });
}

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
  console.log(`Watch-folder config: ${watchFoldersConfigPath}`);
  console.log('Conversation index stats:', conversationIndex.getStats());
  if (fs.existsSync(runtimePaths.frontendDistDir)) {
    console.log(`Serving frontend from: ${runtimePaths.frontendDistDir}`);
  } else {
    console.log('Frontend build not found. Run `npm run build --prefix frontend` for production assets.');
  }
  if (!WATCHER_VERBOSE_LOGS) {
    console.log('Watcher event logging is compact. Set WATCHER_VERBOSE_LOGS=true for per-file logs.');
  }
});

export default app;
