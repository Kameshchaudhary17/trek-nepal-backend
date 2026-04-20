import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { Guide } from '../models/Guide.model.js';
import { ApiError } from '../utils/apiError.js';
import { sendOtpEmail } from '../services/email.service.js';

const AVATAR_COLORS = ['#4a7aaa', '#7a5aaa', '#4a9a6a', '#9a5a40', '#3a8a9a', '#aa7a30', '#6a4a9a', '#9a3a6a', '#3a6a5a', '#7a6a3a'];

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function userPayload(user) {
  return { id: user._id, fullName: user.fullName, email: user.email, role: user.role };
}

export async function register(req, res, next) {
  try {
    const { fullName, email, password, role, phone } = req.body;

    const existing = await User.findOne({ email });

    if (existing?.isVerified) {
      throw new ApiError(409, 'Email already registered');
    }

    // Stale unverified account — delete and recreate with fresh OTP
    if (existing && !existing.isVerified) {
      await User.deleteOne({ _id: existing._id });
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await User.create({ fullName, email, password, role, phone, otp, otpExpiry, isVerified: false });

    await sendOtpEmail(email, otp);

    res.status(201).json({ message: 'OTP sent to your email. Please verify to continue.', email });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) throw new ApiError(400, 'Email and OTP are required');

    const user = await User.findOne({ email }).select('+otp +otpExpiry');
    if (!user) throw new ApiError(404, 'No account found for this email');
    if (user.isVerified) throw new ApiError(400, 'Account already verified. Please log in');
    if (!user.otp || user.otp !== otp.toString()) throw new ApiError(400, 'Invalid OTP');
    if (user.otpExpiry < new Date()) throw new ApiError(400, 'OTP expired. Request a new one');

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Auto-create Guide profile so the guide appears in listings
    if (user.role === 'guide') {
      const alreadyExists = await Guide.findOne({ user: user._id });
      if (!alreadyExists) {
        const words = user.fullName.trim().split(/\s+/);
        const initials = words.length >= 2
          ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
          : user.fullName.slice(0, 2).toUpperCase();
        const color = AVATAR_COLORS[user._id.toString().charCodeAt(20) % AVATAR_COLORS.length];
        await Guide.create({ user: user._id, initials, color });
      }
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
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtpEmail(email, otp);

    res.json({ message: 'New OTP sent to your email' });
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
        role: 'trekker',
        isVerified: true, // Google already verified the email
      });
    } else {
      if (!user.googleId) user.googleId = googleUser.id;
      if (!user.isVerified) user.isVerified = true;
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
