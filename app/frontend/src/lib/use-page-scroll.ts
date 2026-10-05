import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Document positions only, bounded in this tab and scoped to the account.
const positions = new Map<string, number>();

export function usePageScroll(owner: string | undefined, managedByPage = false) {
  const { key, pathname, hash } = useLocation();
  const navigation = useNavigationType();
  useLayoutEffect(() => {
    // Feed and conversations already preserve their own scroll containers.
    if (managedByPage || pathname === '/home' || pathname.startsWith('/post/') || hash) return;
    const entry = `${owner ?? 'guest'}:${key}`;
    const target = navigation === 'POP' ? positions.get(entry) ?? 0 : 0;
    let restoring = target > 0;
    let observer: ResizeObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      if (restoring) return;
      positions.delete(entry);
      positions.set(entry, window.scrollY);
      if (positions.size > 100) positions.delete(positions.keys().next().value!);
    };
    const finish = () => {
      restoring = false;
      observer?.disconnect();
      if (timer) clearTimeout(timer);
    };
    const restore = () => {
      window.scrollTo({ top: target, behavior: 'instant' });
      if (Math.abs(window.scrollY - target) < 2) finish();
    };
    const takeControl = () => { finish(); save(); };
    restore();
    if (restoring) {
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(restore);
        observer.observe(document.getElementById('root') ?? document.body);
      }
      timer = setTimeout(finish, 4000);
    }
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('wheel', takeControl, { passive: true });
    window.addEventListener('touchstart', takeControl, { passive: true });
    document.addEventListener('keydown', takeControl);
    document.addEventListener('click', save, true);
    return () => {
      finish();
      window.removeEventListener('scroll', save);
      window.removeEventListener('wheel', takeControl);
      window.removeEventListener('touchstart', takeControl);
      document.removeEventListener('keydown', takeControl);
      document.removeEventListener('click', save, true);
    };
  }, [owner, key, pathname, hash, navigation, managedByPage]);
}
