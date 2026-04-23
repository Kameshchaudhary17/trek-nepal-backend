import { Booking } from '../models/Booking.model.js';
import { Guide } from '../models/Guide.model.js';
import { ApiError } from '../utils/apiError.js';
import { getStripe, isStripeConfigured, STRIPE_CURRENCY } from '../config/stripe.js';

/* POST /api/payments/intent/:bookingId
   Trekker-only. Creates (or retrieves) a Stripe PaymentIntent for the booking
   and returns its clientSecret so the frontend can confirm card-side. */
export async function createPaymentIntent(req, res, next) {
  try {
    if (!isStripeConfigured()) {
      throw new ApiError(503, 'Payments are not yet configured on this server');
    }

    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError(404, 'Booking not found');
    if (!booking.trekker.equals(req.user._id)) {
      throw new ApiError(403, 'Only the trekker who owns this booking can pay for it');
    }
    if (booking.status !== 'confirmed') {
      throw new ApiError(400, 'Booking must be confirmed by the guide before payment');
    }
    if (booking.paymentStatus === 'paid') {
      throw new ApiError(400, 'This booking is already paid');
    }
    if (booking.paymentStatus === 'refunded') {
      throw new ApiError(400, 'This booking has been refunded and cannot be paid again');
    }
    if (!(booking.totalCost > 0)) {
      throw new ApiError(400, 'Booking has no amount due');
    }

    // Guide must still be verified — admin may have suspended them since the booking was created.
    const guide = await Guide.findById(booking.guide).select('status').lean();
    if (!guide || guide.status !== 'verified') {
      throw new ApiError(400, 'Guide is no longer available — please cancel and choose another guide');
    }

    const stripe = getStripe();
    const amountMinor = Math.round(booking.totalCost * 100); // Stripe wants cents

    let intent;
    if (booking.stripePaymentIntentId) {
      // Re-use the same intent so we don't double-charge on retries.
      intent = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
      if (intent.status === 'succeeded') {
        booking.paymentStatus = 'paid';
        booking.amountPaid = intent.amount_received / 100;
        booking.paidAt = new Date();
        await booking.save();
        throw new ApiError(400, 'This booking is already paid');
      }
      if (intent.amount !== amountMinor) {
        intent = await stripe.paymentIntents.update(booking.stripePaymentIntentId, {
          amount: amountMinor,
        });
      }
    } else {
      intent = await stripe.paymentIntents.create({
        amount: amountMinor,
        currency: STRIPE_CURRENCY,
        metadata: {
          bookingId: booking._id.toString(),
          trekkerId: booking.trekker.toString(),
          guideId:   booking.guide.toString(),
        },
        automatic_payment_methods: { enabled: true },
      });
      booking.stripePaymentIntentId = intent.id;
      booking.paymentStatus = 'processing';
      await booking.save();
    }

    res.json({
      clientSecret: intent.client_secret,
      amount: booking.totalCost,
      currency: STRIPE_CURRENCY,
      paymentStatus: booking.paymentStatus,
    });
  } catch (err) {
    next(err);
  }
}

/* POST /api/payments/webhook
   Stripe → us. Raw body required for signature verification.
   Mounted with express.raw() in routes file. */
export async function handleStripeWebhook(req, res) {
  if (!isStripeConfigured()) {
    return res.status(503).send('Stripe not configured');
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).send('STRIPE_WEBHOOK_SECRET not set');
  }

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe] webhook signature verify failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const intent = event.data?.object;
    const bookingId = intent?.metadata?.bookingId;

    switch (event.type) {
      case 'payment_intent.succeeded': {
        if (!bookingId) break;
        // Idempotent: only move forward from unpaid/processing/failed → paid.
        // Never regress from 'refunded' (a late retry after a refund must NOT re-mark paid).
        await Booking.updateOne(
          { _id: bookingId, paymentStatus: { $in: ['unpaid', 'processing', 'failed'] } },
          {
            $set: {
              paymentStatus: 'paid',
              amountPaid: (intent.amount_received ?? intent.amount) / 100,
              paidAt: new Date(),
            },
          }
        );
        break;
      }
      case 'payment_intent.payment_failed': {
        if (!bookingId) break;
        // Only mark failed if the intent hasn't already succeeded/refunded.
        await Booking.updateOne(
          { _id: bookingId, paymentStatus: { $in: ['unpaid', 'processing'] } },
          { $set: { paymentStatus: 'failed' } }
        );
        break;
      }
      case 'charge.refunded': {
        // Look up booking via payment_intent on the charge.
        const pi = intent?.payment_intent;
        if (!pi) break;
        await Booking.updateOne(
          { stripePaymentIntentId: pi, paymentStatus: { $ne: 'refunded' } },
          { $set: { paymentStatus: 'refunded' } }
        );
        break;
      }
      default:
        // Ignore — Stripe sends a lot of events we don't care about.
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[stripe] webhook handler error:', err);
    res.status(500).json({ received: false });
  }
}
