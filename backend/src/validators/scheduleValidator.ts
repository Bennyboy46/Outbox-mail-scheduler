import { z } from 'zod';

export const scheduleEmailSchema = z.object({
  subject: z
    .string({ required_error: 'Subject is required' })
    .trim()
    .min(1, 'Subject cannot be empty')
    .max(255, 'Subject cannot exceed 255 characters'),

  body: z
    .string({ required_error: 'Email body is required' })
    .trim()
    .min(1, 'Email body cannot be empty'),

  recipients: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .email('Invalid recipient email address')
    )
    .min(1, 'At least one valid recipient is required')
    .transform((emails) => Array.from(new Set(emails))), // Deduplicate recipients

  startTime: z
    .string({ required_error: 'Start time is required' })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Start time must be a valid ISO 8601 date string',
    }),

  delayBetweenEmails: z
    .number()
    .int()
    .min(0, 'Delay between emails must be at least 0 ms')
    .default(2000)
    .optional(),

  hourlyLimit: z
    .number()
    .int()
    .min(1, 'Hourly limit must be at least 1')
    .default(200)
    .optional(),

  senderEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid sender email')
    .optional(),

  senderId: z.string().uuid('Invalid sender').optional(),
});

export type ScheduleEmailInputValidated = z.infer<typeof scheduleEmailSchema>;
