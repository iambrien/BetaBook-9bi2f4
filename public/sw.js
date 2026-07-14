const CACHE_NAME = 'betabook-v3';
const STATIC_ASSETS = ['/', '/manifest.json', '/favicon.svg'];

// ── In-memory scheduled reminder timers ────────────────────────────────────
const scheduledTimers = new Map(); // txId → timerId

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('supabase')) return;
  if (event.request.url.includes('onspace')) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.url.startsWith('http')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/'));
    })
  );
});

// ── Push Notifications ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {
    title: 'BetaBook',
    body: 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'betabook-default',
    data: {},
  };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      data: payload.data,
      requireInteraction: false,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        const client = clientList[0];
        client.focus();
        if (event.notification.data?.url) client.navigate(event.notification.data.url);
      } else {
        clients.openWindow(event.notification.data?.url || '/');
      }
    })
  );
});

// ── Message Handler ────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  // Immediate notification
  if (type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, data } = payload || {};
    self.registration.showNotification(title || 'BetaBook', {
      body: body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: tag || 'betabook-msg',
      data: data || {},
      vibrate: [300, 100, 300],
      requireInteraction: false,
    });
    return;
  }

  // Schedule a future reminder
  if (type === 'SCHEDULE_REMINDER') {
    const { txId, delay, title, body, tag } = payload || {};
    if (!txId || !delay || delay <= 0) return;

    // Clear any existing timer for this txId
    if (scheduledTimers.has(txId)) {
      clearTimeout(scheduledTimers.get(txId));
    }

    const timerId = setTimeout(() => {
      scheduledTimers.delete(txId);
      self.registration.showNotification(title || '⏰ Debt Reminder — BetaBook', {
        body: body || 'You have a scheduled debt collection reminder.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: tag || `reminder-${txId}`,
        data: { url: '/' },
        vibrate: [300, 100, 300, 100, 300],
        requireInteraction: true, // stays until dismissed
      });
    }, delay);

    scheduledTimers.set(txId, timerId);
    return;
  }

  // Cancel a scheduled reminder
  if (type === 'CANCEL_REMINDER') {
    const { txId } = payload || {};
    if (txId && scheduledTimers.has(txId)) {
      clearTimeout(scheduledTimers.get(txId));
      scheduledTimers.delete(txId);
    }
  }
});
