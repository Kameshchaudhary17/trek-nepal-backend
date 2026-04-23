import { Router } from 'express';
import { uploadProfilePhoto, uploadNationalId, uploadTrekPhoto } from '../controllers/upload.controller.js';
import { profileUpload, nationalIdUpload, trekUpload } from '../middleware/upload.middleware.js';
import { protect, adminOnly } from '../middleware/auth.middleware.js';
import { uploadLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

// No auth — used during registration before the account exists.
// Rate-limited by IP to prevent anonymous Cloudinary quota abuse.
router.post('/profile',     uploadLimiter, profileUpload,    uploadProfilePhoto);
router.post('/national-id', uploadLimiter, nationalIdUpload, uploadNationalId);

// Admin only
router.post('/trek', protect, adminOnly, trekUpload, uploadTrekPhoto);

export default router;
