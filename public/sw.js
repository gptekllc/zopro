// Service Worker for Push Notifications and PWA Badge
// This service worker handles push notifications and app badge updates

self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing...');
  // Do NOT call self.skipWaiting() — let Workbox control the lifecycle
});

self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push received');
  
  let data = { title: 'Notification', body: 'You have a new notification', badge_count: 1 };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('[Service Worker] Error parsing push data:', e);
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || 'default',
    data: {
      url: data.url || '/notifications',
      badge_count: data.badge_count || 1,
    },
    vibrate: [100, 50, 100, 50, 100, 50, 100], // Enhanced vibration pattern for haptic feedback
    silent: false, // Allow system notification sound to play
    renotify: true, // Always vibrate/sound even for same tag
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Dismiss' },
    ],
  };
  
  // Update PWA badge with unread count
  if ('setAppBadge' in self.navigator) {
    const badgeCount = data.badge_count || 1;
    self.navigator.setAppBadge(badgeCount).catch((err) => {
      console.log('[Service Worker] Badge API error:', err);
    });
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  const urlToOpen = event.notification.data?.url || '/notifications';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (urlToOpen !== '/') {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      // Open new window if no existing window found
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('[Service Worker] Push subscription changed');
  // The client will need to resubscribe when they next open the app
});

// Listen for messages from the main thread to update badge
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'UPDATE_BADGE') {
    const count = event.data.count || 0;
    if ('setAppBadge' in self.navigator) {
      if (count > 0) {
        self.navigator.setAppBadge(count).catch(() => {});
      } else {
        self.navigator.clearAppBadge().catch(() => {});
      }
    }
  }
});
