import { useEffect, useRef } from 'react';

interface Props {
  /** True when another older page exists. When false, nothing is rendered. */
  hasMore: boolean;
  /** True while a page is being fetched. Disables the auto-trigger and
   * shows a small spinner. */
  loading: boolean;
  /** Called when the user scrolls near the top and another page is
   * available. Caller is responsible for preserving the scroll position
   * after prepending new messages. */
  onLoadMore: () => void;
}

/**
 * Small "loader at the top of the scrollable list". Uses
 * IntersectionObserver so that simply scrolling the conversation up near
 * the top of the history automatically fetches the next older page. A
 * visible fallback button is also rendered in case the observer is not
 * supported (rare on modern browsers but safe).
 */
export default function LoadOlderTrigger({ hasMore, loading, onLoadMore }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || loading) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onLoadMore();
            break;
          }
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (!hasMore && !loading) return null;
  return (
    <div
      ref={ref}
      className="flex items-center justify-center py-2 text-[11px] text-[var(--loboko-text-muted)]"
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full border-2 border-[#2563eb] border-t-transparent animate-spin"
            aria-hidden="true"
          />
          <span>Chargement des anciens messages…</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onLoadMore}
          className="px-2 py-1 rounded-full hover:bg-[var(--loboko-surface-hover)]"
        >
          Charger les anciens messages
        </button>
      )}
    </div>
  );
}