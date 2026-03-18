import os from 'os';
import path from 'path';

const APP_DIR_NAME = 'agents-cli-chat-viewer';

const resolveXdgPath = (
  explicitValue: string | undefined,
  xdgValue: string | undefined,
  fallbackSegments: string[]
): string => {
  if (explicitValue?.trim()) {
    return path.resolve(explicitValue);
  }

  if (xdgValue?.trim()) {
    return path.resolve(xdgValue, APP_DIR_NAME);
  }

  return path.resolve(os.homedir(), ...fallbackSegments, APP_DIR_NAME);
};

export const getRuntimePaths = (backendRoot: string) => {
  const configDir = resolveXdgPath(
    process.env.AGENTS_CLI_CHAT_VIEWER_CONFIG_DIR,
    process.env.XDG_CONFIG_HOME,
    ['.config']
  );
  const dataDir = resolveXdgPath(
    process.env.AGENTS_CLI_CHAT_VIEWER_DATA_DIR,
    process.env.XDG_DATA_HOME,
    ['.local', 'share']
  );

  return {
    backendRoot,
    frontendDistDir: path.resolve(backendRoot, '../frontend/dist'),
    logsDir: path.resolve(process.env.LOGS_DIR || path.join(dataDir, 'logs')),
    watchFoldersConfigPath: path.resolve(
      process.env.WATCH_FOLDERS_CONFIG || path.join(configDir, 'watch-folders.json')
    ),
    conversationIndexCachePath: path.resolve(
      process.env.CONVERSATION_INDEX_CACHE || path.join(configDir, 'conversation-index-cache.json')
    ),
  };
};
