"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import styles from "./SearchPanel.module.css";

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
    <div className={styles.wrapper}>
      <div className={styles.card}>
        {/* Destination */}
        <div className={styles.fieldGroup} ref={inputRef}>
          <label className={styles.label}>Destination</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}>📍</span>
            <input
              type="text"
              placeholder="Search any place in Singapore..."
              value={query}
              onChange={handleInputChange}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className={styles.input}
            />
            {selectedDest && <span className={styles.inputCheck}>✓</span>}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className={styles.suggestions}>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectPlace(s)}
                  className={styles.suggestionItem}
                  style={{
                    borderBottom:
                      i < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div className={styles.suggestionName}>{s.name}</div>
                  <div className={styles.suggestionAddr}>{s.address}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Duration Slider */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            Duration —{" "}
            <span className={styles.labelAccent}>{durationLabel}</span>
          </label>
          <div className={styles.sliderRow}>
            <span className={styles.rangeLabel}>30m</span>
            <input
              type="range"
              min="0.5"
              max="12"
              step="0.5"
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value))}
              className={styles.sliderInput}
            />
            <span className={styles.rangeLabel}>12h</span>
          </div>
        </div>

        {/* Priority */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Priority</label>
          <div className={styles.priorityGrid}>
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                onClick={() => setPriority(p.key)}
                className={`${styles.priorityBtn} ${priority === p.key ? styles.priorityBtnActive : ""}`}
              >
                <div style={{ fontSize: 14 }}>
                  {p.icon} <span className={styles.priorityBtnLabel}>{p.label}</span>
                </div>
                <div className={styles.priorityBtnDesc}>{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Search Button */}
        <button
          onClick={handleSubmit}
          disabled={!selectedDest || loading}
          className={`${styles.submitBtn} ${
            selectedDest && !loading ? styles.submitBtnActive : styles.submitBtnDisabled
          }`}
          style={{ opacity: loading ? 0.7 : 1 }}
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
