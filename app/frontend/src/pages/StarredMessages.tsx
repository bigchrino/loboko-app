/**
 * StarredMessages page — displays all messages (DM + group) starred by the
 * current user, with search, filters and sorting. Clicking a row navigates to
 * the originating conversation (direct message with the contact, or group chat).
 *
 * Data sources:
 *   - DM stars:    table `starred_messages` (user_id, message_id)
 *                  messages live in `messages` (user_id sender, receiver_id)
 *   - Group stars: table `group_starred_messages` (user_id, message_id)
 *                  messages live in `group_messages` (group_id, user_id sender)
 *
 * The page is defensive: if any of the above tables are missing, it still
 * renders an empty state rather than crashing.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { Link, useNavigate } from 'react-router-dom';
import {
  Star,
  Search as SearchIcon,
  MessageCircle,
  Users,
  ArrowUpDown,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StarKind = 'direct' | 'group';
type SortOrder = 'recent' | 'oldest';
type FilterKind = 'all' | 'direct' | 'group';

interface StarredRow {
  starId: string; // starred_messages.id or group_starred_messages.id
  messageId: string;
  kind: StarKind;
  content: string;
  createdAt: string | null;
  starredAt: string | null;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  // For direct messages, the "other" user (conversation peer for the link).
  peerId?: string;
  peerName?: string;
  // For group messages, the group info.
  groupId?: string;
  groupName?: string;
}

interface ProfileLite {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_key?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  if (sameDay) return `${hh}:${mm}`;
  const diffMs = now.getTime() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < 7 * day) {
    return d.toLocaleDateString(undefined, { weekday: 'short' }) + ` ${hh}:${mm}`;
  }
  return d.toLocaleDateString();
}

function displayName(p?: ProfileLite | null): string {
  if (!p) return 'Utilisateur';
  return p.display_name || p.username || 'Utilisateur';
}

/**
 * Best-effort JSON content rendering. Many message `content` fields in this
 * app are JSON payloads (image, video, voice, system, etc.). For the starred
 * list we show a short human-readable preview.
 */
function renderPreview(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return raw;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const type = (parsed?.type as string) || '';
    switch (type) {
      case 'image':
        return '📷 Photo';
      case 'video':
        return '🎥 Vidéo';
      case 'voice':
      case 'audio':
        return '🎙️ Message vocal';
      case 'file':
        return `📎 ${(parsed.name as string) || 'Fichier'}`;
      case 'system':
        return typeof parsed.text === 'string' ? String(parsed.text) : 'Message système';
      case 'location':
        return '📍 Position';
      case 'contact':
        return '👤 Contact';
      case 'sticker':
        return '🌟 Sticker';
      default: {
        if (typeof parsed.text === 'string') return parsed.text;
        if (typeof parsed.caption === 'string') return parsed.caption;
        return raw;
      }
    }
  } catch {
    return raw;
  }
}

