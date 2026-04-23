/* Nepal trekking seasons, matched to PlatformConfig.seasons ids.
   month is 1-12 (not JS 0-11). */
function seasonIdForMonth(month) {
  if ([3, 4, 10, 11].includes(month)) return 'peak';
  if ([5, 9].includes(month))         return 'shoulder';
  if ([6, 7, 8].includes(month))      return 'low';
  return 'winter'; // 12, 1, 2
}

export function seasonForDate(date, seasons = []) {
  const month = new Date(date).getUTCMonth() + 1;
  const id = seasonIdForMonth(month);
  const match = seasons.find((s) => s.id === id);
  return match || { id, multiplier: 1 };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/* Pure function — caller passes in ratePerDay, days, startDate, and the
   resolved PlatformConfig. Returns { totalCost, breakdown }. */
export function computeBookingCost({ ratePerDay, days, startDate, config }) {
  const base = ratePerDay * days;
  const season = seasonForDate(startDate, config?.seasons);
  const seasonMultiplier = Number(season?.multiplier ?? 1);
  const subtotal = round2(base * seasonMultiplier);

  const platformFeePct = Number(config?.platformFeePct ?? 0);
  const platformFee = round2(subtotal * (platformFeePct / 100));

  const totalCost = round2(subtotal + platformFee);

  return {
    totalCost,
    breakdown: {
      base,
      seasonMultiplier,
      seasonId: season.id,
      subtotal,
      platformFeePct,
      platformFee,
    },
  };
}
