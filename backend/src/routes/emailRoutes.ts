import { Router } from 'express';
import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  getEmailById,
  searchEmailRecords,
} from '../controllers/emailController';
import { requireAuth } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const attachmentDirectory = path.resolve(process.env.ATTACHMENT_STORAGE_DIR || './storage/attachments');
fs.mkdirSync(attachmentDirectory, { recursive: true });
const upload = multer({
  dest: attachmentDirectory,
  limits: { files: 5, fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['application/pdf', 'text/plain', 'text/csv', 'image/png', 'image/jpeg', 'application/zip'];
    callback(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

// Protect all email routes with authentication middleware
router.use(requireAuth);

router.post('/schedule', upload.array('attachments', 5), scheduleEmails);
router.get('/scheduled', getScheduledEmails);
router.get('/sent', getSentEmails);
router.get('/search', searchEmailRecords);
router.get('/:id', getEmailById);

export default router;
