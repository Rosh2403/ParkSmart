/**
 * Spend log storage — Supabase-backed.
 * Async I/O functions: logSpend, getSpendLog, clearSpendLog, deleteEntry.
 * Pure analytics functions take the log array as first argument so the stats
 * page can derive all views from a single in-memory fetch.
 */
import supabase from "./supabase";
import { getDeviceId } from "./deviceId";

function dispatch(log) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("spendLogChange", { detail: log }));
  }
}

function rowToEntry(row) {
  return {
    id:            row.id,
    carparkName:   row.carpark_name,
    carparkId:     row.carpark_id,
    agency:        row.agency,
    cost:          parseFloat(row.cost),
    durationHours: parseFloat(row.duration_hours),
    parkedAt:      row.parked_at,
    endedAt:       row.ended_at,
    lat:           row.lat,
    lng:           row.lng,
  };
}

/** Log a completed parking session. */
export async function logSpend({ carparkName, carparkId, agency, cost, durationHours, parkedAt, endedAt, lat, lng }) {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  const { error } = await supabase.from("spend_log").insert({
    id:             `spend_${parkedAt}`,
    device_id:      deviceId,
    carpark_name:   carparkName || "Unknown Carpark",
    carpark_id:     carparkId || null,
    agency:         agency || "HDB",
    cost:           Math.round(cost * 100) / 100,
    duration_hours: Math.round(durationHours * 10) / 10,
    parked_at:      parkedAt,
    ended_at:       endedAt,
    lat:            lat ?? null,
    lng:            lng ?? null,
  });
  if (error) { console.error("logSpend:", error.message); return; }
  dispatch(await getSpendLog());
}

/** Get all spend log entries for this device, newest first. */
export async function getSpendLog() {
  const deviceId = getDeviceId();
  if (!deviceId) return [];
  const { data, error } = await supabase
    .from("spend_log")
    .select("*")
    .eq("device_id", deviceId)
    .order("parked_at", { ascending: false });
  if (error) { console.error("getSpendLog:", error.message); return []; }
  return (data || []).map(rowToEntry);
}

/** Delete all entries for this device. */
export async function clearSpendLog() {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  const { error } = await supabase.from("spend_log").delete().eq("device_id", deviceId);
  if (error) { console.error("clearSpendLog:", error.message); return; }
  dispatch([]);
}

/** Delete a single entry by id. */
export async function deleteEntry(id) {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  const { error } = await supabase
    .from("spend_log")
    .delete()
    .eq("device_id", deviceId)
    .eq("id", id);
  if (error) { console.error("deleteEntry:", error.message); return; }
  dispatch(await getSpendLog());
}

// ── Pure analytics functions (operate on in-memory log array) ──────────────

/** Total spend for given SGT year + 0-indexed month. */
export function getMonthlyTotal(log, year, month) {
  return getMonthEntries(log, year, month).reduce((s, e) => s + e.cost, 0);
}

/** Entries for given SGT year + 0-indexed month. */
export function getMonthEntries(log, year, month) {
  return log.filter((e) => {
    const d = new Date(e.parkedAt + 8 * 3600 * 1000);
    return d.getUTCFullYear() === year && d.getUTCMonth() === month;
  });
}

/** Last `weeks` weekly totals, oldest → newest. */
export function getWeeklyTotals(log, weeks = 8) {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const idx        = weeks - 1 - i;
    const weekStart  = now - (idx + 1) * 7 * 24 * 3600 * 1000;
    const weekEnd    = now -  idx      * 7 * 24 * 3600 * 1000;
    const total      = log
      .filter((e) => e.parkedAt >= weekStart && e.parkedAt < weekEnd)
      .reduce((s, e) => s + e.cost, 0);
    const label = new Date(weekStart).toLocaleDateString("en-SG", {
      month: "short", day: "numeric", timeZone: "Asia/Singapore",
    });
    return { weekLabel: label, total };
  });
}

/** Top N carparks by total spend. */
export function getTopCarparks(log, limit = 5) {
  const byName = {};
  for (const e of log) {
    if (!byName[e.carparkName]) {
      byName[e.carparkName] = { carparkName: e.carparkName, agency: e.agency, totalCost: 0, visits: 0 };
    }
    byName[e.carparkName].totalCost = Math.round((byName[e.carparkName].totalCost + e.cost) * 100) / 100;
    byName[e.carparkName].visits++;
  }
  return Object.values(byName).sort((a, b) => b.totalCost - a.totalCost).slice(0, limit);
}
