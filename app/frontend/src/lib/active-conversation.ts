/**
 * Tracks which conversation the user is currently viewing so we can skip
 * redundant push notifications and in-app toasts for that conversation.
 *
 * Two channels:
 *   - `sessionStorage` (for other same-origin tabs / components in the app)
 *   - Service worker `postMessage` (so the SW can suppress push notifs
 *     when the user is already focused on the conversation).
 */

export type ActiveConversation = {
  type: 'dm' | 'group';
  id: string;
} | null;

const KEY = 'loboko:active-conversation';

function postToSW(payload: ActiveConversation): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    navigator.serviceWorker.ready
      .then((reg) => {
        reg.active?.postMessage({ type: 'active-conversation', payload });
      })
      .catch(() => {
        /* ignore: SW may not be installed yet */
      });
  } catch {
    /* ignore */
  }
}

export function setActiveConversation(conv: NonNullable<ActiveConversation>): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(conv));
  } catch {
    /* storage may be unavailable */
  }
  postToSW(conv);
}

export function clearActiveConversation(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage may be unavailable */
  }
  postToSW(null);
}

export function getActiveConversation(): ActiveConversation {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveConversation;
  } catch {
    return null;
  }
}

export function isConversationActive(type: 'dm' | 'group', id: string): boolean {
  const active = getActiveConversation();
  return !!active && active.type === type && active.id === id;
}