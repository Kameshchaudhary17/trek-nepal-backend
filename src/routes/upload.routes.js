import { Router } from 'express';
import { uploadProfilePhoto, uploadNationalId, uploadTrekPhoto } from '../controllers/upload.controller.js';
import { profileUpload, nationalIdUpload, trekUpload } from '../middleware/upload.middleware.js';
import { protect, adminOnly } from '../middleware/auth.middleware.js';

const router = Router();

// No auth — used during registration before account exists
router.post('/profile',     profileUpload,   uploadProfilePhoto);
router.post('/national-id', nationalIdUpload, uploadNationalId);

// Admin only
router.post('/trek', protect, adminOnly, trekUpload, uploadTrekPhoto);

export default router;
