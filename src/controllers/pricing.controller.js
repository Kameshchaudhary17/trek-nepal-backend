import TrekPricing from '../models/TrekPricing.model.js';
import PlatformConfig from '../models/PlatformConfig.model.js';

/* ── Seed data (all values in NPR — Nepalese Rupee) ───────────────── */
const TREK_SEED = [
  {
    trekId: 'ebc', name: 'Everest Base Camp', region: 'Khumbu',
    difficulty: 'Hard', minDays: 12, maxDays: 16,
    altitude: '5,364m', altitudeM: 5364, color: '#4a7aaa',
    tags: ['Classic', 'Most Popular'],
    baseCost: { min: 95000, max: 160000 },
    permits: [
      { name: 'Sagarmatha National Park', cost: 3000 },
      { name: 'TIMS Card', cost: 2000 },
      { name: 'Khumbu Pasang Lhamu Rural Municipality', cost: 2000 },
    ],
    season: 'Oct–Nov, Mar–May',
  },
  {
    trekId: 'annapurna', name: 'Annapurna Circuit', region: 'Gandaki',
    difficulty: 'Moderate–Hard', minDays: 14, maxDays: 21,
    altitude: '5,416m', altitudeM: 5416, color: '#7a5aaa',
    tags: ['Scenic', 'High Pass'],
    baseCost: { min: 80000, max: 135000 },
    permits: [
      { name: 'ACAP (Annapurna Conservation Area)', cost: 3000 },
      { name: 'TIMS Card', cost: 2000 },
    ],
    season: 'Oct–Nov, Mar–Apr',
  },
  {
    trekId: 'langtang', name: 'Langtang Valley', region: 'Bagmati',
    difficulty: 'Moderate', minDays: 7, maxDays: 10,
    altitude: '3,870m', altitudeM: 3870, color: '#4a9a6a',
    tags: ['Family Friendly'],
    baseCost: { min: 47000, max: 80000 },
    permits: [
      { name: 'Langtang National Park', cost: 3000 },
      { name: 'TIMS Card', cost: 2000 },
    ],
    season: 'Oct–Nov, Mar–May',
  },
  {
    trekId: 'manaslu', name: 'Manaslu Circuit', region: 'Gandaki',
    difficulty: 'Hard', minDays: 14, maxDays: 18,
    altitude: '5,106m', altitudeM: 5106, color: '#9a5a40',
    tags: ['Remote', 'Off-beaten'],
    baseCost: { min: 108000, max: 190000 },
    permits: [
      { name: 'Manaslu Restricted Area Permit', cost: 13500 },
      { name: 'Manaslu Conservation Area', cost: 3000 },
      { name: 'TIMS Card', cost: 2000 },
    ],
    season: 'Sep–Nov, Mar–May',
  },
  {
    trekId: 'gokyo', name: 'Gokyo Lakes', region: 'Khumbu',
    difficulty: 'Moderate–Hard', minDays: 12, maxDays: 15,
    altitude: '5,357m', altitudeM: 5357, color: '#3a8a9a',
    tags: ['Lakes', 'Panoramic'],
    baseCost: { min: 88000, max: 150000 },
    permits: [
      { name: 'Sagarmatha National Park', cost: 3000 },
      { name: 'TIMS Card', cost: 2000 },
    ],
    season: 'Oct–Nov, Mar–May',
  },
  {
    trekId: 'mustang', name: 'Upper Mustang', region: 'Gandaki',
    difficulty: 'Moderate', minDays: 10, maxDays: 14,
    altitude: '3,840m', altitudeM: 3840, color: '#aa7a30',
    tags: ['Restricted Area', 'Cultural'],
    baseCost: { min: 162000, max: 270000 },
    permits: [
      { name: 'Upper Mustang Restricted Area Permit', cost: 67500 },
      { name: 'Annapurna Conservation Area', cost: 3000 },
      { name: 'TIMS Card', cost: 2000 },
    ],
    season: 'May–Oct',
  },
  {
    trekId: 'helambu', name: 'Helambu Circuit', region: 'Bagmati',
    difficulty: 'Easy', minDays: 5, maxDays: 8,
    altitude: '3,640m', altitudeM: 3640, color: '#6aaa4a',
    tags: ['Beginner', 'Near Kathmandu'],
    baseCost: { min: 27000, max: 54000 },
    permits: [
      { name: 'Shivapuri-Nagarjun National Park', cost: 1500 },
      { name: 'TIMS Card', cost: 2000 },
    ],
    season: 'Sep–May',
  },
  {
    trekId: 'dolpo', name: 'Dolpo Circuit', region: 'Karnali',
    difficulty: 'Hard', minDays: 20, maxDays: 28,
    altitude: '5,360m', altitudeM: 5360, color: '#8a3a7a',
    tags: ['Remote', 'Restricted Area'],
    baseCost: { min: 200000, max: 340000 },
    permits: [
      { name: 'Dolpo Restricted Area Permit', cost: 67500 },
      { name: 'Shey Phoksundo National Park', cost: 3000 },
      { name: 'TIMS Card', cost: 2000 },
    ],
    season: 'Jun–Oct',
  },
];

