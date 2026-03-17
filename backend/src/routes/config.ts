import { Router } from 'express';
import { getConversationIndex } from '../services/conversationRuntime.js';
import { getWatchFoldersConfig } from '../services/watchFoldersRuntime.js';

export const configRouter = Router();

configRouter.get('/watch-folders', (req, res) => {
  try {
    res.json(getWatchFoldersConfig().listFolders());
  } catch (error) {
    console.error('Failed to list watch folders:', error);
    res.status(500).json({ error: 'Failed to list watch folders' });
  }
});

configRouter.post('/watch-folders', async (req, res) => {
  try {
    const { folderPath, label } = req.body;
    if (!folderPath || typeof folderPath !== 'string') {
      return res.status(400).json({ error: 'folderPath is required' });
    }

    const entry = await getWatchFoldersConfig().addFolder(folderPath, label);
    await getConversationIndex().rebuild();
    res.status(201).json(entry);
  } catch (error) {
    console.error('Failed to add watch folder:', error);
    res.status(500).json({ error: 'Failed to add watch folder' });
  }
});

configRouter.delete('/watch-folders/:id', async (req, res) => {
  try {
    const deleted = await getWatchFoldersConfig().removeFolder(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Watch folder not found' });
    }

    await getConversationIndex().rebuild();
    res.status(204).send();
  } catch (error) {
    console.error('Failed to remove watch folder:', error);
    res.status(500).json({ error: 'Failed to remove watch folder' });
  }
});
