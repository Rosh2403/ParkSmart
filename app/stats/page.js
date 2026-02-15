// V1 feature: Monthly Parking Spend Tracker — log each parking session,
// visualise monthly spend, see which carparks you use most.
// Planned: local storage persistence, monthly chart, per-carpark breakdown.

export default function StatsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        maxWidth: 480,
        margin: "0 auto",
        padding: "40px 24px calc(80px + env(safe-area-inset-bottom, 0px))",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 64, marginBottom: 16 }}>💰</div>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}
      >
        Spending Tracker
      </h2>
      <p
        style={{
          color: "var(--text-dim)",
          fontSize: 14,
          lineHeight: 1.6,
          maxWidth: 260,
          margin: "0 auto 24px",
        }}
      >
        Track your monthly parking spend and see which carparks cost you the
        most over time.
      </p>
      <div
        style={{
          display: "inline-block",
          padding: "8px 18px",
          borderRadius: 20,
          background: "rgba(99,102,241,0.1)",
          border: "1px solid rgba(99,102,241,0.3)",
          color: "var(--accent-light)",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Space Mono', monospace",
          letterSpacing: "0.06em",
        }}
      >
        COMING IN V1
      </div>
    </main>
  );
}
