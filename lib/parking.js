// lib/parking.js
// LTA DataMall Carpark Availability API integration + SG parking rate engine

import { FPS_CARPARKS } from "./fpsCarparks.js";
import { isSundayOrPH } from "./publicHolidays.js";

const LTA_API_URL = "https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2";

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
    const url = skip > 0 ? `${LTA_API_URL}?%24skip=${skip}` : LTA_API_URL;
    const res = await fetch(url, {
      headers: { AccountKey: apiKey, accept: "application/json" },
      // Abort if LTA API doesn't respond within 8 seconds
      signal: AbortSignal.timeout(8000),
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
 * Returns key time boundaries for the night period that contains or follows `tsMs`,
 * in Singapore time (UTC+8).
 *
 * Night period: 10:30pm SGT → 7:00am SGT (next day)
 * FPS window:  7:00am SGT  → 10:30pm SGT (same day)
 *
 * Two cases:
 *   Before 7am SGT → still in PREVIOUS night (yesterday 10:30pm → today 7am)
 *   After  7am SGT → next night starts tonight (today 10:30pm → tomorrow 7am)
 *
 * @param {number} tsMs - Unix timestamp in ms
 * @returns {{ cutoverMs: number, morningMs: number, fpsStartMs: number }}
 */
function getNightBoundaries(tsMs) {
  const sgMs = tsMs + 8 * 3600 * 1000;
  const sgDate = new Date(sgMs);

  // Midnight SGT of the current date (expressed as UTC ms)
  const midnightUtcMs =
    Date.UTC(sgDate.getUTCFullYear(), sgDate.getUTCMonth(), sgDate.getUTCDate()) -
    8 * 3600 * 1000;

  const todayFpsStart  = midnightUtcMs + 7 * 3600 * 1000;                   // 7:00am today SGT
  const todayCutover   = midnightUtcMs + 22 * 3600 * 1000 + 30 * 60 * 1000; // 10:30pm today SGT
  const tomorrowMorning = todayCutover + 8.5 * 3600 * 1000;                  // 7:00am tomorrow SGT

  if (tsMs < todayFpsStart) {
    // Before 7am: still in last night (yesterday 10:30pm → today 7am)
    const yesterdayCutover = todayCutover - 24 * 3600 * 1000;
    return { cutoverMs: yesterdayCutover, morningMs: todayFpsStart, fpsStartMs: todayFpsStart };
  }

  // 7am or later: next night starts at today's 10:30pm
  return { cutoverMs: todayCutover, morningMs: tomorrowMorning, fpsStartMs: todayFpsStart };
}

/**
 * Calculate estimated parking cost, split across day/night boundaries.
 *
 * @param {string} agency - HDB, URA, or LTA
 * @param {number} durationHours - parking duration in hours
 * @param {boolean} isCentral - whether in central area
 * @param {number} [startTime] - Unix timestamp ms when parking starts (default: now)
 * @returns {{ cost, ratePerHour, rateLabel, capLabel, capApplied, isNightRate, dayHours, nightHours, nightCapApplied }}
 */
export function calculateParkingCost(agency, durationHours, isCentral, startTime = Date.now()) {
  if (agency === "LTA") {
    // LTA mall carparks: no night cap, flat hourly rate
    const rate = RATES.LTA.default;
    const cost = Math.min(durationHours * rate.perHour, rate.dayCap);
    return {
      cost: Math.round(cost * 100) / 100,
      ratePerHour: rate.perHour,
      rateLabel: `$${rate.perHour.toFixed(2)}/hr`,
      capLabel: `$${rate.dayCap}/day cap`,
      capApplied: durationHours * rate.perHour > rate.dayCap,
      isNightRate: false,
      dayHours: durationHours,
      nightHours: 0,
      nightCapApplied: false,
    };
  }

  const rateKey = agency === "URA" ? "default" : isCentral ? "central" : "nonCentral";
  const rate = agency === "URA" ? RATES.URA[rateKey] : RATES.HDB[rateKey];
  const perHour = rate.perHalfHour * 2;
  const durationMs = durationHours * 3600 * 1000;
  const endTime = startTime + durationMs;

  const { cutoverMs, morningMs } = getNightBoundaries(startTime);

  // Determine how the parking session overlaps with day and night periods
  // Night period: cutoverMs → morningMs
  const nightStart = cutoverMs;
  const nightEnd = morningMs;

  const overlapStart = Math.max(startTime, nightStart);
  const overlapEnd = Math.min(endTime, nightEnd);
  const nightMs = Math.max(0, overlapEnd - overlapStart);
  const dayMs = durationMs - nightMs;

  const dayHours = dayMs / 3600000;
  const nightHours = nightMs / 3600000;

  // Day cost capped at dayCap
  const rawDayCost = dayHours * perHour;
  const dayCost = Math.min(rawDayCost, rate.dayCap);

  // Night cost capped at nightCap ($5)
  const rawNightCost = nightHours * perHour;
  const nightCost = nightHours > 0 ? Math.min(rawNightCost, rate.nightCap) : 0;
  const nightCapApplied = nightHours > 0 && rawNightCost > rate.nightCap;

  const totalCost = dayCost + nightCost;

  return {
    cost: Math.round(totalCost * 100) / 100,
    ratePerHour: perHour,
    rateLabel: `$${rate.perHalfHour.toFixed(2)}/30min`,
    capLabel: nightHours > 0 ? `$${rate.nightCap} night cap` : `$${rate.dayCap}/day cap`,
    capApplied: rawDayCost > rate.dayCap || nightCapApplied,
    isNightRate: nightHours > 0,
    dayHours: Math.round(dayHours * 100) / 100,
    nightHours: Math.round(nightHours * 100) / 100,
    nightCapApplied,
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
 * Process raw LTA carpark data into our app format.
 * Applies time-aware pricing and FPS (Free Parking Scheme) for Sun/PH.
 *
 * @param {Array} rawCarparks
 * @param {number} destLat
 * @param {number} destLng
 * @param {number} durationHours
 * @param {string} priority
 * @param {number} [radiusKm]
 * @param {number} [startTime] - Unix ms for when parking begins (default: Date.now())
 */
export function processCarparks(rawCarparks, destLat, destLng, durationHours, priority, radiusKm = 2, startTime = Date.now()) {
  if (!durationHours || durationHours <= 0) durationHours = 0.5;
  const processed = [];
  const isFreeDay = isSundayOrPH(startTime);

  for (const cp of rawCarparks) {
    // Only process car lots (not motorcycle/heavy vehicle)
    if (cp.LotType && cp.LotType !== "C") continue;

    const loc = parseLocation(cp.Location);
    if (!loc) continue;

    const distanceKm = haversineDistance(loc.lat, loc.lng, destLat, destLng);
    if (distanceKm > radiusKm) continue;

    const isCentral = isCentralArea(loc.lat, loc.lng, cp.Area);
    const agency = cp.Agency || "HDB";

    // Check Free Parking Scheme: HDB/URA carparks in FPS_CARPARKS are free on Sun/PH 7am–10:30pm
    const isFpsCarpark = agency !== "LTA" && FPS_CARPARKS.has(cp.CarParkID);

    // Only "free today" if startTime falls within the FPS window (7am–10:30pm SGT)
    let isFreeToday = false;
    let costInfo;

    if (isFreeDay && isFpsCarpark) {
      const { fpsStartMs, cutoverMs } = getNightBoundaries(startTime);
      const withinFpsWindow = startTime >= fpsStartMs && startTime < cutoverMs;

      if (withinFpsWindow) {
        isFreeToday = true;
        const endTime = startTime + durationHours * 3600 * 1000;

        if (endTime <= cutoverMs) {
          // Session ends before 10:30pm — entirely free
          costInfo = {
            cost: 0,
            ratePerHour: 0,
            rateLabel: "FREE",
            capLabel: "Sun/PH Free Parking",
            capApplied: false,
            isNightRate: false,
            dayHours: durationHours,
            nightHours: 0,
            nightCapApplied: false,
          };
        } else {
          // Session crosses 10:30pm: free portion + paid night portion
          // Free: startTime → 10:30pm
          // Paid: 10:30pm → endTime  (calculateParkingCost handles night cap)
          const paidDurationHours = (endTime - cutoverMs) / 3600000;
          const paidCostInfo = calculateParkingCost(agency, paidDurationHours, isCentral, cutoverMs);
          costInfo = {
            ...paidCostInfo,
            capLabel: "Free until 10:30PM + $5 night cap",
          };
        }
      } else {
        // FPS carpark but search time is outside the free window (before 7am or after 10:30pm)
        costInfo = calculateParkingCost(agency, durationHours, isCentral, startTime);
      }
    } else {
      costInfo = calculateParkingCost(agency, durationHours, isCentral, startTime);
    }

    const availableLots = parseInt(cp.AvailableLots) || 0;

    const carpark = {
      id: cp.CarParkID,
      name: cp.Development || `Carpark ${cp.CarParkID}`,
      agency,
      area: cp.Area || "",
      lat: loc.lat,
      lng: loc.lng,
      distanceKm: Math.round(distanceKm * 100) / 100,
      walkTimeMin: estimateWalkTime(distanceKm),
      availableLots,
      isCentral,
      isFreeToday,
      ...costInfo,
    };

    // Free carparks get a boosted cost score
    carpark.score = isFreeToday
      ? Math.round(100 * 0.60 + scoreCarpark({ ...carpark, cost: 0 }, priority) * 0.40)
      : scoreCarpark(carpark, priority);

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

/**
 * Generate time-aware recommendation banners for the results view.
 *
 * Returns 0–1 recommendations (highest priority type wins):
 *   SUNDAY_FREE   > EVENING_SOON > NIGHT_ACTIVE > EARLY_BIRD
 *
 * @param {Array} carparks - already-processed carpark list
 * @param {number} startTime - Unix ms for current/search time
 * @param {number} durationHours - parking duration
 * @returns {Array<object>} recommendation objects (at most one per priority)
 */
export function getTimeAwareRecommendations(carparks, startTime, durationHours) {
  const recommendations = [];
  if (!carparks || carparks.length === 0) return recommendations;

  const sgMs = startTime + 8 * 3600 * 1000;
  const sgDate = new Date(sgMs);
  const hour = sgDate.getUTCHours();
  const minute = sgDate.getUTCMinutes();
  const totalMinutes = hour * 60 + minute; // minutes since midnight SG

  const CUTOVER_MINS = 22 * 60 + 30; // 10:30pm = 1350 min
  const MORNING_MINS = 7 * 60;        // 7:00am = 420 min

  // Helper: is current time in night period (10:30pm–7am)?
  const isNight =
    totalMinutes >= CUTOVER_MINS || totalMinutes < MORNING_MINS;

  // 1. SUNDAY_FREE — highest priority
  const freeCarparks = carparks.filter((cp) => cp.isFreeToday);
  if (freeCarparks.length > 0) {
    recommendations.push({ type: "SUNDAY_FREE", freeCount: freeCarparks.length });
    return recommendations; // Only show one banner
  }

  // 2. EVENING_SOON — within 30 min of 10:30pm cutover (day period only)
  if (!isNight) {
    const minsUntilCutover = CUTOVER_MINS - totalMinutes;
    if (minsUntilCutover > 0 && minsUntilCutover <= 30) {
      // Find cheapest carpark and compare current vs post-cutover cost
      const hdbUraCarparks = carparks.filter((cp) => cp.agency !== "LTA");
      if (hdbUraCarparks.length > 0) {
        const cheapestNow = hdbUraCarparks.reduce((a, b) => (a.cost < b.cost ? a : b));
        const futureStart = startTime + minsUntilCutover * 60 * 1000;
        const futureCost = calculateParkingCost(
          cheapestNow.agency,
          durationHours,
          cheapestNow.isCentral,
          futureStart
        );
        const savings = cheapestNow.cost - futureCost.cost;
        if (savings > 0.50) {
          recommendations.push({
            type: "EVENING_SOON",
            waitMinutes: Math.ceil(minsUntilCutover),
            savingsAmount: Math.round(savings * 100) / 100,
            bestCarpark: cheapestNow,
          });
          return recommendations;
        }
      }
    }
  }

  // 3. NIGHT_ACTIVE — it's currently night time
  if (isNight) {
    recommendations.push({ type: "NIGHT_ACTIVE", nightCapDollars: 5.00 });
    return recommendations;
  }

  // 4. EARLY_BIRD — before 10am with LTA carparks in results
  if (totalMinutes < 10 * 60) {
    const ltaCount = carparks.filter((cp) => cp.agency === "LTA").length;
    if (ltaCount > 0) {
      recommendations.push({ type: "EARLY_BIRD", ltaCount });
      return recommendations;
    }
  }

  return recommendations;
}
