/**
 * One-time migration from localStorage to Supabase.
 * Called once on app load — checks for leftover data from the pre-Supabase
 * version and uploads it, then removes the localStorage keys so it never runs again.
 */
import { addFavourite } from "./favouritesStorage";
import { logSpend } from "./spendStorage";

const MIGRATED_KEY = "parksmart_supabase_migrated_v1";

export async function migrateLocalStorageToSupabase() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return; // already done

    const tasks = [];

    // Migrate favourites
    const rawFavs = localStorage.getItem("parksmart_favourites");
    if (rawFavs) {
      const favs = JSON.parse(rawFavs) || [];
      for (const f of favs) {
        tasks.push(addFavourite(f));
      }
    }

    // Migrate spend log
    const rawLog = localStorage.getItem("parksmart_spend_log");
    if (rawLog) {
      const log = JSON.parse(rawLog) || [];
      for (const e of log) {
        tasks.push(logSpend({
          carparkName:  e.carparkName,
          carparkId:    e.carparkId,
          agency:       e.agency,
          cost:         e.cost,
          durationHours: e.durationHours,
          parkedAt:     e.parkedAt,
          endedAt:      e.endedAt,
          lat:          e.lat,
          lng:          e.lng,
        }));
      }
    }

    if (tasks.length === 0) {
      // Nothing to migrate — mark done immediately
      localStorage.setItem(MIGRATED_KEY, "1");
      return;
    }

    await Promise.allSettled(tasks);

    // Clean up old keys
    localStorage.removeItem("parksmart_favourites");
    localStorage.removeItem("parksmart_spend_log");
    localStorage.setItem(MIGRATED_KEY, "1");

    console.log(`[ParkSmart] Migrated ${tasks.length} local records to Supabase.`);
  } catch (err) {
    console.warn("[ParkSmart] localStorage migration failed:", err.message);
  }
}
