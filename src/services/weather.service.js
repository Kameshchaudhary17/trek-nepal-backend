const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const LOCATIONS = [
  { name: "Swayambhunath (Monkey Temple)",  lat: 27.7149, lng: 85.2904, region: "Kathmandu Valley" },
  { name: "Boudhanath Stupa",               lat: 27.7215, lng: 85.3620, region: "Kathmandu Valley" },
  { name: "Pashupatinath Temple",            lat: 27.7104, lng: 85.3487, region: "Kathmandu Valley" },
  { name: "Durbar Square (Kathmandu)",       lat: 27.7045, lng: 85.3070, region: "Kathmandu Valley" },
  { name: "Changunarayan Temple",            lat: 27.7376, lng: 85.4222, region: "Kathmandu Valley" },
  { name: "Phewa Lake",                      lat: 28.2096, lng: 83.9530, region: "Pokhara" },
  { name: "Sarangkot",                       lat: 28.2436, lng: 83.9586, region: "Pokhara" },
  { name: "World Peace Pagoda",              lat: 28.1948, lng: 83.9596, region: "Pokhara" },
  { name: "Davis Falls",                     lat: 28.1902, lng: 83.9615, region: "Pokhara" },
  { name: "Gupteshwor Cave",                 lat: 28.1896, lng: 83.9609, region: "Pokhara" },
  { name: "Begnas Lake",                     lat: 28.1856, lng: 84.0747, region: "Pokhara" },
  { name: "Mahendra Cave",                   lat: 28.2508, lng: 83.9843, region: "Pokhara" },
  { name: "Lukla",                           lat: 27.6869, lng: 86.7297, region: "Khumbu" },
  { name: "Namche Bazaar",                   lat: 27.8069, lng: 86.7140, region: "Khumbu" },
  { name: "Tengboche Monastery",             lat: 27.8361, lng: 86.7647, region: "Khumbu" },
  { name: "Kala Patthar",                    lat: 27.9861, lng: 86.8267, region: "Khumbu" },
  { name: "Gokyo Lakes",                     lat: 27.9608, lng: 86.6836, region: "Khumbu" },
  { name: "Annapurna Circuit",               lat: 28.5167, lng: 84.1000, region: "Annapurna" },
  { name: "Ghorepani Poon Hill",             lat: 28.4006, lng: 83.6958, region: "Annapurna" },
  { name: "Mardi Himal",                     lat: 28.4533, lng: 83.8753, region: "Annapurna" },
  { name: "Jomsom",                          lat: 28.7811, lng: 83.7289, region: "Annapurna" },
  { name: "Tatopani",                        lat: 28.5203, lng: 83.6358, region: "Annapurna" },
  { name: "Manang",                          lat: 28.6697, lng: 84.0086, region: "Annapurna" },
  { name: "Thorong La Pass",                 lat: 28.7956, lng: 83.9278, region: "Annapurna" },
  { name: "Kyanjin Gompa",                   lat: 28.2078, lng: 85.5639, region: "Langtang" },
  { name: "Helambu Valley",                  lat: 27.9200, lng: 85.5800, region: "Langtang" },
  { name: "Chitwan National Park",           lat: 27.5291, lng: 84.3542, region: "Terai" },
  { name: "Bardia National Park",            lat: 28.3722, lng: 81.5000, region: "Terai" },
  { name: "Tharu Cultural Village",          lat: 27.5200, lng: 84.3600, region: "Terai" },
  { name: "Elephant Breeding Center",        lat: 27.5728, lng: 84.4689, region: "Terai" },
  { name: "Rara Lake",                       lat: 29.5270, lng: 82.0839, region: "Far West" },
  { name: "Rara National Park",              lat: 29.5270, lng: 82.0839, region: "Far West" },
  { name: "Khaptad National Park",           lat: 29.2200, lng: 81.1000, region: "Far West" },
  { name: "Dhorpatan Hunting Reserve",       lat: 28.5000, lng: 83.0500, region: "Far West" },
  { name: "Api Himal Base Camp",             lat: 30.0103, lng: 80.9314, region: "Far West" },
  { name: "Saipal Himal Region",             lat: 29.8500, lng: 81.3500, region: "Far West" },
  { name: "Badimalika Temple",               lat: 29.3822, lng: 81.5139, region: "Far West" },
  { name: "Muktinath Temple",                lat: 28.8167, lng: 83.8667, region: "Mustang" },
  { name: "Upper Mustang",                   lat: 29.1800, lng: 83.9700, region: "Mustang" },
  { name: "Lower Mustang",                   lat: 28.7811, lng: 83.7289, region: "Mustang" },
  { name: "Tilicho Lake",                    lat: 28.6928, lng: 83.8414, region: "Mustang" },
  { name: "Janaki Temple (Janakpur)",        lat: 26.7281, lng: 85.9261, region: "Eastern Nepal" },
  { name: "Pathivara Temple",                lat: 27.4439, lng: 87.8200, region: "Eastern Nepal" },
  { name: "Kanchenjunga Base Camp",          lat: 27.7022, lng: 87.9961, region: "Eastern Nepal" },
  { name: "Manakamana Temple",               lat: 27.9636, lng: 84.6028, region: "Central" },
  { name: "Dolpo Region",                    lat: 29.0500, lng: 82.8000, region: "Dolpo" },
];

