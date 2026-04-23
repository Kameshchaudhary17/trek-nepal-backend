import mongoose from 'mongoose';

const permitSchema = new mongoose.Schema(
  { name: { type: String, required: true }, cost: { type: Number, required: true, min: 0 } },
  { _id: false }
);

const trekSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, unique: true, trim: true },
    region:      { type: String, required: true, trim: true },
    difficulty:  { type: String, required: true, enum: ['Easy', 'Moderate', 'Moderate–Hard', 'Hard'] },
    minDays:     { type: Number, required: true, min: 1 },
    maxDays:     { type: Number, required: true, min: 1 },
    altitude:    { type: String, required: true },   // display string e.g. "5,364m"
    altitudeM:   { type: Number, required: true },   // numeric for sorting
    season:      { type: String, required: true },
    bestMonths:  { type: String, required: true },
    guideFrom:   { type: Number, required: true, min: 0 },
    color:       { type: String, default: '#2D6A4F' },
    tags:        { type: [String], default: [] },
    restricted:  { type: Boolean, default: false },
    desc:        { type: String, default: '' },
    highlights:  { type: [String], default: [] },
    permits:     { type: [permitSchema], default: [] },
    photo:       { type: String, default: '' },
    active:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

trekSchema.index({ region: 1, difficulty: 1 });
trekSchema.index({ altitudeM: -1 });
trekSchema.index({ guideFrom: 1 });

export const Trek = mongoose.model('Trek', trekSchema);
