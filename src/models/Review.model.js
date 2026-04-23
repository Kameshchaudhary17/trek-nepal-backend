import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true, // one review per booking
    },
    guide: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guide',
      required: true,
      index: true,
    },
    trekker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
  },
  { timestamps: true }
);

reviewSchema.index({ guide: 1, createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
