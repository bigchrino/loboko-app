/* LOBOKO Service Worker — Web Push + notification click routing */
/* eslint-disable no-restricted-globals */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'skip-waiting') {
    self.skipWaiting();
  }
});

async function anyVisibleClientFocusedOnConversation(data) {
  if (!data) return false;
  const clientList = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  return clientList.some((c) => {
    if (c.visibilityState !== 'visible' || !c.focused) return false;
    try {
      const url = new URL(c.url);
      if (data.type === 'dm') {
        return url.pathname.startsWith('/messages') && url.searchParams.get('to') === String(data.conversation_id);
      }
      if (data.type === 'group') {
        return url.pathname === `/messages/group/${data.conversation_id}` ||
               url.pathname.startsWith(`/messages/group/${data.conversation_id}/`);
      }
    } catch (_) {
      return false;
    }
    return false;
  });
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch (_) {
      payload = { title: 'LOBOKO', body: event.data ? event.data.text() : '' };
    }

    const data = payload.data || {};
    // If the user is already looking at this conversation, skip the notif.
    if (await anyVisibleClientFocusedOnConversation(data)) {
      return;
    }

    const title = payload.title || 'LOBOKO';
    const body = payload.body || '';
    const tag = data.conversation_id
      ? `${data.type || 'dm'}:${data.conversation_id}`
      : 'loboko';

    await self.registration.showNotification(title, {
      body,
      tag, // groups notifs of same conversation
      renotify: true,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data,
      requireInteraction: data.type === 'urgent_order',
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetPath = (() => {
    if (data.type === 'urgent_order' && (data.order_id || data.conversation_id)) {
      return `/my-orders/${encodeURIComponent(data.order_id || data.conversation_id)}`;
    }
    if (data.type === 'group' && data.conversation_id) {
      return `/messages/group/${encodeURIComponent(data.conversation_id)}`;
    }
    if (data.type === 'dm' && data.conversation_id) {
      return `/messages?to=${encodeURIComponent(data.conversation_id)}`;
    }
    if (data.post_id) return `/post/${encodeURIComponent(data.post_id)}`;
    if (data.type === 'notification' || data.type === 'test') return '/notifications';
    return '/messages';
  })();

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    // Try to focus an existing window and navigate it.
    for (const client of clientList) {
      try {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(targetPath);
            } catch (_) {
              client.postMessage({ type: 'navigate', path: targetPath });
            }
          } else {
            client.postMessage({ type: 'navigate', path: targetPath });
          }
          return;
        }
      } catch (_) {
        /* ignore */
      }
    }
    // Otherwise open a new window.
    await self.clients.openWindow(targetPath);
  })());
});