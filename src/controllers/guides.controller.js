import { Guide } from '../models/Guide.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/apiError.js';
import cloudinary from '../config/cloudinary.js';

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
      verified,
      sort = 'rating',
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { status: 'verified' }; // only NTB-verified guides appear publicly
    if (region) filter.region = region;
    if (language) filter.languages = language;
    if (minRating) filter.averageRating = { $gte: parseFloat(minRating) };
    if (trek) filter.routes = new RegExp(trek.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const sortMap = {
      rating: { averageRating: -1 },
      price_asc: { ratePerDay: 1 },
      price_desc: { ratePerDay: -1 },
      experience: { experience: -1 },
      treks: { treksCompleted: -1 },
    };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    let guides = await Guide.find(filter)
      .populate('user', 'fullName email profilePhoto')
      .sort(sortMap[sort] || { averageRating: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    if (search) {
      const q = search.toLowerCase();
      guides = guides.filter(
        (g) =>
          g.user?.fullName?.toLowerCase().includes(q) ||
          g.specialty?.toLowerCase().includes(q) ||
          g.routes.some((r) => r.toLowerCase().includes(q))
      );
    }

    const total = await Guide.countDocuments(filter);

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
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    res.json({ url });
  } catch (err) {
    next(err);
  }
}

/* ─── PATCH /api/guides/admin/:id/status  (protected, role=admin) ─
   Body: { status: 'pending' | 'verified' | 'rejected' }
─────────────────────────────────────────────────────────────────── */
export async function adminSetGuideStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      throw new ApiError(400, 'status must be pending, verified, or rejected');
    }

    const guide = await Guide.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true, runValidators: true }
    ).populate('user', 'fullName email phone');

    if (!guide) throw new ApiError(404, 'Guide not found');

    res.json({ guide });
  } catch (err) {
    next(err);
  }
}
