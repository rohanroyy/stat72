import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  new NavigationRoute(
    new NetworkFirst({ networkTimeoutSeconds: 3 }),
    { denylist: [/^\/api\//] }
  )
);

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "STORE_EXAMS") {
    self.__examData = event.data.exams || [];
  }
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Use the action URL embedded in notification data, fallback to root
  const deepLink = event.notification.data?.url || "/";
  const urlToOpen = deepLink.startsWith("http")
    ? deepLink
    : self.location.origin + deepLink;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // If a window for this app is already open, navigate it to the deep-link
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "navigate" in client) {
          client.focus();
          return client.navigate(urlToOpen);
        }
      }
      // Otherwise open a new tab/window
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
    })
  );
});

