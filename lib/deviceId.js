/**
 * Returns a stable UUID for this device, generating and persisting one on
 * first launch. Used as the user identifier for all Supabase rows.
 * Storage: localStorage key "parksmart_device_id"
 */
const KEY = "parksmart_device_id";

export function getDeviceId() {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
