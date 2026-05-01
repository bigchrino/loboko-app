import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Returns a `goBack` function that navigates to the previous page in the
 * browser history. If there is no meaningful previous entry (e.g. the user
 * arrived directly via a pasted URL, a notification deep-link, or a fresh
 * tab), it falls back to the provided `fallbackPath` (default `/`).
 *
 * This is used by every visible back button in the app so that the back
 * arrow always returns the user to the *real* previous screen instead of
 * unconditionally jumping to the home page.
 *
 * The heuristic used to detect "no history" relies on `window.history.length`
 * and the history API's state index. It is not 100% foolproof across all
 * browsers, but it matches the behaviour users expect from native apps.
 */
export function useBackNavigation(fallbackPath: string = '/') {
  const navigate = useNavigate();

  const goBack = useCallback(() => {
    try {
      // `window.history.length` is >= 1 even on a fresh tab, so we treat
      // values <= 1 as "no real history" and use the fallback. When the
      // user navigated internally (e.g. clicked a link or pushed a route),
      // the length grows past 1 and we can safely go back.
      if (typeof window !== 'undefined' && window.history.length > 1) {
        navigate(-1);
        return;
      }
    } catch {
      // Ignore and fall through to the fallback below.
    }
    navigate(fallbackPath);
  }, [navigate, fallbackPath]);

  return goBack;
}