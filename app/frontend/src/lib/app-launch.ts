const LAST_PATH_KEY = 'loboko-last-window-path';

interface AppLaunch {
  pathname: string;
  search: string;
  hash: string;
  navigationType: string;
  standalone: boolean;
  previousPath: string | null;
  externalReferrer: boolean;
}

export function shouldStartAtHome(launch: AppLaunch) {
  const { pathname, search, hash } = launch;
  if (pathname === '/' || pathname === '/home' || pathname === '/onboarding' ||
      pathname === '/contact' || pathname.startsWith('/auth/') ||
      pathname === '/blog' || pathname.startsWith('/blog/')) return false;
  if (new URLSearchParams(search).get('loboko_launch') === 'notification') return false;
  if (launch.navigationType === 'reload' || launch.externalReferrer) return false;
  return launch.standalone || launch.previousPath === pathname + search + hash;
}

export function rememberAppPath(path: string) {
  try { sessionStorage.setItem(LAST_PATH_KEY, path); } catch { /* Storage is optional. */ }
}

/** Runs once per document, never on ordinary in-app navigation or visibility changes. */
export function prepareAppLaunch() {
  let previousPath: string | null = null;
  try { previousPath = sessionStorage.getItem(LAST_PATH_KEY); } catch { /* Private browsing. */ }
  const url = new URL(window.location.href);
  let externalReferrer = false;
  try { externalReferrer = Boolean(document.referrer) && new URL(document.referrer).origin !== url.origin; } catch { /* No valid referrer. */ }
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const standalone = window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const home = shouldStartAtHome({ pathname: url.pathname, search: url.search, hash: url.hash,
    previousPath, navigationType: navigation?.type ?? 'navigate', standalone, externalReferrer });
  if (home) {
    window.history.replaceState(null, '', '/home');
  } else if (url.searchParams.get('loboko_launch') === 'notification') {
    url.searchParams.delete('loboko_launch');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
  rememberAppPath(window.location.pathname + window.location.search + window.location.hash);
}
