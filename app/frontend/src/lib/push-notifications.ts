/**
 * Web Push registration + subscription lifecycle.
 *
 * Flow:
 *   1. `isPushSupported()`              — feature detection
 *   2. `registerServiceWorker()`        — installs `/sw.js` (idempotent)
 *   3. `subscribeCurrentUser()`         — asks permission, creates PushSubscription,
 *                                         persists it in `push_subscriptions`
 *   4. `unsubscribeCurrentUser()`       — unsubscribes + removes row
 *
 * The VAPID public key comes from `import.meta.env.VITE_VAPID_PUBLIC_KEY`.
 * If missing, push silently degrades to no-op (the UI surfaces this).
 */

import { supabase } from '@/lib/supabase';

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || '';

/** Runtime feature detection. iOS < 16.4 or non-PWA Safari returns false. */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** True on iOS / iPadOS where push only works inside an installed PWA. */
export function isIosStandaloneRequired(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  if (!isIos) return false;
  const standalone =
    // @ts-expect-error — Safari-only prop
    (typeof navigator.standalone === 'boolean' && navigator.standalone) ||
    window.matchMedia?.('(display-mode: standalone)').matches;
  return !standalone;
}

export function permissionStatus(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/** Register the service worker once. Safe to call multiple times. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) return existing;
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (e) {
    console.error('[push] SW registration failed', e);
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function pushSubToRow(sub: PushSubscription) {
  const json = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  return {
    endpoint: json.endpoint ?? sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  };
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const reg = await registerServiceWorker();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function isSubscribed(): Promise<boolean> {
  const s = await getCurrentSubscription();
  return !!s;
}

/**
 * Ask permission if needed, create a PushSubscription and persist it.
 * Returns { ok: true } on success, or { ok: false, reason } otherwise.
 */
export async function subscribeCurrentUser(): Promise<
  { ok: true } | { ok: false; reason: 'unsupported' | 'no-vapid' | 'denied' | 'error' | 'not-authed' }
> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid' };

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) return { ok: false, reason: 'not-authed' };

  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: 'error' };

  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const row = pushSubToRow(sub);
    if (!row.endpoint || !row.p256dh || !row.auth) {
      return { ok: false, reason: 'error' };
    }

    // Upsert by endpoint (endpoint is UNIQUE). We store user_id so the
    // edge function can fetch all devices of a user.
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: uid,
          endpoint: row.endpoint,
          p256dh: row.p256dh,
          auth: row.auth,
          user_agent: navigator.userAgent ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' },
      );
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error('[push] subscribe failed', e);
    return { ok: false, reason: 'error' };
  }
}

export async function unsubscribeCurrentUser(): Promise<void> {
  try {
    const sub = await getCurrentSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      try {
        await sub.unsubscribe();
      } catch (_) {
        /* ignore */
      }
      if (endpoint) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
    }
  } catch (e) {
    console.error('[push] unsubscribe failed', e);
  }
}

/** Called at app boot: make sure the SW is alive and any existing subscription is
 *  still bound to the current user. No-op if not subscribed. */
export async function syncPushSubscriptionOnStartup(userId: string | null | undefined): Promise<void> {
  if (!userId || !isPushSupported() || !VAPID_PUBLIC_KEY) return;
  try {
    const reg = await registerServiceWorker();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const row = pushSubToRow(sub);
    if (!row.endpoint) return;
    await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: row.endpoint,
          p256dh: row.p256dh,
          auth: row.auth,
          user_agent: navigator.userAgent ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' },
      );
  } catch (e) {
    console.error('[push] startup sync failed', e);
  }
}