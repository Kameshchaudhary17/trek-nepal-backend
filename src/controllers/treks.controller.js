import { Trek } from '../models/Trek.model.js';
import { ApiError } from '../utils/apiError.js';

/* ── Public ───────────────────────────────────────────────────── */

export async function getTreks(req, res, next) {
  try {
    const { region, difficulty, minDays, maxDays, sort = 'popular' } = req.query;
    const filter = { active: true };
    if (region)     filter.region = region;
    if (difficulty) filter.difficulty = difficulty;
    if (minDays || maxDays) {
      filter.minDays = {};
      if (minDays) filter.minDays.$gte = Number(minDays);
      if (maxDays) filter.maxDays = { $lte: Number(maxDays) };
    }

    const sortMap = {
      popular:  { createdAt: 1 },
      price:    { guideFrom: 1 },
      duration: { minDays: 1 },
      altitude: { altitudeM: -1 },
    };

    const treks = await Trek.find(filter).sort(sortMap[sort] ?? sortMap.popular);
    res.json({ total: treks.length, treks });
  } catch (err) {
    next(err);
  }
}

export async function getTrekById(req, res, next) {
  try {
    const trek = await Trek.findOne({ _id: req.params.id, active: true });
    if (!trek) return next(new ApiError(404, 'Trek not found'));
    res.json({ trek });
  } catch (err) {
    next(err);
  }
}

/* ── Admin CRUD ───────────────────────────────────────────────── */

export async function adminGetTreks(req, res, next) {
  try {
    const treks = await Trek.find().sort({ createdAt: 1 });
    res.json({ total: treks.length, treks });
  } catch (err) {
    next(err);
  }
}

export async function createTrek(req, res, next) {
  try {
    const trek = await Trek.create(req.body);
    res.status(201).json({ trek });
  } catch (err) {
    if (err.code === 11000) return next(new ApiError(409, 'A trek with that name already exists'));
    next(err);
  }
}

export async function updateTrek(req, res, next) {
  try {
    const trek = await Trek.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!trek) return next(new ApiError(404, 'Trek not found'));
    res.json({ trek });
  } catch (err) {
    next(err);
  }
}

export async function deleteTrek(req, res, next) {
  try {
    const trek = await Trek.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!trek) return next(new ApiError(404, 'Trek not found'));
    res.json({ message: 'Trek removed' });
  } catch (err) {
    next(err);
  }
}

