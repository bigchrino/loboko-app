import { useEffect, useRef, useState } from 'react';
import { searchMentionables, type MentionSuggestion } from '@/lib/mentions';
import { getMediaUrl } from '@/lib/storage-helpers';

interface Props {
  query: string;
  open: boolean;
  onSelect: (s: MentionSuggestion) => void;
  onClose: () => void;
  // Position: "above" anchors the dropdown bottom to the anchor's top,
  // "below" anchors the top to the anchor's bottom.
  position?: 'above' | 'below';
}

/**
 * Floating list of @mention suggestions. Controlled by a query string; the
 * parent component is responsible for detecting the in-progress @token and
 * passing the current query. Keyboard navigation is handled by the parent
 * (ArrowUp/Down/Enter) via selected index — we keep this dumb on purpose to
 * avoid stealing focus from the underlying input/textarea.
 */
export default function MentionSuggestions({
  query,
  open,
  onSelect,
  onClose,
  position = 'above',
}: Props) {
  const [items, setItems] = useState<MentionSuggestion[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const rid = ++reqIdRef.current;
    setLoading(true);
    searchMentionables(query).then(async (list) => {
      if (rid !== reqIdRef.current) return;
      setItems(list);
      setActiveIdx(0);
      // Resolve avatar previews lazily (parallel).
      const map: Record<string, string> = {};
      await Promise.all(
        list.map(async (s) => {
          if (s.avatar_key) {
            try {
              const url = await getMediaUrl(s.avatar_key);
              if (url) map[s.user_id] = url;
            } catch {
              /* ignore */
            }
          }
        }),
      );
      if (rid === reqIdRef.current) setAvatars(map);
      setLoading(false);
    });
  }, [query, open]);

  // Keyboard navigation: listen at window level while open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (!items.length) {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        const pick = items[activeIdx];
        if (pick && pick.username) {
          e.preventDefault();
          onSelect(pick);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, items, activeIdx, onSelect, onClose]);

  if (!open) return null;
  if (!loading && items.length === 0) return null;

  const posClass =
    position === 'above'
      ? 'bottom-full mb-2'
      : 'top-full mt-2';

  return (
    <div
      className={`absolute left-0 right-0 z-40 ${posClass} bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-xl shadow-lg max-h-60 overflow-y-auto`}
      onMouseDown={(e) => {
        // Prevent focus loss on the underlying input.
        e.preventDefault();
      }}
    >
      {loading && items.length === 0 ? (
        <div className="px-3 py-2 text-xs text-[var(--loboko-text-muted)]">
          Recherche...
        </div>
      ) : (
        <ul>
          {items.map((s, idx) => {
            const name = s.display_name || s.username || 'Utilisateur';
            const initials = name.slice(0, 2).toUpperCase();
            const active = idx === activeIdx;
            return (
              <li key={s.user_id}>
                <button
                  type="button"
                  onClick={() => s.username && onSelect(s)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition ${
                    active
                      ? 'bg-[var(--loboko-surface-hover)]'
                      : 'hover:bg-[var(--loboko-surface-hover)]'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {avatars[s.user_id] ? (
                      <img
                        src={avatars[s.user_id]}
                        alt={name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{name}</div>
                    {s.username && (
                      <div className="text-[10px] text-[var(--loboko-text-muted)] truncate">
                        @{s.username}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}