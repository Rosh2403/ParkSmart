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
 * HDB rates (EPS):
 *   Non-Central:          $0.60/30min, day cap $12, night cap $5
 *   Central (Mon-Sat 7am-5pm):  $1.20/30min, day cap $20, night cap $5
 *   Central (other hours):      $0.60/30min (same as non-central)
 *
 * URA: $1.20/30min, day cap $20, night cap $5
 * LTA (malls): $3.00/hr, day cap $30, no night cap
 *
 * Night period: 10:30pm–7am → $5 flat cap (HDB/URA only)
 *
 * Peak carparks: selected carparks charge +$0.20/30min during peak windows
 *
 * Source: hdb.gov.sg/car-parks/shortterm-parking/short-term-parking-charges
 */

// Official HDB Central Area carpark IDs (hdb.gov.sg)
const CENTRAL_AREA_CARPARKS = new Set([
  "ACB", "BBB", "BRB1", "CY", "DUXM", "HLM",
  "KAB", "KAM", "KAS", "PRM", "SLS", "SR1",
  "SR2", "TPM", "UCS", "WCB",
]);

// Peak hour carparks: +$0.20/30min above base rate during peak windows (SGT)
// Source: hdb.gov.sg/car-parks/shortterm-parking/short-term-parking-charges
// Each period: { days: 'weekday'|'weekend'|'monToSat'|'daily', s: startHour, e: endHour }
const PEAK_CARPARKS = {
  ACB:  { periods: [{ days: "weekday", s: 10, e: 18 }, { days: "weekend", s: 8, e: 19 }] },
  CY:   { periods: [{ days: "weekday", s: 10, e: 18 }, { days: "weekend", s: 8, e: 19 }] },
  SE21: { periods: [{ days: "monToSat", s: 10, e: 22 }] },
  SE22: { periods: [{ days: "monToSat", s: 10, e: 22 }] },
  SE24: { periods: [{ days: "daily", s: 10, e: 22 }] },
  MP14: { periods: [{ days: "daily", s: 8, e: 20 }] },
  MP15: { periods: [{ days: "daily", s: 8, e: 20 }] },
  MP16: { periods: [{ days: "daily", s: 8, e: 20 }] },
  HG9:  { periods: [{ days: "weekday", s: 11, e: 20 }, { days: "weekend", s: 9, e: 20 }] },
  HG9T: { periods: [{ days: "weekday", s: 11, e: 20 }, { days: "weekend", s: 9, e: 20 }] },
  HG15: { periods: [{ days: "weekday", s: 11, e: 20 }, { days: "weekend", s: 9, e: 20 }] },
  HG16: { periods: [{ days: "weekday", s: 11, e: 20 }, { days: "weekend", s: 9, e: 20 }] },
};

const RATES = {
  HDB: {
    nonCentral: { perHalfHour: 0.60, dayCap: 12, nightCap: 5 },
    // Central: biz hours (Mon-Sat 7am-5pm) = $1.20/30min; other day = $0.60/30min
    central: { bizHalfHour: 1.20, stdHalfHour: 0.60, dayCap: 20, nightCap: 5 },
  },
  URA: {
    default: { perHalfHour: 1.20, dayCap: 20, nightCap: 5 },
  },
  LTA: {
    default: { perHour: 3.00, dayCap: 30 },
  },
};

// Fallback bounding box for URA / unknown carparks (Singapore central area)
const CENTRAL_BOUNDS = { minLat: 1.27, maxLat: 1.31, minLng: 103.82, maxLng: 103.87 };

/**
 * Determine if a carpark is in the Central Area.
 * HDB: uses the official ID list. LTA: uses the Area field. Others: geographic fallback.
 */
function isCentralArea(carparkId, lat, lng, area) {
  if (CENTRAL_AREA_CARPARKS.has(carparkId)) return true;
  if (area && ["Marina", "Orchard", "HarbFront"].includes(area)) return true;
  return (
    lat >= CENTRAL_BOUNDS.minLat && lat <= CENTRAL_BOUNDS.maxLat &&
    lng >= CENTRAL_BOUNDS.minLng && lng <= CENTRAL_BOUNDS.maxLng
  );
}

/**
 * Returns ms of overlap between [startMs, endMs] and Mon-Sat 7am-5pm SGT (business hours).
 * Used to determine which portion of a Central Area session uses the $1.20/30min rate.
 */
