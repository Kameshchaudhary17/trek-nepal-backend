import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { TokenBlacklist } from '../models/TokenBlacklist.model.js';
import { ApiError } from '../utils/apiError.js';

export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return next(new ApiError(403, 'Admin access required'));
  next();
}

export async function protect(req, res, next) {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;

    if (!token) throw new ApiError(401, 'Not authenticated');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const revoked = await TokenBlacklist.exists({ tokenHash });
    if (revoked) throw new ApiError(401, 'Session ended. Please log in again.');

    req.user = await User.findById(decoded.id);
    if (!req.user) throw new ApiError(401, 'User no longer exists');

    next();
  } catch (err) {
    next(err);
  }
}
