import { Router } from 'express';
import { createSlackConnectUrl, completeSlackConnect, disconnectSlack } from '../services/slack';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.get('/connect', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ url: await createSlackConnectUrl(req.sender!.id) });
  } catch (error: any) {
    res.status(503).json({ error: 'Slack Unavailable', message: error.message });
  }
});

router.get('/callback', async (req, res) => {
  try {
    await completeSlackConnect(String(req.query.code || ''), String(req.query.state || ''));
    res.redirect(`${process.env.SLACK_SUCCESS_REDIRECT || 'http://localhost:3000/dashboard'}?slack=connected`);
  } catch (error: any) {
    console.error('[Slack] OAuth callback failed:', error?.message || error);
    res.redirect(`${process.env.SLACK_SUCCESS_REDIRECT || 'http://localhost:3000/dashboard'}?slack=error`);
  }
});

router.delete('/connection', requireAuth, async (req: AuthenticatedRequest, res) => {
  await disconnectSlack(req.sender!.id);
  res.status(204).send();
});

export default router;