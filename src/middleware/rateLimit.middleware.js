import rateLimit from 'express-rate-limit';

const jsonMessage = (message) => ({ message });

/* Login / password — brute-force protection per IP. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonMessage('Too many login attempts. Please try again in 15 minutes.'),
});

/* OTP verify / resend — 6-digit codes are brute-forceable. */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonMessage('Too many OTP attempts. Please wait before trying again.'),
});

/* Public uploads run BEFORE the account exists, so protect by IP only. */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonMessage('Upload limit reached. Please try again later.'),
});

/* AI endpoints do DB reads — cheap but scriptable. Keep public callers honest. */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonMessage('Too many AI requests. Please slow down.'),
});
