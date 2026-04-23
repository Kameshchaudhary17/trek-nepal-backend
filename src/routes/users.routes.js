import { Router } from 'express';
import { User } from '../models/User.model.js';
import { protect, adminOnly } from '../middleware/auth.middleware.js';

const router = Router();

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
