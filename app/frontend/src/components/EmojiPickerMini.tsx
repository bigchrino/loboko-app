import { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';

const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🥳',
  '😅','😇','🙂','😉','😌','😋','🤤','😴','🤔','😬',
  '😢','😭','😡','🤬','🥺','😱','😳','🤯','😤','😏',
  '👍','👎','👏','🙌','🙏','💪','🤝','✌️','🤞','👌',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💯',
  '🔥','✨','🎉','🎊','⭐','🌟','⚡','💥','💫','☀️',
];

interface Props {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export default function EmojiPickerMini({ onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Emojis"
        className="w-9 h-9 rounded-full text-[var(--loboko-text-muted)] hover:bg-[var(--loboko-surface-hover)] hover:text-[var(--loboko-text)] flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
      >
        <Smile size={18} />
      </button>
      {open && (
        <div className="absolute bottom-11 right-0 z-30 w-64 max-h-52 overflow-y-auto rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] shadow-lg p-2 grid grid-cols-8 gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onSelect(e);
                setOpen(false);
              }}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--loboko-surface-hover)] text-lg"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}