"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { saveSession, getSession, extendSession, clearSession } from "@/lib/parkedStorage";
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
  const [gpsState, setGpsState] = useState("idle"); // idle | loading | error
  const [gpsError, setGpsError] = useState("");

  // Load session on mount
  useEffect(() => {
    setSession(getSession());
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
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const saved = saveSession({
          lat,
          lng,
          expiresAt: Date.now() + selectedDuration.ms,
          label: "",
        });
        setSession(saved);
        setGpsState("idle");
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
  }, [selectedDuration]);

  const handleExtend = (extraMs) => {
    const updated = extendSession(extraMs);
    if (updated) setSession({ ...updated });
  };

  const handleClear = () => {
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

    return (
      <main className={styles.main}>
        <div className={styles.section}>
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

        {/* Duration picker */}
        <div className={styles.durationBlock}>
          <div className={styles.durationTitle}>Parking duration</div>
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
