const KEY = "parksmart_risk_log_v1";

function readLog() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logRiskEvent(type, meta = {}) {
  if (typeof window === "undefined") return;
  const next = [
    {
      id: `risk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      at: Date.now(),
      ...meta,
    },
    ...readLog(),
  ].slice(0, 200);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function getRiskLog() {
  if (typeof window === "undefined") return [];
  return readLog();
}
