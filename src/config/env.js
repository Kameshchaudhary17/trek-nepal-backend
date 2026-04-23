/* Centralized tunables. All values override-able via env. */

const num = (key, fallback) => {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

export const OTP_EXPIRY_MINUTES            = num('OTP_EXPIRY_MINUTES', 10);
export const OTP_RESEND_COOLDOWN_SECONDS   = num('OTP_RESEND_COOLDOWN_SECONDS', 60);
export const OTP_EXPIRY_MS                 = OTP_EXPIRY_MINUTES * 60 * 1000;

export const CLOUDINARY_SIGNED_URL_TTL_SECONDS = num('CLOUDINARY_SIGNED_URL_TTL_SECONDS', 3600);

/* Avatar palette used for generated guide avatars. Override with comma-separated
   hex list in AVATAR_COLORS env var. */
const DEFAULT_AVATAR_COLORS = [
  '#4a7aaa', '#7a5aaa', '#4a9a6a', '#9a5a40', '#3a8a9a',
  '#aa7a30', '#6a4a9a', '#9a3a6a', '#3a6a5a', '#7a6a3a',
];

export const AVATAR_COLORS = (process.env.AVATAR_COLORS
  ? process.env.AVATAR_COLORS.split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_AVATAR_COLORS);

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
