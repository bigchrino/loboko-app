import { useEffect, useMemo, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import type { MentionSuggestion } from '@/lib/mentions';
import { getMediaUrl } from '@/lib/storage-helpers';

interface Profile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_key: string | null;
}

interface Props {
  query: string;
  open: boolean;
  /** Profiles of current group members (excluding current user). */
  memberProfiles: Profile[];
  onSelect: (s: MentionSuggestion) => void;
  onClose: () => void;
  position?: 'above' | 'below';
}

/**
 * Group-scoped mention suggestions. Unlike the global MentionSuggestions,
 * this component only shows members of the current group, and includes a
 * special "@tous" item to mention everyone. This keeps group conversations
 * contextual and prevents users from pinging people outside the group.
 */
export default function GroupMentionSuggestions({
  query,
  open,
  memberProfiles,
  onSelect,
  onClose,
  position = 'above',
}: Props) {
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [activeIdx, setActiveIdx] = useState(0);

  // Build suggestion list: @tous first, then filtered members.
  const items: MentionSuggestion[] = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    const allItem: MentionSuggestion = {
      user_id: '__all__',
      username: 'tous',
      display_name: 'Tous les membres',
      avatar_key: null,
    };
    const filteredMembers = memberProfiles
      .filter((p) => {
        if (!q) return true;
        const u = (p.username || '').toLowerCase();
        const d = (p.display_name || '').toLowerCase();
        return u.includes(q) || d.includes(q);
      })
      .map((p) => ({
        user_id: p.user_id,
        username: p.username,
        display_name: p.display_name,
        avatar_key: p.avatar_key,
      }));

    // "@tous" matches when query is empty or is a prefix of "tous".
    const includeAll = !q || 'tous'.startsWith(q) || 'all'.startsWith(q);
    const list: MentionSuggestion[] = [];
    if (includeAll) list.push(allItem);
    list.push(...filteredMembers);
    return list.slice(0, 10);
  }, [query, memberProfiles]);

  const activeIdxRef = useRef(activeIdx);
  activeIdxRef.current = activeIdx;

  // Resolve avatars lazily.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        items.map(async (s) => {
          if (s.avatar_key && !avatars[s.user_id]) {
            try {
              const url = await getMediaUrl(s.avatar_key);
              if (url) map[s.user_id] = url;
            } catch {
              /* ignore */
            }
          }
        }),
      );
      if (!cancelled && Object.keys(map).length > 0) {
        setAvatars((prev) => ({ ...prev, ...map }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items]);

  // Reset active index when list changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [query, open, items.length]);

  // Keyboard navigation.
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
        const pick = items[activeIdxRef.current];
        if (pick) {
          e.preventDefault();
          onSelect(pick);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, items, onSelect, onClose]);

  if (!open) return null;
  if (items.length === 0) return null;

  const posClass = position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2';

  return (
    <div
      className={`absolute left-0 right-0 z-40 ${posClass} bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-xl shadow-lg max-h-60 overflow-y-auto`}
      onMouseDown={(e) => e.preventDefault()}
    >
      <ul>
        {items.map((s, idx) => {
          const isAll = s.user_id === '__all__';
          const name = s.display_name || s.username || 'Utilisateur';
          const initials = (name || 'U').slice(0, 2).toUpperCase();
          const active = idx === activeIdx;
          return (
            <li key={s.user_id}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition ${
                  active
                    ? 'bg-[var(--loboko-surface-hover)]'
                    : 'hover:bg-[var(--loboko-surface-hover)]'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${
                    isAll
                      ? 'bg-gradient-to-br from-[#f59e0b] to-[#d97706]'
                      : 'bg-gradient-to-br from-[#2563eb] to-[#1d4ed8]'
                  }`}
                >
                  {isAll ? (
                    <Users size={14} />
                  ) : avatars[s.user_id] ? (
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
                      {isAll && ' · mentionner tout le groupe'}
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}