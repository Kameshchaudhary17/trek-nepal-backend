import { Router } from 'express';
import { listMessages, sendMessage, unreadCount, markMessagesRead } from '../controllers/messages.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/bookings/:bookingId/messages',       protect, listMessages);
router.post('/bookings/:bookingId/messages',      protect, sendMessage);
router.post('/bookings/:bookingId/messages/read', protect, markMessagesRead);
router.get('/messages/unread',                    protect, unreadCount);

export default router;
