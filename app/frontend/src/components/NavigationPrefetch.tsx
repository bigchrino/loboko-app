import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { canPreloadPages, preloadPage } from '@/lib/page-preload';

export default function NavigationPrefetch() {
  const { user, profile, loading } = useAuth();
  useEffect(() => {
    const intent = (event: Event) => {
      if (!canPreloadPages() || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin) void preloadPage(url.pathname);
    };
    document.addEventListener('pointerover', intent, { passive: true });
    document.addEventListener('pointerdown', intent, { passive: true });
    document.addEventListener('focusin', intent);
    return () => {
      document.removeEventListener('pointerover', intent);
      document.removeEventListener('pointerdown', intent);
      document.removeEventListener('focusin', intent);
    };
  }, []);
  useEffect(() => {
    if (loading || !user || !profile || !canPreloadPages()) return;
    let cancelled = false;
    // Warm one small destination at a time after startup, not every route.
    const timer = window.setTimeout(async () => {
      for (const path of ['/home', '/menu']) {
        if (cancelled || document.visibilityState !== 'visible') break;
        await preloadPage(path);
      }
    }, 1500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [loading, user?.id, profile?.user_id]);
  return null;
}
