// lib/parking.js
// LTA DataMall Carpark Availability API integration + SG parking rate engine

const LTA_API_URL = "http://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2";

/**
 * Fetch carpark availability from LTA DataMall.
 * API returns: CarParkID, Area, Development, Location (lat lng), AvailableLots, LotType, Agency
 * Paginated at 500 records per call.
 */
export async function fetchCarparkAvailability(apiKey) {
  const allCarparks = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const url = skip > 0 ? `${LTA_API_URL}?$skip=${skip}` : LTA_API_URL;
    const res = await fetch(url, {
      headers: { AccountKey: apiKey, accept: "application/json" },
    });

    if (!res.ok) throw new Error(`LTA API error: ${res.status}`);

    const data = await res.json();
    const records = data.value || [];
    allCarparks.push(...records);

    if (records.length < 500) {
      hasMore = false;
    } else {
      skip += 500;
    }
  }

  return allCarparks;
}

/**
 * Parse LTA location string "LAT LONG" into {lat, lng}
 */
export function parseLocation(locationStr) {
  if (!locationStr || typeof locationStr !== "string") return null;
  const parts = locationStr.trim().split(" ");
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
  return { lat, lng };
}

/**
 * Calculate distance between two points using Haversine formula (in km)
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate walking time from distance in km (average 5 km/h)
 */
export function estimateWalkTime(distanceKm) {
  return Math.round((distanceKm / 5) * 60);
}

/**
 * Singapore parking rate engine
 * 
 * HDB rates (EPS - Electronic Parking System):
 *   Non-Central: $0.60 per 30 min ($1.20/hr)
 *   Central: $1.20 per 30 min ($2.40/hr)
 *   Night cap (10:30pm-7am): $5
 *   Whole-day cap (non-central): $12
 *   Whole-day cap (central): $20
 * 
 * URA rates: Similar to HDB central
 * 
 * LTA carparks (malls): Varies, typically $2-5/hr
 * 
 * Agency field from API: HDB, URA, LTA
 * Area field from API: Marina, Orchard, HarbFront, JurongLakeDistrict (LTA only)
 */
const RATES = {
  HDB: {
    nonCentral: { perHalfHour: 0.60, dayCap: 12, nightCap: 5 },
    central: { perHalfHour: 1.20, dayCap: 20, nightCap: 5 },
  },
  URA: {
    default: { perHalfHour: 1.20, dayCap: 20, nightCap: 5 },
  },
  LTA: {
    // LTA carparks are typically malls — rates vary but we use averages
    default: { perHour: 3.00, dayCap: 30 },
  },
};

// Central area postal districts (rough bounding box for Singapore central)
// Districts 1-8: Central
const CENTRAL_BOUNDS = {
  minLat: 1.27,
  maxLat: 1.31,
  minLng: 103.82,
  maxLng: 103.87,
};

function isCentralArea(lat, lng, area) {
  // If LTA Area field indicates central areas
  if (area && ["Marina", "Orchard", "HarbFront"].includes(area)) return true;
  // Rough geographic check
  return (
    lat >= CENTRAL_BOUNDS.minLat &&
    lat <= CENTRAL_BOUNDS.maxLat &&
    lng >= CENTRAL_BOUNDS.minLng &&
    lng <= CENTRAL_BOUNDS.maxLng
  );
}

/**
 * Calculate estimated parking cost
 * @param {string} agency - HDB, URA, or LTA
 * @param {number} durationHours - parking duration in hours
 * @param {boolean} isCentral - whether in central area
 * @returns {{ cost: number, rate: string, cap: string }}
 */
