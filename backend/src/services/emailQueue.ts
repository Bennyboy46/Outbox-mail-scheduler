import { Queue } from 'bullmq';
import redis from '../config/redis';

export const EMAIL_QUEUE_NAME = 'email-scheduler';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export interface EmailJobRecord {
  id: string;
  senderId: string;
  to: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export const enqueueEmailJob = async (email: EmailJobRecord) => {
  const delayMs = Math.max(0, email.scheduledAt.getTime() - Date.now());

  const job = await emailQueue.add(
    'send-email',
    {
      emailId: email.id,
      senderId: email.senderId,
      recipient: email.to,
      subject: email.subject,
      body: email.body,
      scheduledAt: email.scheduledAt.toISOString(),
      delayBetweenEmails: email.delayBetweenEmails,
      hourlyLimit: email.hourlyLimit,
    },
    {
      jobId: `email-${email.id}`,
      delay: delayMs,
      attempts: 4,
      backoff: {
        type: 'fixed',
        delay: 10000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  return {
    emailId: email.id,
    jobId: job.id ?? `email-${email.id}`,
    recipient: email.to,
    scheduledAt: email.scheduledAt.toISOString(),
    status: 'QUEUED',
    delayMs,
  };
};

export const enqueueEmailJobs = async (emails: EmailJobRecord[]) => {
  const jobs: Array<{ emailId: string; jobId: string; recipient: string; scheduledAt: string; status: string; delayMs: number }> = [];

  for (const email of emails) {
    const result = await enqueueEmailJob(email);
    jobs.push(result);
  }

  return jobs;
};

export const enqueueRetryJob = async ({
  emailId,
  senderId,
  recipient,
  subject,
  body,
  scheduledAt,
  delayBetweenEmails,
  hourlyLimit,
  delayMs,
}: {
  emailId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  delayBetweenEmails: number;
  hourlyLimit: number;
  delayMs: number;
}) => {
  const retryJob = await emailQueue.add(
    'send-email',
    {
      emailId,
      senderId,
      recipient,
      subject,
      body,
      scheduledAt: scheduledAt.toISOString(),
      delayBetweenEmails,
      hourlyLimit,
    },
    {
      jobId: `retry-${Date.now()}-${emailId}`,
      delay: delayMs,
      attempts: 4,
      backoff: {
        type: 'fixed',
        delay: 10000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  return retryJob;
};
