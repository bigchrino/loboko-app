import { useLayoutEffect, useState } from 'react';

export const CHAT_PANEL_CLASS = 'fixed inset-x-0 top-[64px] z-30 flex flex-col bg-[var(--loboko-surface)] overflow-hidden overscroll-none lg:static lg:h-[calc(100vh-160px)] lg:border lg:border-[var(--loboko-border)] lg:rounded-2xl';
export const CHAT_COMPOSER_CLASS = 'p-2 sm:p-3 border-t border-[var(--loboko-border)] flex items-center gap-1.5 sm:gap-2 relative w-full min-w-0 bg-[var(--loboko-surface)]';

// Shared by direct and group conversations. The home-indicator inset is
// needed with the keyboard closed, but must not leave a gap above it.
export function useChatViewport(active: boolean) {
  const [viewport, setViewport] = useState({ bottom: 0, keyboardOpen: false });
  useLayoutEffect(() => {
    if (!active) { setViewport({ bottom: 0, keyboardOpen: false }); return; }
    const vv = window.visualViewport;
    const update = () => {
      const bottom = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      const keyboardOpen = bottom > 100;
      setViewport((previous) => previous.bottom === bottom && previous.keyboardOpen === keyboardOpen
        ? previous : { bottom, keyboardOpen });
    };
    update();
    window.addEventListener('resize', update);
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
    };
  }, [active]);
  return {
    panelStyle: { bottom: viewport.bottom },
    composerStyle: { paddingBottom: viewport.keyboardOpen ? '0.5rem' : 'calc(env(safe-area-inset-bottom,0px) + 0.5rem)' },
  };
}
