import { Router } from 'express';
import { protect, adminOnly } from '../middleware/auth.middleware.js';
import {
  createBooking,
  getMyBookings,
  getGuideBookings,
  updateBookingStatus,
  getBookingById,
  adminListBookings,
} from '../controllers/bookings.controller.js';

const router = Router();

router.use(protect);

router.post('/', createBooking);
router.get('/my', getMyBookings);
router.get('/guide', getGuideBookings);
router.get('/admin', adminOnly, adminListBookings);
router.patch('/:id/status', updateBookingStatus);
router.get('/:id', getBookingById);

export default router;