/* ── Seed (run once if collection empty) — all amounts in NPR ─── */
const SEED_DATA = [
  { name: "Everest Base Camp", region: "Khumbu", difficulty: "Hard", minDays: 12, maxDays: 16, altitude: "5,364m", altitudeM: 5364, season: "Oct–Nov, Mar–May", bestMonths: "Oct, Apr", guideFrom: 95000, color: "#2D6A4F", tags: ["Classic", "Most Popular"], restricted: false, desc: "The world's most iconic trek through Sherpa villages, rhododendron forests and glacial moraines to the foot of the world's highest mountain.", highlights: ["Kala Patthar sunrise panorama", "Namche Bazaar acclimatisation day", "Tengboche Monastery", "Khumbu Icefall views"], permits: [{ name: "Sagarmatha National Park Entry", cost: 3000 }, { name: "TIMS Card", cost: 2000 }, { name: "Khumbu Pasang Lhamu Municipality", cost: 2000 }] },
  { name: "Annapurna Circuit", region: "Gandaki", difficulty: "Moderate–Hard", minDays: 14, maxDays: 21, altitude: "5,416m", altitudeM: 5416, season: "Oct–Nov, Mar–Apr", bestMonths: "Oct, Mar", guideFrom: 80000, color: "#5E6BAD", tags: ["Scenic", "High Pass"], restricted: false, desc: "A classic circumnavigation of the Annapurna massif crossing the legendary Thorong La Pass at 5,416m through diverse landscapes and cultures.", highlights: ["Thorong La Pass crossing", "Muktinath Temple", "Poon Hill sunrise", "Marsyangdi River gorge"], permits: [{ name: "ACAP (Annapurna Conservation Area)", cost: 3000 }, { name: "TIMS Card", cost: 2000 }] },
  { name: "Langtang Valley", region: "Bagmati", difficulty: "Moderate", minDays: 7, maxDays: 10, altitude: "3,870m", altitudeM: 3870, season: "Oct–Nov, Mar–May", bestMonths: "Nov, Apr", guideFrom: 47000, color: "#3D8A68", tags: ["Family Friendly", "Short"], restricted: false, desc: "Nepal's closest major trekking valley to Kathmandu, offering glaciers, yak pastures and Tamang Buddhist culture without the EBC crowds.", highlights: ["Kyanjin Gompa monastery", "Tserko Ri viewpoint (4,984m)", "Langtang glaciers", "Authentic Tamang villages"], permits: [{ name: "Langtang National Park Entry", cost: 3000 }, { name: "TIMS Card", cost: 2000 }] },
  { name: "Manaslu Circuit", region: "Gandaki", difficulty: "Hard", minDays: 14, maxDays: 18, altitude: "5,106m", altitudeM: 5106, season: "Sep–Nov, Mar–May", bestMonths: "Oct, Apr", guideFrom: 108000, color: "#C05621", tags: ["Remote", "Off-beaten"], restricted: true, desc: "A remote wilderness circuit around the world's eighth-highest mountain, requiring a restricted area permit and rewarding with raw Himalayan isolation.", highlights: ["Larkya La Pass (5,106m)", "Tsum Valley side trip", "Birendra Lake", "Ancient Nubri monasteries"], permits: [{ name: "Manaslu Restricted Area Permit", cost: 13500 }, { name: "Manaslu Conservation Area", cost: 3000 }, { name: "TIMS Card", cost: 2000 }] },
  { name: "Gokyo Lakes", region: "Khumbu", difficulty: "Moderate–Hard", minDays: 12, maxDays: 15, altitude: "5,357m", altitudeM: 5357, season: "Oct–Nov, Mar–May", bestMonths: "Oct, Apr", guideFrom: 88000, color: "#2E7A8A", tags: ["Lakes", "Panoramic"], restricted: false, desc: "An alternative to the EBC route offering turquoise glacial lakes, the Ngozumpa Glacier and an exceptional panoramic summit at Gokyo Ri.", highlights: ["Gokyo Ri sunrise (5,357m)", "Five Gokyo Lakes", "Ngozumpa Glacier views", "Cho Oyu reflections"], permits: [{ name: "Sagarmatha National Park Entry", cost: 3000 }, { name: "TIMS Card", cost: 2000 }] },
  { name: "Upper Mustang", region: "Gandaki", difficulty: "Moderate", minDays: 10, maxDays: 14, altitude: "3,840m", altitudeM: 3840, season: "May–Oct", bestMonths: "Jun, Sep", guideFrom: 162000, color: "#8B6914", tags: ["Restricted Area", "Cultural"], restricted: true, desc: "A forbidden kingdom frozen in time — ancient cave monasteries, wind-carved canyons and Tibetan Buddhist culture in Nepal's remote rain-shadow desert.", highlights: ["Lo Manthang walled city", "Sky caves of Mustang", "Tibetan Buddhist gompa", "Moon landscape terrain"], permits: [{ name: "Upper Mustang Restricted Area Permit", cost: 67500 }, { name: "Annapurna Conservation Area", cost: 3000 }, { name: "TIMS Card", cost: 2000 }] },
  { name: "Annapurna Base Camp", region: "Gandaki", difficulty: "Moderate", minDays: 9, maxDays: 12, altitude: "4,130m", altitudeM: 4130, season: "Oct–Nov, Mar–May", bestMonths: "Nov, Apr", guideFrom: 60000, color: "#7C3D87", tags: ["Shorter Circuit", "Glacier"], restricted: false, desc: "A dramatic journey into the heart of the Annapurna sanctuary, ending in a 360° amphitheatre ringed by eight peaks over 7,000m.", highlights: ["ABC glacier amphitheatre", "Rhododendron forests", "Machhapuchhre Base Camp", "Ghorepani sunrise"], permits: [{ name: "ACAP (Annapurna Conservation Area)", cost: 3000 }, { name: "TIMS Card", cost: 2000 }] },
  { name: "Ghorepani Poon Hill", region: "Gandaki", difficulty: "Easy", minDays: 4, maxDays: 6, altitude: "3,210m", altitudeM: 3210, season: "Oct–May", bestMonths: "Dec, Mar", guideFrom: 27000, color: "#2D5A8E", tags: ["Beginner", "Sunrise Views"], restricted: false, desc: "Nepal's most popular short trek, famous for the sunrise panorama of Dhaulagiri, Annapurna and Machhapuchhre from Poon Hill at dawn.", highlights: ["Poon Hill 3,210m sunrise", "Rhododendron bloom (Mar–Apr)", "Ulleri stone staircase", "Ghorepani village"], permits: [{ name: "ACAP (Annapurna Conservation Area)", cost: 3000 }, { name: "TIMS Card", cost: 2000 }] },
  { name: "Mardi Himal", region: "Gandaki", difficulty: "Moderate", minDays: 6, maxDays: 8, altitude: "4,500m", altitudeM: 4500, season: "Oct–Nov, Mar–May", bestMonths: "Oct, Apr", guideFrom: 47000, color: "#1E6E8A", tags: ["Off-beaten", "Quiet"], restricted: false, desc: "A hidden gem in the Annapurna region offering high-ridge walking with close-up Machhapuchhre views and far fewer trekkers than the classic routes.", highlights: ["High Camp ridge walk", "Machhapuchhre close views", "Forest Camp rhododendrons", "Peaceful teahouses"], permits: [{ name: "ACAP (Annapurna Conservation Area)", cost: 3000 }, { name: "TIMS Card", cost: 2000 }] },
  { name: "Kanchenjunga Base Camp", region: "Eastern Nepal", difficulty: "Hard", minDays: 18, maxDays: 24, altitude: "5,143m", altitudeM: 5143, season: "Oct–Nov, Mar–May", bestMonths: "Oct, Apr", guideFrom: 128000, color: "#6B3FA0", tags: ["Remote", "Pristine"], restricted: true, desc: "Nepal's most remote major trek circling the world's third-highest mountain through untouched wilderness, requiring a restricted area permit and experienced guide.", highlights: ["North & South Base Camps", "Pangpema panorama", "Rhododendron forests", "Untouched villages"], permits: [{ name: "Kanchenjunga Restricted Area Permit", cost: 2000 }, { name: "Kanchenjunga Conservation Area", cost: 3000 }, { name: "TIMS Card", cost: 2000 }] },
  { name: "Dolpo Region", region: "Karnali", difficulty: "Hard", minDays: 21, maxDays: 28, altitude: "5,190m", altitudeM: 5190, season: "May–Oct", bestMonths: "Jun, Sep", guideFrom: 148000, color: "#7A4030", tags: ["Restricted Area", "Remote", "Buddhist"], restricted: true, desc: "One of Nepal's last true wilderness areas — a high Tibetan plateau with shimmering Phoksundo Lake, ancient Bon monasteries and yak-herder culture.", highlights: ["Phoksundo Lake", "Shey Gompa monastery", "Crystal Mountain", "Kagmara La Pass (5,115m)"], permits: [{ name: "Lower Dolpo Restricted Permit", cost: 1000 }, { name: "Upper Dolpo Restricted Permit", cost: 67500 }, { name: "Shey Phoksundo NP Entry", cost: 3000 }, { name: "TIMS Card", cost: 2000 }] },
  { name: "Helambu Circuit", region: "Bagmati", difficulty: "Easy", minDays: 5, maxDays: 7, altitude: "3,640m", altitudeM: 3640, season: "Oct–May", bestMonths: "Nov, Mar", guideFrom: 34000, color: "#4A7A50", tags: ["Beginner", "Cultural", "Short"], restricted: false, desc: "A gentle loop through Hyolmo villages and Buddhist monasteries near Kathmandu — perfect for first-time trekkers seeking authentic culture without extreme altitude.", highlights: ["Tharepati ridge views", "Hyolmo villages", "Namobuddha monastery day trip", "Melamchi Ghyang gompa"], permits: [{ name: "Langtang National Park Entry", cost: 3000 }, { name: "TIMS Card", cost: 2000 }] },
];

export async function seedTreks() {
  const count = await Trek.countDocuments();
  if (count > 0) return;
  await Trek.insertMany(SEED_DATA);
  console.log('Trek collection seeded with', SEED_DATA.length, 'routes.');
}
