self.addEventListener("push", event => {
  let data = { title: "Laurea di Carmine", body: "Il gioco sta per iniziare", url: "/" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title || "Laurea di Carmine", {
    body: data.body || "Il gioco sta per iniziare",
    icon: "/icons/apple-touch-icon.png",
    badge: "/icons/apple-touch-icon.png",
    data: { url: data.url || "/" },
    tag: "laurea-carmine-game-start",
    renotify: true
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
