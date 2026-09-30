import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { createSender, deleteSender, listSenders, setDefaultSender } from '../controllers/senderController';

const router = Router();
router.use(requireAuth);
router.get('/', listSenders);
router.post('/', createSender);
router.delete('/:id', deleteSender);
router.post('/:id/default', setDefaultSender);
export default router;