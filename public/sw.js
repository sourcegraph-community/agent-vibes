// Service Worker for handling push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('No data in push event');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (parseError) {
    console.error('Failed to parse push payload', parseError);
    data = {
      title: 'AgentVibes',
      body: event.data.text() || 'New notification',
    };
  }

  const options = {
    body: data.body || 'New notification from AgentVibes',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    image: data.image,
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'open',
        title: 'Open App',
      },
      {
        action: 'close',
        title: 'Dismiss',
      },
    ],
    requireInteraction: true,
    tag: 'agentvibes-notification',
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AgentVibes', options),
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }

        if (typeof self.clients.openWindow === 'function') {
          return self.clients.openWindow(urlToOpen);
        }

        return undefined;
      }),
  );
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Handle service worker installation
self.addEventListener('install', () => {
  console.log('Service Worker installed');
  self.skipWaiting();
});
