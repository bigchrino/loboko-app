/* LOBOKO Service Worker — Web Push + notification click routing */
/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'loboko-sw-v1';

// Currently-focused conversation, broadcast from the app via postMessage.
// Shape: { type: 'dm'|'group', id: string } | null
let activeConversation = null;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'active-conversation') {
    activeConversation = msg.payload ?? null;
  } else if (msg.type === 'skip-waiting') {
    self.skipWaiting();
  }
});

function isSameAsActive(data) {
  if (!activeConversation || !data) return false;
  return (
    data.type === activeConversation.type &&
    String(data.conversation_id) === String(activeConversation.id)
  );
}

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
        return url.pathname.startsWith('/messages') && url.search.includes(`user=${data.conversation_id}`);
      }
      if (data.type === 'group') {
        return url.pathname === `/groups/${data.conversation_id}` ||
               url.pathname.startsWith(`/groups/${data.conversation_id}/`);
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
    if (isSameAsActive(data) || (await anyVisibleClientFocusedOnConversation(data))) {
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
      requireInteraction: false,
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetPath = (() => {
    if (data.type === 'group' && data.conversation_id) {
      return `/groups/${data.conversation_id}`;
    }
    if (data.type === 'dm' && data.conversation_id) {
      return `/messages?user=${data.conversation_id}`;
    }
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