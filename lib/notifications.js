import { Capacitor } from "@capacitor/core";

// Fixed IDs so we can cancel/replace all parking notifications deterministically.
const PRE_EXPIRY_IDS = [1001, 1002, 1003, 1004, 1005, 1006];
const OVERDUE_IDS = [1101, 1102, 1103, 1104, 1105, 1106];
const ARRIVAL_PAYMENT_ID = 1201;
const CANCEL_IDS = [...PRE_EXPIRY_IDS, ...OVERDUE_IDS, ARRIVAL_PAYMENT_ID].map((id) => ({ id }));

/**
 * Returns the LocalNotifications plugin, or null when running in a browser
 * (Capacitor is not native). All callers must null-check the return value.
 */
async function getPlugin() {
  if (!Capacitor.isNativePlatform()) return null;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

/**
 * Request notification permission. Returns true if granted.
 * Always returns false in the browser (graceful no-op).
 */
export async function requestNotificationPermission() {
  const LN = await getPlugin();
  if (!LN) return false;
  try {
    const { display } = await LN.checkPermissions();
    if (display === "granted") return true;
    const result = await LN.requestPermissions();
    return result.display === "granted";
  } catch {
    return false;
  }
}

function normalizeReminderMinutes(reminderMinsList = []) {
  const valid = reminderMinsList
    .map((m) => parseInt(m, 10))
    .filter((m) => Number.isInteger(m) && m > 0);
  return [...new Set(valid)].sort((a, b) => b - a);
}

/**
 * Schedule a parking reminder notification.
 * Cancels any existing parking notification before scheduling the new one.
 * Does nothing in the browser or when reminderMins is 0.
 *
 * @param {object} opts
 * @param {number} opts.expiresAt  - Unix timestamp (ms) when parking expires
 * @param {number} opts.reminderMins - How many minutes before expiry to fire
 */
export async function scheduleParkingReminder({ expiresAt, reminderMins }) {
  return scheduleParkingReminders({
    expiresAt,
    reminderMinsList: reminderMins ? [reminderMins] : [],
    escalationMins: 0,
    escalationCount: 0,
  });
}

/**
 * Schedule multiple parking reminders + optional overdue escalation reminders.
 *
 * @param {object} opts
 * @param {number} opts.expiresAt - Unix timestamp (ms) when parking expires
 * @param {number[]} [opts.reminderMinsList] - reminder lead times in minutes
 * @param {number} [opts.escalationMins] - minutes between overdue reminders
 * @param {number} [opts.escalationCount] - number of overdue reminders
 */
export async function scheduleParkingReminders({
  expiresAt,
  reminderMinsList = [],
  escalationMins = 10,
  escalationCount = 0,
}) {
  const LN = await getPlugin();
  if (!LN) return;
  if (!expiresAt || !Number.isFinite(expiresAt)) return;

  try {
    // Always cancel old ones first so we never duplicate notifications.
    await LN.cancel({ notifications: CANCEL_IDS });

    const reminders = normalizeReminderMinutes(reminderMinsList);
    const now = Date.now();
    const notifications = [];

    reminders.slice(0, PRE_EXPIRY_IDS.length).forEach((mins, idx) => {
      const fireAtMs = expiresAt - mins * 60 * 1000;
      if (fireAtMs <= now) return;
      notifications.push({
        id: PRE_EXPIRY_IDS[idx],
        title: "🅿️ Parking Reminder",
        body: `Your parking expires in ${mins} min${mins === 1 ? "" : "s"}.`,
        schedule: {
          at: new Date(fireAtMs),
          allowWhileIdle: true,
        },
        extra: null,
      });
    });

    const steps = Math.max(0, parseInt(escalationCount, 10) || 0);
    const gapMins = Math.max(1, parseInt(escalationMins, 10) || 10);
    for (let i = 0; i < Math.min(steps, OVERDUE_IDS.length); i++) {
      const fireAtMs = expiresAt + (i + 1) * gapMins * 60 * 1000;
      if (fireAtMs <= now) continue;
      notifications.push({
        id: OVERDUE_IDS[i],
        title: "⚠️ Parking May Be Overdue",
        body: "Extend or end your parking session to reduce fine risk.",
        schedule: {
          at: new Date(fireAtMs),
          allowWhileIdle: true,
        },
        extra: null,
      });
    }

    if (notifications.length === 0) return;
    await LN.schedule({ notifications });
  } catch (err) {
    // Non-fatal — the app still works without notifications
    console.warn("Failed to schedule parking reminders:", err);
  }
}

/**
 * Cancel the pending parking reminder, e.g. when the user taps "Done Parking".
 * No-op in the browser.
 */
export async function cancelParkingReminder() {
  const LN = await getPlugin();
  if (!LN) return;
  try {
    await LN.cancel({ notifications: CANCEL_IDS });
  } catch {
    // ignore
  }
}

/**
 * Fire a one-time reminder shortly after user arrival to start app payment
 * for no-gantry carparks.
 *
 * @param {object} opts
 * @param {string} [opts.carparkName]
 */
export async function scheduleArrivalPaymentReminder({ carparkName = "" } = {}) {
  const LN = await getPlugin();
  if (!LN) return;

  try {
    await LN.cancel({ notifications: [{ id: ARRIVAL_PAYMENT_ID }] });
    await LN.schedule({
      notifications: [
        {
          id: ARRIVAL_PAYMENT_ID,
          title: "Start Parking Payment",
          body: carparkName
            ? `No gantry at ${carparkName}. Start your Parking.sg session now.`
            : "No gantry detected. Start your Parking.sg session now.",
          schedule: {
            at: new Date(Date.now() + 1000),
            allowWhileIdle: true,
          },
          extra: null,
        },
      ],
    });
  } catch (err) {
    console.warn("Failed to schedule arrival payment reminder:", err);
  }
}
