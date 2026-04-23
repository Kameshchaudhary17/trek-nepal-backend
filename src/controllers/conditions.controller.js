import { fetchAllConditions, LOCATIONS } from '../services/weather.service.js';

export async function getConditions(req, res, next) {
  try {
    const { region, status } = req.query;

    let data = await fetchAllConditions();

    if (region) data = data.filter((d) => d.region === region);
    if (status) data = data.filter((d) => d.status === status.toLowerCase());

    const counts = { open: 0, caution: 0, closed: 0 };
    data.forEach((d) => { if (!d.error && counts[d.status] !== undefined) counts[d.status]++; });

    res.json({
      total: data.length,
      counts,
      fetchedAt: data[0]?.fetchedAt ?? new Date().toISOString(),
      conditions: data,
    });
  } catch (err) {
    next(err);
  }
}

export function getRegions(req, res) {
  const regions = [...new Set(LOCATIONS.map((l) => l.region))];
  res.json({ regions });
}
