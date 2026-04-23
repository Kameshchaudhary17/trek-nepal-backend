import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth.middleware.js';
import {
  getPricingConfig,
  adminGetTrekPrices,
  adminUpdateTrekPrice,
  adminUpdateConfig,
} from '../controllers/pricing.controller.js';

const router = Router();

// Public
router.get('/config', getPricingConfig);

// Admin only
router.get('/treks',              protect, adminOnly, adminGetTrekPrices);
router.put('/treks/:trekId',      protect, adminOnly, adminUpdateTrekPrice);
router.put('/config',             protect, adminOnly, adminUpdateConfig);

export default router;
