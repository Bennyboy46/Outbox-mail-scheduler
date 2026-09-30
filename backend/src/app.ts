import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './config/db';
import emailRoutes from './routes/emailRoutes';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './services/emailQueue';
import { requireAdmin } from './middleware/auth';
import slackRoutes from './routes/slackRoutes';
import senderRoutes from './routes/senderRoutes';

dotenv.config();

const app = express();
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));



app.use(express.json());

// Health check endpoint verifying service and database status
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      service: 'Outbox / ReachInbox Email Scheduler Backend'
    });
  } catch (error: any) {
    console.error('[Health] Database check failed:', error?.message || error);
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: 'Database unavailable',
      timestamp: new Date().toISOString(),
      service: 'Outbox / ReachInbox Email Scheduler Backend'
    });
  }
});

// Email scheduling and tracking API routes
app.use('/api/emails', emailRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/senders', senderRoutes);

const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath('/api/admin/queues');
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: bullBoardAdapter,
});
app.use('/api/admin/queues', requireAdmin, bullBoardAdapter.getRouter());

app.use((error: any, _req: Request, res: Response, _next: Function) => {
  console.error('[API] Unhandled request error:', error?.message || error);
  res.status(Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500 ? error.statusCode : 500).json({
    error: 'Request failed',
    message: 'The request could not be completed.',
  });
});

export default app;
