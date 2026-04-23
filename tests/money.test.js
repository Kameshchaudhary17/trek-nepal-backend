import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/* Smoke test for env-driven config module. Keeps config/env.js honest. */
describe('config/env.js', () => {
  it('exports sensible defaults when no env overrides', async () => {
    delete process.env.OTP_EXPIRY_MINUTES;
    delete process.env.OTP_RESEND_COOLDOWN_SECONDS;
    delete process.env.CLOUDINARY_SIGNED_URL_TTL_SECONDS;
    const env = await import('../src/config/env.js?nocache=' + Date.now());
    assert.equal(env.OTP_EXPIRY_MINUTES, 10);
    assert.equal(env.OTP_RESEND_COOLDOWN_SECONDS, 60);
    assert.equal(env.CLOUDINARY_SIGNED_URL_TTL_SECONDS, 3600);
    assert.equal(env.OTP_EXPIRY_MS, 600000);
    assert.ok(Array.isArray(env.AVATAR_COLORS));
    assert.ok(env.AVATAR_COLORS.length > 0);
  });
});

describe('stripe config', () => {
  it('defaults to NPR when STRIPE_CURRENCY unset', async () => {
    delete process.env.STRIPE_CURRENCY;
    const { STRIPE_CURRENCY, isStripeConfigured } = await import(
      '../src/config/stripe.js?nocache=' + Date.now()
    );
    assert.equal(STRIPE_CURRENCY, 'npr');
    assert.equal(typeof isStripeConfigured(), 'boolean');
  });
});
