"use client";
import { useState, useCallback } from "react";
import SearchPanel from "@/components/SearchPanel";
import ResultsList, { ResultsSkeleton } from "@/components/ResultsList";
// MapView uses Leaflet (browser-only) — dynamic with ssr:false excludes it
// from the server bundle and removes the need for the runtime import() dance
import dynamic from "next/dynamic";
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });
import ErrorBoundary from "@/components/ErrorBoundary";
import styles from "./page.module.css";

export default function Home() {
  const [destination, setDestination] = useState(null);
  const [carparks, setCarparks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCarpark, setSelectedCarpark] = useState(null);
  const [duration, setDuration] = useState(2);
  const [priority, setPriority] = useState("balanced");
  const [showMap, setShowMap] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async (dest, dur, pri) => {
    setLoading(true);
    setError(null);
    setDestination(dest);
    setDuration(dur);
    setPriority(pri);
    setSearched(true);

    try {
      const res = await fetch(
        `/api/carparks?lat=${dest.lat}&lng=${dest.lng}&duration=${dur}&priority=${pri}&radius=2`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setCarparks(data.carparks || []);
      if (data.carparks?.length > 0) {
        setSelectedCarpark(data.carparks[0]);
        setShowMap(true);
      }
    } catch (err) {
      setError(err.message);
      setCarparks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNavigate = useCallback((carpark) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${carpark.lat},${carpark.lng}&travelmode=driving`,
      "_blank"
    );
  }, []);

  return (
    <main className={styles.main}>
      <ErrorBoundary>
        <SearchPanel onSearch={handleSearch} loading={loading} />

        {error && (
          <div className={styles.errorBanner}>
            {error === "LTA_API_KEY not configured" ? (
              <>
                <strong>API Key Required</strong>
                <br />
                Add your LTA DataMall API key to{" "}
                <code className={styles.errorBannerCode}>.env.local</code> as{" "}
                <code className={styles.errorBannerCode}>LTA_API_KEY=your_key</code>.
                <br />
                Get a free key at{" "}
                <a
                  href="https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html"
                  target="_blank"
                  rel="noopener"
                  className={styles.errorBannerLink}
                >
                  datamall.lta.gov.sg
                </a>
              </>
            ) : (
              error
            )}
          </div>
        )}

        {showMap && destination && (
          <div className={styles.mapWrapper}>
            <MapView
              destination={destination}
              carparks={carparks}
              selectedCarpark={selectedCarpark}
              onSelectCarpark={setSelectedCarpark}
            />
          </div>
        )}

        {searched && loading && <ResultsSkeleton />}

        {searched && !loading && (
          <ResultsList
            carparks={carparks}
            selectedCarpark={selectedCarpark}
            onSelectCarpark={setSelectedCarpark}
            onNavigate={handleNavigate}
            duration={duration}
          />
        )}

        {!searched && (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>🚗</div>
            <p className={styles.welcomeText}>
              Enter your destination and parking duration to find the most optimal carpark nearby.
            </p>
            <div className={styles.welcomeFeatures}>
              {[
                { icon: "💰", label: "Real SG Rates" },
                { icon: "📡", label: "Live Data" },
                { icon: "🧭", label: "Navigate" },
              ].map((f) => (
                <div key={f.label} className={styles.welcomeFeatureItem}>
                  <div className={styles.welcomeFeatureIcon}>{f.icon}</div>
                  <div className={styles.welcomeFeatureLabel}>{f.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ErrorBoundary>
    </main>
  );
}
