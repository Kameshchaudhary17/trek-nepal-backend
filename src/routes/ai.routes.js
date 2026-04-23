import { Router } from 'express';
import { priceCheck, permitsFor, planner } from '../controllers/ai.controller.js';
import { aiLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.use(aiLimiter);

/* All endpoints are deterministic helpers over existing platform data —
   no external LLM calls. Safe to expose publicly (rate-limited). */
router.post('/price-check',     priceCheck);
router.get('/permits/:trekId',  permitsFor);
router.get('/planner/:trekId',  planner);

export default router;
