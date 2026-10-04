import { ReactNode, useEffect, useRef, useState } from 'react';

interface Props {
  /** Rendered when the element is visible (or was visible once). */
  children: ReactNode;
  /** Placeholder rendered before the element becomes visible. */
  placeholder?: ReactNode;
  /** Root margin for IntersectionObserver. Defaults to 200px so content
   * starts loading slightly before it enters the viewport, avoiding a
   * visible pop on scroll. */
  rootMargin?: string;
  className?: string;
  /** Optional nested scroller used for ahead-of-scroll loading. */
  scrollRootSelector?: string;
}

/**
 * Renders `children` only once the wrapper has been visible in the viewport
 * at least once. This lets heavy media (images, videos) skip the network
 * entirely while they are scrolled out of view, which is the single biggest
 * win on low-quality connections.
 *
 * Falls back to immediate rendering if `IntersectionObserver` is not
 * supported by the browser.
 */
export default function LazyMedia({
  children,
  placeholder,
  rootMargin = '200px',
  className,
  scrollRootSelector,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin, root: scrollRootSelector ? el.closest(scrollRootSelector) : null },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin, scrollRootSelector]);

  return (
    <div ref={ref} className={className}>
      {visible
        ? children
        : placeholder ?? (
            <div
              className="w-56 h-40 rounded-lg bg-black/20 animate-pulse"
              aria-label="Chargement du média"
            />
          )}
    </div>
  );
}