import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { Guide } from '../models/Guide.model.js';
import { TokenBlacklist } from '../models/TokenBlacklist.model.js';
import { ApiError } from '../utils/apiError.js';
import { sendOtpEmail } from '../services/email.service.js';
import {
  AVATAR_COLORS,
  OTP_EXPIRY_MS,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '../config/env.js';

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function userPayload(user) {
  return { id: user._id, fullName: user.fullName, email: user.email, role: user.role, profilePhoto: user.profilePhoto || '' };
}

export async function register(req, res, next) {
  try {
    const { fullName, email, password, role, phone, profilePhotoUrl, nationalIdPublicId } = req.body;

    const existing = await User.findOne({ email });

    if (existing?.isVerified) {
      throw new ApiError(409, 'Email already registered');
    }

    // Stale unverified account — delete and recreate with fresh OTP
    if (existing && !existing.isVerified) {
      await User.deleteOne({ _id: existing._id });
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);

    await User.create({
      fullName, email, password, role, phone,
      profilePhoto: profilePhotoUrl || '',
      nationalIdPublicId: nationalIdPublicId || '',
      otp, otpExpiry, isVerified: false,
    });

    await sendOtpEmail(email, otp);

    res.status(201).json({
      message: 'OTP sent to your email. Please verify to continue.',
      email,
      resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) throw new ApiError(400, 'Email and OTP are required');

    const user = await User.findOne({ email }).select('+otp +otpExpiry +nationalIdPublicId');
    if (!user) throw new ApiError(404, 'No account found for this email');
    if (user.isVerified) throw new ApiError(400, 'Account already verified. Please log in');
    if (!user.otp || user.otp !== otp.toString()) throw new ApiError(400, 'Invalid OTP');
    if (user.otpExpiry <= new Date()) throw new ApiError(400, 'OTP expired. Request a new one');

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Auto-create Guide profile so the guide appears in listings.
    // Atomic upsert — safe under concurrent OTP-verify requests.
    if (user.role === 'guide') {
      const words = user.fullName.trim().split(/\s+/);
      const initials = words.length >= 2
        ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
        : user.fullName.slice(0, 2).toUpperCase();
      const color = AVATAR_COLORS[user._id.toString().charCodeAt(20) % AVATAR_COLORS.length];
      await Guide.updateOne(
        { user: user._id },
        {
          $setOnInsert: {
            user: user._id,
            initials,
            color,
            nationalIdPublicId: user.nationalIdPublicId || '',
          },
        },
        { upsert: true }
      );
    }

    const token = signToken(user._id);

    res.json({
      message: 'Email verified successfully',
      token,
      user: userPayload(user),
    });
  } catch (err) {
    next(err);
  }
}

export async function resendOtp(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) throw new ApiError(400, 'Email is required');

    const user = await User.findOne({ email }).select('+otp +otpExpiry');
    if (!user) throw new ApiError(404, 'No account found for this email');
    if (user.isVerified) throw new ApiError(400, 'Account already verified. Please log in');

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);
    await user.save();

    await sendOtpEmail(email, otp);

    res.json({
      message: 'New OTP sent to your email',
      resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) throw new ApiError(400, 'Email and password required');

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      throw new ApiError(401, 'Invalid email or password');
    }

    if (!user.isVerified) {
      throw new ApiError(403, 'Please verify your email before logging in');
    }

    const token = signToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: userPayload(user),
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res) {
  res.json({ user: req.user });
}

export async function logout(req, res, next) {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;
    if (!token) throw new ApiError(400, 'No token provided');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date((decoded.exp ?? Math.floor(Date.now() / 1000) + 86400) * 1000);

    // upsert avoids errors if the same token is revoked twice
    await TokenBlacklist.updateOne(
      { tokenHash },
      { $setOnInsert: { tokenHash, expiresAt } },
      { upsert: true }
    );

    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

/* POST /auth/forgot-password
   Body: { email }
   Sends an OTP to the email if the account exists and is verified. To avoid
   email enumeration we always return 200 with a generic message. */
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) throw new ApiError(400, 'Email is required');

    const user = await User.findOne({ email }).select('+otp +otpExpiry');
    // Only real, verified accounts get an OTP — but we return the same
    // response either way so attackers can't probe for valid emails.
    if (user && user.isVerified) {
      const otp = generateOtp();
      user.otp = otp;
      user.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);
      await user.save();
      await sendOtpEmail(email, otp, { purpose: 'reset' });
    }

    res.json({
      message: 'If an account exists for that email, a reset code has been sent.',
      resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (err) {
    next(err);
  }
}

/* POST /auth/reset-password
   Body: { email, otp, newPassword } */
export async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      throw new ApiError(400, 'email, otp and newPassword are required');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new ApiError(400, 'newPassword must be at least 8 characters');
    }

    const user = await User.findOne({ email }).select('+password +otp +otpExpiry');
    if (!user || !user.isVerified) throw new ApiError(400, 'Invalid reset request');
    if (!user.otp || user.otp !== otp.toString()) throw new ApiError(400, 'Invalid OTP');
    if (user.otpExpiry <= new Date()) throw new ApiError(400, 'OTP expired. Request a new one');

    user.password = newPassword; // pre('save') hook re-hashes with bcrypt
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ message: 'Password updated. Please log in with your new password.' });
  } catch (err) {
    next(err);
  }
}

export async function googleAuth(req, res, next) {
  try {
    const { accessToken } = req.body;
    if (!accessToken) throw new ApiError(400, 'Access token required');

    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new ApiError(401, 'Invalid Google token');

    const googleUser = await r.json();

    let user = await User.findOne({ email: googleUser.email });
    if (!user) {
      user = await User.create({
        fullName: googleUser.name,
        email: googleUser.email,
        googleId: googleUser.id,
        profilePhoto: googleUser.picture || '',
        role: 'trekker',
        isVerified: true,
      });
    } else {
      if (!user.googleId) user.googleId = googleUser.id;
      if (!user.isVerified) user.isVerified = true;
      if (!user.profilePhoto && googleUser.picture) user.profilePhoto = googleUser.picture;
      await user.save();
    }

    const token = signToken(user._id);
    res.json({
      message: 'Google authentication successful',
      token,
      user: userPayload(user),
    });
  } catch (err) {
    next(err);
  }
}
