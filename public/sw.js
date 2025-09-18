// Service Worker for handling push notifications
self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('No data in push event');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'AgentVibes',
      body: event.data.text() || 'New notification'
    };
  }

  const options = {
    body: data.body || 'New notification from AgentVibes',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    image: data.image,
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ],
    requireInteraction: true,
    tag: 'agentvibes-notification'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AgentVibes', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Default action or 'open' action
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if the app is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If not open, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle service worker activation
self.addEventListener('activate', function(event) {
  console.log('Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Handle service worker installation  
self.addEventListener('install', function(event) {
  console.log('Service Worker installed');
  self.skipWaiting();
});
