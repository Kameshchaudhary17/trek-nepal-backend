import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeBookingCost, seasonForDate } from '../src/utils/pricing.js';

const CONFIG = {
  platformFeePct: 5,
  seasons: [
    { id: 'peak',     multiplier: 1.0  },
    { id: 'shoulder', multiplier: 0.85 },
    { id: 'low',      multiplier: 0.65 },
    { id: 'winter',   multiplier: 0.75 },
  ],
};

describe('seasonForDate', () => {
  it('matches October to peak', () => {
    const s = seasonForDate('2026-10-15', CONFIG.seasons);
    assert.equal(s.id, 'peak');
  });

  it('matches July to low (monsoon)', () => {
    const s = seasonForDate('2026-07-15', CONFIG.seasons);
    assert.equal(s.id, 'low');
  });

  it('matches January to winter', () => {
    const s = seasonForDate('2026-01-15', CONFIG.seasons);
    assert.equal(s.id, 'winter');
  });

  it('matches May to shoulder', () => {
    const s = seasonForDate('2026-05-15', CONFIG.seasons);
    assert.equal(s.id, 'shoulder');
  });

  it('returns multiplier 1 when season is missing from config', () => {
    const s = seasonForDate('2026-07-15', []);
    assert.equal(s.multiplier, 1);
  });
});

describe('computeBookingCost', () => {
  it('applies peak multiplier + 5% fee', () => {
    const { totalCost, breakdown } = computeBookingCost({
      ratePerDay: 5000, days: 10, startDate: '2026-10-15', config: CONFIG,
    });
    assert.equal(breakdown.base, 50000);
    assert.equal(breakdown.seasonMultiplier, 1);
    assert.equal(breakdown.subtotal, 50000);
    assert.equal(breakdown.platformFee, 2500);
    assert.equal(totalCost, 52500);
  });

  it('applies low multiplier correctly (NPR example)', () => {
    const { totalCost, breakdown } = computeBookingCost({
      ratePerDay: 5000, days: 10, startDate: '2026-07-15', config: CONFIG,
    });
    assert.equal(breakdown.seasonId, 'low');
    assert.equal(breakdown.subtotal, 32500);     // 50000 * 0.65
    assert.equal(breakdown.platformFee, 1625);    // 5% of 32500
    assert.equal(totalCost, 34125);
  });

  it('handles zero ratePerDay gracefully', () => {
    const { totalCost, breakdown } = computeBookingCost({
      ratePerDay: 0, days: 7, startDate: '2026-04-01', config: CONFIG,
    });
    assert.equal(breakdown.base, 0);
    assert.equal(totalCost, 0);
  });

  it('falls back to multiplier 1 if config is null', () => {
    const { totalCost, breakdown } = computeBookingCost({
      ratePerDay: 4000, days: 5, startDate: '2026-07-15', config: null,
    });
    assert.equal(breakdown.seasonMultiplier, 1);
    assert.equal(breakdown.platformFeePct, 0);
    assert.equal(totalCost, 20000);
  });
});
