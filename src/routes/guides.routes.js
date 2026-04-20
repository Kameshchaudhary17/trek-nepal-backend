import { Router } from 'express';
import {
  getGuides,
  getGuideById,
  upsertMyProfile,
  adminListGuides,
  adminSetGuideStatus,
} from '../controllers/guides.controller.js';
import { protect, adminOnly } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', getGuides);
router.put('/me/profile', protect, upsertMyProfile);

// Admin routes — must come before /:id
router.get('/admin', protect, adminOnly, adminListGuides);
router.patch('/admin/:id/status', protect, adminOnly, adminSetGuideStatus);

router.get('/:id', getGuideById);

export default router;
