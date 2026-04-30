/**
 * Last-seen helpers.
 *
 * Strategy:
 *  - Update `profiles.last_seen_at` on focus, on visibility change to
 *    "visible", and on blur / pagehide / beforeunload (when the user
 *    leaves the app).
 *  - A short periodic heartbeat (~12s) runs ONLY while the tab is visible
 *    AND the user has interacted recently (pointer / key / scroll /
 *    touch). This keeps "vu récemment" close to real-time without
 *    spamming the database.
 *  - A tiny 5s anti-spam throttle coalesces bursts of events.
 *
 * IMPORTANT: "En ligne" is never derived from `last_seen_at`. Online
 * status comes exclusively from PresenceContext. This module only
 * provides the fallback "Vu ..." label when the user is offline.
 */
import { supabase } from '@/lib/supabase';

const MIN_WRITE_GAP_MS = 5_000; // at most one write every 5s
const HEARTBEAT_MS = 12_000; // periodic ping while active & visible
const ACTIVE_WINDOW_MS = 60_000; // considered "active" if interaction < 60s ago

let lastWriteAt = 0;
let lastWriteUserId: string | null = null;
let inFlight: Promise<void> | null = null;

async function writeNow(userId: string): Promise<void> {
  if (!userId) return;
  if (inFlight) return;
  inFlight = (async () => {
    try {
      const iso = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({ last_seen_at: iso })
        .eq('user_id', userId);
      if (error) {
        // Non-fatal (column/policy may be missing in older deployments).
        console.warn('[last-seen] update failed', error.message);
      }
    } catch (e) {
      console.warn('[last-seen] update exception', e);
    } finally {
      inFlight = null;
    }
  })();
  await inFlight;
}

/**
 * Throttled update. Safe to call on every UI event.
 */
export async function updateMyLastSeen(userId: string): Promise<void> {
  if (!userId) return;
  const now = Date.now();
  if (lastWriteUserId === userId && now - lastWriteAt < MIN_WRITE_GAP_MS) return;
  lastWriteAt = now;
  lastWriteUserId = userId;
  await writeNow(userId);
}

/**
 * Best-effort write that bypasses the 5s anti-spam throttle. Used on
 * focus/blur/unload so "vu à l'instant" stays accurate when the user
 * transitions in/out of the app.
 */
export async function forceUpdateMyLastSeen(userId: string): Promise<void> {
  if (!userId) return;
  lastWriteAt = Date.now();
  lastWriteUserId = userId;
  await writeNow(userId);
}

/**
 * Install focus/blur/visibility/interaction listeners and a 12s active
 * heartbeat. Returns a teardown function.
 */
export function startLastSeenHeartbeat(userId: string): () => void {
  if (!userId) return () => {};

  let lastInteractionAt = Date.now();
  const markInteraction = () => {
    lastInteractionAt = Date.now();
  };
  const isActive = () =>
    document.visibilityState === 'visible' &&
    Date.now() - lastInteractionAt < ACTIVE_WINDOW_MS;

  // Initial ping on mount.
  void forceUpdateMyLastSeen(userId);

  const onFocus = () => {
    markInteraction();
    void forceUpdateMyLastSeen(userId);
  };
  const onBlur = () => {
    // User switched away — record the moment they left.
    void forceUpdateMyLastSeen(userId);
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      markInteraction();
      void forceUpdateMyLastSeen(userId);
    } else {
      // Tab hidden — treat as leaving.
      void forceUpdateMyLastSeen(userId);
    }
  };
  const onPageHide = () => {
    void forceUpdateMyLastSeen(userId);
  };
  const onBeforeUnload = () => {
    void forceUpdateMyLastSeen(userId);
  };

  const interactionEvents: (keyof WindowEventMap)[] = [
    'mousemove',
    'mousedown',
    'keydown',
    'wheel',
    'touchstart',
    'scroll',
  ];

  interactionEvents.forEach((ev) =>
    window.addEventListener(ev, markInteraction, { passive: true }),
  );
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('visibilitychange', onVisibility);

  const interval = window.setInterval(() => {
    if (isActive()) {
      void updateMyLastSeen(userId);
    }
  }, HEARTBEAT_MS);

  return () => {
    window.clearInterval(interval);
    interactionEvents.forEach((ev) =>
      window.removeEventListener(ev, markInteraction),
    );
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Return a French "last seen" label for a given timestamp.
 * Does NOT check online presence — caller must handle the online case
 * before calling this function.
 */
export function formatLastSeen(dateLike: string | Date | null | undefined): string {
  if (!dateLike) return '';
  const date = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  const time = date.getTime();
  if (Number.isNaN(time)) return '';
  const now = new Date();
  const diffMs = now.getTime() - time;
  if (diffMs < 0) return '';
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Vu \u00e0 l\u2019instant';
  if (diffMin < 60) return `Vu il y a ${diffMin} min`;

  const hhmm = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (isSameDay(date, now)) {
    return `Vu aujourd\u2019hui \u00e0 ${hhmm}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return `Vu hier \u00e0 ${hhmm}`;
  }

  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yyyy = date.getFullYear();
  return `Vu le ${dd}/${mm}/${yyyy}`;
}

/**
 * Convenience: resolve the display label given presence + last_seen_at.
 * "En ligne" is ONLY returned when `online` is true (derived from
 * PresenceContext). Otherwise returns the formatted last-seen label,
 * or '' if unknown.
 */
export function resolveActivityLabel(
  online: boolean,
  lastSeenAt: string | null | undefined,
): string {
  if (online) return 'En ligne';
  return formatLastSeen(lastSeenAt);
}