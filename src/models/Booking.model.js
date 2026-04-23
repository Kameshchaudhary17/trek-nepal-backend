import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    trekker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    guide: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guide',
      required: true,
    },
    route: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    days: {
      type: Number,
      required: true,
      min: 1,
      max: 90,
    },
    message: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },
    ratePerDay: {
      type: Number,
      default: 0,
    },
    totalCost: {
      type: Number,
      default: 0,
    },
    costBreakdown: {
      base:             { type: Number, default: 0 }, // ratePerDay * days
      seasonMultiplier: { type: Number, default: 1 },
      seasonId:         { type: String, default: '' },
      subtotal:         { type: Number, default: 0 }, // base * seasonMultiplier
      platformFeePct:   { type: Number, default: 0 },
      platformFee:      { type: Number, default: 0 },
    },
    guideNote: {
      type: String,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'processing', 'paid', 'failed', 'refunded'],
      default: 'unpaid',
    },
    stripePaymentIntentId: {
      type: String,
      default: '',
      index: true,
    },
    amountPaid: { type: Number, default: 0 },
    paidAt:     { type: Date },
  },
  { timestamps: true }
);

bookingSchema.index({ trekker: 1, createdAt: -1 });
bookingSchema.index({ guide: 1, status: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