export function calculateParkingCost(agency, durationHours, isCentral) {
  if (agency === "LTA") {
    const rate = RATES.LTA.default;
    const cost = Math.min(durationHours * rate.perHour, rate.dayCap);
    return {
      cost: Math.round(cost * 100) / 100,
      ratePerHour: rate.perHour,
      rateLabel: `$${rate.perHour.toFixed(2)}/hr`,
      capLabel: `$${rate.dayCap}/day cap`,
      capApplied: durationHours * rate.perHour > rate.dayCap,
    };
  }

  const rateKey = agency === "URA" ? "default" : isCentral ? "central" : "nonCentral";
  const rate = agency === "URA" ? RATES.URA[rateKey] : RATES.HDB[rateKey];
  const perHour = rate.perHalfHour * 2;
  const rawCost = durationHours * perHour;
  const cost = Math.min(rawCost, rate.dayCap);

  return {
    cost: Math.round(cost * 100) / 100,
    ratePerHour: perHour,
    rateLabel: `$${rate.perHalfHour.toFixed(2)}/30min`,
    capLabel: `$${rate.dayCap}/day cap`,
    capApplied: rawCost > rate.dayCap,
  };
}

/**
 * Score a carpark based on multiple factors
 * @param {object} carpark - processed carpark object
 * @param {string} priority - "cheapest" | "closest" | "balanced" | "best_value"
 * @returns {number} score 0-100
 */
export function scoreCarpark(carpark, priority = "balanced") {
  const { cost, distanceKm, availableLots } = carpark;

  // Normalize each factor to 0-100
  const maxCost = 30;
  const costScore = Math.max(0, (1 - cost / maxCost) * 100);
  const distScore = Math.max(0, (1 - Math.min(distanceKm / 2, 1)) * 100);
  const availScore = Math.min(availableLots / 50, 1) * 100; // 50+ lots = perfect score

  const weights = {
    cheapest: { cost: 0.60, dist: 0.20, avail: 0.20 },
    closest: { cost: 0.20, dist: 0.60, avail: 0.20 },
    balanced: { cost: 0.35, dist: 0.35, avail: 0.30 },
    best_value: { cost: 0.45, dist: 0.30, avail: 0.25 },
  };

  const w = weights[priority] || weights.balanced;
  return Math.round(costScore * w.cost + distScore * w.dist + availScore * w.avail);
}

/**
 * Process raw LTA carpark data into our app format
 */
export function processCarparks(rawCarparks, destLat, destLng, durationHours, priority, radiusKm = 2) {
  const processed = [];

  for (const cp of rawCarparks) {
    // Only process car lots (not motorcycle/heavy vehicle)
    if (cp.LotType && cp.LotType !== "C") continue;

    const loc = parseLocation(cp.Location);
    if (!loc) continue;

    const distanceKm = haversineDistance(loc.lat, loc.lng, destLat, destLng);
    if (distanceKm > radiusKm) continue;

    const isCentral = isCentralArea(loc.lat, loc.lng, cp.Area);
    const costInfo = calculateParkingCost(cp.Agency || "HDB", durationHours, isCentral);
    const availableLots = parseInt(cp.AvailableLots) || 0;

    const carpark = {
      id: cp.CarParkID,
      name: cp.Development || `Carpark ${cp.CarParkID}`,
      agency: cp.Agency || "HDB",
      area: cp.Area || "",
      lat: loc.lat,
      lng: loc.lng,
      distanceKm: Math.round(distanceKm * 100) / 100,
      walkTimeMin: estimateWalkTime(distanceKm),
      availableLots,
      isCentral,
      ...costInfo,
    };

    carpark.score = scoreCarpark(carpark, priority);
    processed.push(carpark);
  }

  // Sort by score descending
  processed.sort((a, b) => b.score - a.score);

  // Assign badges
  if (processed.length > 0) {
    processed[0].badge = "BEST MATCH";
    const cheapest = [...processed].sort((a, b) => a.cost - b.cost)[0];
    const closest = [...processed].sort((a, b) => a.distanceKm - b.distanceKm)[0];
    if (cheapest.id !== processed[0].id) {
      const cp = processed.find((c) => c.id === cheapest.id);
      if (cp && !cp.badge) cp.badge = "CHEAPEST";
    }
    if (closest.id !== processed[0].id) {
      const cp = processed.find((c) => c.id === closest.id);
      if (cp && !cp.badge) cp.badge = "NEAREST";
    }
  }

  return processed;
}
