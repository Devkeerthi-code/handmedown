/* HandMeDown service worker: only handles wishlist alert notifications. No offline caching. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "HandMeDown", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "HandMeDown";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Something you wanted was just listed.",
      tag: data.tag,
      data: { url: data.url || "/" },
      icon: "/icon.svg",
      badge: "/icon.svg",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url === url);
      if (open) return open.focus();
      return self.clients.openWindow(url);
    }),
  );
});
