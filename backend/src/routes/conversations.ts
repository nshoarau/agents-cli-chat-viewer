import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConversationIndex } from '../services/conversationRuntime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const conversationRouter = Router();

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
