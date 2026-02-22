import { isSundayOrPH } from "./publicHolidays.js";
import { MALL_RATES_CATALOG } from "../data/mallRatesCatalog.js";

function roundCurrency(v) {
  return Math.round(v * 100) / 100;
}

function roundUpHalfHours(hours) {
  return Math.max(0, Math.ceil(hours * 2));
}

function normalizeName(value) {
  return (value || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcFirstHourThenHalfHour({ durationHours, firstHour, perHalfHour, rateLabel, capLabel }) {
  const cost = durationHours <= 1
    ? firstHour
    : firstHour + roundUpHalfHours(durationHours - 1) * perHalfHour;

  return {
    cost: roundCurrency(cost),
    ratePerHour: perHalfHour * 2,
    rateLabel,
    capLabel,
    capApplied: false,
    isNightRate: false,
    dayHours: durationHours,
    nightHours: 0,
    nightCapApplied: false,
    rateSource: "official",
    rateSourceLabel: "Official",
  };
}

function calculateFromTariff(tariff, durationHours, startTime) {
  if (!tariff || tariff.type !== "first_hour_then_half_hour") return null;
  const sgNow = new Date(startTime + 8 * 3600 * 1000);
  const dow = sgNow.getUTCDay(); // 0=Sun, 6=Sat
  const mins = sgNow.getUTCHours() * 60 + sgNow.getUTCMinutes();
  const isWeekendOrPH = dow === 0 || dow === 6 || isSundayOrPH(startTime);

  const dayStartMins = Number.isFinite(tariff.dayStartMins) ? tariff.dayStartMins : 7 * 60;
  const dayEndMins = Number.isFinite(tariff.dayEndMins) ? tariff.dayEndMins : 22 * 60;
  const isDayWindow = mins >= dayStartMins && mins < dayEndMins;

  let band = tariff.night;
  if (isDayWindow) {
    band = isWeekendOrPH ? tariff.weekendOrPH : tariff.weekday;
  }
  if (!band) return null;

  return calcFirstHourThenHalfHour({
    durationHours,
    firstHour: band.firstHour,
    perHalfHour: band.perHalfHour,
    rateLabel: band.rateLabel,
    capLabel: tariff.capLabel || "Published mall rates",
  });
}

export function calculateMallOverrideCost({
  carparkId = "",
  carparkName = "",
  carparkArea = "",
  carparkLat = null,
  carparkLng = null,
  destinationName = "",
  durationHours,
  startTime,
}) {
  const idNorm = normalizeName(carparkId);
  const nameNorm = normalizeName(carparkName);
  const areaNorm = normalizeName(carparkArea);
  const destNorm = normalizeName(destinationName);

  const match = MALL_RATES_CATALOG.find((m) =>
    m.aliases.some((a) => {
      const alias = normalizeName(a);
      return alias && (
        idNorm.includes(alias) ||
        nameNorm.includes(alias) ||
        areaNorm.includes(alias) ||
        destNorm.includes(alias)
      );
    }) || (
      m.geofence &&
      Number.isFinite(carparkLat) &&
      Number.isFinite(carparkLng) &&
      haversineMeters(carparkLat, carparkLng, m.geofence.lat, m.geofence.lng) <= m.geofence.radiusM &&
      m.aliases.some((a) => destNorm.includes(normalizeName(a)))
    )
  );

  if (!match) return null;
  return calculateFromTariff(match.tariff, durationHours, startTime);
}
