import { Router } from 'express';
import { eventRouter } from './events.js';
import { conversationRouter } from './conversations.js';
import { configRouter } from './config.js';

export const apiRouter = Router();

// Test health route
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/events', eventRouter);
apiRouter.use('/config', configRouter);
apiRouter.use('/conversations', conversationRouter);
