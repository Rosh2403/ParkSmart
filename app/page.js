"use client";
import { useState, useCallback } from "react";
import SearchPanel from "@/components/SearchPanel";
import ResultsList from "@/components/ResultsList";
import MapView from "@/components/MapView";
import Header from "@/components/Header";

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
    <main style={{ minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative" }}>
      <Header />
      <SearchPanel onSearch={handleSearch} loading={loading} />

      {error && (
        <div
          style={{
            margin: "0 24px 16px",
            padding: "12px 16px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12,
            fontSize: 13,
            color: "#FCA5A5",
          }}
        >
          {error === "LTA_API_KEY not configured" ? (
            <>
              <strong>API Key Required</strong>
              <br />
              Add your LTA DataMall API key to <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 4px", borderRadius: 4 }}>.env.local</code> as{" "}
              <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 4px", borderRadius: 4 }}>LTA_API_KEY=your_key</code>.
              <br />
              Get a free key at{" "}
              <a href="https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html" target="_blank" rel="noopener" style={{ color: "#818CF8" }}>
                datamall.lta.gov.sg
              </a>
            </>
          ) : (
            error
          )}
        </div>
      )}

      {showMap && destination && (
        <div style={{ margin: "0 24px 16px", animation: "slideUp 0.4s ease" }}>
          <MapView
            destination={destination}
            carparks={carparks}
            selectedCarpark={selectedCarpark}
            onSelectCarpark={setSelectedCarpark}
          />
        </div>
      )}

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
        <div style={{ padding: "40px 24px", textAlign: "center", animation: "fadeIn 0.6s ease" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚗</div>
          <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>
            Enter your destination and parking duration to find the most optimal carpark nearby.
          </p>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 28 }}>
            {[
              { icon: "💰", label: "Real SG Rates" },
              { icon: "📡", label: "Live Data" },
              { icon: "🧭", label: "Navigate" },
            ].map((f) => (
              <div key={f.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{f.icon}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'Space Mono', monospace" }}>{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
