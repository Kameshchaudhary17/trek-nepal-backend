import { Router } from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  createBooking,
  getMyBookings,
  getGuideBookings,
  updateBookingStatus,
  getBookingById,
} from '../controllers/bookings.controller.js';

const router = Router();

router.use(protect);

router.post('/', createBooking);
router.get('/my', getMyBookings);
router.get('/guide', getGuideBookings);
router.patch('/:id/status', updateBookingStatus);
router.get('/:id', getBookingById);

export default router;
