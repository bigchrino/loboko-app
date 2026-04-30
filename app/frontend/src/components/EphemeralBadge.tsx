import { useEffect, useRef, useState } from 'react';
import { Timer } from 'lucide-react';

/**
 * EphemeralBadge
 * ----------------
 * A small ⏳/Timer icon used as an indicator on ephemeral messages. When the
 * user taps (or clicks) the icon, a tiny, floating popover appears next to
 * it describing the remaining time until the message disappears:
 *
 *   - "Disparaît dans 23 h"
 *   - "Disparaît dans 6 j"
 *   - "Expire bientôt"
 *   - "Expiré"
 *
 * The popover auto-dismisses after a few seconds and also closes when the
 * user clicks/taps anywhere else. The component is self-contained so it can
 * be dropped inside any chat bubble (DM or group) without touching bubble
 * layout.
 */
export interface EphemeralBadgeProps {
  /** ISO timestamp of when the message expires, or null/undefined if none. */
  expiresAt?: string | null;
  /**
   * Visual size of the icon in pixels. Defaults to 11 to match the existing
   * inline badges next to message timestamps.
   */
  size?: number;
  /**
   * Extra Tailwind classes for the icon button wrapper. Only use to tweak
   * spacing; do not change its visual style.
   */
  className?: string;
}

function formatRemaining(expiresAt?: string | null): string {
  if (!expiresAt) return 'Message éphémère';
  const now = Date.now();
  const end = new Date(expiresAt).getTime();
  if (!Number.isFinite(end)) return 'Message éphémère';
  const diffMs = end - now;
  if (diffMs <= 0) return 'Expiré';

  const sec = Math.floor(diffMs / 1000);
  // Less than 60 seconds -> clearly imminent
  if (sec < 60) return 'Expire bientôt';
  const min = Math.floor(sec / 60);
  if (min < 60) {
    // Under 5 minutes we still say "Expire bientôt" to avoid noisy "Disparaît dans 3 min"
    if (min < 5) return 'Expire bientôt';
    return `Disparaît dans ${min} min`;
  }
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Disparaît dans ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Disparaît dans ${days} j`;
}

export default function EphemeralBadge({
  expiresAt,
  size = 11,
  className = '',
}: EphemeralBadgeProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState<string>(() => formatRemaining(expiresAt));
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close popover when clicking outside or pressing Escape. Also auto-hide
  // after ~3 seconds so it stays discreet.
  useEffect(() => {
    if (!open) return;

    const onDocDown = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('touchstart', onDocDown, { passive: true });
    document.addEventListener('keydown', onKey);

    if (autoHideRef.current) clearTimeout(autoHideRef.current);
    autoHideRef.current = setTimeout(() => setOpen(false), 3000);

    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('touchstart', onDocDown);
      document.removeEventListener('keydown', onKey);
      if (autoHideRef.current) {
        clearTimeout(autoHideRef.current);
        autoHideRef.current = null;
      }
    };
  }, [open]);

  const handleActivate = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent the surrounding bubble's long-press / click handlers from
    // firing when the user just wants to peek at the remaining time.
    e.stopPropagation();
    if (typeof (e as React.MouseEvent).preventDefault === 'function') {
      e.preventDefault();
    }
    setLabel(formatRemaining(expiresAt));
    setOpen((v) => !v);
  };

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex items-center ${className}`}
      // Swallow long-press so the bubble's action menu does not pop while
      // the user is trying to read the remaining-time hint.
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleActivate}
        className="inline-flex items-center justify-center text-[#60a5fa] hover:text-[#93c5fd] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#60a5fa] rounded"
        aria-label="Message éphémère — afficher le temps restant"
        aria-expanded={open}
      >
        <Timer size={size} aria-hidden="true" />
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-[10px] leading-tight text-[var(--loboko-text)] whitespace-nowrap shadow-lg pointer-events-none select-none"
        >
          {label}
        </span>
      )}
    </span>
  );
}