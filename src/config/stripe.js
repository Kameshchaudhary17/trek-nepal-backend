import Stripe from 'stripe';

/* Lazy singleton — boot must not fail if Stripe isn't configured yet.
   Callers should check isStripeConfigured() before using the client. */
let client = null;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe() {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured — set STRIPE_SECRET_KEY in .env');
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  }
  return client;
}

// Nepal: default to NPR. Stripe supports NPR as a presentment currency;
// whether you can charge in NPR depends on your Stripe account country.
export const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY || 'npr').toLowerCase();

// Stripe expects a minor unit for most currencies (cents = 1/100). NPR has
// no subdivision in practice; Stripe still treats it as 1/100, so Rs. 1 = 100.
export const STRIPE_MINOR_UNIT_MULTIPLIER = 100;
