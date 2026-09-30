import 'dotenv/config';
import app from './app';
import prisma from './config/db';

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`[Backend] Scheduler service running on http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
  console.log('[Backend] SIGTERM received. Shutting down gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('[Backend] SIGINT received. Shutting down gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

export default server;
