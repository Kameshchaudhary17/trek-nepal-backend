import { Router } from 'express';
import { createReview, listGuideReviews, getReviewForBooking } from '../controllers/reviews.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

// Public
router.get('/guides/:guideId/reviews', listGuideReviews);

// Authenticated
router.post('/bookings/:bookingId/review', protect, createReview);
router.get('/bookings/:bookingId/review', protect, getReviewForBooking);

export default router;
