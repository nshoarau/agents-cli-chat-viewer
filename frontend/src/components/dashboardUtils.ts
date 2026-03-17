import type { ConversationSummary } from '../types';

export const getNextConversationIdAfterDelete = (
  conversations: ConversationSummary[],
  deletedId: string
): string | undefined => {
  const deletedIndex = conversations.findIndex((item) => item.id === deletedId);

  if (deletedIndex === -1) {
    return undefined;
  }

  return conversations[deletedIndex + 1]?.id ?? conversations[deletedIndex - 1]?.id;
};
