import { useSyncExternalStore } from 'react';
import { DEFAULT_APP_PREFERENCES, getAppPreferences, subscribeAppPreferences } from './app-preferences';

export function useAppPreferences(owner = 'device') {
  return useSyncExternalStore(subscribeAppPreferences,
    () => getAppPreferences(owner), () => DEFAULT_APP_PREFERENCES);
}
