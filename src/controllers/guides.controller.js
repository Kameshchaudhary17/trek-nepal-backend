import { Guide } from '../models/Guide.model.js';
import { User } from '../models/User.model.js';
import { Booking } from '../models/Booking.model.js';
import { Review } from '../models/Review.model.js';
import PlatformConfig from '../models/PlatformConfig.model.js';
import { ApiError } from '../utils/apiError.js';
import cloudinary from '../config/cloudinary.js';
import { CLOUDINARY_SIGNED_URL_TTL_SECONDS } from '../config/env.js';
import { sendGuideRejected } from '../services/email.service.js';

/* ─── GET /api/guides ─────────────────────────────────────────────
   Query params:
     search      – text match on name, specialty, or routes
     region      – exact region name
     language    – guide must speak this language
     minRating   – averageRating >= value
     verified    – 'true' to show verified only
     sort        – rating | price_asc | price_desc | experience | treks
     page        – default 1
     limit       – default 20, max 50
─────────────────────────────────────────────────────────────────── */
export async function getGuides(req, res, next) {
  try {
    const {
      search,
      region,
      trek,
      language,
      minRating,
      sort = 'rating',
      page = 1,
      limit = 20,
    } = req.query;

    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const filter = { status: 'verified' }; // only NTB-verified guides appear publicly
    if (region) filter.region = region;
    if (language) filter.languages = language;
    if (minRating) filter.averageRating = { $gte: parseFloat(minRating) };
    if (trek) filter.routes = new RegExp(escapeRegex(trek), 'i');

    // Search matches guide's own fields OR the linked user's fullName/email.
    // Resolve user IDs first so the whole query runs in MongoDB.
    if (search) {
      const safe = escapeRegex(search);
      const rx = new RegExp(safe, 'i');
      const matchingUsers = await User.find(
        { $or: [{ fullName: rx }, { email: rx }] },
        { _id: 1 }
      ).lean();
      const userIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { specialty: rx },
        { routes:    rx },
        { user:      { $in: userIds } },
      ];
    }

    const sortMap = {
      rating: { averageRating: -1 },
      price_asc: { ratePerDay: 1 },
      price_desc: { ratePerDay: -1 },
      experience: { experience: -1 },
      treks: { treksCompleted: -1 },
    };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    const [guides, total] = await Promise.all([
      Guide.find(filter)
        .populate('user', 'fullName email profilePhoto')
        .sort(sortMap[sort] || { averageRating: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Guide.countDocuments(filter),
    ]);

    res.json({ guides, total, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
}

/* ─── GET /api/guides/:id ─────────────────────────────────────── */
export async function getGuideById(req, res, next) {
  try {
    const guide = await Guide.findById(req.params.id)
      .populate('user', 'fullName email phone profilePhoto')
      .lean();

    if (!guide) throw new ApiError(404, 'Guide not found');

    res.json({ guide });
  } catch (err) {
    next(err);
  }
}

/* ─── GET /api/guides/me  (protected, role=guide) ────────────────
   Returns the current user's guide profile (or null if not created).
─────────────────────────────────────────────────────────────────── */
export async function getMyProfile(req, res, next) {
  try {
    const guide = await Guide.findOne({ user: req.user._id })
      .populate('user', 'fullName email phone profilePhoto')
      .lean();
    res.json({ guide: guide || null });
  } catch (err) {
    next(err);
  }
}

/* ─── PUT /api/guides/me/profile  (protected, role=guide) ────────
   Creates or updates the guide profile for the authenticated user.
─────────────────────────────────────────────────────────────────── */
export async function upsertMyProfile(req, res, next) {
  try {
    if (req.user.role !== 'guide') {
      throw new ApiError(403, 'Only users with guide role can create a guide profile');
    }

    const {
      specialty,
      region,
      experience,
      ratePerDay,
      languages,
      routes,
      bio,
      treksCompleted,
      color,
      profilePhoto,
    } = req.body;

    // Validate ratePerDay (if supplied) falls inside one of the admin-defined
    // guide-tier bands. Keeps the platform honest — no rogue pricing via curl.
    if (ratePerDay !== undefined && ratePerDay !== null) {
      const rate = Number(ratePerDay);
      if (!Number.isFinite(rate) || rate < 0) {
        throw new ApiError(400, 'ratePerDay must be a non-negative number');
      }
      const config = await PlatformConfig.findOne({}).select('guideTiers').lean();
      const tiers = config?.guideTiers || [];
      if (tiers.length > 0) {
        const inBand = tiers.some(
          (t) => rate >= (t.ratePerDay?.min ?? 0) && rate <= (t.ratePerDay?.max ?? Infinity)
        );
        if (!inBand) {
          const ranges = tiers
            .map((t) => `${t.label}: Rs. ${t.ratePerDay?.min}–${t.ratePerDay?.max}`)
            .join(' · ');
          throw new ApiError(400, `ratePerDay must fall within a guide tier band (${ranges})`);
        }
      }
    }

    const fullName = req.user.fullName || '';
    const words = fullName.trim().split(/\s+/);
    const initials = words.length >= 2
      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
      : fullName.slice(0, 2).toUpperCase();

    if (profilePhoto) {
      await User.findByIdAndUpdate(req.user._id, { profilePhoto });
    }

    const update = {
      specialty,
      region,
      experience,
      ratePerDay,
      languages,
      routes,
      bio,
      treksCompleted,
      color,
      initials,
    };

    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    const guide = await Guide.findOneAndUpdate(
      { user: req.user._id },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    ).populate('user', 'fullName email profilePhoto');

    res.json({ guide });
  } catch (err) {
    next(err);
  }
}

/* ─── GET /api/guides/me/reviews  (protected, role=guide) ──────────
   Paginated list of reviews for the current guide's profile. */
export async function getMyReviews(req, res, next) {
  try {
    if (req.user.role !== 'guide') {
      throw new ApiError(403, 'Only guides can view their reviews');
    }
    const guide = await Guide.findOne({ user: req.user._id }).select('_id').lean();
    if (!guide) throw new ApiError(404, 'Guide profile not found');

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

    const [reviews, total] = await Promise.all([
      Review.find({ guide: guide._id })
        .populate('trekker', 'fullName profilePhoto')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments({ guide: guide._id }),
    ]);

    res.json({ reviews, total, page, limit });
  } catch (err) {
    next(err);
  }
}

/* ─── GET /api/guides/me/earnings  (protected, role=guide) ─────────
   Revenue + fees summary for the current guide's paid bookings. */
export async function getMyEarnings(req, res, next) {
  try {
    if (req.user.role !== 'guide') {
      throw new ApiError(403, 'Only guides can view their earnings');
    }
    const guide = await Guide.findOne({ user: req.user._id }).select('_id').lean();
    if (!guide) throw new ApiError(404, 'Guide profile not found');

    const match = { guide: guide._id, paymentStatus: 'paid' };

    const [totals, monthly, recent] = await Promise.all([
      Booking.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            bookings:        { $sum: 1 },
            totalRevenue:    { $sum: '$totalCost' },
            platformFees:    { $sum: { $ifNull: ['$costBreakdown.platformFee', 0] } },
          },
        },
      ]),
      Booking.aggregate([
        { $match: match },
        {
          $group: {
            _id: { y: { $year: '$paidAt' }, m: { $month: '$paidAt' } },
            revenue: { $sum: '$totalCost' },
            count:   { $sum: 1 },
          },
        },
        { $sort: { '_id.y': -1, '_id.m': -1 } },
        { $limit: 12 },
      ]),
      Booking.find(match)
        .populate('trekker', 'fullName profilePhoto')
        .select('route days startDate totalCost paidAt trekker')
        .sort({ paidAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const t = totals[0] || { bookings: 0, totalRevenue: 0, platformFees: 0 };
    res.json({
      currency: 'NPR',
      totals: {
        bookings:     t.bookings,
        totalRevenue: t.totalRevenue,
        platformFees: t.platformFees,
        netEarnings:  Math.max(0, t.totalRevenue - t.platformFees),
      },
      monthly: monthly.map((row) => ({
        year:    row._id.y,
        month:   row._id.m,
        revenue: row.revenue,
        bookings: row.count,
      })),
      recent,
    });
  } catch (err) {
    next(err);
  }
}

/* ─── GET /api/guides/admin  (protected, role=admin) ─────────────
   Query params: status (pending|verified|rejected), page, limit
─────────────────────────────────────────────────────────────────── */
export async function adminListGuides(req, res, next) {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (status && ['pending', 'verified', 'rejected'].includes(status)) {
      // Documents created before the status field was added have no status field —
      // treat missing as 'pending' so they always appear for admin review.
      filter.$or = status === 'pending'
        ? [{ status: 'pending' }, { status: { $exists: false } }]
        : [{ status }];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const [guides, statusCounts] = await Promise.all([
      Guide.find(filter)
        .populate('user', 'fullName email phone')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Guide.aggregate([
        {
          $group: {
            _id: { $ifNull: ['$status', 'pending'] },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const counts = { pending: 0, verified: 0, rejected: 0 };
    statusCounts.forEach(({ _id, count }) => { if (_id) counts[_id] = count; });

    res.json({ guides, total: guides.length, page: pageNum, limit: limitNum, counts });
  } catch (err) {
    next(err);
  }
}

/* ─── GET /api/guides/admin/:id/national-id  (protected, role=admin) ─
   Returns a short-lived signed URL for the guide's national ID document.
─────────────────────────────────────────────────────────────────── */
export async function getGuideNationalId(req, res, next) {
  try {
    const guide = await Guide.findById(req.params.id).lean();
    if (!guide) throw new ApiError(404, 'Guide not found');
    if (!guide.nationalIdPublicId) throw new ApiError(404, 'No national ID on file for this guide');

    const url = cloudinary.url(guide.nationalIdPublicId, {
      sign_url: true,
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + CLOUDINARY_SIGNED_URL_TTL_SECONDS,
    });

    res.json({ url });
  } catch (err) {
    next(err);
  }
}

/* ─── PATCH /api/guides/admin/:id/status  (protected, role=admin) ─
   Body: { status: 'pending' | 'verified' | 'rejected', reason? }
   When rejecting, `reason` is stored on the Guide and emailed to them.
   When moving back to pending/verified, any prior reason is cleared. */
export async function adminSetGuideStatus(req, res, next) {
  try {
    const { status, reason } = req.body;
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      throw new ApiError(400, 'status must be pending, verified, or rejected');
    }

    const update = { status };
    if (status === 'rejected') {
      const trimmed = typeof reason === 'string' ? reason.trim() : '';
      if (!trimmed) throw new ApiError(400, 'A rejection reason is required');
      if (trimmed.length > 1000) throw new ApiError(400, 'Rejection reason too long (max 1000 chars)');
      update.rejectionReason = trimmed;
      update.rejectedAt = new Date();
    } else {
      // Clear any prior rejection metadata so the guide doesn't see stale copy.
      update.rejectionReason = '';
      update.rejectedAt = null;
    }

    const guide = await Guide.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    ).populate('user', 'fullName email phone');

    if (!guide) throw new ApiError(404, 'Guide not found');

    // Fire-and-forget rejection notice.
    if (status === 'rejected' && guide.user?.email) {
      sendGuideRejected({
        to: guide.user.email,
        guideName: guide.user.fullName,
        reason: update.rejectionReason,
      });
    }

    res.json({ guide });
  } catch (err) {
    next(err);
  }
}

/* ─── POST /api/guides/me/reapply  (protected, role=guide) ─────────
   Lets a rejected guide request re-verification. Moves their status
   from 'rejected' → 'pending' and clears the stored reason. */
export async function reapplyForVerification(req, res, next) {
  try {
    if (req.user.role !== 'guide') {
      throw new ApiError(403, 'Only guides can re-apply');
    }
    const guide = await Guide.findOne({ user: req.user._id });
    if (!guide) throw new ApiError(404, 'Guide profile not found');
    if (guide.status !== 'rejected') {
      throw new ApiError(400, 'Only rejected guides can re-apply');
    }

    guide.status = 'pending';
    guide.rejectionReason = '';
    guide.rejectedAt = null;
    await guide.save();

    res.json({ guide });
  } catch (err) {
    next(err);
  }
}
