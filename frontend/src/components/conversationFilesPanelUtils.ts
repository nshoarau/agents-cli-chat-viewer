import type { Conversation } from '../types';
import { toDisplayFilePath } from './displayFilePath';
import { extractMessageFileReferences } from './fileReferenceUtils';

export type ConversationFileSource = 'prompt' | 'activity' | 'both';

export interface ConversationFileEntry {
  filePath: string;
  displayPath: string;
  folderPath: string;
  source: ConversationFileSource;
  frequency: number;
  promptCount: number;
  activityCount: number;
  latestTimestamp: number | null;
  latestOrder: number;
}

export interface ConversationFileGroup {
  folderPath: string;
  files: ConversationFileEntry[];
}

const ROOT_FOLDER_LABEL = '(root)';

const normalizePath = (value: string): string => value.replace(/\\/g, '/');

const toFolderPath = (displayPath: string): string => {
  const normalized = normalizePath(displayPath).replace(/\/+$/, '');
  const lastSlashIndex = normalized.lastIndexOf('/');
  return lastSlashIndex === -1 ? ROOT_FOLDER_LABEL : normalized.slice(0, lastSlashIndex);
};

const compareByRecencyAndFrequency = (
  left: Pick<ConversationFileEntry, 'latestTimestamp' | 'latestOrder' | 'frequency' | 'displayPath'>,
  right: Pick<ConversationFileEntry, 'latestTimestamp' | 'latestOrder' | 'frequency' | 'displayPath'>
): number => {
  const leftTimestamp = left.latestTimestamp ?? Number.NEGATIVE_INFINITY;
  const rightTimestamp = right.latestTimestamp ?? Number.NEGATIVE_INFINITY;

  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  if (left.latestOrder !== right.latestOrder) {
    return right.latestOrder - left.latestOrder;
  }

  if (left.frequency !== right.frequency) {
    return right.frequency - left.frequency;
  }

  return left.displayPath.localeCompare(right.displayPath);
};

export const buildConversationFileGroups = (conversation?: Conversation): ConversationFileGroup[] => {
  if (!conversation) {
    return [];
  }

  const entries = new Map<string, ConversationFileEntry>();
  let eventOrder = 0;

  const touchEntry = (
    filePath: string,
    source: 'prompt' | 'activity',
    latestTimestamp: number | null
  ) => {
    const existing = entries.get(filePath);
    const displayPath = toDisplayFilePath(filePath, conversation.projectPath);
    const folderPath = toFolderPath(displayPath);

    if (!existing) {
      entries.set(filePath, {
        filePath,
        displayPath,
        folderPath,
        source,
        frequency: 1,
        promptCount: source === 'prompt' ? 1 : 0,
        activityCount: source === 'activity' ? 1 : 0,
        latestTimestamp,
        latestOrder: eventOrder,
      });
      eventOrder += 1;
      return;
    }

    existing.frequency += 1;
    existing.promptCount += source === 'prompt' ? 1 : 0;
    existing.activityCount += source === 'activity' ? 1 : 0;
    existing.source =
      existing.promptCount > 0 && existing.activityCount > 0
        ? 'both'
        : existing.promptCount > 0
          ? 'prompt'
          : 'activity';

    if (
      latestTimestamp !== null &&
      (existing.latestTimestamp === null || latestTimestamp >= existing.latestTimestamp)
    ) {
      existing.latestTimestamp = latestTimestamp;
      existing.latestOrder = eventOrder;
    } else if (existing.latestTimestamp === null) {
      existing.latestOrder = eventOrder;
    }

    eventOrder += 1;
  };

  conversation.messages.forEach((message) => {
    const timestamp = message.timestamp ? new Date(message.timestamp).getTime() : Number.NaN;
    const latestTimestamp = Number.isFinite(timestamp) ? timestamp : null;

    extractMessageFileReferences(message.content).forEach((filePath) => {
      touchEntry(filePath, 'prompt', latestTimestamp);
    });
  });

  conversation.sessionActivity?.toolCalls.forEach((toolCall) => {
    if (!toolCall.filePath) {
      return;
    }

    const timestamp = toolCall.timestamp ? new Date(toolCall.timestamp).getTime() : Number.NaN;
    touchEntry(toolCall.filePath, 'activity', Number.isFinite(timestamp) ? timestamp : null);
  });

  conversation.sessionActivity?.filesTouched.forEach((filePath) => {
    const existing = entries.get(filePath);

    if (!existing || existing.activityCount === 0) {
      touchEntry(filePath, 'activity', null);
    }
  });

  const groups = new Map<string, ConversationFileEntry[]>();

  [...entries.values()]
    .sort(compareByRecencyAndFrequency)
    .forEach((entry) => {
      const folderEntries = groups.get(entry.folderPath);
      if (folderEntries) {
        folderEntries.push(entry);
        return;
      }

      groups.set(entry.folderPath, [entry]);
    });

  return [...groups.entries()]
    .map(([folderPath, files]) => ({
      folderPath,
      files,
    }))
    .sort((left, right) =>
      compareByRecencyAndFrequency(left.files[0], right.files[0]) || left.folderPath.localeCompare(right.folderPath)
    );
};
