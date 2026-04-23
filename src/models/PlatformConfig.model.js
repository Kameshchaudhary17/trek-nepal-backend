import mongoose from 'mongoose';

const rateBandSchema = new mongoose.Schema(
  { min: Number, max: Number },
  { _id: false }
);

const guideTierSchema = new mongoose.Schema(
  {
    id:         String,
    label:      String,
    desc:       String,
    ratePerDay: rateBandSchema,
    color:      String,
  },
  { _id: false }
);

const seasonSchema = new mongoose.Schema(
  {
    id:         String,
    label:      String,
    multiplier: Number,
    badge:      String,
  },
  { _id: false }
);

// Singleton doc — always fetch the first (and only) record
const platformConfigSchema = new mongoose.Schema(
  {
    platformFeePct:   { type: Number, default: 5, min: 0, max: 100 },
    porterRatePerDay: rateBandSchema,
    guideTiers:       [guideTierSchema],
    seasons:          [seasonSchema],
    aiNotice:         { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('PlatformConfig', platformConfigSchema);
