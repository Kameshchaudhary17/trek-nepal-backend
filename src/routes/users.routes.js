import { Router } from 'express';
import { User } from '../models/User.model.js';
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

// GET /api/users/admin/trekkers — all trekkers for admin panel
router.get('/admin/trekkers', protect, adminOnly, async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 50 } = req.query;

    const filter = { role: 'trekker' };
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email:    { $regex: search, $options: 'i' } },
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
