import mongoose from 'mongoose';

const guideSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    specialty: { type: String, default: '' },
    region: {
      type: String,
      enum: ['Khumbu', 'Gandaki', 'Bagmati', 'Mustang', 'Karnali', 'Mechi', 'Other'],
      default: 'Other',
    },
    experience: { type: Number, default: 0, min: 0 },
    ratePerDay: { type: Number, default: 0, min: 0 },
    verified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    languages: { type: [String], default: ['English', 'Nepali'] },
    routes: { type: [String], default: [] },
    bio: { type: String, default: '' },
    nationalIdPublicId: { type: String, default: '' },
    treksCompleted: { type: Number, default: 0, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    color: { type: String, default: '#4a7aaa' },
    initials: { type: String, default: '' },
  },
  { timestamps: true }
);

guideSchema.index({ region: 1, verified: 1, averageRating: -1 });
guideSchema.index({ ratePerDay: 1 });

export const Guide = mongoose.model('Guide', guideSchema);
