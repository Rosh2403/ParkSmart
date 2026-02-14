"use client";

export default function Header() {
  return (
    <div style={{ padding: "24px 24px 0", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            boxShadow: "0 4px 15px rgba(99,102,241,0.3)",
          }}
        >
          🅿️
        </div>
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              background: "linear-gradient(135deg, #E2E8F0, #94A3B8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ParkSmart
          </h1>
          <p
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              fontFamily: "'Space Mono', monospace",
              letterSpacing: "0.06em",
            }}
          >
            SINGAPORE PARKING OPTIMIZER
          </p>
        </div>
      </div>
    </div>
  );
}
