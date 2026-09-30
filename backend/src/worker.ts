import 'dotenv/config';
import { Worker } from 'bullmq';
import prisma from './config/db';
import redis from './config/redis';
import { EMAIL_QUEUE_NAME, enqueueRetryJob } from './services/emailQueue';
import { sendEmail } from './services/mailer';
import { notifyRateLimitOnce } from './services/slack';
import { indexEmail } from './services/emailSearch';
import path from 'path';
import {
  clearSendDelay,
  releaseHourlySlot,
  reserveHourlySlot,
  reserveSendDelay,
} from './services/rateLimiter';

const concurrency = Number(process.env.WORKER_CONCURRENCY || 5);
const attachmentRoot = path.resolve(process.env.ATTACHMENT_STORAGE_DIR || './storage/attachments');

const resolveAttachmentPath = (storageKey: string) => {
  const resolved = path.resolve(attachmentRoot, storageKey);
  if (!resolved.startsWith(`${attachmentRoot}${path.sep}`)) throw new Error('Attachment storage reference is invalid.');
  return resolved;
};

export const isFinalAttempt = (job: { attemptsMade: number; opts?: { attempts?: number } }) =>
  job.attemptsMade + 1 >= (job.opts?.attempts || 1);

const processEmailJob = async (job: any) => {
  const { emailId } = job.data as { emailId: string };

  if (!emailId) {
    throw new Error('Job payload is missing emailId');
  }

  console.log(`[Worker] Job ${job.id} received for email ${emailId}`);

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { sender: true, attachments: true },
  });

  if (!email) {
    console.log(`[Worker] Email ${emailId} no longer exists in PostgreSQL; skipping job.`);
    return { skipped: true, reason: 'not_found' };
  }

  if (email.status === 'SENT') {
    console.log(`[Worker] Email ${emailId} already marked SENT; skipping duplicate send.`);
    return { skipped: true, reason: 'already_sent' };
  }

  if (email.status === 'FAILED' && job.attemptsMade > 0) {
    console.log(`[Worker] Email ${emailId} is already FAILED; skipping duplicate retry.`);
    return { skipped: true, reason: 'already_failed' };
  }

  const claimResult = await prisma.email.updateMany({
    where: { id: emailId, status: 'PENDING' },
    data: {
      status: 'PROCESSING',
      updatedAt: new Date(),
    },
  });

  if (claimResult.count === 0) {
    const current = await prisma.email.findUnique({ where: { id: emailId } });
    console.log(`[Worker] Email ${emailId} could not be claimed; current status: ${current?.status ?? 'unknown'}`);
    return { skipped: true, reason: 'not_claimed' };
  }

  const delayMs = email.delayBetweenEmails ?? Number(process.env.DEFAULT_EMAIL_DELAY_MS || 2000);
  const hourlyLimit = email.hourlyLimit ?? Number(process.env.DEFAULT_HOURLY_LIMIT || 200);

  const sendDelay = await reserveSendDelay(email.senderId, delayMs);
  if (!sendDelay.allowed) {
    const waitMs = Math.max(250, sendDelay.waitMs + 250);

    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'PENDING',
        failureReason: null,
        updatedAt: new Date(),
      },
    });

    await enqueueRetryJob({
      emailId,
      senderId: email.senderId,
      recipient: email.to,
      subject: email.subject,
      body: email.body,
      scheduledAt: email.scheduledAt,
      delayBetweenEmails: delayMs,
      hourlyLimit,
      delayMs: waitMs,
    });

    console.log(`[Worker] Email ${emailId} deferred for minimum delay: ${waitMs}ms`);
    return { delayed: true, waitMs };
  }

  const rateLimit = await reserveHourlySlot(email.senderId, hourlyLimit);
  if (!rateLimit.allowed) {
    const waitMs = Math.max(250, rateLimit.waitMs + 250);

    await clearSendDelay(email.senderId);
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'PENDING',
        failureReason: null,
        rateLimitRescheduleCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    await enqueueRetryJob({
      emailId,
      senderId: email.senderId,
      recipient: email.to,
      subject: email.subject,
      body: email.body,
      scheduledAt: email.scheduledAt,
      delayBetweenEmails: delayMs,
      hourlyLimit,
      delayMs: waitMs,
    });

    await notifyRateLimitOnce(
      email.senderId,
      `Hourly email limit reached for ${email.sender.email}. Email delivery is delayed and will resume after the rate-limit window.`,
    );

    console.log(
      `[Worker] Email ${emailId} is rate-limited; rescheduling for ${waitMs}ms to avoid exceeding hourly limit.`
    );
    return { delayed: true, waitMs, reason: 'rate_limit' };
  }

  try {
    const delivery = await sendEmail({
      to: email.to,
      subject: email.subject,
      body: email.body,
      from: email.sender.email,
      attachments: email.attachments.map((attachment) => ({
        filename: attachment.filename,
        path: resolveAttachmentPath(attachment.storageKey),
        contentType: attachment.mimeType,
      })),
    });

    console.log(`[Worker] Message ID: ${delivery.messageId}`);

    if (delivery.previewUrl) {
      console.log(`[Worker] Ethereal preview: ${delivery.previewUrl}`);
    }

    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        failureReason: null,
        updatedAt: new Date(),
      },
    });

    await indexEmail({
      ...email,
      userId: email.sender.ownerId || email.senderId,
      status: 'SENT',
      sentAt: new Date(),
    });

    console.log(
      `[Worker] Email ${emailId} sent successfully to ${email.to}. Message ID: ${delivery.messageId}`
    );

    return {
      sent: true,
      messageId: delivery.messageId,
      previewUrl: delivery.previewUrl,
    };
  } catch (error: any) {
    await clearSendDelay(email.senderId);
    await releaseHourlySlot(email.senderId);

    const finalAttempt = isFinalAttempt(job);

    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: finalAttempt ? 'FAILED' : 'PENDING',
        failureReason: error?.message || 'SMTP send failed',
        retryCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    console.error(`[Worker] Email ${emailId} send failed: ${error?.message || error}`);
    throw error;
  }
};

export const emailWorker = new Worker(
  EMAIL_QUEUE_NAME,
  async (job) => processEmailJob(job),
  {
    connection: redis,
    concurrency,
    autorun: true,
    removeOnComplete: { age: 60 * 60 },
    removeOnFail: { age: 24 * 60 * 60 },
  }
);

emailWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully.`);
});

emailWorker.on('failed', (job, error) => {
  console.error(`[Worker] Job ${job?.id} failed: ${error.message}`);
});

const shutdown = async (signal: string) => {
  console.log(`[Worker] ${signal} received. Shutting down gracefully...`);
  await emailWorker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
};

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

export default emailWorker;
