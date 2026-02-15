const KEY = "parksmart_parked_session";

/**
 * Save a new parking session to localStorage and notify other components
 * via a custom window event (storage events only fire in other tabs).
 */
export function saveSession({ lat, lng, expiresAt, label = "" }) {
  const session = { lat, lng, parkedAt: Date.now(), expiresAt, label };
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
