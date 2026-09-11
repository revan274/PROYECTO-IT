/* global self, clients */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = typeof payload.title === 'string' ? payload.title : 'Mesa IT';
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'Tienes una actualización pendiente.',
    tag: typeof payload.tag === 'string' ? payload.tag : 'mesa-it',
    renotify: true,
    data: { url: typeof payload.url === 'string' ? payload.url : '/#/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/#/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((windowClient) => windowClient.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      return;
    }
    await clients.openWindow(targetUrl);
  })());
});
