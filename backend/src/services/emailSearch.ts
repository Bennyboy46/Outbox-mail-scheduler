import { Client } from '@elastic/elasticsearch';

const indexName = process.env.ELASTICSEARCH_INDEX || 'outbox-emails';
const client = process.env.ELASTICSEARCH_URL
  ? new Client({
      node: process.env.ELASTICSEARCH_URL,
      auth: process.env.ELASTICSEARCH_API_KEY ? { apiKey: process.env.ELASTICSEARCH_API_KEY } : undefined,
    })
  : null;

export const getEmailSearchClient = () => client;
export const getEmailSearchIndex = () => indexName;

export const indexEmail = async (email: {
  id: string;
  senderId: string;
  userId?: string;
  to: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
  createdAt: Date;
}) => {
  if (!client) return;
  try {
    await client.index({
      index: indexName,
      id: email.id,
      document: {
        id: email.id,
        userId: email.userId || email.senderId,
        senderId: email.senderId,
        recipient: email.to,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
        createdAt: email.createdAt,
      },
      refresh: 'wait_for',
    });
  } catch (error) {
    console.error('[EmailSearch] Indexing failed; PostgreSQL remains the source of truth.', error);
  }
};

export const searchEmails = async ({
  senderIds,
  query,
  status,
  from = 0,
  size = 25,
}: {
  senderIds: string[];
  query?: string;
  status?: string;
  from?: number;
  size?: number;
}) => {
  if (!client) return null;
  try {
    const response = await client.search({
      index: indexName,
      from,
      size: Math.min(size, 100),
      query: {
        bool: {
          filter: [
            { terms: { userId: senderIds } },
            ...(status ? [{ term: { status } }] : []),
          ],
          ...(query ? { must: [{ multi_match: { query, fields: ['recipient', 'subject', 'body'] } }] } : {}),
        },
      },
      sort: [{ createdAt: 'desc' }],
    });
    return response.hits.hits.map((hit) => hit._source);
  } catch (error) {
    console.error('[EmailSearch] Search unavailable:', error);
    return null;
  }
};

export const indexEmailStrict = async (email: Parameters<typeof indexEmail>[0]) => {
  if (!client) throw new Error('ELASTICSEARCH_URL is not configured.');
  await client.index({
    index: indexName,
    id: email.id,
    document: {
      id: email.id,
      userId: email.userId || email.senderId,
      senderId: email.senderId,
      recipient: email.to,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt,
      createdAt: email.createdAt,
    },
    refresh: false,
  });
};