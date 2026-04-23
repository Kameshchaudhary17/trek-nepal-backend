import { Router } from 'express';
import express from 'express';
import { createPaymentIntent, handleStripeWebhook } from '../controllers/payments.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

// Webhook — Stripe posts raw JSON; signature verification needs the unparsed body.
// Mounted BEFORE the global express.json() (see app.js).
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

// Client-facing
router.post('/intent/:bookingId', protect, createPaymentIntent);

export default router;
