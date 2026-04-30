/**
 * Lightweight emoji picker used by status creation and reply input.
 *
 * Goals:
 *  - No heavy third-party dependency (small curated set, renders as native
 *    unicode glyphs).
 *  - Lazy-loaded via `React.lazy()` from the caller so it is NOT bundled
 *    into the initial app chunk.
 *  - Works on mobile + desktop and is safe to place above a text input
 *    without blurring it (we use `onMouseDown` / `onTouchStart` with
 *    `preventDefault()` so the input keeps focus on mobile).
 *
 * The picker exposes a single `onSelect(emoji)` callback. The caller is
 * responsible for inserting the emoji at the current cursor position in
 * its own input/textarea — see `insertAtCursor()` below.
 */

import { useMemo, useState } from 'react';

type Category = {
  key: string;
  label: string;
  icon: string;
  emojis: string[];
};

// Curated, cross-platform-safe set. Kept intentionally small so the
// component renders instantly on low-end Android devices.
const CATEGORIES: Category[] = [
  {
    key: 'smileys',
    label: 'Smileys',
    icon: '😀',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐',
      '🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒',
      '🤕','🤢','🤮','🥵','🥶','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁',
      '☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣',
      '😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','💩','🤡',
    ],
  },
  {
    key: 'gestures',
    label: 'Gestes',
    icon: '👍',
    emojis: [
      '👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️',
      '👋','🤚','🖐️','✋','🖖','👏','🙌','👐','🤲','🤝','🙏','💪','🦾','✊','👊','🤛',
      '🤜','💅','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞',
      '💓','💗','💖','💘','💝',
    ],
  },
  {
    key: 'animals',
    label: 'Animaux',
    icon: '🐶',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵',
      '🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🐺','🐴','🦄','🐝','🪲','🐛',
      '🦋','🐌','🐞','🐢','🐍','🦖','🐙','🦑','🦐','🦀','🐠','🐟','🐬','🐳','🐋','🦈',
      '🐊','🐅','🐆','🐘','🦏','🦛','🐪','🐫','🦙','🦒','🐃','🐂','🐄','🐎','🐖','🐏',
      '🐑','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐓','🦃','🦚','🦜','🦢','🐇','🐁','🐀',
    ],
  },
  {
    key: 'food',
    label: 'Nourriture',
    icon: '🍔',
    emojis: [
      '🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝',
      '🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯',
      '🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟',
      '🍕','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣',
      '🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧',
      '🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','☕',
      '🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍷','🍸','🍹','🍾','🥂','🥃','🥄','🍴','🍽️',
    ],
  },
  {
    key: 'activity',
    label: 'Activités',
    icon: '⚽',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍',
      '🏏','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿',
      '⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣',
      '🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭',
      '🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎯','🎳',
      '🎮','🎰','🧩',
    ],
  },
  {
    key: 'travel',
    label: 'Voyage',
    icon: '🚗',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🛵','🏍️',
      '🛺','🚲','🛴','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚞','🚝','🚄',
      '🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺','🛰️','🚀','🛸','🚁',
      '🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','⛽','🚧','🚦','🚥','🗺️','🗿','🗽','🗼',
      '🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏜️','🌋','⛰️','🏔️','🗻','🏕️',
    ],
  },
  {
    key: 'objects',
    label: 'Objets',
    icon: '💡',
    emojis: [
      '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼',
      '📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭',
      '⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸',
      '💵','💴','💶','💷','💰','💳','💎','⚖️','🪜','🧰','🔧','🔨','⚒️','🛠️','⛏️','🪚',
      '🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️',
      '🪦','⚱️','🏺','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','💊','💉','🩸',
    ],
  },
  {
    key: 'symbols',
    label: 'Symboles',
    icon: '✨',
    emojis: [
      '✨','⭐','🌟','💫','⚡','🔥','🎉','🎊','🎁','🎈','🎂','💯','✅','❌','❗','❓',
      '💬','💭','🗯️','♨️','💤','🕳️','🆗','🆒','🆕','🆙','🆓','🈶','🈚','🉐','🉑','☑️',
      '✔️','〰️','➰','➿','™️','©️','®️','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤',
      '🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','🔶','🔷','🔸','🔹','🔺','🔻','💠',
      '🔘','🔳','🔲',
    ],
  },
];

type Props = {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  className?: string;
};

export default function EmojiPicker({ onSelect, onClose, className }: Props) {
  const [active, setActive] = useState<string>(CATEGORIES[0].key);
  const [query, setQuery] = useState('');

  const activeCategory = useMemo(
    () => CATEGORIES.find((c) => c.key === active) ?? CATEGORIES[0],
    [active],
  );

  const list = useMemo(() => {
    const q = query.trim();
    if (q.length === 0) return activeCategory.emojis;
    // Very light "search": match by raw glyph for now. With only unicode
    // we can't match by name, so an empty search is the common path.
    return activeCategory.emojis.filter((e) => e.includes(q));
  }, [activeCategory, query]);

  return (
    <div
      className={
        'select-none rounded-2xl border border-white/15 bg-[#111827]/95 shadow-2xl backdrop-blur ' +
        (className ?? '')
      }
      // Keep the associated text input focused on mobile: prevent the
      // emoji panel from stealing focus via pointer events.
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => {
        // Allow taps on real buttons; just block focus shift on the wrapper.
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <div className="flex items-center gap-1 px-2 pt-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setActive(c.key)}
            aria-label={c.label}
            className={
              'w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors ' +
              (active === c.key
                ? 'bg-white/15'
                : 'hover:bg-white/10 text-white/70')
            }
          >
            <span aria-hidden>{c.icon}</span>
          </button>
        ))}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto h-8 px-2 rounded-lg text-xs text-white/70 hover:bg-white/10"
          >
            Fermer
          </button>
        )}
      </div>

      <div className="px-2 pt-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Rechercher (${activeCategory.label})…`}
          className="w-full h-8 px-2 text-xs rounded-md bg-white/10 border border-white/10 text-white placeholder-white/40 outline-none focus:border-white/30"
          // Prevent the reply input from losing focus on desktop when the
          // user clicks into the search box — but on mobile we actually
          // want to let the keyboard open here, so only auto-blur on desktop.
        />
      </div>

      <div
        className="p-2 overflow-y-auto"
        style={{ maxHeight: '220px' }}
      >
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}
        >
          {list.map((e, idx) => (
            <button
              key={`${e}-${idx}`}
              type="button"
              onClick={() => onSelect(e)}
              className="h-9 rounded-lg text-xl hover:bg-white/10 active:bg-white/20 flex items-center justify-center"
              aria-label={`Emoji ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Insert `emoji` at the current cursor position in a controlled
 * `<input>` or `<textarea>`. Falls back to appending if the ref or
 * selection is not available.
 *
 * Usage:
 *   const ref = useRef<HTMLInputElement>(null);
 *   const handleEmoji = (e: string) => {
 *     const next = insertAtCursor(ref.current, value, e);
 *     setValue(next);
 *   };
 */
export function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  current: string,
  emoji: string,
  maxLength?: number,
): string {
  if (!el) {
    const appended = current + emoji;
    return maxLength ? appended.slice(0, maxLength) : appended;
  }
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + emoji + current.slice(end);
  const clipped = maxLength ? next.slice(0, maxLength) : next;
  // Defer caret restoration to next tick so React re-renders the value first.
  requestAnimationFrame(() => {
    try {
      el.focus();
      const pos = Math.min(start + emoji.length, clipped.length);
      el.setSelectionRange(pos, pos);
    } catch {
      /* noop */
    }
  });
  return clipped;
}