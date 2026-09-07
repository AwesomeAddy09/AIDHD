// Minimal service worker whose only current job is to let the page show
// notifications via registration.showNotification(), which is required
// on some browsers (Android Chrome in particular refuses the plain
// `new Notification()` constructor from page context) and is the more
// forward-compatible choice generally.
//
// Reminders are currently scheduled entirely client-side (see
// lib/reminders.js): the page computes when each timed task/event is
// coming up and sets a plain setTimeout, which calls showNotification
// when it fires. That means reminders only fire while this tab (or an
// installed PWA using it) is open and running — there's no server
// pushing notifications, so nothing fires if the browser is fully
// closed. That's the known limitation flagged when this was built.
//
// To upgrade to real background push later (e.g. once a Capacitor
// native wrapper exists, or if full Web Push is added before that):
//   1. Add a `push` event listener here that reads the payload and
//      calls self.registration.showNotification(...) itself, instead
//      of relying on the page's setTimeout.
//   2. Replace the client-side scheduling in lib/reminders.js with a
//      server-side scheduler (e.g. a cron job) that looks at upcoming
//      tasks/events across all users and sends a push at the right
//      time, using stored push subscriptions (or native push tokens
//      for the Capacitor build) instead of computing delays in the
//      browser.
// The notification content and lead-time logic (lib/reminders.js) can
// stay the same either way, only the delivery mechanism changes.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// self.addEventListener("push", (event) => {
//   // Real push delivery would land here once there's a server sending
//   // pushes instead of the page scheduling its own setTimeouts.
// });

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
