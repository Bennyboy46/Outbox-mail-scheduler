import crypto from 'crypto';
import { WebClient } from '@slack/web-api';
import prisma from '../config/db';
import redis from '../config/redis';

const key = () => {
  const value = process.env.SLACK_TOKEN_ENCRYPTION_KEY;
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) throw new Error('SLACK_TOKEN_ENCRYPTION_KEY must be a 32-byte hex key.');
  return Buffer.from(value, 'hex');
};

const encrypt = (value: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
};

const decrypt = (value: string) => {
  const [iv, tag, encrypted] = value.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
};

export const createSlackConnectUrl = async (senderId: string) => {
  if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_REDIRECT_URI) throw new Error('Slack OAuth is not configured.');
  const state = crypto.randomBytes(32).toString('hex');
  await redis.set(`slack:oauth:${state}`, senderId, 'EX', 600);
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    redirect_uri: process.env.SLACK_REDIRECT_URI,
    state,
    scope: 'chat:write,channels:read,incoming-webhook',
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
};

export const completeSlackConnect = async (code: string, state: string) => {
  const senderId = await redis.get(`slack:oauth:${state}`);
  if (!senderId) throw new Error('Invalid or expired Slack OAuth state.');
  await redis.del(`slack:oauth:${state}`);
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.SLACK_CLIENT_ID || '', client_secret: process.env.SLACK_CLIENT_SECRET || '', code, redirect_uri: process.env.SLACK_REDIRECT_URI || '' }),
  });
  const result = await response.json() as any;
  if (!result.ok || !result.access_token || !result.team?.id) throw new Error(result.error || 'Slack OAuth failed.');
  await prisma.slackConnection.upsert({
    where: { senderId },
    create: { senderId, teamId: result.team.id, teamName: result.team.name, channelId: result.incoming_webhook?.channel_id, encryptedAccessToken: encrypt(result.access_token) },
    update: { teamId: result.team.id, teamName: result.team.name, channelId: result.incoming_webhook?.channel_id, encryptedAccessToken: encrypt(result.access_token) },
  });
};

export const disconnectSlack = (senderId: string) => prisma.slackConnection.deleteMany({ where: { senderId } });

export const notifySlack = async (senderId: string, text: string) => {
  try {
    const connection = await prisma.slackConnection.findUnique({ where: { senderId } });
    if (!connection?.channelId) return false;
    const client = new WebClient(decrypt(connection.encryptedAccessToken));
    await client.chat.postMessage({ channel: connection.channelId, text });
    return true;
  } catch (error) {
    console.error('[Slack] Notification failed; email processing continues.', error);
    return false;
  }
};

export const notifyRateLimitOnce = async (senderId: string, text: string) => {
  const bucket = new Date().toISOString().slice(0, 13);
  const claimed = await redis.set(`slack:rate-limit-notified:${senderId}:${bucket}`, '1', 'EX', 3600, 'NX');
  if (claimed !== 'OK') return false;
  return notifySlack(senderId, text);
};