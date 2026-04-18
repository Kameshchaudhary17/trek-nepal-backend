import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/apiError.js';

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

export async function register(req, res, next) {
  try {
    const { fullName, email, password, role, phone } = req.body;

    const existing = await User.findOne({ email });
    if (existing) throw new ApiError(409, 'Email already registered');

    const user = await User.create({ fullName, email, password, role, phone });

    const token = signToken(user._id);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
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

    const token = signToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
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
      });
    } else if (!user.googleId) {
      user.googleId = googleUser.id;
      await user.save();
    }

    const token = signToken(user._id);
    res.json({
      message: 'Google authentication successful',
      token,
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}
