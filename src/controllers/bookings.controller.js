import { Booking } from '../models/Booking.model.js';
import { Guide } from '../models/Guide.model.js';
import { User } from '../models/User.model.js';
import PlatformConfig from '../models/PlatformConfig.model.js';
import { ApiError } from '../utils/apiError.js';
import { computeBookingCost } from '../utils/pricing.js';
import {
  sendNewBookingNotice,
  sendBookingSubmitted,
  sendBookingStatusChange,
} from '../services/email.service.js';
import { getStripe, isStripeConfigured } from '../config/stripe.js';
import { createNotification } from './notifications.controller.js';

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
    const guideUserId  = populated?.guide?.user?._id;

    if (trekkerEmail) {
      sendBookingSubmitted({ to: trekkerEmail, trekkerName, guideName, booking: populated });
    }
    if (guideEmail) {
      sendNewBookingNotice({ to: guideEmail, guideName, trekkerName, booking: populated });
    }

    // In-app notification — guide sees a bell alert for the new request.
    if (guideUserId) {
      createNotification({
        userId: guideUserId,
        type:   'booking.new',
        title:  `New booking request from ${trekkerName}`,
        body:   `${populated.route} · ${populated.days} day${populated.days === 1 ? '' : 's'}`,
        link:   '/guide/dashboard',
      }).catch((e) => console.error('[notif] booking.new failed:', e.message));
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

    // Notify the *other* party of the change — email + in-app.
    const trekkerEmail = populated?.trekker?.email;
    const trekkerName  = populated?.trekker?.fullName;
    const trekkerId    = populated?.trekker?._id;
    const guideEmail   = populated?.guide?.user?.email;
    const guideName    = populated?.guide?.user?.fullName;
    const guideUserId  = populated?.guide?.user?._id;
    const changedByTrekker = status === 'cancelled';
    const recipient = changedByTrekker
      ? { to: guideEmail,   name: guideName,   userId: guideUserId,  otherPartyName: trekkerName, link: '/guide/dashboard' }
      : { to: trekkerEmail, name: trekkerName, userId: trekkerId,    otherPartyName: guideName,   link: '/bookings' };

    if (recipient.to) {
      sendBookingStatusChange({
        to: recipient.to,
        recipientName: recipient.name,
        status,
        otherPartyName: recipient.otherPartyName,
        booking: populated,
      });
    }

    if (recipient.userId) {
      const titleByStatus = {
        confirmed: `${recipient.otherPartyName} confirmed your booking`,
        rejected:  `${recipient.otherPartyName} declined your booking`,
        cancelled: `${recipient.otherPartyName} cancelled the booking`,
        completed: `Your trek with ${recipient.otherPartyName} is complete — leave a review`,
      };
      createNotification({
        userId: recipient.userId,
        type:   `booking.${status}`,
        title:  titleByStatus[status] || 'Booking updated',
        body:   `${populated.route} · ${populated.days} day${populated.days === 1 ? '' : 's'}`,
        link:   recipient.link,
      }).catch((e) => console.error('[notif] booking status failed:', e.message));
    }

    res.json({ booking: populated });
  } catch (err) {
    next(err);
  }
}

/* ── GET /api/bookings/admin (admin only) ───────────────────────────
   Query: status, paymentStatus, search (route/trekker/guide name),
          from (ISO), to (ISO), page, limit (≤100).
   Returns paginated bookings + per-status counts for the dashboard. */
export async function adminListBookings(req, res, next) {
  try {
    const { status, paymentStatus, search, from, to } = req.query;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));

    const filter = {};
    if (status)        filter.status        = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (from || to) {
      filter.createdAt = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) filter.createdAt.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) filter.createdAt.$lte = d;
      }
      if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
    }

    // Search matches route OR any linked user's fullName. Escape regex first.
    if (search) {
      const s = String(search);
      if (s.length > 80) throw new ApiError(400, 'Search query too long (max 80 characters)');
      const safe = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      const users = await User.find({ fullName: rx }, { _id: 1 }).lean();
      const userIds = users.map((u) => u._id);
      const guidesByUser = await Guide.find({ user: { $in: userIds } }, { _id: 1 }).lean();
      const guideIds = guidesByUser.map((g) => g._id);
      filter.$or = [
        { route: rx },
        { trekker: { $in: userIds } },
        { guide: { $in: guideIds } },
      ];
    }

    const [bookings, total, counts] = await Promise.all([
      Booking.find(filter)
        .populate({ path: 'trekker', select: 'fullName email' })
        .populate({ path: 'guide', populate: { path: 'user', select: 'fullName email' }, select: 'user ratePerDay status' })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter),
      Booking.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const byStatus = counts.reduce((acc, r) => ({ ...acc, [r._id || 'unknown']: r.count }), {});

    res.json({ bookings, total, page, limit, counts: byStatus });
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
