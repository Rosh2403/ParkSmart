import { isSundayOrPH } from "./publicHolidays.js";

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

const MALL_RATE_OVERRIDES = [
  {
    key: "jurong_point",
    aliases: ["jurongpoint", "jurongpointshoppingcentre", "jp1", "jp2"],
    calculate({ durationHours, startTime }) {
      const sgNow = new Date(startTime + 8 * 3600 * 1000);
      const dow = sgNow.getUTCDay(); // 0=Sun, 6=Sat
      const mins = sgNow.getUTCHours() * 60 + sgNow.getUTCMinutes();
      const isWeekendOrPH = dow === 0 || dow === 6 || isSundayOrPH(startTime);
      const isDayWindow = mins >= 7 * 60 && mins < 22 * 60; // 7am-10pm

      if (isDayWindow && isWeekendOrPH) {
        return calcFirstHourThenHalfHour({
          durationHours,
          firstHour: 1.8,
          perHalfHour: 0.9,
          rateLabel: "$1.80 first hr, $0.90/30min",
          capLabel: "Jurong Point published rates",
        });
      }

      if (isDayWindow) {
        return calcFirstHourThenHalfHour({
          durationHours,
          firstHour: 1.5,
          perHalfHour: 0.75,
          rateLabel: "$1.50 first hr, $0.75/30min",
          capLabel: "Jurong Point published rates",
        });
      }

      return calcFirstHourThenHalfHour({
        durationHours,
        firstHour: 1.2,
        perHalfHour: 0.6,
        rateLabel: "$1.20 first hr, $0.60/30min",
        capLabel: "Jurong Point published rates",
      });
    },
  },
];

export function calculateMallOverrideCost({ carparkId = "", carparkName = "", durationHours, startTime }) {
  const idNorm = normalizeName(carparkId);
  const nameNorm = normalizeName(carparkName);

  const match = MALL_RATE_OVERRIDES.find((m) =>
    m.aliases.some((a) => {
      const alias = normalizeName(a);
      return alias && (idNorm.includes(alias) || nameNorm.includes(alias));
    })
  );

  if (!match) return null;
  return match.calculate({ durationHours, startTime });
}

