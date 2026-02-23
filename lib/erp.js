// lib/erp.js
// Lightweight ERP estimator based on destination zone and SG peak windows.

function toSgMinutes(tsMs) {
  const sg = new Date(tsMs + 8 * 60 * 60 * 1000);
  return {
    day: sg.getUTCDay(), // 0=Sun
    mins: sg.getUTCHours() * 60 + sg.getUTCMinutes(),
  };
}

function haversineKm(lat1, lng1, lat2, lng2) {
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

function round2(v) {
  return Math.round(v * 100) / 100;
}

// Coarse ERP-prone zones (centers + rough radius). Values represent a typical
// single-direction ERP exposure during the stated period.
const ERP_ZONES = [
  { key: "cbd-marina", lat: 1.285, lng: 103.852, radiusKm: 2.1, inbound: 3.0, outbound: 3.5, confidence: "high" },
  { key: "orchard", lat: 1.304, lng: 103.832, radiusKm: 1.2, inbound: 2.5, outbound: 2.8, confidence: "medium" },
  { key: "bugis-cityhall", lat: 1.298, lng: 103.855, radiusKm: 1.4, inbound: 2.6, outbound: 3.0, confidence: "medium" },
];

function getZone(lat, lng) {
  let best = null;
  for (const zone of ERP_ZONES) {
    const km = haversineKm(lat, lng, zone.lat, zone.lng);
    if (km <= zone.radiusKm) {
      if (!best || km < best.km) best = { ...zone, km };
    }
  }
  return best;
}

function isWeekday(day) {
  return day >= 1 && day <= 5;
}

function inInboundWindow(mins) {
  return mins >= 7 * 60 + 30 && mins <= 10 * 60;
}

function inOutboundWindow(mins) {
  return mins >= 17 * 60 && mins <= 20 * 60;
}

export function estimateErpCost({
  destinationLat,
  destinationLng,
  startTime,
  durationHours,
  isCentral = false,
}) {
  const endTime = startTime + durationHours * 60 * 60 * 1000;
  const startSg = toSgMinutes(startTime);
  const endSg = toSgMinutes(endTime);
  const zone = getZone(destinationLat, destinationLng);

  const weekdayStart = isWeekday(startSg.day);
  const weekdayEnd = isWeekday(endSg.day);
  const inboundLikely = weekdayStart && inInboundWindow(startSg.mins);
  const outboundLikely = weekdayEnd && inOutboundWindow(endSg.mins);

  let inbound = 0;
  let outbound = 0;
  let confidence = "low";
  let note = "No ERP expected for this timing/destination.";

  if (zone) {
    if (inboundLikely) inbound = zone.inbound;
    if (outboundLikely) outbound = zone.outbound;
    confidence = zone.confidence;
    if (inbound > 0 || outbound > 0) {
      note = "Estimated by destination ERP zone and peak-hour windows.";
    }
  } else if (isCentral) {
    // Fallback for central-area carparks outside the coarse zone circles.
    if (inboundLikely) inbound = 1.2;
    if (outboundLikely) outbound = 1.0;
    confidence = "low";
    if (inbound > 0 || outbound > 0) {
      note = "Estimated from central-area peak-hour exposure.";
    }
  }

  const total = inbound + outbound;
  return {
    inbound: round2(inbound),
    outbound: round2(outbound),
    total: round2(total),
    confidence,
    note,
    window: {
      inboundLikely,
      outboundLikely,
    },
    zone: zone ? zone.key : null,
  };
}
