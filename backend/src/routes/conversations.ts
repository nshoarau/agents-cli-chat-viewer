import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConversationIndex } from '../services/conversationRuntime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAX_FILE_PREVIEW_BYTES = 200_000;
const MARKDOWN_LINK_PATTERN = /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const GENERIC_PATH_PATTERN =
  /(?:^|[\s([{"'`])((?:\/[\w.@-]+)+|(?:\.{1,2}\/)?(?:[\w-]+\/)+[\w.@-]+|(?:\.{1,2}\/)?[\w-]+(?:\/[\w.-]+)*\.[A-Za-z0-9]+)\b/g;
const EXTENSIONLESS_FILE_NAMES = new Set([
  'dockerfile',
  'makefile',
  'gemfile',
  'procfile',
  'rakefile',
  'justfile',
  'brewfile',
  'podfile',
  'cartfile',
  'vagrantfile',
  'jenkinsfile',
]);

export const conversationRouter = Router();

const normalizePathCandidate = (value: string): string => value.trim().replace(/[),.:;!?]+$/, '');
const WSL_DISTRIBUTION_NAME = process.env.WSL_DISTRO_NAME;

const isDomainLike = (value: string): boolean =>
  /^(?:\d{1,3}\.){1,3}\d{1,3}(?::\d+)?$/.test(value) ||
  /^(?:localhost|(?:[\w-]+\.)+[A-Za-z]{2,})(?::\d+)?$/.test(value) ||
  /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/|$)/.test(value) ||
  /^(?:localhost|(?:[\w-]+\.)+[A-Za-z]{2,})(?::\d+)?(?:\/|$)/.test(value);

const hasFileLikeBaseName = (value: string): boolean => {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '');
  const baseName = normalized.split('/').pop() ?? normalized;
  const lowerBaseName = baseName.toLocaleLowerCase();

  return (
    lowerBaseName.includes('.') ||
    lowerBaseName.startsWith('.') ||
    EXTENSIONLESS_FILE_NAMES.has(lowerBaseName)
  );
};

const isPreviewablePathReference = (value: string): boolean => {
  if (
    !value ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('mailto:') ||
    value.startsWith('#') ||
    isDomainLike(value)
  ) {
    return false;
  }

  return hasFileLikeBaseName(value);
};

const extractMessageFileReferences = (content: string): string[] => {
  const references = new Set<string>();

  for (const match of content.matchAll(MARKDOWN_LINK_PATTERN)) {
    const candidate = normalizePathCandidate(match[1] ?? '');
    if (isPreviewablePathReference(candidate)) {
      references.add(candidate);
    }
  }

  const contentWithoutMarkdownLinks = content.replace(MARKDOWN_LINK_PATTERN, ' ');

  for (const match of contentWithoutMarkdownLinks.matchAll(GENERIC_PATH_PATTERN)) {
    const candidate = normalizePathCandidate(match[1] ?? '');
    if (isPreviewablePathReference(candidate)) {
      references.add(candidate);
    }
  }

  return [...references];
};

const resolvePreviewCandidates = (
  filePath: string,
  options?: {
    projectPath?: string;
    conversationFilePath?: string;
  }
): string[] => {
  const candidates = new Set<string>();
  const { projectPath, conversationFilePath } = options ?? {};

  if (path.isAbsolute(filePath)) {
    candidates.add(path.resolve(filePath));
  }

  if (projectPath) {
    candidates.add(path.resolve(projectPath, filePath));
    if (filePath.startsWith(path.sep)) {
      candidates.add(path.resolve(projectPath, `.${filePath}`));
    }
  }

  if (conversationFilePath) {
    const conversationDir = path.dirname(conversationFilePath);
    candidates.add(path.resolve(conversationDir, filePath));
    if (filePath.startsWith(path.sep)) {
      candidates.add(path.resolve(conversationDir, `.${filePath}`));
    }
  }

  candidates.add(path.resolve(process.cwd(), filePath));
  if (filePath.startsWith(path.sep)) {
    candidates.add(path.resolve(process.cwd(), `.${filePath}`));
  }

  return [...candidates];
};

const toEditorPath = (resolvedPath: string): string => {
  if (!WSL_DISTRIBUTION_NAME || !path.isAbsolute(resolvedPath) || /^[A-Za-z]:[\\/]/.test(resolvedPath)) {
    return resolvedPath;
  }

  const normalizedPath = resolvedPath.replace(/\//g, '\\');
  return `\\\\wsl.localhost\\${WSL_DISTRIBUTION_NAME}${normalizedPath}`;
};

const getLogsDir = () => process.env.LOGS_DIR || path.join(__dirname, '../../logs');

// List all conversations
conversationRouter.get('/', async (req, res) => {
  try {
    const agentType =
      req.query.agentType === 'claude' ||
      req.query.agentType === 'codex' ||
      req.query.agentType === 'gemini'
        ? req.query.agentType
        : undefined;
    const offset = Number.parseInt(String(req.query.offset || '0'), 10);
    const limit = Number.parseInt(String(req.query.limit || '200'), 10);

    res.json(getConversationIndex().listConversations(agentType, offset, limit));
  } catch (error) {
    console.error('List failed:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// Get detailed conversation
conversationRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const includeProject = req.query.includeProject === 'true';
    const conversation = await getConversationIndex().getConversation(id, includeProject);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Fetch detail failed:', error);
    res.status(500).json({ error: 'Failed to fetch conversation detail' });
  }
});

conversationRouter.get('/:id/files/content', async (req, res) => {
  try {
    const { id } = req.params;
    const requestedPath = String(req.query.path || '');

    if (!requestedPath) {
      return res.status(400).json({ error: 'A file path is required.' });
    }

    const conversation = await getConversationIndex().getConversation(id, false);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const allowedPaths = new Set<string>(
      [
        ...(conversation.sessionActivity?.filesTouched ?? []),
        ...(conversation.sessionActivity?.toolCalls
          .map((toolCall) => toolCall.filePath)
          .filter((filePath): filePath is string => Boolean(filePath)) ?? []),
        ...(conversation.messages ?? []).flatMap((message) =>
          extractMessageFileReferences(message.content ?? '')
        ),
      ].flatMap((filePath) =>
        resolvePreviewCandidates(filePath, {
          projectPath: conversation.projectPath,
          conversationFilePath: conversation.filePath,
        })
      )
    );

    const requestedCandidates = resolvePreviewCandidates(requestedPath, {
      projectPath: conversation.projectPath,
      conversationFilePath: conversation.filePath,
    });
    const matchedPath = requestedCandidates.find((candidate) => allowedPaths.has(candidate));

    if (!matchedPath) {
      return res.status(403).json({ error: 'File is not available for this conversation preview.' });
    }

    const stats = await fs.stat(matchedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Only regular files can be previewed.' });
    }

    const fileHandle = await fs.open(matchedPath, 'r');
    const bytesToRead = Math.min(stats.size, MAX_FILE_PREVIEW_BYTES);
    const buffer = Buffer.alloc(bytesToRead);
    await fileHandle.read(buffer, 0, bytesToRead, 0);
    await fileHandle.close();

    return res.json({
      filePath: matchedPath,
      editorPath: toEditorPath(matchedPath),
      content: buffer.toString('utf-8'),
      truncated: stats.size > MAX_FILE_PREVIEW_BYTES,
    });
  } catch (error) {
    console.error('File preview failed:', error);
    return res.status(500).json({ error: 'Failed to load file preview.' });
  }
});

// Update status (Archive/Restore)
conversationRouter.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== 'active' && status !== 'archived') {
    return res.status(400).json({ error: 'Invalid status' });
  }

  if (!getConversationIndex().updateStatus(id, status)) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  res.status(204).send();
});

// Delete conversation (and file)
conversationRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await getConversationIndex().deleteConversation(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Add a folder to watch (via symlink)
conversationRouter.post('/folders', async (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: 'folderPath is required' });
    }

    const logsDir = getLogsDir();
    const folderName = path.basename(folderPath);
    const symlinkPath = path.join(logsDir, folderName);

    // Check if the symlink or folder already exists in logsDir
    try {
      await fs.access(symlinkPath);
      return res.status(400).json({ error: 'A folder with this name already exists in logs' });
    } catch (e) {
      // Doesn't exist, proceed
    }

    await getConversationIndex().addFolder(folderPath);
    res.json({ message: `Linked ${folderPath} to ${symlinkPath}` });
  } catch (error) {
    console.error('Failed to link folder:', error);
    res.status(500).json({ error: 'Failed to link folder' });
  }
});

// Remove a folder from watch list (delete symlink)
conversationRouter.delete('/folders/:name', async (req, res) => {
  try {
    const { name } = req.params;
    if (name === 'General') {
      return res.status(400).json({ error: 'Cannot delete the root logs folder' });
    }

    const logsDir = getLogsDir();
    const symlinkPath = path.join(logsDir, name);

    // Verify it exists and is a symlink (security check)
    try {
      const stats = await fs.lstat(symlinkPath);
      if (!stats.isSymbolicLink()) {
        return res.status(400).json({ error: 'Only added folders (symlinks) can be deleted' });
      }
    } catch (e) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    await getConversationIndex().removeFolder(name);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to remove folder:', error);
    res.status(500).json({ error: 'Failed to remove folder' });
  }
});
