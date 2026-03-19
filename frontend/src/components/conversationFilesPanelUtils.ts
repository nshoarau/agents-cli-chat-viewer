import type { Conversation } from '../types';
import { toDisplayFilePath } from './displayFilePath';
import {
  extractMessageFileReferences,
  isPreviewablePathReference,
  toPreviewablePathReference,
} from './fileReferenceUtils';

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

interface InternalConversationFileEntry extends ConversationFileEntry {
  openPathPriority: number;
}

const ROOT_FOLDER_LABEL = '(root)';

const normalizePath = (value: string): string => value.replace(/\\/g, '/');
const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');
const isAbsolutePath = (value: string): boolean =>
  value.startsWith('/') || value.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(value);
const isSingleSegmentFileName = (value: string): boolean => {
  const normalized = trimTrailingSlash(normalizePath(value));

  if (!normalized || normalized.includes('/')) {
    return false;
  }

  const baseName = normalized.split('/').pop() ?? normalized;
  return (
    (baseName.includes('.') && !baseName.endsWith('.')) ||
    baseName.startsWith('.')
  );
};
const isPreviewableActivityPathReference = (value: string): boolean =>
  isPreviewablePathReference(value) || isSingleSegmentFileName(toPreviewablePathReference(value));

const toCanonicalPreviewPath = (filePath: string, projectPath?: string): string => {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedProjectPath = projectPath ? trimTrailingSlash(normalizePath(projectPath)) : undefined;

  if (normalizedProjectPath && normalizedFilePath.startsWith(`${normalizedProjectPath}/`)) {
    return normalizedFilePath.slice(normalizedProjectPath.length + 1);
  }

  return normalizedFilePath;
};

const shouldMergePreviewPaths = (leftPath: string, rightPath: string): boolean => {
  const normalizedLeftPath = normalizePath(leftPath);
  const normalizedRightPath = normalizePath(rightPath);
  const leftIsAbsolute = isAbsolutePath(normalizedLeftPath);
  const rightIsAbsolute = isAbsolutePath(normalizedRightPath);

  if (normalizedLeftPath === normalizedRightPath) {
    return true;
  }

  if (leftIsAbsolute !== rightIsAbsolute) {
    const absolutePath = leftIsAbsolute ? normalizedLeftPath : normalizedRightPath;
    const relativePath = leftIsAbsolute ? normalizedRightPath : normalizedLeftPath;
    return absolutePath.endsWith(`/${relativePath}`);
  }

  return false;
};

const openPathScore = (value: string, priority: number): number => {
  const absoluteBonus = isAbsolutePath(value) ? 100_000 : 0;
  return priority * 10_000 + absoluteBonus - value.length;
};

const pickPreferredOpenPath = (
  currentPath: string,
  currentPriority: number,
  nextPath: string,
  nextPriority: number
): string => {
  if (openPathScore(nextPath, nextPriority) > openPathScore(currentPath, currentPriority)) {
    return nextPath;
  }
  return currentPath;
};

const pickPreferredDisplayPath = (currentPath: string, nextPath: string): string => {
  if (nextPath.length < currentPath.length) {
    return nextPath;
  }

  return currentPath;
};

const toFolderPath = (displayPath: string): string => {
  const normalized = trimTrailingSlash(normalizePath(displayPath));
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

  const entries = new Map<string, InternalConversationFileEntry>();
  let eventOrder = 0;

  const touchEntry = (
    filePath: string,
    source: 'prompt' | 'activity',
    latestTimestamp: number | null,
    previewPathPriority: number,
    openPathCandidate: string
  ) => {
    const canonicalFilePath = toCanonicalPreviewPath(filePath, conversation.projectPath);
    const displayPath = toDisplayFilePath(canonicalFilePath, conversation.projectPath);
    const folderPath = toFolderPath(displayPath);
    const existingKey =
      entries.has(canonicalFilePath)
        ? canonicalFilePath
        : [...entries.keys()].find((entryKey) => {
            const entry = entries.get(entryKey);
            return (
              entry !== undefined &&
              shouldMergePreviewPaths(entry.filePath, canonicalFilePath)
            );
          });
    const existing = existingKey ? entries.get(existingKey) : undefined;

    if (!existing) {
      entries.set(canonicalFilePath, {
        filePath: normalizePath(openPathCandidate),
        displayPath,
        folderPath,
        source,
        frequency: 1,
        promptCount: source === 'prompt' ? 1 : 0,
        activityCount: source === 'activity' ? 1 : 0,
        latestTimestamp,
        latestOrder: eventOrder,
        openPathPriority: previewPathPriority,
      });
      eventOrder += 1;
      return;
    }

    existing.frequency += 1;
    existing.promptCount += source === 'prompt' ? 1 : 0;
    existing.activityCount += source === 'activity' ? 1 : 0;
    existing.filePath = pickPreferredOpenPath(
      existing.filePath,
      existing.openPathPriority,
      normalizePath(openPathCandidate),
      previewPathPriority
    );
    existing.openPathPriority = Math.max(existing.openPathPriority, previewPathPriority);
    existing.displayPath = pickPreferredDisplayPath(existing.displayPath, displayPath);
    existing.folderPath = toFolderPath(existing.displayPath);
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
      touchEntry(filePath, 'prompt', latestTimestamp, 2, filePath);
    });
  });

  conversation.sessionActivity?.toolCalls.forEach((toolCall) => {
    if (!toolCall.filePath || !isPreviewableActivityPathReference(toolCall.filePath)) {
      return;
    }

    const timestamp = toolCall.timestamp ? new Date(toolCall.timestamp).getTime() : Number.NaN;
    const previewablePath = toPreviewablePathReference(toolCall.filePath);
    touchEntry(
      previewablePath,
      'activity',
      Number.isFinite(timestamp) ? timestamp : null,
      3,
      previewablePath
    );
  });

  conversation.sessionActivity?.filesTouched.forEach((filePath) => {
    if (!isPreviewableActivityPathReference(filePath)) {
      return;
    }

    const previewablePath = toPreviewablePathReference(filePath);
    const canonicalFilePath = toCanonicalPreviewPath(previewablePath, conversation.projectPath);
    const existing = entries.get(canonicalFilePath);

    if (!existing || existing.activityCount === 0) {
      touchEntry(previewablePath, 'activity', null, 1, previewablePath);
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
