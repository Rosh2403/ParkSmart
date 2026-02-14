"use client";
import { useState } from "react";

function ScoreRing({ score, size = 48 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#10B981" : score >= 45 ? "#F59E0B" : "#EF4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={size * 0.3}
        fontWeight="800"
        style={{ transform: "rotate(90deg)", transformOrigin: "center" }}
      >
        {score}
      </text>
    </svg>
  );
}

function Badge({ text }) {
  const bg =
    text === "BEST MATCH"
      ? "linear-gradient(135deg, #6366F1, #8B5CF6)"
      : text === "CHEAPEST"
      ? "linear-gradient(135deg, #10B981, #059669)"
      : "linear-gradient(135deg, #F59E0B, #D97706)";
  return (
    <span
      style={{
        background: bg,
        color: "#fff",
        fontSize: 9,
        fontWeight: 800,
        padding: "3px 8px",
        borderRadius: 6,
        fontFamily: "'Space Mono', monospace",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function AgencyBadge({ agency }) {
  const colors = {
    HDB: { bg: "rgba(59,130,246,0.15)", text: "#60A5FA" },
    URA: { bg: "rgba(168,85,247,0.15)", text: "#C084FC" },
    LTA: { bg: "rgba(16,185,129,0.15)", text: "#2DD4BF" },
  };
  const c = colors[agency] || colors.HDB;
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        padding: "2px 7px",
        borderRadius: 5,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "'Space Mono', monospace",
      }}
    >
      {agency}
    </span>
  );
}

function CarparkCard({ carpark, isSelected, onSelect, onNavigate, duration }) {
  const cp = carpark;

  return (
    <div
      onClick={() => onSelect(cp)}
      style={{
        background: isSelected ? "rgba(99,102,241,0.08)" : "var(--bg-card)",
        border: isSelected ? "1px solid rgba(99,102,241,0.3)" : "1px solid var(--border)",
        borderRadius: 14,
        padding: 16,
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        position: "relative",
      }}
    >
      {/* Badge */}
      {cp.badge && (
        <div style={{ position: "absolute", top: 10, right: 10 }}>
          <Badge text={cp.badge} />
        </div>
      )}

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <ScoreRing score={cp.score} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 3,
              paddingRight: cp.badge ? 80 : 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {cp.name}
          </h3>

          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <AgencyBadge agency={cp.agency} />
            {cp.isCentral && (
              <span style={{ fontSize: 10, color: "var(--yellow)", fontWeight: 600 }}>Central</span>
            )}
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "baseline" }}>
            <div>
              <span style={{ fontSize: 20, fontWeight: 800, color: "var(--green)" }}>
                ${cp.cost.toFixed(2)}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>total</span>
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--text-secondary)" }}>
              <span>🚶 {cp.walkTimeMin}min</span>
              <span>📏 {cp.distanceKm}km</span>
              <span
                style={{
                  color:
                    cp.availableLots > 30
                      ? "var(--green)"
                      : cp.availableLots > 10
                      ? "var(--yellow)"
                      : "var(--red)",
                  fontWeight: 600,
                }}
              >
                🅿️ {cp.availableLots} lots
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isSelected && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", animation: "slideUp 0.3s ease" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <StatBox label="RATE" value={cp.rateLabel} sub={cp.capLabel} color="var(--accent-light)" />
            <StatBox
              label="AVAILABILITY"
              value={`${cp.availableLots} lots`}
              sub={cp.availableLots > 30 ? "High" : cp.availableLots > 10 ? "Medium" : "Low"}
              color={cp.availableLots > 30 ? "var(--green)" : cp.availableLots > 10 ? "var(--yellow)" : "var(--red)"}
            />
            <StatBox label="DISTANCE" value={`${cp.distanceKm}km`} sub={`${cp.walkTimeMin}min walk`} color="var(--text-primary)" />
          </div>

          {/* Cost Breakdown */}
          <div
            style={{
              marginTop: 10,
              background: "rgba(16,185,129,0.05)",
              border: "1px solid rgba(16,185,129,0.15)",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--green)",
                fontFamily: "'Space Mono', monospace",
                marginBottom: 6,
              }}
            >
              💡 COST BREAKDOWN
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
              <span>{cp.rateLabel} × {duration}h</span>
              <span>${(cp.ratePerHour * duration).toFixed(2)}</span>
            </div>
            {cp.capApplied && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--green)", marginBottom: 4 }}>
                <span>Daily cap applied</span>
                <span>-${(cp.ratePerHour * duration - cp.cost).toFixed(2)}</span>
              </div>
            )}
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: 4,
                marginTop: 4,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              <span>You pay</span>
              <span style={{ color: "var(--green)" }}>${cp.cost.toFixed(2)}</span>
            </div>
          </div>

          {/* Navigate Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(cp);
            }}
            style={{
              width: "100%",
              marginTop: 10,
              padding: "12px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #10B981, #059669)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 4px 15px rgba(16,185,129,0.3)",
              transition: "all 0.2s",
            }}
          >
            🧭 Navigate with Google Maps
          </button>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, sub, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'Space Mono', monospace", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export default function ResultsList({ carparks, selectedCarpark, onSelectCarpark, onNavigate, duration }) {
  if (carparks.length === 0) {
    return (
      <div style={{ padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
        <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No carparks found within 2km. Try a different location.</p>
      </div>
    );
  }

  const bestPrice = Math.min(...carparks.map((c) => c.cost));
  const worstPrice = Math.max(...carparks.map((c) => c.cost));
  const savings = (worstPrice - bestPrice).toFixed(2);

  return (
    <div style={{ padding: "0 24px 32px" }}>
      {/* Summary */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
        {[
          { label: "Found", value: `${carparks.length} carparks`, color: "var(--accent-light)" },
          { label: "Best Price", value: `$${bestPrice.toFixed(2)}`, color: "var(--green)" },
          { label: "Potential Savings", value: `$${savings}`, color: "var(--yellow)" },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "8px 12px",
              flex: "1 0 auto",
              minWidth: 90,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "var(--text-muted)",
                fontFamily: "'Space Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {s.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: s.color, marginTop: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {carparks.slice(0, 15).map((cp, i) => (
          <div key={cp.id} style={{ animation: `slideUp 0.4s ease ${i * 0.05}s both` }}>
            <CarparkCard
              carpark={cp}
              isSelected={selectedCarpark?.id === cp.id}
              onSelect={onSelectCarpark}
              onNavigate={onNavigate}
              duration={duration}
            />
          </div>
        ))}
      </div>

      {carparks.length > 15 && (
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
          Showing top 15 of {carparks.length} results
        </p>
      )}
    </div>
  );
}
