"use client";
import { useState, useRef, useCallback, useEffect } from "react";

const PRIORITIES = [
  { key: "cheapest", label: "Cheapest", icon: "💰", desc: "Minimize cost" },
  { key: "closest", label: "Closest", icon: "📍", desc: "Minimize walk" },
  { key: "balanced", label: "Balanced", icon: "⚖️", desc: "Best overall" },
  { key: "best_value", label: "Best Value", icon: "✨", desc: "Quality + price" },
];

export default function SearchPanel({ onSearch, loading }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedDest, setSelectedDest] = useState(null);
  const [duration, setDuration] = useState(2);
  const [priority, setPriority] = useState("balanced");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const searchPlaces = useCallback(async (q) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.results || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedDest(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(val), 300);
  };

  const handleSelectPlace = (place) => {
    setQuery(place.name);
    setSelectedDest(place);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    if (!selectedDest) return;
    onSearch(selectedDest, duration, priority);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const durationLabel =
    duration < 1
      ? `${Math.round(duration * 60)}min`
      : duration === Math.floor(duration)
      ? `${duration}h`
      : `${Math.floor(duration)}h ${Math.round((duration % 1) * 60)}m`;

  return (
    <div style={{ padding: "20px 24px" }}>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 20,
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Destination */}
        <div style={{ marginBottom: 16, position: "relative" }} ref={inputRef}>
          <label style={labelStyle}>Destination</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>
              📍
            </span>
            <input
              type="text"
              placeholder="Search any place in Singapore..."
              value={query}
              onChange={handleInputChange}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              style={inputStyle}
            />
            {selectedDest && (
              <span
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 14,
                  color: "var(--green)",
                }}
              >
                ✓
              </span>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                marginTop: 4,
                zIndex: 100,
                maxHeight: 200,
                overflowY: "auto",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectPlace(s)}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom: i < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.target.style.background = "rgba(99,102,241,0.1)")}
                  onMouseLeave={(e) => (e.target.style.background = "transparent")}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.address}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Duration Slider */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>
            Duration — <span style={{ color: "var(--accent-light)" }}>{durationLabel}</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={rangeLabel}>30m</span>
            <input
              type="range"
              min="0.5"
              max="12"
              step="0.5"
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: "var(--accent)", height: 4 }}
            />
            <span style={rangeLabel}>12h</span>
          </div>
        </div>

        {/* Priority */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Priority</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                onClick={() => setPriority(p.key)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border:
                    priority === p.key ? "1px solid var(--border-active)" : "1px solid var(--border)",
                  background:
                    priority === p.key ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.02)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  color: "inherit",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 14 }}>
                  {p.icon}{" "}
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{p.label}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Search Button */}
        <button
          onClick={handleSubmit}
          disabled={!selectedDest || loading}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background:
              selectedDest && !loading
                ? "linear-gradient(135deg, #6366F1, #8B5CF6)"
                : "rgba(99,102,241,0.3)",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: selectedDest && !loading ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            letterSpacing: "0.02em",
            transition: "all 0.2s",
            boxShadow: selectedDest ? "0 4px 20px rgba(99,102,241,0.3)" : "none",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <span style={{ animation: "pulse 1.5s infinite" }}>Searching carparks...</span>
          ) : (
            "🔍 Find Optimal Parking"
          )}
        </button>
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontFamily: "'Space Mono', monospace",
  marginBottom: 6,
  display: "block",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px 12px 40px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--text-primary)",
  fontSize: 14,
  fontFamily: "inherit",
  transition: "border-color 0.2s",
};

const rangeLabel = {
  fontSize: 11,
  color: "var(--text-dim)",
  fontFamily: "'Space Mono', monospace",
};
