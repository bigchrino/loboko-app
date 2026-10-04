export interface AppPreferences {
  reduceMotion: boolean;
  saveData: boolean;
  personalizedServices: boolean;
}
export const DEFAULT_APP_PREFERENCES: Readonly<AppPreferences> = Object.freeze({
  reduceMotion: false, saveData: false, personalizedServices: true,
});
const prefix = 'loboko-preferences-v1:';
const snapshots = new Map<string, AppPreferences>();
const listeners = new Set<() => void>();

function read(owner: string): AppPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(prefix + owner) ?? '{}');
    return Object.fromEntries(Object.entries(DEFAULT_APP_PREFERENCES).map(([key, fallback]) =>
      [key, typeof saved?.[key] === 'boolean' ? saved[key] : fallback])) as unknown as AppPreferences;
  } catch { return { ...DEFAULT_APP_PREFERENCES }; }
}
export function getAppPreferences(owner = 'device'): AppPreferences {
  if (!snapshots.has(owner)) snapshots.set(owner, read(owner));
  return snapshots.get(owner)!;
}
export function saveAppPreferences(patch: Partial<AppPreferences>, owner = 'device') {
  const next = { ...getAppPreferences(owner), ...patch };
  // Don't report a persistent setting as saved when storage rejects the write.
  localStorage.setItem(prefix + owner, JSON.stringify(next));
  snapshots.set(owner, next);
  listeners.forEach(listener => listener());
}
export function subscribeAppPreferences(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === null) snapshots.clear();
    else if (event.key.startsWith(prefix)) snapshots.delete(event.key.slice(prefix.length));
    else return;
    listeners.forEach(listener => listener());
  });
}
