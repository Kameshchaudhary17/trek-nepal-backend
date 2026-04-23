import { Booking } from '../models/Booking.model.js';
import { Guide } from '../models/Guide.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/apiError.js';

const populateGuide = {
  path: 'guide',
  populate: { path: 'user', select: 'fullName email profilePhoto' },
  select: 'specialty region ratePerDay status initials color user',
};
const populateTrekker = { path: 'trekker', select: 'fullName email profilePhoto phone' };

/* ── POST /api/bookings ─────────────────────────────────────────────── */
export async function createBooking(req, res, next) {
  try {
    if (req.user.role !== 'trekker') {
      throw new ApiError(403, 'Only trekkers can create bookings');
    }

    const { guideId, route, startDate, days, message } = req.body;

    const guide = await Guide.findById(guideId);
    if (!guide) throw new ApiError(404, 'Guide not found');

    const ratePerDay = guide.ratePerDay || 0;
    const totalCost = ratePerDay * Number(days);

    const booking = await Booking.create({
      trekker: req.user._id,
      guide: guide._id,
      route,
      startDate,
      days,
      message,
      ratePerDay,
      totalCost,
    });

    const populated = await Booking.findById(booking._id)
      .populate(populateGuide)
      .populate(populateTrekker);

    res.status(201).json({ booking: populated });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/bookings/my ───────────────────────────────────────────── */
export async function getMyBookings(req, res, next) {
  try {
    const bookings = await Booking.find({ trekker: req.user._id })
      .populate({
        path: 'guide',
        populate: { path: 'user', select: 'fullName profilePhoto' },
        select: 'specialty region ratePerDay status initials color user',
      })
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/bookings/guide ────────────────────────────────────────── */
export async function getGuideBookings(req, res, next) {
  try {
    const guide = await Guide.findOne({ user: req.user._id });
    if (!guide) throw new ApiError(404, 'Guide profile not found');

    const filter = { guide: guide._id };
    if (req.query.status) filter.status = req.query.status;

    const bookings = await Booking.find(filter)
      .populate('trekker', 'fullName email phone profilePhoto')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}

/* ── PATCH /api/bookings/:id/status ────────────────────────────────── */
export async function updateBookingStatus(req, res, next) {
  try {
    const { status, guideNote } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw new ApiError(404, 'Booking not found');

    if (status === 'confirmed' || status === 'rejected') {
      const guide = await Guide.findOne({ user: req.user._id });
      if (!guide || !guide._id.equals(booking.guide)) {
        throw new ApiError(403, 'Not authorized to update this booking');
      }
      if (booking.status !== 'pending') {
        throw new ApiError(400, 'Booking is no longer pending');
      }
    } else if (status === 'cancelled') {
      if (!booking.trekker.equals(req.user._id)) {
        throw new ApiError(403, 'Not authorized to cancel this booking');
      }
      if (!['pending', 'confirmed'].includes(booking.status)) {
        throw new ApiError(400, 'Booking cannot be cancelled in its current state');
      }
    } else if (status === 'completed') {
      const guide = await Guide.findOne({ user: req.user._id });
      if (!guide || !guide._id.equals(booking.guide)) {
        throw new ApiError(403, 'Not authorized to complete this booking');
      }
      if (booking.status !== 'confirmed') {
        throw new ApiError(400, 'Only confirmed bookings can be marked as completed');
      }
    } else {
      throw new ApiError(400, 'Invalid status');
    }

    booking.status = status;
    if (guideNote !== undefined) booking.guideNote = guideNote;
    await booking.save();

    const populated = await Booking.findById(booking._id)
      .populate(populateGuide)
      .populate(populateTrekker);

    res.json({ booking: populated });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/bookings/:id ──────────────────────────────────────────── */
export async function getBookingById(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate(populateGuide)
      .populate(populateTrekker);

    if (!booking) throw new ApiError(404, 'Booking not found');

    const isTheTrekker = booking.trekker && booking.trekker._id.equals(req.user._id);
    let isTheGuide = false;
    if (booking.guide && booking.guide.user) {
      isTheGuide = booking.guide.user._id
        ? booking.guide.user._id.equals(req.user._id)
        : booking.guide.user.equals(req.user._id);
    }

    if (!isTheTrekker && !isTheGuide) {
      throw new ApiError(403, 'Not authorized to view this booking');
    }

    res.json({ booking });
  } catch (err) {
    next(err);
  }
}
