import { Request } from 'express';
import { Sender, Email, EmailStatus } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  sender?: Sender;
}

export interface ScheduleEmailInput {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string; // ISO 8601
  delayBetweenEmails?: number;
  hourlyLimit?: number;
  senderEmail?: string;
}

export interface ScheduledJobPayload {
  emailId: string;
  senderId: string;
  recipient: string;
  subject: string;
  scheduledAt: string;
  delayMs: number;
  delayBetweenEmails: number;
  hourlyLimit: number;
}
