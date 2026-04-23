import { Trek } from '../models/Trek.model.js';
import PlatformConfig from '../models/PlatformConfig.model.js';
import { ApiError } from '../utils/apiError.js';
import { seasonForDate } from '../utils/pricing.js';

/* POST /api/ai/price-check
   Body: { trekId, startDate, days, tierId }
   Returns a fair-rate window for the trek given the season and guide tier.
   Deterministic — no LLM — but uses the same multipliers the real booking
   engine applies. */
export async function priceCheck(req, res, next) {
  try {
    const { trekId, startDate, days, tierId } = req.body;
    if (!trekId || !startDate || !days || !tierId) {
      throw new ApiError(400, 'trekId, startDate, days and tierId are required');
    }

    const [trek, config] = await Promise.all([
      Trek.findById(trekId).lean(),
      PlatformConfig.findOne({}).lean(),
    ]);
    if (!trek) throw new ApiError(404, 'Trek not found');
    if (!config) throw new ApiError(500, 'Platform pricing not configured');

    const tier = (config.guideTiers || []).find((t) => t.id === tierId);
    if (!tier) throw new ApiError(400, `Unknown guide tier: ${tierId}`);

    const dayCount = Number(days);
    if (!Number.isInteger(dayCount) || dayCount < 1) {
      throw new ApiError(400, 'days must be a positive integer');
    }

    const season = seasonForDate(startDate, config.seasons);
    const mult = Number(season.multiplier ?? 1);

    const guideMin = Math.round(tier.ratePerDay.min * dayCount * mult);
    const guideMax = Math.round(tier.ratePerDay.max * dayCount * mult);
    const permitTotal = (trek.permits || []).reduce((s, p) => s + (p.cost || 0), 0);
    const fair = {
      guideRange: { min: guideMin, max: guideMax },
      permitTotal,
      totalEstimate: {
        min: guideMin + permitTotal,
        max: guideMax + permitTotal,
      },
    };

    res.json({
      trek: { id: trek._id, name: trek.name, region: trek.region },
      season,
      tier: { id: tier.id, label: tier.label, bandPerDay: tier.ratePerDay },
      days: dayCount,
      currency: 'NPR',
      estimate: fair,
      notice: 'Suggested range from admin-set tier bands × seasonal multiplier. Final rate is set by the guide within this window.',
    });
  } catch (err) {
    next(err);
  }
}

/* GET /api/ai/permits/:trekId — what permits does the trekker need? */
export async function permitsFor(req, res, next) {
  try {
    const trek = await Trek.findById(req.params.trekId).lean();
    if (!trek) throw new ApiError(404, 'Trek not found');

    const permits = (trek.permits || []).map((p) => ({ name: p.name, cost: p.cost }));
    const total = permits.reduce((s, p) => s + (p.cost || 0), 0);

    res.json({
      trek: { id: trek._id, name: trek.name, region: trek.region, restricted: !!trek.restricted },
      permits,
      total,
      currency: 'NPR',
      notes: trek.restricted
        ? 'This is a restricted-area trek — permits must be arranged through a registered trekking agency, and solo trekking is not allowed.'
        : 'Permits are typically arranged in Kathmandu or Pokhara before departure. Keep two passport photocopies on hand.',
    });
  } catch (err) {
    next(err);
  }
}

/* GET /api/ai/planner/:trekId — day-by-day outline from trek highlights. */
export async function planner(req, res, next) {
  try {
    const trek = await Trek.findById(req.params.trekId).lean();
    if (!trek) throw new ApiError(404, 'Trek not found');

    const days = Math.max(trek.minDays || 1, 1);
    const highlights = Array.isArray(trek.highlights) ? trek.highlights : [];

    // Spread highlights roughly across the days. Buffer with acclimatisation
    // days for treks above 4000m.
    const schedule = [];
    const total = days;
    const highlightCount = highlights.length || 1;

    for (let i = 1; i <= total; i++) {
      const hi = highlights[Math.min(
        Math.floor(((i - 1) / total) * highlightCount),
        highlightCount - 1,
      )];
      const isAccl =
        (trek.altitudeM || 0) > 4000 && (i === Math.ceil(total / 3) || i === Math.ceil((2 * total) / 3));
      schedule.push({
        day: i,
        title: isAccl ? 'Acclimatisation day' : hi || 'Trekking day',
        note: isAccl
          ? 'Rest day at altitude — short side hike, hydrate, sleep low.'
          : 'Continue along the main route.',
      });
    }

    res.json({
      trek: { id: trek._id, name: trek.name, region: trek.region, altitude: trek.altitude },
      days: total,
      schedule,
      disclaimer:
        'Indicative plan only. Your NTB-verified guide will adjust pace for weather, acclimatisation and group fitness.',
    });
  } catch (err) {
    next(err);
  }
}
