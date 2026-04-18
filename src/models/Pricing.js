const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema({
  trekId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  baseDays: {
    type: Number,
    required: true
  },
  baseCost: {
    type: Number,
    required: true,
    min: 0
  },
  permitCost: {
    type: Number,
    required: true,
    default: 0
  },
  guideRates: {
    standard: {
      min: { type: Number, required: true },
      max: { type: Number, required: true }
    },
    expert: {
      min: { type: Number, required: true },
      max: { type: Number, required: true }
    }
  },
  platformFeePct: {
    type: Number,
    required: true,
    default: 10,
    min: 0,
    max: 100
  },
  aiDynamicPricingEnabled: {
    type: Boolean,
    default: false
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

const Pricing = mongoose.model('Pricing', pricingSchema);

const guideRateProposalSchema = new mongoose.Schema({
  guideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  trekId: {
    type: String,
    required: true
  },
  proposedRatePerDay: {
    type: Number,
    required: true
  },
  reasoning: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

const GuideRateProposal = mongoose.model('GuideRateProposal', guideRateProposalSchema);

module.exports = {
  Pricing,
  GuideRateProposal
};
