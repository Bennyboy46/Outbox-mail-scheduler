import axios from 'axios';
import { Session } from 'next-auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Build authenticated headers from NextAuth session
function getAuthHeaders(session: Session | null): Record<string, string> {
  const idToken = (session?.user as (Session['user'] & { idToken?: string }) | undefined)?.idToken;
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmails?: number;
  hourlyLimit?: number;
  senderEmail?: string;
  senderId?: string;
  attachments?: File[];
}

export interface SenderRecord {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  isDefault: boolean;
}

export interface EmailRecord {
  id: string;
  to: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
  jobId: string | null;
  failureReason: string | null;
  retryCount: number;
  rateLimitRescheduleCount: number;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
  };
}

export interface ScheduleEmailResponse {
  message: string;
  count: number;
  scheduling: {
    startTime: string;
    delayMs: number;
    delayBetweenEmails: number;
    hourlyLimit: number;
  };
  jobs: Array<{
    emailId: string;
    jobId: string | null;
    recipient: string;
    scheduledAt: string;
    status: string;
  }>;
  sender: {
    id: string;
    email: string;
    name: string | null;
  };
}

export const emailApi = {
  schedule: async (
    payload: ScheduleEmailPayload,
    session: Session | null
  ): Promise<ScheduleEmailResponse> => {
    const hasAttachments = Boolean(payload.attachments && payload.attachments.length > 0);
    const authHeaders = getAuthHeaders(session);

    if (hasAttachments) {
      const form = new FormData();
      form.append('subject', payload.subject);
      form.append('body', payload.body);
      form.append('recipients', JSON.stringify(payload.recipients));
      form.append('startTime', payload.startTime);
      if (payload.delayBetweenEmails !== undefined) form.append('delayBetweenEmails', String(payload.delayBetweenEmails));
      if (payload.hourlyLimit !== undefined) form.append('hourlyLimit', String(payload.hourlyLimit));
      if (payload.senderEmail) form.append('senderEmail', payload.senderEmail);
      if (payload.senderId) form.append('senderId', payload.senderId);
      payload.attachments?.forEach((file) => form.append('attachments', file));

      const { data } = await axios.post<ScheduleEmailResponse>(
        `${API_BASE}/emails/schedule`,
        form,
        { headers: { ...authHeaders } }
      );
      return data;
    }

    const body = {
      subject: payload.subject,
      body: payload.body,
      recipients: payload.recipients,
      startTime: payload.startTime,
      ...(payload.delayBetweenEmails !== undefined && { delayBetweenEmails: payload.delayBetweenEmails }),
      ...(payload.hourlyLimit !== undefined && { hourlyLimit: payload.hourlyLimit }),
      ...(payload.senderEmail && { senderEmail: payload.senderEmail }),
      ...(payload.senderId && { senderId: payload.senderId }),
    };
    const { data } = await axios.post<ScheduleEmailResponse>(
      `${API_BASE}/emails/schedule`,
      body,
      { headers: { 'Content-Type': 'application/json', ...authHeaders } }
    );
    return data;
  },



  getScheduled: async (session: Session | null): Promise<EmailRecord[]> => {
    const { data } = await axios.get<EmailRecord[]>(
      `${API_BASE}/emails/scheduled`,
      { headers: getAuthHeaders(session) }
    );
    return data;
  },

  getSent: async (session: Session | null): Promise<EmailRecord[]> => {
    const { data } = await axios.get<EmailRecord[]>(
      `${API_BASE}/emails/sent`,
      { headers: getAuthHeaders(session) }
    );
    return data;
  },

  getById: async (id: string, session: Session | null): Promise<EmailRecord> => {
    const { data } = await axios.get<EmailRecord>(
      `${API_BASE}/emails/${id}`,
      { headers: getAuthHeaders(session) }
    );
    return data;
  },

  search: async (params: { q?: string; status?: string; from?: number; size?: number }, session: Session | null): Promise<EmailRecord[]> => {
    const { data } = await axios.get<EmailRecord[]>(`${API_BASE}/emails/search`, {
      params,
      headers: getAuthHeaders(session),
    });
    return data;
  },
};

export const senderApi = {
  list: async (session: Session | null): Promise<SenderRecord[]> => {
    const { data } = await axios.get<SenderRecord[]>(`${API_BASE}/senders`, { headers: getAuthHeaders(session) });
    return data;
  },
};

export const slackApi = {
  connect: async (session: Session | null): Promise<{ url: string }> => {
    const { data } = await axios.get<{ url: string }>(`${API_BASE}/slack/connect`, { headers: getAuthHeaders(session) });
    return data;
  },

  disconnect: async (session: Session | null): Promise<void> => {
    await axios.delete(`${API_BASE}/slack/connection`, { headers: getAuthHeaders(session) });
  },
};
