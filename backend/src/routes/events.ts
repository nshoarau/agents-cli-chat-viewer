import { Router, type Response } from 'express';

export const eventRouter = Router();

// Store active SSE clients
let clients: Response[] = [];

eventRouter.get('/', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Add this client to the clients list
  clients.push(res);

  // Remove client when they disconnect
  req.on('close', () => {
    clients = clients.filter((client) => client !== res);
  });
});

// Broadcast log updates to all connected clients
export function broadcastLogUpdate(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach((client) => client.write(message));
}