const CONFIG_SEED = {
  platformFeePct: 5,
  porterRatePerDay: { min: 2000, max: 3000 },
  guideTiers: [
    {
      id: 'standard', label: 'Standard Guide',
      desc: 'NTB certified, 1–3 yrs experience, basic first aid',
      ratePerDay: { min: 3000, max: 5000 }, color: '#4a9a6a',
    },
    {
      id: 'senior', label: 'Senior Guide',
      desc: '5+ yrs experience, advanced first aid, strong English',
      ratePerDay: { min: 5000, max: 7000 }, color: '#4a7aaa',
    },
    {
      id: 'expert', label: 'Expert / High-Altitude',
      desc: '10+ yrs, summit credentials, multilingual, logistics expert',
      ratePerDay: { min: 7000, max: 10000 }, color: '#e0b874',
    },
  ],
  seasons: [
    { id: 'peak',     label: 'Peak Season (Oct–Nov, Mar–Apr)', multiplier: 1.00, badge: 'Most Popular' },
    { id: 'shoulder', label: 'Shoulder (May, Sep)',             multiplier: 0.85, badge: 'Good Value' },
    { id: 'low',      label: 'Low / Monsoon (Jun–Aug)',         multiplier: 0.65, badge: 'Budget Friendly' },
    { id: 'winter',   label: 'Winter (Dec–Feb)',                multiplier: 0.75, badge: 'Quiet Trails' },
  ],
  aiNotice:
    'AI pricing suggestions coming soon — our model will factor season, demand and trek difficulty to recommend the fairest rate for your booking.',
};

export async function seedPricing() {
  const [trekCount, configCount] = await Promise.all([
    TrekPricing.countDocuments(),
    PlatformConfig.countDocuments(),
  ]);
  if (trekCount === 0) {
    await TrekPricing.insertMany(TREK_SEED);
    console.log(`Seeded ${TREK_SEED.length} trek pricing records.`);
  }
  if (configCount === 0) {
    await PlatformConfig.create(CONFIG_SEED);
    console.log('Seeded platform config.');
  }
}

/* ── Handlers ───────────────────────────────────────────────────── */

// GET /api/pricing/config  →  full config for public use
export async function getPricingConfig(req, res, next) {
  try {
    const [trekPrices, config] = await Promise.all([
      TrekPricing.find({}).lean(),
      PlatformConfig.findOne({}).lean(),
    ]);
    res.json({
      trekPrices,
      guideTiers:       config?.guideTiers       ?? [],
      seasons:          config?.seasons          ?? [],
      porterRatePerDay: config?.porterRatePerDay ?? { min: 15, max: 22 },
      platformFeePct:   config?.platformFeePct   ?? 5,
      aiNotice:         config?.aiNotice         ?? '',
      updatedAt:        config?.updatedAt,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/pricing/treks  →  admin list all trek prices
export async function adminGetTrekPrices(req, res, next) {
  try {
    const treks = await TrekPricing.find({}).lean();
    res.json({ treks });
  } catch (err) {
    next(err);
  }
}

// PUT /api/pricing/treks/:trekId  →  admin update trek pricing
export async function adminUpdateTrekPrice(req, res, next) {
  try {
    const { trekId } = req.params;
    const updated = await TrekPricing.findOneAndUpdate(
      { trekId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Trek pricing not found.' });
    res.json({ trek: updated });
  } catch (err) {
    next(err);
  }
}

// PUT /api/pricing/config  →  admin update global config
export async function adminUpdateConfig(req, res, next) {
  try {
    const config = await PlatformConfig.findOneAndUpdate(
      {},
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ config });
  } catch (err) {
    next(err);
  }
}