function getBusinessHoursMs(startMs, endMs) {
  if (endMs <= startMs) return 0;
  const SGT_OFFSET = 8 * 3600 * 1000;
  const DAY_MS     = 24 * 3600 * 1000;
  let total = 0;

  const firstSgDate = new Date(startMs + SGT_OFFSET);
  let midnightUtc = Date.UTC(
    firstSgDate.getUTCFullYear(), firstSgDate.getUTCMonth(), firstSgDate.getUTCDate()
  ) - SGT_OFFSET;

  while (midnightUtc < endMs) {
    const dow = new Date(midnightUtc + SGT_OFFSET).getUTCDay(); // 0=Sun, 6=Sat
    if (dow >= 1 && dow <= 6) { // Mon-Sat
      const bizStart = midnightUtc + 7  * 3600 * 1000; // 7am SGT
      const bizEnd   = midnightUtc + 17 * 3600 * 1000; // 5pm SGT
      total += Math.max(0, Math.min(endMs, bizEnd) - Math.max(startMs, bizStart));
    }
    midnightUtc += DAY_MS;
  }
  return total;
}

/**
 * Returns ms of overlap between [startMs, endMs] and peak-hour windows for a carpark.
 * Peak windows are always daytime so they never overlap with the night period.
 *
 * @param {string|null} carparkId
 * @param {number} startMs
 * @param {number} endMs
 * @returns {number}
 */
