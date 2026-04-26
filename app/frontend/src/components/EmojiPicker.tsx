import { useEffect, useRef } from 'react';

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🙄', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
    ],
  },
  {
    label: 'Gestes',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
      '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '🙏',
      '💪', '🦾', '✍️', '👏', '🙌', '👐', '🤲', '🤜', '🤛', '👊',
    ],
  },
  {
    label: 'Cœurs',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌',
    ],
  },
  {
    label: 'Objets',
    emojis: [
      '🔥', '✨', '🎉', '🎊', '🎁', '🎈', '🏆', '🥇', '🥈', '🥉',
      '⭐', '🌟', '💫', '💯', '💢', '💥', '💤', '💨', '🕐', '☀️',
      '🌙', '☁️', '⚡', '❄️', '🌈', '☂️', '🌸', '🌺', '🌹', '🌻',
    ],
  },
];

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-14 right-0 z-30 w-72 max-h-80 overflow-y-auto bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl shadow-xl p-3"
    >
      {EMOJI_GROUPS.map((group) => (
        <div key={group.label} className="mb-3 last:mb-0">
          <div className="text-[10px] uppercase tracking-wide text-[var(--loboko-text-muted)] mb-1.5 px-1">
            {group.label}
          </div>
          <div className="grid grid-cols-8 gap-1">
            {group.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--loboko-surface-hover)] text-xl transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}