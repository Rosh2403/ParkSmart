"use client";
import { useEffect } from "react";
import { getDeviceId } from "@/lib/deviceId";
import { migrateLocalStorageToSupabase } from "@/lib/migrateLocalStorage";

/**
 * Ensures a stable device ID exists and runs the one-time localStorage →
 * Supabase migration on first launch after the upgrade.
 * Rendered once in the root layout — no UI output.
 */
export default function AuthProvider({ children }) {
  useEffect(() => {
    // Ensure device ID is generated on first launch
    getDeviceId();
    // Migrate any pre-Supabase localStorage data (no-op after first run)
    migrateLocalStorageToSupabase();
  }, []);

  return children;
}
