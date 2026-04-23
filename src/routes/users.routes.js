import { Router } from 'express';
import { User } from '../models/User.model.js';
import { Guide } from '../models/Guide.model.js';
import { Booking } from '../models/Booking.model.js';
import { protect, adminOnly } from '../middleware/auth.middleware.js';

const router = Router();

// PATCH /api/users/me — update own profile (name, phone, profilePhoto)
router.patch('/me', protect, async (req, res, next) => {
  try {
    const { fullName, phone, profilePhoto } = req.body;
    const update = {};
    if (fullName?.trim())        update.fullName     = fullName.trim();
    if (phone  !== undefined)    update.phone        = phone;
    if (profilePhoto !== undefined) update.profilePhoto = profilePhoto;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true, runValidators: true }
    );

    res.json({
      user: {
        id: user._id, fullName: user.fullName, email: user.email,
        role: user.role, profilePhoto: user.profilePhoto || '',
        phone: user.phone || '',
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/admin/stats — dashboard overview counts + recent activity
router.get('/admin/stats', protect, adminOnly, async (req, res, next) => {
  try {
    const [totalGuides, totalTrekkers, totalBookings, pendingVerification, revenueAgg] =
      await Promise.all([
        Guide.countDocuments({ status: 'verified' }),
        User.countDocuments({ role: 'trekker' }),
        Booking.countDocuments(),
        Guide.countDocuments({ status: 'pending' }),
        Booking.aggregate([
          { $match: { status: { $in: ['confirmed', 'completed'] } } },
          { $group: { _id: null, total: { $sum: '$totalCost' } } },
        ]),
      ]);

    const revenue = revenueAgg[0]?.total || 0;

    const [recentUsers, recentBookings] = await Promise.all([
      User.find({})
        .select('fullName role createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Booking.find({})
        .select('route status createdAt trekker')
        .populate('trekker', 'fullName')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const activity = [
      ...recentUsers.map((u) => ({
        id: `u-${u._id}`,
        text: `${u.fullName} registered as a ${u.role}`,
        time: u.createdAt,
        icon: u.role === 'guide' ? '🧭' : '👤',
      })),
      ...recentBookings.map((b) => ({
        id: `b-${b._id}`,
        text: `${b.trekker?.fullName || 'A trekker'} booked ${b.route}`,
        time: b.createdAt,
        icon: '📋',
      })),
    ]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 6);

    res.json({
      stats: { totalGuides, totalTrekkers, totalBookings, revenue, pendingVerification },
      activity,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/admin/trekkers — all trekkers for admin panel
router.get('/admin/trekkers', protect, adminOnly, async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 50 } = req.query;

    const filter = { role: 'trekker' };
    if (search) {
      const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { fullName: { $regex: safe, $options: 'i' } },
        { email:    { $regex: safe, $options: 'i' } },
      ];
    }

    const trekkers = await User.find(filter)
      .select('fullName email phone role isVerified createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    res.json({ trekkers, total });
  } catch (err) {
    next(err);
  }
});

export default router;
