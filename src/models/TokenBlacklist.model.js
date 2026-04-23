import mongoose from 'mongoose';

/* Stores SHA-256 hash of revoked JWTs.
   TTL index on `expiresAt` auto-purges entries once the underlying token
   would have expired anyway — keeps the collection bounded. */
const tokenBlacklistSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema);
