import mongoose from 'mongoose';

const permitSchema = new mongoose.Schema(
  { name: String, cost: Number, required: { type: Boolean, default: true } },
  { _id: false }
);

const baseCostSchema = new mongoose.Schema(
  { min: { type: Number, required: true }, max: { type: Number, required: true } },
  { _id: false }
);

const trekPricingSchema = new mongoose.Schema(
  {
    trekId:     { type: String, required: true, unique: true },
    name:       { type: String, required: true },
    region:     { type: String, required: true },
    difficulty: { type: String, required: true },
    minDays:    { type: Number, required: true },
    maxDays:    { type: Number, required: true },
    altitude:   { type: String, default: '' },
    altitudeM:  { type: Number, default: 0 },
    color:      { type: String, default: '#4a7aaa' },
    tags:       [String],
    baseCost:   { type: baseCostSchema, required: true },
    permits:    [permitSchema],
    season:     { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('TrekPricing', trekPricingSchema);
