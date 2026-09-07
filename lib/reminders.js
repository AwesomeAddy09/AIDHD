// Client-side reminder scheduling. Everything here runs in the browser:
// there's no server pushing anything, so a reminder only fires while
// this tab (or an installed PWA using it) is open and running. See the
// comment at the top of public/sw.js for exactly what would need to
// change to upgrade this to real background push later (e.g. once a
// Capacitor native wrapper exists).

// Only schedule real setTimeouts for items within this window. A tab
// realistically won't stay open for days waiting on a reminder, and
// very long setTimeout delays aren't reliably precise anyway (subject
// to throttling, sleep/wake, etc.) — items further out just get picked
// up on a later re-scan once they fall inside the window.
export const REMINDER_HORIZON_MS = 24 * 60 * 60 * 1000;

// Re-scan this often even with no other trigger, so items that drift
// into the horizon purely by the passage of time still get scheduled.
export const REMINDER_RESCAN_MS = 10 * 60 * 1000;

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export async function registerReminderServiceWorker() {
  if (!notificationsSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    return null;
  }
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return "denied";
  }
}

export function showReminderNotification(registration, { key, title, body }) {
  if (!registration) return;
  registration.showNotification(title, {
    body,
    tag: key,
    icon: "/next.svg",
  }).catch(() => {});
}

// items: [{ key, title, body, startAt: Date }]. Clears every timer in
// timersRef.current and reschedules from scratch, skipping anything
// already in notifiedKeys (so a re-scan mid-lead-time doesn't re-fire
// something already shown) or already started.
export function scheduleReminders({ items, timersRef, notifiedKeysRef, leadMinutes, onFire }) {
  for (const id of timersRef.current.values()) clearTimeout(id);
  timersRef.current.clear();

  const now = Date.now();
  for (const item of items) {
    if (notifiedKeysRef.current.has(item.key)) continue;
    const startMs = item.startAt.getTime();
    if (startMs <= now) continue;
    if (startMs - now > REMINDER_HORIZON_MS) continue;

    const fireAt = startMs - leadMinutes * 60 * 1000;
    const delay = Math.max(0, fireAt - now);
    const timeoutId = setTimeout(() => {
      notifiedKeysRef.current.add(item.key);
      onFire(item);
    }, delay);
    timersRef.current.set(item.key, timeoutId);
  }
}

export function clearScheduledReminders(timersRef) {
  for (const id of timersRef.current.values()) clearTimeout(id);
  timersRef.current.clear();
}
