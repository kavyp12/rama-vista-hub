// backend/src/index.ts
import express, { Application } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { prisma } from './utils/prisma';
import { initIO, getIO } from './utils/socket';
import { sendPushToUser } from './utils/webpush';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uplodall')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', routes);

// Error Handler
app.use(errorHandler);

// ─── Socket.io Setup ───────────────────────────────────────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
  }
});

// Each agent joins a private room named "user:<their-userId>"
// Frontend emits 'join' with userId right after connecting
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('join', (userId: string) => {
    socket.join(`user:${userId}`);
    console.log(`[Socket] User ${userId} joined room user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Share the io instance with the rest of the app (controllers use it)
initIO(io);
// ───────────────────────────────────────────────────────────────────────────

// ─── Cron Jobs (DB-backed, survives restarts) ──────────────────────────────

const startCronJobs = () => {
  const checkFollowUps = async () => {
    try {
      const now = new Date();
      // Only fetch tasks that haven't been notified yet (lastNotifiedAt: null)
      // This guard survives server restarts — no in-memory state needed
      const pendingTasks = await prisma.followUpTask.findMany({
        where: {
          status: 'pending',
          scheduledAt: { lte: now },
          lastNotifiedAt: null   // ← DB-backed: only notify once per task
        },
        include: { lead: true }
      });

      for (const task of pendingTasks) {
        // Mark as notified in DB FIRST — crash-safe, prevents double-send
        await prisma.followUpTask.update({
          where: { id: task.id },
          data: { lastNotifiedAt: new Date() }
        });

        // Send Web Push (Background PWA Notification)
        await sendPushToUser(task.agentId, {
          title: '⏰ Follow-up Reminder',
          body: `Time to follow up with ${task.lead.name}.`,
          url: `/leads?highlight=${task.leadId}`,
          tag: `followup-${task.id}`
        });

        // Send Socket Notification (If tab is open)
        try {
          getIO().to(`user:${task.agentId}`).emit('followup_reminder', {
            leadId: task.leadId,
            leadName: task.lead.name,
            message: `Reminder: Follow up with ${task.lead.name}`
          });
        } catch (e) {
          console.error('[Cron] Socket emit failed:', e);
        }

        console.log(`[Cron] 🔔 Notified agent ${task.agentId} for task ${task.id}`);
      }
    } catch (error) {
      console.error('[Cron] Error checking follow-ups:', error);
    }
  };

  // Run immediately on start, then every 1 minute
  checkFollowUps();
  setInterval(checkFollowUps, 60 * 1000);
};

// Start cron jobs
startCronJobs();
// ───────────────────────────────────────────────────────────────────────────

// Start server (httpServer instead of app.listen — wraps socket.io)
const server = httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Socket.io ready`);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');

  server.close(async () => {
    console.log('✅ HTTP server closed');

    await prisma.$disconnect();
    console.log('✅ Database connection closed');

    process.exit(0);
  });

  setTimeout(() => {
    console.error('⌛ Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default app;