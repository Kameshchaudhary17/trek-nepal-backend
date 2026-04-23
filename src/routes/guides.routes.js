import { Router } from 'express';
import {
  getGuides,
  getGuideById,
  getMyProfile,
  upsertMyProfile,
  getMyReviews,
  getMyEarnings,
  adminListGuides,
  adminSetGuideStatus,
  getGuideNationalId,
} from '../controllers/guides.controller.js';
import { protect, adminOnly } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', getGuides);
router.get('/me', protect, getMyProfile);
router.put('/me/profile', protect, upsertMyProfile);
router.get('/me/reviews',  protect, getMyReviews);
router.get('/me/earnings', protect, getMyEarnings);

// Admin routes — must come before /:id
router.get('/admin', protect, adminOnly, adminListGuides);
router.patch('/admin/:id/status', protect, adminOnly, adminSetGuideStatus);
router.get('/admin/:id/national-id', protect, adminOnly, getGuideNationalId);

router.get('/:id', getGuideById);

export default router;
