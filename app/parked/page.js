"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { saveSession, getSession, extendSession, clearSession } from "@/lib/parkedStorage";
import { logSpend } from "@/lib/spendStorage";
import { calculateParkingCost } from "@/lib/parking";
import {
  requestNotificationPermission,
  scheduleParkingReminder,
  cancelParkingReminder,
} from "@/lib/notifications";
import styles from "./parked.module.css";

const ParkedMap = dynamic(() => import("@/components/ParkedMap"), { ssr: false });

const DURATION_PRESETS = [
  { label: "30m",  ms: 30 * 60 * 1000 },
  { label: "1h",   ms: 60 * 60 * 1000 },
  { label: "1.5h", ms: 90 * 60 * 1000 },
  { label: "2h",   ms: 120 * 60 * 1000 },
  { label: "3h",   ms: 180 * 60 * 1000 },
  { label: "4h",   ms: 240 * 60 * 1000 },
];

const REMINDER_PRESETS = [
  { label: "None", mins: 0 },
  { label: "5 min", mins: 5 },
  { label: "10 min", mins: 10 },
  { label: "15 min", mins: 15 },
  { label: "30 min", mins: 30 },
];

function formatCountdown(ms) {
  if (ms <= 0) {
    const over = Math.abs(ms);
    const m = Math.floor(over / 60000);
    const s = Math.floor((over % 60000) / 1000);
    return { text: `-${m}:${String(s).padStart(2, "0")}`, expired: true };
  }
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) {
    return { text: `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, expired: false };
  }
  return { text: `${m}:${String(s).padStart(2, "0")}`, expired: false };
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" });
}

export default function ParkedPage() {
  const [session, setSession] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(DURATION_PRESETS[3]); // 2h default
  const [selectedReminder, setSelectedReminder] = useState(REMINDER_PRESETS[3]); // 15 min default
  const [gpsState, setGpsState] = useState("idle"); // idle | loading | error
  const [gpsError, setGpsError] = useState("");
  const [prefilledCarpark, setPrefilledCarpark] = useState(null);
  const [loggedEntry, setLoggedEntry] = useState(null); // brief confirmation after done

  // Load session and any pre-filled carpark from the Find tab
  useEffect(() => {
    setSession(getSession());
    try {
      const raw = localStorage.getItem("parksmart_last_selected_carpark");
      if (raw) setPrefilledCarpark(JSON.parse(raw));
    } catch {}
  }, []);

  // Countdown ticker
  useEffect(() => {
    if (!session) { setCountdown(null); return; }
    const tick = () => setCountdown(session.expiresAt - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  const handleParkHere = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      setGpsState("error");
      return;
    }
    setGpsState("loading");
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const expiresAt = Date.now() + selectedDuration.ms;
        const reminderMins = selectedReminder.mins;

        const saved = saveSession({
          lat, lng, expiresAt, reminderMins,
          carparkId:   prefilledCarpark?.id   || null,
          carparkName: prefilledCarpark?.name || "",
          agency:      prefilledCarpark?.agency    || "HDB",
          isCentral:   prefilledCarpark?.isCentral || false,
        });
        setSession(saved);
        setGpsState("idle");

        // Request permission + schedule reminder (non-blocking, best-effort)
        if (reminderMins > 0) {
          const granted = await requestNotificationPermission();
          if (granted) {
            await scheduleParkingReminder({ expiresAt, reminderMins });
          }
        }
      },
      (err) => {
        const msgs = {
          1: "Location permission denied. Please allow location access.",
          2: "Location unavailable. Try again.",
          3: "Location request timed out. Try again.",
        };
        setGpsError(msgs[err.code] || "Could not get location.");
        setGpsState("error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [selectedDuration, selectedReminder]);

  const handleExtend = async (extraMs) => {
    const updated = extendSession(extraMs);
    if (!updated) return;
    setSession({ ...updated });
    // Reschedule reminder with the same lead time but updated expiry
    if (updated.reminderMins > 0) {
      await scheduleParkingReminder({
        expiresAt: updated.expiresAt,
        reminderMins: updated.reminderMins,
      });
    }
  };

  const handleClear = async () => {
    // Log the spend before clearing the session
    if (session) {
      const endedAt = Date.now();
      const durationHours = (endedAt - session.parkedAt) / 3600000;
      const { cost } = calculateParkingCost(
        session.agency || "HDB",
        durationHours,
        session.isCentral || false,
        session.parkedAt,
        session.carparkId || null
      );
      const entry = await logSpend({
        carparkName:  session.carparkName || "Unknown Carpark",
        carparkId:    session.carparkId,
        agency:       session.agency || "HDB",
        cost,
        durationHours,
        parkedAt:     session.parkedAt,
        endedAt,
        lat:          session.lat,
        lng:          session.lng,
      });
      if (entry) setLoggedEntry(entry);
      // Clear the pre-filled carpark after use
      try { localStorage.removeItem("parksmart_last_selected_carpark"); } catch {}
      setPrefilledCarpark(null);
    }
    await cancelParkingReminder();
    clearSession();
    setSession(null);
    setGpsState("idle");
    setGpsError("");
  };

  const handleNavigate = () => {
    if (!session) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${session.lat},${session.lng}&travelmode=walking`;
    window.open(url, "_blank");
  };

  // ── Active session view ──────────────────────────────────────────────────
  if (session) {
    const { text: countdownText, expired } = formatCountdown(countdown ?? 0);
    const reminderLabel = session.reminderMins
      ? `Reminder set · ${session.reminderMins} min before expiry`
      : "No reminder set";

    return (
      <main className={styles.main}>
        <div className={styles.section}>
          {/* Carpark name chip */}
          {session.carparkName && (
            <div className={styles.carparkChip}>📍 {session.carparkName}</div>
          )}

          {/* Spend confirmation flash */}
          {loggedEntry && (
            <div className={styles.loggedBanner}>
              ✅ Logged $<strong>{loggedEntry.cost.toFixed(2)}</strong> for {loggedEntry.carparkName}
            </div>
          )}

          {/* Map */}
          <ParkedMap lat={session.lat} lng={session.lng} />

          {/* Timer */}
          <div className={styles.timerCard}>
            <div className={styles.timerLabel}>
              {expired ? "⚠️ EXPIRED" : "⏱ TIME REMAINING"}
            </div>
            <div className={`${styles.timerDisplay} ${expired ? styles.timerExpired : ""}`}>
              {countdownText}
            </div>
            <div className={styles.timerMeta}>
              Parked at {formatTime(session.parkedAt)} · until {formatTime(session.expiresAt)}
            </div>
            <div className={styles.reminderStatus}>
              🔔 {reminderLabel}
            </div>

            {/* Extend buttons */}
            <div className={styles.extendRow}>
              <span className={styles.extendLabel}>Extend:</span>
              <button className={styles.extendBtn} onClick={() => handleExtend(30 * 60 * 1000)}>+30m</button>
              <button className={styles.extendBtn} onClick={() => handleExtend(60 * 60 * 1000)}>+1h</button>
              <button className={styles.extendBtn} onClick={() => handleExtend(120 * 60 * 1000)}>+2h</button>
            </div>
          </div>

          {/* Actions */}
          <button className={styles.navigateBtn} onClick={handleNavigate}>
            🗺 Navigate to My Car
          </button>
          <button className={styles.clearBtn} onClick={handleClear}>
            Done Parking
          </button>
        </div>
      </main>
    );
  }

  // ── No session — Park Here view ──────────────────────────────────────────
  return (
    <main className={styles.main}>
      <div className={styles.section}>
        <div className={styles.heroIcon}>🚗</div>
        <h2 className={styles.heroTitle}>I&apos;m Parked Here</h2>
        <p className={styles.heroSub}>
          Drop a pin at your car&apos;s GPS location and set a parking timer.
        </p>

        {/* Pre-filled carpark chip */}
        {prefilledCarpark && (
          <div className={styles.prefilledChip}>
            <span>📍 {prefilledCarpark.name}</span>
            <button
              className={styles.prefilledClear}
              onClick={() => {
                setPrefilledCarpark(null);
                try { localStorage.removeItem("parksmart_last_selected_carpark"); } catch {}
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Duration picker */}
        <div className={styles.pickerBlock}>
          <div className={styles.pickerTitle}>Parking duration</div>
          <div className={styles.durationGrid}>
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.label}
                className={`${styles.durationBtn} ${selectedDuration.label === p.label ? styles.durationBtnActive : ""}`}
                onClick={() => setSelectedDuration(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reminder picker */}
        <div className={styles.pickerBlock}>
          <div className={styles.pickerTitle}>Reminder before expiry</div>
          <div className={styles.reminderGrid}>
            {REMINDER_PRESETS.map((r) => (
              <button
                key={r.label}
                className={`${styles.reminderBtn} ${selectedReminder.mins === r.mins ? styles.reminderBtnActive : ""}`}
                onClick={() => setSelectedReminder(r)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {selectedReminder.mins > 0 && (
            <p className={styles.reminderHint}>
              You&apos;ll get a notification {selectedReminder.label} before your time is up.
            </p>
          )}
        </div>

        {/* GPS error */}
        {gpsState === "error" && (
          <div className={styles.errorBanner}>{gpsError}</div>
        )}

        {/* Park button */}
        <button
          className={styles.parkBtn}
          onClick={handleParkHere}
          disabled={gpsState === "loading"}
        >
          {gpsState === "loading" ? (
            <span style={{ animation: "pulse 1.5s infinite" }}>Getting location…</span>
          ) : (
            "📍 Drop Pin Here"
          )}
        </button>
      </div>
    </main>
  );
}
