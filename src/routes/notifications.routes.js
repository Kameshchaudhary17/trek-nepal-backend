import { Router } from 'express';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notifications.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/',            protect, listNotifications);
router.post('/:id/read',   protect, markNotificationRead);
router.post('/read-all',   protect, markAllNotificationsRead);

export default router;
