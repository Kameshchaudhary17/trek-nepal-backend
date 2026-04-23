import { Review } from '../models/Review.model.js';
import { Booking } from '../models/Booking.model.js';
import { Guide } from '../models/Guide.model.js';
import { ApiError } from '../utils/apiError.js';

async function recalcGuideRating(guideId) {
  const agg = await Review.aggregate([
    { $match: { guide: guideId } },
    { $group: { _id: '$guide', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const { avg = 0, count = 0 } = agg[0] || {};
  await Guide.updateOne(
    { _id: guideId },
    { $set: { averageRating: Math.round(avg * 10) / 10, reviewCount: count } }
  );
}

/* POST /api/bookings/:bookingId/review  (trekker, booking must be completed) */
export async function createReview(req, res, next) {
  try {
    const { bookingId } = req.params;
    const { rating, comment = '' } = req.body;

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      throw new ApiError(400, 'rating must be an integer between 1 and 5');
    }
    if (typeof comment !== 'string' || comment.length > 2000) {
      throw new ApiError(400, 'comment must be a string up to 2000 chars');
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');
    if (!booking.trekker.equals(req.user._id)) {
      throw new ApiError(403, 'Only the trekker can review this booking');
    }
    if (booking.status !== 'completed') {
      throw new ApiError(400, 'Only completed bookings can be reviewed');
    }

    const existing = await Review.findOne({ booking: booking._id });
    if (existing) throw new ApiError(409, 'You have already reviewed this booking');

    const review = await Review.create({
      booking:  booking._id,
      guide:    booking.guide,
      trekker:  req.user._id,
      rating:   ratingNum,
      comment:  comment.trim(),
    });

    await recalcGuideRating(booking.guide);

    res.status(201).json({ review });
  } catch (err) {
    // Duplicate-key race → translate to 409
    if (err?.code === 11000) return next(new ApiError(409, 'You have already reviewed this booking'));
    next(err);
  }
}

/* GET /api/guides/:guideId/reviews  (public) */
export async function listGuideReviews(req, res, next) {
  try {
    const { guideId } = req.params;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

    const [reviews, total] = await Promise.all([
      Review.find({ guide: guideId })
        .populate('trekker', 'fullName profilePhoto')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments({ guide: guideId }),
    ]);

    res.json({ reviews, total, page, limit });
  } catch (err) {
    next(err);
  }
}

/* GET /api/bookings/:bookingId/review  (booking parties only)
   Returns existing review for a booking (or null). Lets frontend hide the
   "Leave review" CTA when already submitted. */
export async function getReviewForBooking(req, res, next) {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId).lean();
    if (!booking) throw new ApiError(404, 'Booking not found');

    const isTrekker = booking.trekker.equals(req.user._id);
    const guide = await Guide.findOne({ user: req.user._id }, { _id: 1 }).lean();
    const isGuide = guide && booking.guide.equals(guide._id);

    if (!isTrekker && !isGuide) {
      throw new ApiError(403, 'Not authorized to view this review');
    }

    const review = await Review.findOne({ booking: bookingId }).lean();
    res.json({ review: review || null });
  } catch (err) {
    next(err);
  }
}
