import { useEffect, useRef } from 'react';
import {
  Reply,
  Forward,
  Copy,
  Star,
  StarOff,
  Trash2,
  UserX,
} from 'lucide-react';

export type MessageAction =
  | 'reply'
  | 'forward'
  | 'copy'
  | 'star'
  | 'unstar'
  | 'delete_for_me'
  | 'delete_for_everyone';

interface Props {
  anchor: { x: number; y: number };
  mine: boolean;
  isText: boolean;
  starred: boolean;
  onAction: (a: MessageAction) => void;
  onClose: () => void;
  onPickEmoji: (emoji: string) => void;
}

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '👎'];

/**
 * Floating bubble shown on long-press over a message bubble:
 * a row of quick emoji reactions + a popover menu of actions.
 * Sender can "delete for everyone", receiver cannot.
 */
export default function MessageActionsMenu({
  anchor,
  mine,
  isText,
  starred,
  onAction,
  onClose,
  onPickEmoji,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  // Clamp position inside viewport
  const width = 240;
  const estimatedHeight = mine ? 320 : 270;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const left = Math.max(8, Math.min(anchor.x, vw - width - 8));
  const top = Math.max(8, Math.min(anchor.y, vh - estimatedHeight - 8));

  const items: Array<{
    key: MessageAction;
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    danger?: boolean;
    hidden?: boolean;
  }> = [
    { key: 'reply', label: 'Répondre', icon: Reply },
    { key: 'forward', label: 'Transférer', icon: Forward },
    { key: 'copy', label: 'Copier', icon: Copy, hidden: !isText },
    starred
      ? { key: 'unstar', label: 'Retirer des importants', icon: StarOff }
      : { key: 'star', label: 'Ajouter aux messages importants', icon: Star },
    { key: 'delete_for_me', label: 'Supprimer pour moi', icon: Trash2, danger: true },
    {
      key: 'delete_for_everyone',
      label: 'Supprimer pour tout le monde',
      icon: UserX,
      danger: true,
      hidden: !mine,
    },
  ];

  return (
    <div
      ref={ref}
      style={{ left, top, width }}
      className="fixed z-[80] bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between gap-1 px-2 py-2 border-b border-[var(--loboko-border)] bg-[var(--loboko-elevated)]">
        {QUICK_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPickEmoji(e)}
            className="w-9 h-9 rounded-full hover:bg-[var(--loboko-surface-hover)] text-xl flex items-center justify-center"
            aria-label={`Réagir avec ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="py-1">
        {items
          .filter((it) => !it.hidden)
          .map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => onAction(it.key)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--loboko-surface-hover)] ${
                  it.danger ? 'text-red-400' : 'text-[var(--loboko-text)]'
                }`}
              >
                <Icon size={16} />
                <span>{it.label}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}