function getPeakHoursMs(carparkId, startMs, endMs) {
  const def = carparkId ? PEAK_CARPARKS[carparkId] : null;
  if (!def || endMs <= startMs) return 0;

  const SGT_OFFSET = 8 * 3600 * 1000;
  const DAY_MS     = 24 * 3600 * 1000;
  let total = 0;

  const firstSgDate = new Date(startMs + SGT_OFFSET);
  let midnightUtc = Date.UTC(
    firstSgDate.getUTCFullYear(), firstSgDate.getUTCMonth(), firstSgDate.getUTCDate()
  ) - SGT_OFFSET;

  while (midnightUtc < endMs) {
    const dow = new Date(midnightUtc + SGT_OFFSET).getUTCDay();
    for (const p of def.periods) {
      const applies =
        p.days === "daily" ||
        (p.days === "weekday"  && dow >= 1 && dow <= 5) ||
        (p.days === "weekend"  && (dow === 0 || dow === 6)) ||
        (p.days === "monToSat" && dow >= 1 && dow <= 6);
      if (applies) {
        const peakStart = midnightUtc + p.s * 3600 * 1000;
        const peakEnd   = midnightUtc + p.e * 3600 * 1000;
        total += Math.max(0, Math.min(endMs, peakEnd) - Math.max(startMs, peakStart));
      }
    }
    midnightUtc += DAY_MS;
  }
  return total;
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
 * Calculate estimated parking cost, correctly split across all time boundaries:
 *   - Night period (10:30pm–7am): $5 flat cap for HDB/URA
 *   - Central Area HDB: $1.20/30min Mon-Sat 7am-5pm; $0.60/30min all other day hours
 *   - Peak carparks: +$0.20/30min during their peak window
 *
 * @param {string} agency - HDB, URA, or LTA
 * @param {number} durationHours - parking duration in hours
 * @param {boolean} isCentral - whether in central area
 * @param {number} [startTime] - Unix timestamp ms when parking starts (default: now)
 * @param {string|null} [carparkId] - carpark ID for peak-hour lookup (optional)
 * @returns {{ cost, ratePerHour, rateLabel, capLabel, capApplied, isNightRate, dayHours, nightHours, nightCapApplied }}
 */
export function calculateParkingCost(agency, durationHours, isCentral, startTime = Date.now(), carparkId = null) {
  if (agency === "LTA") {
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

  const durationMs = durationHours * 3600 * 1000;
  const endTime    = startTime + durationMs;

  const { cutoverMs, morningMs } = getNightBoundaries(startTime);

  // ── Night overlap (10:30pm → 7am) ───────────────────────────────────────
  const nightMs    = Math.max(0, Math.min(endTime, morningMs) - Math.max(startTime, cutoverMs));
  const nightHours = nightMs / 3600000;

  // ── Day overlap (everything that is NOT night) ───────────────────────────
  const dayMs = durationMs - nightMs;

  // ── URA / non-central HDB: flat rate all day hours ───────────────────────
  if (agency === "URA" || !isCentral) {
    const rate    = agency === "URA" ? RATES.URA.default : RATES.HDB.nonCentral;
    const perHour = rate.perHalfHour * 2;

    const rawDayCost = (dayMs / 3600000) * perHour;
    const dayCost    = Math.min(rawDayCost, rate.dayCap);

    const rawNightCost   = nightHours * perHour;
    const nightCost      = nightHours > 0 ? Math.min(rawNightCost, rate.nightCap) : 0;
    const nightCapApplied = nightHours > 0 && rawNightCost > rate.nightCap;

    // Peak premium: +$0.20/30min = +$0.40/hr for specific carparks
    const peakMs      = getPeakHoursMs(carparkId, startTime, endTime);
    const peakPremium = (peakMs / 3600000) * 0.40;

    const totalCost = dayCost + nightCost + peakPremium;

    return {
      cost: Math.round(totalCost * 100) / 100,
      ratePerHour: perHour,
      rateLabel: `$${rate.perHalfHour.toFixed(2)}/30min`,
      capLabel: nightHours > 0 ? `$${rate.nightCap} night cap` : `$${rate.dayCap}/day cap`,
      capApplied: rawDayCost > rate.dayCap || nightCapApplied,
      isNightRate: nightHours > 0,
      dayHours: Math.round((dayMs / 3600000) * 100) / 100,
      nightHours: Math.round(nightHours * 100) / 100,
      nightCapApplied,
    };
  }

  // ── Central Area HDB: time-varying day rate ──────────────────────────────
  // Mon-Sat 7am-5pm: $1.20/30min ($2.40/hr)
  // All other day hours:   $0.60/30min ($1.20/hr)
  // Night: $5 flat cap
  // Day cap: $20
  const rate = RATES.HDB.central;

  const bizMs      = getBusinessHoursMs(startTime, endTime); // Mon-Sat 7am-5pm overlap
  const stdDayMs   = dayMs - bizMs;                         // evenings, Sundays, etc.

  const bizHours    = bizMs / 3600000;
  const stdDayHours = stdDayMs / 3600000;

  const rawBizCost    = bizHours    * rate.bizHalfHour * 2;  // $2.40/hr
  const rawStdDayCost = stdDayHours * rate.stdHalfHour * 2;  // $1.20/hr
  const rawDayCost    = rawBizCost + rawStdDayCost;
  const dayCost       = Math.min(rawDayCost, rate.dayCap);   // $20 day cap

  const rawNightCost   = nightHours * rate.bizHalfHour * 2;  // use higher rate for cap comparison
  const nightCost      = nightHours > 0 ? Math.min(rawNightCost, rate.nightCap) : 0;
  const nightCapApplied = nightHours > 0 && rawNightCost > rate.nightCap;

  // Peak premium: +$0.20/30min for ACB/CY during their peak windows
  const peakMs      = getPeakHoursMs(carparkId, startTime, endTime);
  const peakPremium = (peakMs / 3600000) * 0.40;

  const totalCost = dayCost + nightCost + peakPremium;

  // rateLabel: describe the predominant day rate
  const rateLabel = bizHours > 0
    ? `$${rate.bizHalfHour.toFixed(2)}/30min (biz hrs) / $${rate.stdHalfHour.toFixed(2)}/30min (other)`
    : `$${rate.stdHalfHour.toFixed(2)}/30min`;

  return {
    cost: Math.round(totalCost * 100) / 100,
    ratePerHour: bizHours > 0 ? rate.bizHalfHour * 2 : rate.stdHalfHour * 2,
    rateLabel,
    capLabel: nightHours > 0 ? `$${rate.nightCap} night cap` : `$${rate.dayCap}/day cap`,
    capApplied: rawDayCost > rate.dayCap || nightCapApplied,
    isNightRate: nightHours > 0,
    dayHours: Math.round((dayMs / 3600000) * 100) / 100,
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

    const isCentral = isCentralArea(cp.CarParkID, loc.lat, loc.lng, cp.Area);
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
          const paidCostInfo = calculateParkingCost(agency, paidDurationHours, isCentral, cutoverMs, cp.CarParkID);
          costInfo = {
            ...paidCostInfo,
            capLabel: "Free until 10:30PM + $5 night cap",
          };
        }
      } else {
        // FPS carpark but search time is outside the free window (before 7am or after 10:30pm)
        costInfo = calculateParkingCost(agency, durationHours, isCentral, startTime, cp.CarParkID);
      }
    } else {
      costInfo = calculateParkingCost(agency, durationHours, isCentral, startTime, cp.CarParkID);
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
