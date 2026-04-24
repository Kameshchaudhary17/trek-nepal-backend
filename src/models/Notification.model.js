import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      // e.g. 'booking.confirmed', 'booking.rejected', 'booking.cancelled',
      //      'booking.completed', 'payment.paid', 'payment.refunded',
      //      'review.new', 'message.new'
    },
    title: { type: String, required: true, maxlength: 200 },
    body:  { type: String, default: '', maxlength: 1000 },
    link:  { type: String, default: '', maxlength: 500 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
