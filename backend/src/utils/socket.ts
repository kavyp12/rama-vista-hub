// backend/src/utils/socket.ts
// Node.js only — NO browser APIs here. Just a singleton for the Socket.io Server instance.

import { Server } from 'socket.io';

let io: Server;

export const initIO = (server: Server): void => {
  io = server;
};

export const getIO = (): Server => {
  if (!io) throw new Error('[Socket] io not initialized. Call initIO() first.');
  return io;
};