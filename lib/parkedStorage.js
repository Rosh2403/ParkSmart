const KEY = "parksmart_parked_session";

/**
 * Save a new parking session to localStorage and notify other components
 * via a custom window event (storage events only fire in other tabs).
 * Optional carpark fields (carparkId, carparkName, agency, isCentral) are
 * stored so the spend logger can compute accurate costs when the session ends.
 */
export function saveSession({
  lat, lng, expiresAt, label = "", reminderMins = 15,
  carparkId = null, carparkName = "", agency = "HDB", isCentral = false,
  reminderMinsList = null,
  paymentConfirmed = false,
  zoneConfirmed = false,
  plateConfirmed = false,
  checklistSkipped = false,
  escalationEnabled = true,
  escalationMins = 10,
  escalationCount = 3,
}) {
  const resolvedName = carparkName || label;
  const normalizedReminderMinsList = Array.isArray(reminderMinsList)
    ? reminderMinsList
    : (reminderMins > 0 ? [reminderMins] : []);
  const session = {
    lat, lng, parkedAt: Date.now(), expiresAt,
    label: resolvedName, reminderMins,
    carparkId, carparkName: resolvedName, agency, isCentral,
    reminderMinsList: normalizedReminderMinsList,
    paymentConfirmed,
    zoneConfirmed,
    plateConfirmed,
    checklistSkipped,
    escalationEnabled,
    escalationMins,
    escalationCount,
  };
  localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("parkedSessionChange", { detail: session }));
  return session;
}

/**
 * Read the current session. Returns null if none exists.
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Extend the expiry time of the current session.
 */
export function extendSession(extraMs) {
  const session = getSession();
  if (!session) return null;
  session.expiresAt = session.expiresAt + extraMs;
  localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("parkedSessionChange", { detail: session }));
  return session;
}

/**
 * Clear the current session.
 */
export function clearSession() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("parkedSessionChange", { detail: null }));
}

/**
 * Returns true if a session exists and has not expired.
 */
export function hasActiveSession() {
  const s = getSession();
  return s !== null;
}
