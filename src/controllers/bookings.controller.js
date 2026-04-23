import { Booking } from '../models/Booking.model.js';
import { Guide } from '../models/Guide.model.js';
import PlatformConfig from '../models/PlatformConfig.model.js';
import { ApiError } from '../utils/apiError.js';
import { computeBookingCost } from '../utils/pricing.js';
import {
  sendNewBookingNotice,
  sendBookingSubmitted,
  sendBookingStatusChange,
} from '../services/email.service.js';
import { getStripe, isStripeConfigured } from '../config/stripe.js';

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

    if (!guideId || !route || !startDate || !days) {
      throw new ApiError(400, 'guideId, route, startDate and days are required');
    }

    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      throw new ApiError(400, 'Invalid startDate');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      throw new ApiError(400, 'startDate must be today or in the future');
    }

    const dayCount = Number(days);
    if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 90) {
      throw new ApiError(400, 'days must be an integer between 1 and 90');
    }

    const guide = await Guide.findById(guideId);
    if (!guide) throw new ApiError(404, 'Guide not found');
    if (guide.status !== 'verified') {
      throw new ApiError(400, 'This guide is not yet verified and cannot accept bookings');
    }

    const ratePerDay = guide.ratePerDay || 0;
    const config = await PlatformConfig.findOne({}).lean();
    const { totalCost, breakdown } = computeBookingCost({
      ratePerDay,
      days: dayCount,
      startDate: start,
      config,
    });

    const booking = await Booking.create({
      trekker: req.user._id,
      guide: guide._id,
      route,
      startDate: start,
      days: dayCount,
      message,
      ratePerDay,
      totalCost,
      costBreakdown: breakdown,
    });

    const populated = await Booking.findById(booking._id)
      .populate(populateGuide)
      .populate(populateTrekker);

    // Fire-and-forget notifications — never block the response.
    const trekkerEmail = populated?.trekker?.email;
    const trekkerName  = populated?.trekker?.fullName;
    const guideEmail   = populated?.guide?.user?.email;
    const guideName    = populated?.guide?.user?.fullName;
    if (trekkerEmail) {
      sendBookingSubmitted({ to: trekkerEmail, trekkerName, guideName, booking: populated });
    }
    if (guideEmail) {
      sendNewBookingNotice({ to: guideEmail, guideName, trekkerName, booking: populated });
    }

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
      // Payment-in-flight: refuse cancel so we don't race the webhook.
      if (booking.paymentStatus === 'processing') {
        throw new ApiError(409, 'Payment is in progress — please wait for it to finish before cancelling');
      }
      // Already-paid: refund via Stripe. Mark refunded only after Stripe accepts
      // the request; the webhook will confirm the final state.
      if (booking.paymentStatus === 'paid' && booking.stripePaymentIntentId) {
        if (!isStripeConfigured()) {
          throw new ApiError(503, 'Cannot refund — payments are not configured on this server');
        }
        try {
          await getStripe().refunds.create({
            payment_intent: booking.stripePaymentIntentId,
            reason: 'requested_by_customer',
          });
          booking.paymentStatus = 'refunded';
        } catch (err) {
          console.error('[stripe] refund failed for booking', booking._id.toString(), err.message);
          throw new ApiError(502, 'Refund could not be processed. Please contact support.');
        }
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

    // Notify the *other* party of the change.
    const trekkerEmail = populated?.trekker?.email;
    const trekkerName  = populated?.trekker?.fullName;
    const guideEmail   = populated?.guide?.user?.email;
    const guideName    = populated?.guide?.user?.fullName;
    const changedByTrekker = status === 'cancelled';
    const recipient = changedByTrekker
      ? { to: guideEmail,   name: guideName,   otherPartyName: trekkerName }
      : { to: trekkerEmail, name: trekkerName, otherPartyName: guideName  };
    if (recipient.to) {
      sendBookingStatusChange({
        to: recipient.to,
        recipientName: recipient.name,
        status,
        otherPartyName: recipient.otherPartyName,
        booking: populated,
      });
    }

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
