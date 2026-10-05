import { lazy, type ComponentType } from 'react';

const loaders = new WeakMap<object, () => Promise<unknown>>();
const routes = new Map<string, { pattern: RegExp; load: () => Promise<unknown> }>();

/** Share the same import between navigation and intent preloading. */
export function lazyPage(loader: () => Promise<{ default: ComponentType }>) {
  let pending: ReturnType<typeof loader> | undefined;
  const load = () => {
    pending ??= loader().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
  const page = lazy(load);
  loaders.set(page, load);
  return page;
}

export function registerPageRoute(path: string, page: object) {
  const load = loaders.get(page);
  if (!load) return;
  const pattern = path.split('/').map((part) => part.startsWith(':')
    ? '[^/]+' : [...part].map((char) => '.+*?^$()[]{}|\\'.includes(char) ? `\\${char}` : char).join('')).join('/');
  routes.set(path, { pattern: new RegExp(`^${pattern}/?$`), load });
}

/** Code only: no profiles, messages or permissions are prefetched. */
export async function preloadPage(path: string): Promise<void> {
  const pathname = path.split(/[?#]/)[0];
  const route = routes.get(pathname) ?? [...routes.values()].find((value) => value.pattern.test(pathname));
  try { await route?.load(); } catch { /* Navigation retains its own retry UI. */ }
}

export function canPreloadPages() {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  return !connection?.saveData && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '');
}
