"use client";
import { useState, useEffect, useMemo } from "react";
import {
  getSpendLog,
  getMonthlyTotal,
  getMonthEntries,
  getWeeklyTotals,
  getTopCarparks,
  clearSpendLog,
  deleteEntry,
} from "@/lib/spendStorage";
import styles from "./stats.module.css";

// SGT-aware date helpers
function sgtNow() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

function monthLabel(year, month) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-SG", {
    month: "long", year: "numeric", timeZone: "UTC",
  });
}

function formatDate(ts) {
  return new Date(ts + 8 * 3600 * 1000).toLocaleDateString("en-SG", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatDuration(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Agency colour
function agencyColor(agency) {
  if (agency === "URA") return "var(--accent-light)";
  if (agency === "LTA") return "var(--yellow)";
  return "#60a5fa";
}

// ── Weekly Bar Chart ────────────────────────────────────────────────────────
function WeeklyChart({ weeklyTotals }) {
  const maxTotal = Math.max(...weeklyTotals.map((w) => w.total), 0.01);
  const hasData  = weeklyTotals.some((w) => w.total > 0);

  if (!hasData) {
    return (
      <div className={styles.chartEmpty}>
        No data yet — park and log to see your weekly trend.
      </div>
    );
  }

  return (
    <div className={styles.barChart}>
      {weeklyTotals.map(({ weekLabel, total }) => {
        const heightPct = (total / maxTotal) * 100;
        return (
          <div key={weekLabel} className={styles.barCol}>
            <div className={styles.barWrapper}>
              {total > 0 && (
                <div className={styles.barAmount}>${total.toFixed(0)}</div>
              )}
              <div
                className={styles.bar}
                style={{ height: total > 0 ? `${Math.max(heightPct, 4)}%` : "2px" }}
              />
            </div>
            <div className={styles.barLabel}>{weekLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function StatsPage() {
  const [log, setLog] = useState([]);
  const now = sgtNow();
  const [viewYear,  setViewYear]  = useState(now.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(now.getUTCMonth());
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const sync = async () => setLog(await getSpendLog());
    sync();
    window.addEventListener("spendLogChange", sync);
    return () => window.removeEventListener("spendLogChange", sync);
  }, []);

  const thisMonthTotal = useMemo(() => getMonthlyTotal(log, viewYear, viewMonth), [log, viewYear, viewMonth]);
  const prevMonthTotal = useMemo(() => {
    const pm = viewMonth === 0 ? 11 : viewMonth - 1;
    const py = viewMonth === 0 ? viewYear - 1 : viewYear;
    return getMonthlyTotal(log, py, pm);
  }, [log, viewYear, viewMonth]);

  const weeklyTotals = useMemo(() => getWeeklyTotals(log, 8), [log]);
  const topCarparks  = useMemo(() => getTopCarparks(log, 5),   [log]);
  const monthEntries = useMemo(() => getMonthEntries(log, viewYear, viewMonth), [log, viewYear, viewMonth]);

  const monthDelta = thisMonthTotal - prevMonthTotal;
  const isCurrentMonth =
    viewYear === now.getUTCFullYear() && viewMonth === now.getUTCMonth();

  const handlePrevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const handleNextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const handleClearAll = async () => {
    await clearSpendLog();
    setShowClearConfirm(false);
  };

  const handleDelete = (id) => { deleteEntry(id); };

  return (
    <main className={styles.main}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h2 className={styles.title}>Spending Tracker</h2>
        {log.length > 0 && (
          <span className={styles.totalSessions}>{log.length} sessions</span>
        )}
      </div>

      {/* ── Month Navigation ── */}
      <div className={styles.monthNav}>
        <button className={styles.monthNavBtn} onClick={handlePrevMonth}>‹</button>
        <span className={styles.monthLabel}>{monthLabel(viewYear, viewMonth)}</span>
        <button
          className={styles.monthNavBtn}
          onClick={handleNextMonth}
          disabled={isCurrentMonth}
        >
          ›
        </button>
      </div>

      {/* ── Monthly Total Card ── */}
      <div className={styles.totalCard}>
        <div className={styles.totalCardLabel}>
          {isCurrentMonth ? "This Month" : monthLabel(viewYear, viewMonth)}
        </div>
        <div className={styles.totalAmount}>
          ${thisMonthTotal.toFixed(2)}
        </div>
        {prevMonthTotal > 0 && (
          <div className={`${styles.totalDelta} ${monthDelta > 0 ? styles.deltaUp : styles.deltaDown}`}>
            {monthDelta > 0 ? "▲" : "▼"} ${Math.abs(monthDelta).toFixed(2)} vs prev month
          </div>
        )}
        {monthEntries.length > 0 && (
          <div className={styles.totalSub}>
            {monthEntries.length} session{monthEntries.length !== 1 ? "s" : ""} · avg ${(thisMonthTotal / monthEntries.length).toFixed(2)}/session
          </div>
        )}
        {monthEntries.length === 0 && (
          <div className={styles.totalSub}>No sessions this month</div>
        )}
      </div>

      {/* ── Weekly Trend ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Weekly Trend</div>
        <div className={styles.chartCard}>
          <WeeklyChart weeklyTotals={weeklyTotals} />
        </div>
      </div>

      {/* ── Top Carparks ── */}
      {topCarparks.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Top Carparks</div>
          <div className={styles.topList}>
            {topCarparks.map((cp, i) => {
              const widthPct = (cp.totalCost / topCarparks[0].totalCost) * 100;
              return (
                <div key={cp.carparkName} className={styles.topItem}>
                  <div className={styles.topRank}>{i + 1}</div>
                  <div className={styles.topInfo}>
                    <div className={styles.topName}>{cp.carparkName}</div>
                    <div className={styles.topMeta}>
                      <span
                        className={styles.topAgency}
                        style={{ color: agencyColor(cp.agency), borderColor: agencyColor(cp.agency) }}
                      >
                        {cp.agency}
                      </span>
                      <span className={styles.topVisits}>{cp.visits} visit{cp.visits !== 1 ? "s" : ""}</span>
                    </div>
                    <div className={styles.topBarTrack}>
                      <div className={styles.topBarFill} style={{ width: `${widthPct}%` }} />
                    </div>
                  </div>
                  <div className={styles.topCost}>${cp.totalCost.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent Sessions ── */}
      {monthEntries.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {isCurrentMonth ? "This Month's Sessions" : monthLabel(viewYear, viewMonth)}
          </div>
          <div className={styles.sessionList}>
            {monthEntries.map((entry) => (
              <div key={entry.id} className={styles.sessionItem}>
                <div className={styles.sessionLeft}>
                  <div className={styles.sessionName}>{entry.carparkName}</div>
                  <div className={styles.sessionMeta}>
                    {formatDate(entry.parkedAt)} · {formatDuration(entry.durationHours)}
                  </div>
                </div>
                <div className={styles.sessionRight}>
                  <div className={styles.sessionCost}>${entry.cost.toFixed(2)}</div>
                  <button
                    className={styles.sessionDelete}
                    onClick={() => handleDelete(entry.id)}
                    aria-label="Delete session"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {log.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>💰</div>
          <p className={styles.emptyText}>
            No sessions logged yet. Park from the 🅿️ tab to start tracking your spend.
          </p>
        </div>
      )}

      {/* ── Clear History ── */}
      {log.length > 0 && (
        <div className={styles.clearSection}>
          {showClearConfirm ? (
            <div className={styles.clearConfirm}>
              <p className={styles.clearConfirmText}>Delete all {log.length} sessions?</p>
              <div className={styles.clearConfirmBtns}>
                <button className={styles.clearConfirmYes} onClick={handleClearAll}>Yes, clear all</button>
                <button className={styles.clearConfirmNo} onClick={() => setShowClearConfirm(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className={styles.clearBtn} onClick={() => setShowClearConfirm(true)}>
              🗑 Clear All History
            </button>
          )}
        </div>
      )}
    </main>
  );
}