// Small avatar that loads a storage key lazily.
function MiniAvatar({
  name,
  avatarKey,
  icon,
}: {
  name: string;
  avatarKey?: string | null;
  icon?: 'user' | 'group';
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (avatarKey) {
      getMediaUrl(avatarKey).then((u) => {
        if (!cancelled) setUrl(u);
      });
    } else {
      setUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [avatarKey]);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-semibold text-xs shrink-0">
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : icon === 'group' ? (
        <Users size={18} />
      ) : (
        initials
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function StarredMessages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const myId = user?.id || '';

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StarredRow[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKind>('all');
  const [sort, setSort] = useState<SortOrder>('recent');
  const [removing, setRemoving] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!myId) return;
    setLoading(true);
    try {
      // 1) Direct message stars
      const { data: dmStarRows, error: dmStarErr } = await supabase
        .from('starred_messages')
        .select('id, message_id, created_at')
        .eq('user_id', myId);
      const dmStars =
        !dmStarErr && dmStarRows
          ? (dmStarRows as { id: string; message_id: string; created_at: string | null }[])
          : [];

      // 2) Group message stars
      const { data: grpStarRows, error: grpStarErr } = await supabase
        .from('group_starred_messages')
        .select('id, message_id, created_at')
        .eq('user_id', myId);
      const grpStars =
        !grpStarErr && grpStarRows
          ? (grpStarRows as { id: string; message_id: string; created_at: string | null }[])
          : [];

      const dmIds = dmStars.map((r) => r.message_id);
      const grpIds = grpStars.map((r) => r.message_id);

      // 3) Load message rows for each
      const dmMsgsReq =
        dmIds.length > 0
          ? supabase
              .from('messages')
              .select(
                'id, user_id, receiver_id, content, created_at, deleted_for_everyone_at',
              )
              .in('id', dmIds)
          : null;
      const grpMsgsReq =
        grpIds.length > 0
          ? supabase
              .from('group_messages')
              .select('id, group_id, user_id, content, created_at, deleted_for_everyone_at')
              .in('id', grpIds)
          : null;

      const [dmMsgsRes, grpMsgsRes] = await Promise.all([
        dmMsgsReq ? dmMsgsReq : Promise.resolve({ data: [], error: null }),
        grpMsgsReq ? grpMsgsReq : Promise.resolve({ data: [], error: null }),
      ]);

      const dmMsgs =
        (dmMsgsRes.data as {
          id: string;
          user_id: string;
          receiver_id: string;
          content: string;
          created_at: string | null;
          deleted_for_everyone_at: string | null;
        }[]) || [];
      const grpMsgs =
        (grpMsgsRes.data as {
          id: string;
          group_id: string;
          user_id: string;
          content: string;
          created_at: string | null;
          deleted_for_everyone_at: string | null;
        }[]) || [];

      // 4) Gather profile + group ids needed
      const profileIds = new Set<string>();
      for (const m of dmMsgs) {
        profileIds.add(m.user_id);
        profileIds.add(m.receiver_id);
      }
      for (const m of grpMsgs) {
        profileIds.add(m.user_id);
      }
      const groupIds = Array.from(new Set(grpMsgs.map((m) => m.group_id)));

      const profilesReq =
        profileIds.size > 0
          ? supabase
              .from('profiles')
              .select('id, username, display_name, avatar_key')
              .in('id', Array.from(profileIds))
          : null;
      const groupsReq =
        groupIds.length > 0
          ? supabase
              .from('groups')
              .select('id, name, avatar_key')
              .in('id', groupIds)
          : null;

      const [profilesRes, groupsRes] = await Promise.all([
        profilesReq ? profilesReq : Promise.resolve({ data: [], error: null }),
        groupsReq ? groupsReq : Promise.resolve({ data: [], error: null }),
      ]);

      const profiles = (profilesRes.data as ProfileLite[]) || [];
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      const groups =
        (groupsRes.data as { id: string; name: string; avatar_key: string | null }[]) || [];
      const groupMap = new Map(groups.map((g) => [g.id, g]));

      // Resolve avatar URLs for senders (best-effort, parallel)
      const avatarCache = new Map<string, string | null>();
      await Promise.all(
        Array.from(profileIds).map(async (id) => {
          const p = profileMap.get(id);
          if (p?.avatar_key) {
            const u = await getMediaUrl(p.avatar_key);
            avatarCache.set(id, u);
          } else {
            avatarCache.set(id, null);
          }
        }),
      );

      // 5) Build StarredRow list
      const out: StarredRow[] = [];

      const dmMsgMap = new Map(dmMsgs.map((m) => [m.id, m]));
      for (const s of dmStars) {
        const m = dmMsgMap.get(s.message_id);
        if (!m) continue; // message missing (expired / deleted)
        if (m.deleted_for_everyone_at) continue;
        const sender = profileMap.get(m.user_id);
        const peerId = m.user_id === myId ? m.receiver_id : m.user_id;
        const peer = profileMap.get(peerId);
        out.push({
          starId: s.id,
          messageId: m.id,
          kind: 'direct',
          content: m.content || '',
          createdAt: m.created_at,
          starredAt: s.created_at,
          senderId: m.user_id,
          senderName: displayName(sender),
          senderAvatarUrl: avatarCache.get(m.user_id) ?? null,
          peerId,
          peerName: displayName(peer),
        });
      }

      const grpMsgMap = new Map(grpMsgs.map((m) => [m.id, m]));
      for (const s of grpStars) {
        const m = grpMsgMap.get(s.message_id);
        if (!m) continue;
        if (m.deleted_for_everyone_at) continue;
        const sender = profileMap.get(m.user_id);
        const group = groupMap.get(m.group_id);
        out.push({
          starId: s.id,
          messageId: m.id,
          kind: 'group',
          content: m.content || '',
          createdAt: m.created_at,
          starredAt: s.created_at,
          senderId: m.user_id,
          senderName: displayName(sender),
          senderAvatarUrl: avatarCache.get(m.user_id) ?? null,
          groupId: m.group_id,
          groupName: group?.name || 'Groupe',
        });
      }

      setRows(out);
    } catch (e) {
      console.error('[starred] loadAll', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [myId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (filter !== 'all' && r.kind !== filter) return false;
      if (!q) return true;
      const haystack = [
        renderPreview(r.content),
        r.senderName,
        r.peerName || '',
        r.groupName || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    list = list.slice().sort((a, b) => {
      const ta = a.starredAt ? new Date(a.starredAt).getTime() : 0;
      const tb = b.starredAt ? new Date(b.starredAt).getTime() : 0;
      return sort === 'recent' ? tb - ta : ta - tb;
    });
    return list;
  }, [rows, query, filter, sort]);

  const handleUnstar = async (row: StarredRow) => {
    if (!myId) return;
    setRemoving(row.starId);
    try {
      const table = row.kind === 'direct' ? 'starred_messages' : 'group_starred_messages';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', myId)
        .eq('message_id', row.messageId);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.starId !== row.starId));
      toast.success('Retiré des importants');
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    } finally {
      setRemoving(null);
    }
  };

  const handleOpen = (row: StarredRow) => {
    if (row.kind === 'direct' && row.peerId) {
      navigate(`/messages?with=${row.peerId}&messageId=${row.messageId}`);
    } else if (row.kind === 'group' && row.groupId) {
      navigate(`/messages/group/${row.groupId}?messageId=${row.messageId}`);
    }
  };

  const counts = useMemo(
    () => ({
      all: rows.length,
      direct: rows.filter((r) => r.kind === 'direct').length,
      group: rows.filter((r) => r.kind === 'group').length,
    }),
    [rows],
  );

  return (
    <Layout title="Messages importants">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <Star size={20} className="text-yellow-500" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Messages importants</h1>
            <p className="text-sm text-[var(--loboko-text-muted)]">
              Retrouvez tous les messages que vous avez marqués d'une étoile.
            </p>
          </div>
        </div>

        {/* Toolbar: search + filters + sort */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <SearchIcon
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher dans les messages importants..."
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              {([
                { key: 'all', label: `Tous (${counts.all})`, icon: Star },
                { key: 'direct', label: `Directs (${counts.direct})`, icon: MessageCircle },
                { key: 'group', label: `Groupes (${counts.group})`, icon: Users },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                    filter === key
                      ? 'bg-[#2563eb] text-white border-[#2563eb]'
                      : 'bg-[var(--loboko-surface)] text-[var(--loboko-text)] border-[var(--loboko-border)] hover:bg-[var(--loboko-hover)]'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSort(sort === 'recent' ? 'oldest' : 'recent')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--loboko-border)] bg-[var(--loboko-surface)] hover:bg-[var(--loboko-hover)] whitespace-nowrap"
              title="Changer l'ordre"
            >
              <ArrowUpDown size={14} />
              {sort === 'recent' ? 'Plus récents' : 'Plus anciens'}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--loboko-text-muted)]">
            <Loader2 size={20} className="animate-spin mr-2" />
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-3">
              <Star size={28} className="text-yellow-500" />
            </div>
            <p className="font-semibold">Aucun message important</p>
            <p className="text-sm text-[var(--loboko-text-muted)] max-w-xs mt-1">
              {rows.length === 0
                ? "Marquez un message d'une étoile depuis une conversation pour le retrouver ici."
                : 'Aucun résultat ne correspond à votre recherche.'}
            </p>
            <Link
              to="/messages"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2563eb] text-white text-sm font-medium hover:bg-[#1d4ed8]"
            >
              <MessageCircle size={16} />
              Ouvrir les messages
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--loboko-border)] bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)] overflow-hidden">
            {filtered.map((row) => (
              <li
                key={row.starId}
                className="p-3 sm:p-4 hover:bg-[var(--loboko-hover)] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <MiniAvatar
                    name={row.senderName}
                    avatarKey={null}
                    icon={row.kind === 'group' ? 'group' : 'user'}
                  />
                  <button
                    type="button"
                    onClick={() => handleOpen(row)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">
                        {row.senderName}
                      </span>
                      {row.kind === 'direct' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          <MessageCircle size={10} />
                          {row.senderId === myId
                            ? `À ${row.peerName}`
                            : 'Direct'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          <Users size={10} />
                          {row.groupName}
                        </span>
                      )}
                      <span className="text-[11px] text-[var(--loboko-text-muted)] ml-auto shrink-0">
                        {formatDate(row.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--loboko-text)] mt-1 line-clamp-2 break-words">
                      {renderPreview(row.content) || (
                        <span className="italic text-[var(--loboko-text-muted)]">
                          (Message vide)
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[var(--loboko-text-muted)]">
                      <Star size={11} className="text-yellow-500" fill="currentColor" />
                      <span>Marqué {formatDate(row.starredAt)}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnstar(row)}
                    disabled={removing === row.starId}
                    className="p-2 rounded-full text-[var(--loboko-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    title="Retirer des importants"
                  >
                    {removing === row.starId ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}