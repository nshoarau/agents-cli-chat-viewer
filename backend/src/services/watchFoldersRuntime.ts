import { WatchFoldersConfigService } from './watchFoldersConfigService.js';

let watchFoldersConfig: WatchFoldersConfigService | null = null;

export const initializeWatchFoldersConfig = async (
  logsDir: string,
  configPath: string
): Promise<WatchFoldersConfigService> => {
  const service = new WatchFoldersConfigService(logsDir, configPath);
  await service.initialize();
  watchFoldersConfig = service;
  return service;
};

export const getWatchFoldersConfig = (): WatchFoldersConfigService => {
  if (!watchFoldersConfig) {
    throw new Error('Watch folders config has not been initialized');
  }

  return watchFoldersConfig;
};
