import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/db';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    if (!idToken) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'A valid Google authentication token is required. Include Authorization: Bearer <id_token>'
      });
      return;
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('[AuthMiddleware] GOOGLE_CLIENT_ID env var is not set');
      res.status(503).json({
        error: 'Service Misconfigured',
        message: 'Authentication service is not configured correctly.'
      });
      return;
    }

    // Verify Google ID token — any failure from this returns 401
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const normalizedEmail = payload?.email?.toLowerCase().trim();

    if (!payload?.sub || !normalizedEmail || payload.email_verified !== true) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Google account verification failed. Account may not be verified.'
      });
      return;
    }

    const userName = payload.name || normalizedEmail.split('@')[0];
    const userAvatar = payload.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=00a854&color=fff`;

    // Upsert sender in PostgreSQL
    let sender = await prisma.sender.findUnique({
      where: { email: normalizedEmail }
    });

    if (!sender) {
      sender = await prisma.sender.create({
        data: {
          email: normalizedEmail,
          name: userName,
          avatar: userAvatar,
          googleId: payload.sub,
          isDefault: true,
        }
      });
    } else if (sender.googleId && sender.googleId !== payload.sub) {
      // Different Google user claiming same email address
      res.status(403).json({
        error: 'Forbidden',
        message: 'This email is linked to a different Google account.'
      });
      return;
    } else if (!sender.googleId) {
      // First time linking this existing sender to Google
      sender = await prisma.sender.update({
        where: { id: sender.id },
        data: { googleId: payload.sub, avatar: userAvatar, name: userName }
      });
    }

    req.sender = sender;
    req.user = {
      id: sender.id,
      email: sender.email,
      name: sender.name,
      avatar: sender.avatar
    };

    next();
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown authentication error';
    console.error('[AuthMiddleware] Token verification failed:', errorMessage);

    // ALL errors from verifyIdToken (expired, bad signature, wrong audience, network)
    // return 401 — never mask as 500
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Google authentication failed. Please sign in again.',
    });
  }
};

export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  await requireAuth(req, res, () => {
    const configuredAdmins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (req.sender?.role !== 'ADMIN' && !configuredAdmins.includes(req.sender?.email || '')) {
      res.status(403).json({ error: 'Forbidden', message: 'Administrator access is required.' });
      return;
    }
    next();
  });
};
