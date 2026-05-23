import { useEffect, useMemo, useState } from 'react';
import { X, Search, Send, Link2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/contexts/AuthContext';
import { getMediaUrl } from '@/lib/storage-helpers';
import { toast } from 'sonner';

export interface SharePostPreview {
  post_id: string;
  author_id?: string;
  author_name?: string;
  text?: string;
  image_url?: string;
}

interface Target {
  kind: 'user' | 'group';
  id: string;
  name: string;
  avatar_key?: string | null;
  username?: string | null;
}

interface GroupRow {
  id: string;
  name: string;
  avatar_key?: string | null;
}

interface Props {
  open: boolean;
  preview: SharePostPreview;
  onClose: () => void;
  onShareToUsers: (userIds: string[], preview: SharePostPreview) => Promise<void> | void;
  onShareToGroups: (groupIds: string[], preview: SharePostPreview) => Promise<void> | void;
  currentUserId: string;
}

function TargetRow({
  target,
  selected,
  onToggle,
}: {
  target: Target;
  selected: boolean;
  onToggle: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (target.avatar_key) getMediaUrl(target.avatar_key).then(setUrl);
  }, [target.avatar_key]);
  const initials = target.name.slice(0, 2).toUpperCase();
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left ${
        selected
          ? 'bg-[rgba(37,99,235,0.2)] border border-[#2563eb]'
          : 'hover:bg-[var(--loboko-surface-hover)] border border-transparent'
      }`}
    >
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-sm shrink-0">
        {url ? (
          <img src={url} alt={target.name} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">
          {target.name}{' '}
          {target.kind === 'group' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--loboko-elevated)] text-[var(--loboko-text-muted)] ml-1">
              Groupe
            </span>
          )}
        </div>
        {target.kind === 'user' && target.username && (
          <div className="text-xs text-[var(--loboko-text-muted)] truncate">
            @{target.username}
          </div>
        )}
      </div>
      <div
        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
          selected
            ? 'bg-[#2563eb] border-[#2563eb] text-white'
            : 'border-[var(--loboko-border)]'
        }`}
      >
        {selected && <span className="text-[10px]">✓</span>}
      </div>
    </button>
  );
}

export default function SharePostDialog({
  open,
  preview,
  onClose,
  onShareToUsers,
  onShareToGroups,
  currentUserId,
}: Props) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setQuery('');
    (async () => {
      try {
        const [{ data: profilesData }, { data: membersData }] = await Promise.all([
          supabase.from('profiles').select('*').limit(300).eq('banned', false).eq('suspended', false),
          supabase.from('group_members').select('group_id').eq('user_id', currentUserId),
        ]);

        const contacts: Target[] = ((profilesData as Profile[]) || [])
          .filter((p) => p.user_id !== currentUserId)
          .map((p) => ({
            kind: 'user',
            id: p.user_id,
            name: p.display_name || p.username || 'Utilisateur',
            avatar_key: p.avatar_key,
            username: p.username,
          }));

        let groups: Target[] = [];
        const groupIds = ((membersData as Array<{ group_id: string }>) || []).map(
          (r) => r.group_id,
        );
        if (groupIds.length > 0) {
          const { data: groupData } = await supabase
            .from('groups')
            .select('id,name,avatar_key')
            .in('id', groupIds);
          groups = ((groupData as GroupRow[]) || []).map((g) => ({
            kind: 'group',
            id: g.id,
            name: g.name || 'Groupe',
            avatar_key: g.avatar_key || null,
          }));
        }

        setTargets([...groups, ...contacts]);
      } catch (e) {
        console.error('[share-post] load targets', e);
      }
    })();
  }, [open, currentUserId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((t) => {
      const n = t.name.toLowerCase();
      const u = (t.username || '').toLowerCase();
      return n.includes(q) || u.includes(q);
    });
  }, [targets, query]);

  const toggle = (key: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/post/${preview.post_id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié');
    } catch {
      toast.error('Copie impossible');
    }
  };

  const submit = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const userIds: string[] = [];
      const groupIds: string[] = [];
      for (const key of selected) {
        const [kind, id] = key.split(':');
        if (kind === 'user') userIds.push(id);
        else if (kind === 'group') groupIds.push(id);
      }
      if (userIds.length > 0) await onShareToUsers(userIds, preview);
      if (groupIds.length > 0) await onShareToGroups(groupIds, preview);
      toast.success('Publication partagée');
      onClose();
    } catch (e) {
      console.error('[share-post] submit', e);
      toast.error('Partage impossible');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const postText = (preview.text || '').trim();
  const authorLabel = preview.author_name || 'Auteur';

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--loboko-surface)] w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-[var(--loboko-border)] p-4 shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-base">Partager la publication</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 bg-[var(--loboko-elevated)] rounded-lg p-3 flex items-start gap-3">
          {preview.image_url && (
            <img
              src={preview.image_url}
              alt=""
              className="w-12 h-12 rounded-md object-cover shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-[var(--loboko-text)] truncate">
              {authorLabel}
            </div>
            <div className="text-xs text-[var(--loboko-text-muted)] line-clamp-2">
              {postText || 'Publication'}
            </div>
          </div>
        </div>

        <div className="relative mb-2">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un contact ou un groupe"
            className="w-full pl-8 pr-3 py-2 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-sm text-[var(--loboko-text-muted)]">
              Aucune destination
            </div>
          ) : (
            filtered.map((t) => {
              const key = `${t.kind}:${t.id}`;
              return (
                <TargetRow
                  key={key}
                  target={t}
                  selected={selected.has(key)}
                  onToggle={() => toggle(key)}
                />
              );
            })
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--loboko-border)] text-xs font-medium hover:bg-[var(--loboko-surface-hover)]"
          >
            <Link2 size={14} />
            Copier le lien
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || selected.size === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50"
          >
            <Send size={14} />
            {busy ? 'Envoi…' : `Partager (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