function parseWeatherCode(code) {
  if (code === 0)  return { desc: "Clear sky",        severity: 0 };
  if (code === 1)  return { desc: "Mainly clear",     severity: 0 };
  if (code === 2)  return { desc: "Partly cloudy",    severity: 0 };
  if (code === 3)  return { desc: "Overcast",         severity: 0 };
  if (code <= 48)  return { desc: "Foggy",            severity: 1 };
  if (code <= 55)  return { desc: "Drizzle",          severity: 1 };
  if (code === 61) return { desc: "Light rain",       severity: 1 };
  if (code === 63) return { desc: "Moderate rain",    severity: 1 };
  if (code <= 67)  return { desc: "Heavy rain",       severity: 2 };
  if (code === 71) return { desc: "Light snow",       severity: 1 };
  if (code === 73) return { desc: "Moderate snow",    severity: 1 };
  if (code <= 77)  return { desc: "Heavy snow",       severity: 2 };
  if (code === 80) return { desc: "Rain showers",     severity: 1 };
  if (code === 81) return { desc: "Moderate showers", severity: 1 };
  if (code === 82) return { desc: "Violent showers",  severity: 2 };
  if (code <= 86)  return { desc: "Snow showers",     severity: 1 };
  return           { desc: "Thunderstorm",            severity: 2 };
}

function deriveStatus(code, snowfall, windspeed) {
  const { severity } = parseWeatherCode(code);
  if (severity === 2 || snowfall > 3 || windspeed > 60) return "closed";
  if (severity === 1 || snowfall > 0 || windspeed > 35) return "caution";
  return "open";
}

function deriveTrail(code, snowfall, precipitation, windspeed) {
  const { severity } = parseWeatherCode(code);
  if (severity === 2 || snowfall > 3 || windspeed > 60) return "poor";
  if (severity === 1 || snowfall > 0 || precipitation > 5 || windspeed > 35) return "fair";
  return "good";
}

let cache = null;

export async function fetchAllConditions() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const lats = LOCATIONS.map((l) => l.lat).join(",");
  const lngs = LOCATIONS.map((l) => l.lng).join(",");
  const url =
    `${OPEN_METEO}?latitude=${lats}&longitude=${lngs}` +
    `&current=temperature_2m,precipitation,windspeed_10m,weathercode,snowfall` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=Asia%2FKathmandu&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);

  const raw = await res.json();
  const results = Array.isArray(raw) ? raw : [raw];
  const fetchedAt = new Date().toISOString();

  const data = LOCATIONS.map((loc, i) => {
    const r = results[i];
    if (!r?.current) {
      return { ...loc, error: true, fetchedAt };
    }

    const code        = r.current.weathercode  ?? 0;
    const temp        = Math.round(r.current.temperature_2m  ?? 0);
    const windspeed   = Math.round(r.current.windspeed_10m   ?? 0);
    const precipitation = Math.round((r.current.precipitation ?? 0) * 10) / 10;
    const snowfall    = Math.round((r.current.snowfall        ?? 0) * 10) / 10;
    const tempMin     = Math.round(r.daily?.temperature_2m_min?.[0] ?? temp - 3);
    const tempMax     = Math.round(r.daily?.temperature_2m_max?.[0] ?? temp + 3);
    const { desc }    = parseWeatherCode(code);

    return {
      ...loc,
      temp,
      tempMin,
      tempMax,
      windspeed,
      precipitation,
      snowfall,
      weathercode: code,
      desc,
      status: deriveStatus(code, snowfall, windspeed),
      trail:  deriveTrail(code, snowfall, precipitation, windspeed),
      fetchedAt,
      error: false,
    };
  });

  cache = { data, timestamp: Date.now() };
  return data;
}

export { LOCATIONS };
