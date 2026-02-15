"use client";
import { useMemo } from "react";
import styles from "./ResultsList.module.css";

// ScoreRing: SVG with dynamic stroke color — keep as SVG attributes (computed values)
function ScoreRing({ score, size = 48 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#10B981" : score >= 45 ? "#F59E0B" : "#EF4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={size * 0.3} fontWeight="800"
        style={{ transform: "rotate(90deg)", transformOrigin: "center" }}
      >
        {score}
      </text>
    </svg>
  );
}

function Badge({ text }) {
  const cls =
    text === "BEST MATCH" ? styles.badgeBestMatch
    : text === "CHEAPEST"  ? styles.badgeCheapest
    : styles.badgeNearest;
  return <span className={`${styles.badge} ${cls}`}>{text}</span>;
}

function AgencyBadge({ agency }) {
  const cls =
    agency === "URA" ? styles.agencyURA
    : agency === "LTA" ? styles.agencyLTA
    : styles.agencyHDB;
  return <span className={`${styles.agencyBadge} ${cls}`}>{agency}</span>;
}

function StatBox({ label, value, sub, color }) {
  return (
    <div className={styles.statBox}>
      <div className={styles.statBoxLabel}>{label}</div>
      <div className={styles.statBoxValue} style={{ color }}>{value}</div>
      {sub && <div className={styles.statBoxSub}>{sub}</div>}
    </div>
  );
}

function CarparkCard({ carpark, isSelected, onSelect, onNavigate, duration }) {
  const cp = carpark;
  const lotsClass =
    cp.availableLots > 30 ? styles.lotsHigh
    : cp.availableLots > 10 ? styles.lotsMid
    : styles.lotsLow;

  return (
    <div
      onClick={() => onSelect(cp)}
      className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
    >
      {cp.badge && (
        <div className={styles.badgeSlot}>
          <Badge text={cp.badge} />
        </div>
      )}

      <div className={styles.cardBody}>
        <ScoreRing score={cp.score} size={52} />
        <div className={styles.cardInfo}>
          <h3 className={`${styles.cardName} ${cp.badge ? styles.cardNameWithBadge : ""}`}>
            {cp.name}
          </h3>
          <div className={styles.cardMeta}>
            <AgencyBadge agency={cp.agency} />
            {cp.isCentral && <span className={styles.centralLabel}>Central</span>}
          </div>
          <div className={styles.cardStats}>
            <div>
              <span className={styles.cardCost}>${cp.cost.toFixed(2)}</span>
              <span className={styles.cardCostLabel}>total</span>
            </div>
            <div className={styles.cardMinorStats}>
              <span>🚶 {cp.walkTimeMin}min</span>
              <span>📏 {cp.distanceKm}km</span>
              <span className={lotsClass}>🅿️ {cp.availableLots} lots</span>
            </div>
          </div>
        </div>
      </div>

      {isSelected && (
        <div className={styles.expandedPanel}>
          <div className={styles.statGrid}>
            <StatBox label="RATE" value={cp.rateLabel} sub={cp.capLabel} color="var(--accent-light)" />
            <StatBox
              label="AVAILABILITY"
              value={`${cp.availableLots} lots`}
              sub={cp.availableLots > 30 ? "High" : cp.availableLots > 10 ? "Medium" : "Low"}
              color={cp.availableLots > 30 ? "var(--green)" : cp.availableLots > 10 ? "var(--yellow)" : "var(--red)"}
            />
            <StatBox label="DISTANCE" value={`${cp.distanceKm}km`} sub={`${cp.walkTimeMin}min walk`} color="var(--text-primary)" />
          </div>

          <div className={styles.costBreakdown}>
            <div className={styles.costBreakdownTitle}>💡 COST BREAKDOWN</div>
            <div className={styles.costRow}>
              <span>${cp.ratePerHour.toFixed(2)}/hr × {duration}h</span>
              <span>${(cp.ratePerHour * duration).toFixed(2)}</span>
            </div>
            {cp.capApplied && (
              <div className={styles.capRow}>
                <span>Daily cap applied</span>
                <span>-${(cp.ratePerHour * duration - cp.cost).toFixed(2)}</span>
              </div>
            )}
            <div className={styles.costTotal}>
              <span>You pay</span>
              <span className={styles.costTotalAmount}>${cp.cost.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(cp); }}
            className={styles.navigateBtn}
          >
            🧭 Navigate with Google Maps
          </button>
        </div>
      )}
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div className={styles.listWrapper}>
      <div className={styles.skeletonSummaryBar}>
        {[90, 80, 110].map((w, i) => (
          <div key={i} className={`skeleton ${styles.summaryChip}`} style={{ height: 52, minWidth: w }} />
        ))}
      </div>
      <div className={styles.list}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skeletonCard}>
            <div className={styles.skeletonCardBody}>
              <div className={`skeleton ${styles.skeletonAvatar}`} />
              <div className={styles.skeletonLines}>
                <div className={`skeleton ${styles.skeletonLine}`} style={{ height: 16, width: "60%" }} />
                <div className={`skeleton ${styles.skeletonLine}`} style={{ height: 12, width: "40%" }} />
                <div className={`skeleton ${styles.skeletonLine}`} style={{ height: 20, width: "50%", marginBottom: 0 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResultsList({ carparks, selectedCarpark, onSelectCarpark, onNavigate, duration }) {
  if (carparks.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🔍</div>
        <p className={styles.emptyText}>No carparks found within 2km. Try a different location.</p>
      </div>
    );
  }

  const { bestPrice, savings } = useMemo(() => {
    const best = Math.min(...carparks.map((c) => c.cost));
    const worst = Math.max(...carparks.map((c) => c.cost));
    return { bestPrice: best, savings: (worst - best).toFixed(2) };
  }, [carparks]);

  return (
    <div className={styles.listWrapper}>
      <div className={styles.summaryBar}>
        {[
          { label: "Found", value: `${carparks.length} carparks`, color: "var(--accent-light)" },
          { label: "Best Price", value: `$${bestPrice.toFixed(2)}`, color: "var(--green)" },
          { label: "Potential Savings", value: `$${savings}`, color: "var(--yellow)" },
        ].map((s, i) => (
          <div key={i} className={styles.summaryChip}>
            <div className={styles.summaryChipLabel}>{s.label}</div>
            <div className={styles.summaryChipValue} style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className={styles.list}>
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
        <p className={styles.moreNote}>Showing top 15 of {carparks.length} results</p>
      )}
    </div>
  );
}
