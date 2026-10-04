import { useLayoutEffect, useState, type CSSProperties } from 'react';

export const CHAT_PANEL_CLASS = 'fixed inset-x-0 top-[var(--chat-top)] h-[var(--chat-height)] z-30 flex flex-col bg-[var(--loboko-surface)] overflow-hidden overscroll-none lg:static lg:h-[calc(100vh-160px)] lg:border lg:border-[var(--loboko-border)] lg:rounded-2xl';
export const CHAT_HEADER_CLASS = 'shrink-0 flex items-center gap-2 p-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] lg:pt-3 border-b border-[var(--loboko-border)]';
export const CHAT_COMPOSER_CLASS = 'shrink-0 p-2 sm:p-3 border-t border-[var(--loboko-border)] flex items-center gap-1.5 sm:gap-2 relative w-full min-w-0 bg-[var(--loboko-surface)]';

// Keep the complete conversation inside the visible viewport, including
// when Safari pans the page to reveal a focused field.
export function useChatViewport(active: boolean) {
  const [viewport, setViewport] = useState({ top: 0, height: 0, keyboardOpen: false });
  useLayoutEffect(() => {
    if (!active) { setViewport({ top: 0, height: 0, keyboardOpen: false }); return; }
    const vv = window.visualViewport;
    const update = () => {
      const top = vv?.offsetTop ?? 0;
      const height = vv?.height ?? window.innerHeight;
      const keyboardOpen = window.innerHeight - height > 100;
      setViewport((previous) => previous.top === top && previous.height === height && previous.keyboardOpen === keyboardOpen
        ? previous : { top, height, keyboardOpen });
    };
    update();
    window.addEventListener('resize', update);
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    // Only the message list scrolls on mobile; restore the page on exit.
    const mobile = window.matchMedia('(max-width: 1023px)').matches;
    const previousOverflow = document.body.style.overflow;
    if (mobile) document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('resize', update);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      if (mobile) document.body.style.overflow = previousOverflow;
    };
  }, [active]);
  return {
    panelStyle: { '--chat-top': `${viewport.top}px`, '--chat-height': viewport.height ? `${viewport.height}px` : '100dvh' } as CSSProperties,
    composerStyle: { paddingBottom: viewport.keyboardOpen ? '0.5rem' : 'calc(env(safe-area-inset-bottom,0px) + 0.5rem)' },
  };
}
