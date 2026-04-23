import { Router } from 'express';
import {
  getTreks, getTrekById,
  adminGetTreks, createTrek, updateTrek, deleteTrek,
} from '../controllers/treks.controller.js';
import { protect, adminOnly } from '../middleware/auth.middleware.js';

const router = Router();

// Public
router.get('/', getTreks);
router.get('/:id', getTrekById);

// Admin
router.get('/admin/all',    protect, adminOnly, adminGetTreks);
router.post('/admin',       protect, adminOnly, createTrek);
router.put('/admin/:id',    protect, adminOnly, updateTrek);
router.delete('/admin/:id', protect, adminOnly, deleteTrek);

export default router;
