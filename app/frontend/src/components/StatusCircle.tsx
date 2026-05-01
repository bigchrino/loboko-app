import { useEffect, useState } from 'react';
import { getMediaUrl } from '@/lib/storage-helpers';

interface Props {
  avatarKey: string | null;
  fallbackLabel: string;
  /** True when there is at least one unseen status in the group. */
  hasUnseen: boolean;
  /** Size of the inner avatar in px. */
  size?: number;
  /** Optional "plus" badge, e.g. on the "Mon statut" tile. */
  plus?: boolean;
}

/**
 * Circular avatar with a colored ring that indicates unseen vs seen statuses,
 * mirroring the WhatsApp / Instagram story look.
 */
export default function StatusCircle({
  avatarKey,
  fallbackLabel,
  hasUnseen,
  size = 56,
  plus = false,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!avatarKey) {
      setUrl(null);
      return;
    }
    getMediaUrl(avatarKey)
      .then((u) => {
        if (!cancelled) setUrl(u || null);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [avatarKey]);

  const ringClass = hasUnseen
    ? 'bg-gradient-to-tr from-[#2563eb] via-[#7c3aed] to-[#db2777]'
    : 'bg-[var(--loboko-border)]';

  return (
    <div
      className={`relative rounded-full p-[2px] ${ringClass}`}
      style={{ width: size + 6, height: size + 6 }}
    >
      <div
        className="w-full h-full rounded-full bg-[var(--loboko-elevated)] p-[2px] overflow-hidden flex items-center justify-center"
      >
        <div
          className="w-full h-full rounded-full bg-[var(--loboko-surface)] overflow-hidden flex items-center justify-center text-sm font-bold text-[var(--loboko-text)]"
        >
          {url ? (
            <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <span>{fallbackLabel.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
      </div>
      {plus && (
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#2563eb] text-white text-xs font-bold flex items-center justify-center border-2 border-[var(--loboko-elevated)]">
          +
        </span>
      )}
    </div>
  );
}