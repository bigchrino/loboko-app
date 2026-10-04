import { useSyncExternalStore } from 'react';

export const CHAT_THEMES = {
  default: { label: 'Par défaut', background: undefined },
  blue: { label: 'Bleu', background: 'rgba(37,99,235,0.12)' },
  green: { label: 'Vert', background: 'rgba(22,163,74,0.12)' },
  violet: { label: 'Violet', background: 'rgba(124,58,237,0.12)' },
} as const;
export type ChatTheme = keyof typeof CHAT_THEMES;
const prefix = 'loboko:chat-theme:';
const listeners = new Set<() => void>();
function key(owner: string, conversation: string) {
  return prefix + owner + ':' + conversation;
}
export function readChatTheme(owner: string, conversation: string): ChatTheme {
  try {
    const value = localStorage.getItem(key(owner, conversation));
    return value && Object.prototype.hasOwnProperty.call(CHAT_THEMES, value) ? value as ChatTheme : 'default';
  } catch { return 'default'; }
}
export function saveChatTheme(owner: string, conversation: string, theme: ChatTheme) {
  if (!owner || !conversation || !Object.prototype.hasOwnProperty.call(CHAT_THEMES, theme)) throw new Error('Discussion introuvable');
  localStorage.setItem(key(owner, conversation), theme);
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === null || event.key.startsWith(prefix)) listeners.forEach(listener => listener());
  });
}
export function useChatTheme(owner: string, conversation: string) {
  const theme = useSyncExternalStore(subscribe,
    () => readChatTheme(owner, conversation), () => 'default' as ChatTheme);
  return { theme, background: CHAT_THEMES[theme].background };
}
