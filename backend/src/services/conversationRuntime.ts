import path from 'path';
import { ConversationIndexCacheService } from './conversationIndexCacheService.js';
import { ConversationIndexService } from './conversationIndexService.js';

let conversationIndex: ConversationIndexService | null = null;

export const initializeConversationIndex = async (logsDir: string): Promise<ConversationIndexService> => {
  const cacheService = new ConversationIndexCacheService(
    path.join(logsDir, '../config/conversation-index-cache.json')
  );
  const index = new ConversationIndexService(logsDir, cacheService);
  await index.initialize();
  conversationIndex = index;
  return index;
};

export const getConversationIndex = (): ConversationIndexService => {
  if (!conversationIndex) {
    throw new Error('Conversation index has not been initialized');
  }

  return conversationIndex;
};
