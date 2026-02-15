/**
 * Favourites storage — Supabase-backed.
 * All functions are async. Device identified by a stable UUID in localStorage.
 * CustomEvent("favouritesChange") is still dispatched after mutations so
 * components react immediately without polling.
 */
import supabase from "./supabase";
import { getDeviceId } from "./deviceId";

function dispatch(favs) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("favouritesChange", { detail: favs }));
  }
}

function rowToFav(row) {
  return {
    id:        row.carpark_id,
    name:      row.name,
    agency:    row.agency,
    lat:       row.lat,
    lng:       row.lng,
    isCentral: row.is_central,
    area:      row.area,
    addedAt:   row.added_at,
  };
}

/** Get all favourited carparks for this device, newest first. */
export async function getFavourites() {
  const deviceId = getDeviceId();
  if (!deviceId) return [];
  const { data, error } = await supabase
    .from("favourites")
    .select("*")
    .eq("device_id", deviceId)
    .order("added_at", { ascending: false });
  if (error) { console.error("getFavourites:", error.message); return []; }
  return (data || []).map(rowToFav);
}

/** Add a carpark. Upserts so moving to top just updates added_at. */
export async function addFavourite(carpark) {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  const { error } = await supabase.from("favourites").upsert({
    device_id:  deviceId,
    carpark_id: carpark.id,
    name:       carpark.name,
    agency:     carpark.agency,
    lat:        carpark.lat,
    lng:        carpark.lng,
    is_central: carpark.isCentral ?? false,
    area:       carpark.area ?? "",
    added_at:   Date.now(),
  }, { onConflict: "device_id,carpark_id" });
  if (error) { console.error("addFavourite:", error.message); return; }
  dispatch(await getFavourites());
}

/** Remove a carpark by ID. */
export async function removeFavourite(carparkId) {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  const { error } = await supabase
    .from("favourites")
    .delete()
    .eq("device_id", deviceId)
    .eq("carpark_id", carparkId);
  if (error) { console.error("removeFavourite:", error.message); return; }
  dispatch(await getFavourites());
}

/**
 * Toggle. Returns true if now favourited, false if removed.
 */
export async function toggleFavourite(carpark) {
  const favs = await getFavourites();
  if (favs.some((f) => f.id === carpark.id)) {
    await removeFavourite(carpark.id);
    return false;
  }
  await addFavourite(carpark);
  return true;
}

/** Returns true if carpark ID is currently saved. */
export async function isFavourite(carparkId) {
  const favs = await getFavourites();
  return favs.some((f) => f.id === carparkId);
}
