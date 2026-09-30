import { describe, expect, it } from 'vitest';
import { scheduleEmailSchema } from '../src/validators/scheduleValidator';
import { isFinalAttempt } from '../src/worker';

const validRequest = {
  subject: 'Test message',
  body: '<p>Hello</p>',
  recipients: ['one@example.com', 'two@example.com'],
  startTime: new Date(Date.now() + 60_000).toISOString(),
  senderId: '00000000-0000-0000-0000-000000000001',
};

describe('scheduleEmailSchema', () => {
  it('accepts a valid schedule with a selected sender', () => {
    expect(scheduleEmailSchema.safeParse(validRequest).success).toBe(true);
  });

  it('rejects invalid recipients and invalid sender IDs', () => {
    const result = scheduleEmailSchema.safeParse({ ...validRequest, recipients: ['not-an-email'], senderId: 'foreign' });
    expect(result.success).toBe(false);
  });

  it('deduplicates recipients before dispatch', () => {
    const result = scheduleEmailSchema.parse({ ...validRequest, recipients: ['ONE@example.com', 'one@example.com'] });
    expect(result.recipients).toEqual(['one@example.com']);
  });
});

describe('worker retry state', () => {
  it('keeps an email pending while BullMQ has attempts remaining', () => {
    expect(isFinalAttempt({ attemptsMade: 0, opts: { attempts: 4 } })).toBe(false);
    expect(isFinalAttempt({ attemptsMade: 3, opts: { attempts: 4 } })).toBe(true);
  });

  it('treats jobs without retry options as final attempts', () => {
    expect(isFinalAttempt({ attemptsMade: 0 })).toBe(true);
  });
});