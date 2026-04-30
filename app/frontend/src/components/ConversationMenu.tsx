import { useEffect, useRef, useState } from 'react';
import {
  MoreVertical,
  Archive,
  Trash2,
  Ban,
  Flag,
  ArchiveRestore,
  Timer,
} from 'lucide-react';

export type ConversationMenuAction =
  | 'archive'
  | 'unarchive'
  | 'delete'
  | 'block'
  | 'block_and_report'
  | 'ephemeral';

interface Props {
  archived: boolean;
  onAction: (action: ConversationMenuAction) => void;
  ephemeralLabel?: string; // e.g. "24h" to display next to Messages éphémères
}

/**
 * Three-dots menu used in the conversation header. Also triggered by long-press
 * on a conversation item in the list (via the `trigger` render prop variant).
 */
export default function ConversationMenu({
  archived,
  onAction,
  ephemeralLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const items: Array<{
    key: ConversationMenuAction;
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    danger?: boolean;
    hidden?: boolean;
    hint?: string;
  }> = [
    {
      key: 'ephemeral',
      label: 'Messages éphémères',
      icon: Timer,
      hint: ephemeralLabel,
    },
    archived
      ? { key: 'unarchive', label: 'Désarchiver', icon: ArchiveRestore }
      : { key: 'archive', label: 'Archiver', icon: Archive },
    { key: 'delete', label: 'Supprimer la discussion', icon: Trash2, danger: true },
    { key: 'block', label: 'Bloquer', icon: Ban, danger: true },
    {
      key: 'block_and_report',
      label: 'Bloquer et signaler',
      icon: Flag,
      danger: true,
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)] flex items-center justify-center"
        aria-label="Options de la conversation"
        title="Options"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-xl shadow-xl z-40 overflow-hidden">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onAction(it.key);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[var(--loboko-surface-hover)] ${
                  it.danger ? 'text-red-400' : 'text-[var(--loboko-text)]'
                }`}
              >
                <Icon size={16} />
                <span className="flex-1">{it.label}</span>
                {it.hint && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(37,99,235,0.18)] text-[#60a5fa] font-semibold">
                    {it.hint}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}