import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { scheduleEmailSchema } from '../validators/scheduleValidator';
import prisma from '../config/db';
import { enqueueEmailJobs } from '../services/emailQueue';
import { indexEmail, searchEmails } from '../services/emailSearch';
import path from 'path';

export const scheduleEmails = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const sender = req.sender!;

    // 1. Zod input validation
    const requestBody = { ...req.body };
    if (typeof requestBody.recipients === 'string') {
      try { requestBody.recipients = JSON.parse(requestBody.recipients); } catch { requestBody.recipients = []; }
    }
    for (const field of ['delayBetweenEmails', 'hourlyLimit']) {
      if (typeof requestBody[field] === 'string' && requestBody[field] !== '') requestBody[field] = Number(requestBody[field]);
    }
    const validationResult = scheduleEmailSchema.safeParse(requestBody);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: validationResult.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }

    const {
      subject,
      body,
      recipients,
      startTime,
      delayBetweenEmails = 2000,
      hourlyLimit = 200,
      senderEmail,
      senderId,
    } = validationResult.data;

    const selectedSender = senderId
      ? await prisma.sender.findFirst({ where: { id: senderId, OR: [{ id: sender.id }, { ownerId: sender.id }] } })
      : sender;
    if (!selectedSender) {
      res.status(403).json({ error: 'Forbidden', message: 'You cannot schedule using another user’s sender.' });
      return;
    }

    // 2. Ownership / Security Check
    if (senderEmail && senderEmail !== selectedSender.email) {
      res.status(403).json({
        error: 'Forbidden',
        message: `You cannot schedule emails on behalf of '${senderEmail}'. Authenticated sender is '${sender.email}'.`,
      });
      return;
    }

    const scheduledDate = new Date(startTime);
    const delayMs = Math.max(0, scheduledDate.getTime() - Date.now());

    let createdEmails: Awaited<ReturnType<typeof prisma.email.create>>[] = [];

    try {
      createdEmails = await prisma.$transaction(
        recipients.map((to) =>
          prisma.email.create({
            data: {
              to,
              subject,
              body,
              scheduledAt: scheduledDate,
              status: 'PENDING',
              senderId: selectedSender.id,
              delayBetweenEmails: delayBetweenEmails ?? Number(process.env.DEFAULT_EMAIL_DELAY_MS || 2000),
              hourlyLimit: hourlyLimit ?? Number(process.env.DEFAULT_HOURLY_LIMIT || 200),
              jobId: `email-${Date.now()}-${to.replace(/[^a-zA-Z0-9]/g, '_')}`,
            },
          })
        )
      );

      const files = (req.files as Express.Multer.File[] | undefined) || [];
      if (files.length) {
        await prisma.attachment.createMany({
          data: createdEmails.flatMap((email) => files.map((file) => ({
            emailId: email.id,
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            storageKey: path.basename(file.filename),
          }))),
        });
      }

      const queuedJobs = await enqueueEmailJobs(
        createdEmails.map((email) => ({
          id: email.id,
          senderId: selectedSender.id,
          to: email.to,
          subject: email.subject,
          body: email.body,
          scheduledAt: email.scheduledAt,
          delayBetweenEmails: email.delayBetweenEmails,
          hourlyLimit: email.hourlyLimit,
        }))
      );

      await Promise.all(
        createdEmails.map((email, index) =>
          prisma.email.update({
            where: { id: email.id },
            data: {
              jobId: queuedJobs[index]?.jobId || email.jobId,
            },
          })
        )
      );

      await Promise.all(createdEmails.map((email) => indexEmail({ ...email, userId: sender.id })));

      res.status(201).json({
        message: 'Emails scheduled successfully',
        count: createdEmails.length,
        scheduling: {
          startTime: scheduledDate.toISOString(),
          delayMs,
          delayBetweenEmails,
          hourlyLimit,
        },
        jobs: queuedJobs,
        sender: {
          id: selectedSender.id,
          email: selectedSender.email,
          name: selectedSender.name,
        },
      });
      return;
    } catch (queueError: any) {
      if (createdEmails.length > 0) {
        await prisma.email.updateMany({
          where: {
            id: { in: createdEmails.map((email) => email.id) },
          },
          data: {
            status: 'FAILED',
            failureReason: `Queue scheduling failed: ${queueError.message || 'Unknown queue error'}`,
            updatedAt: new Date(),
          },
        });
      }

      throw queueError;
    }

  } catch (error: any) {
    console.error('[EmailController] Error scheduling emails:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to schedule emails.',
    });
  }
};

export const getScheduledEmails = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const sender = req.sender!;
    const emails = await prisma.email.findMany({
      where: {
        sender: { OR: [{ id: sender.id }, { ownerId: sender.id }] },
        status: 'PENDING',
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        sender: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });

    res.json(emails);
  } catch (error: any) {
    console.error('[EmailController] Error fetching scheduled emails:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve scheduled emails.',
    });
  }
};

export const getSentEmails = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const sender = req.sender!;
    const emails = await prisma.email.findMany({
      where: {
        sender: { OR: [{ id: sender.id }, { ownerId: sender.id }] },
        status: { in: ['SENT', 'FAILED'] },
      },
      orderBy: [{ sentAt: 'desc' }, { updatedAt: 'desc' }],
      include: {
        sender: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });

    res.json(emails);
  } catch (error: any) {
    console.error('[EmailController] Error fetching sent emails:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve sent emails.',
    });
  }
};

export const getEmailById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const sender = req.sender!;
    const { id } = req.params;

    const email = await prisma.email.findUnique({
      where: { id },
      include: {
        sender: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });

    if (!email) {
      res.status(404).json({ error: 'Not Found', message: 'Email not found.' });
      return;
    }

    // Ownership check
    if (email.senderId !== sender.id) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You are not authorized to view this email.',
      });
      return;
    }

    res.json(email);
  } catch (error: any) {
    console.error('[EmailController] Error fetching email by id:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve email.',
    });
  }
};

export const searchEmailRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const sender = req.sender!;
  const ownedSenders = await prisma.sender.findMany({
    where: { OR: [{ id: sender.id }, { ownerId: sender.id }] },
    select: { id: true },
  });
  const result = await searchEmails({
    senderIds: ownedSenders.map(({ id }) => id),
    query: typeof req.query.q === 'string' ? req.query.q : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    from: Number(req.query.from || 0),
    size: Number(req.query.size || 25),
  });

  if (result === null) {
    res.status(503).json({ error: 'Search Unavailable', message: 'Elasticsearch is currently unavailable.' });
    return;
  }
  res.json(result);
};
