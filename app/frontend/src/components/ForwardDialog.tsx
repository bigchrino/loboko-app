import { useEffect, useMemo, useState } from 'react';
import { X, Search, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getMediaUrl } from '@/lib/storage-helpers';

interface Props {
  open: boolean;
  preview: string;
  onClose: () => void;
  onForward: (userIds: string[]) => Promise<void> | void;
  currentUserId: string;
}

function Row({
  profile,
  selected,
  onToggle,
}: {
  profile: Profile;
  selected: boolean;
  onToggle: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (profile.avatar_key) getMediaUrl(profile.avatar_key).then(setUrl);
  }, [profile.avatar_key]);
  const name = profile.display_name || profile.username || 'Utilisateur';
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
          <img src={url} alt={name} className="w-full h-full object-cover" />
        ) : (
          name.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{name}</div>
        {profile.username && (
          <div className="text-xs text-[var(--loboko-text-muted)] truncate">
            @{profile.username}
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

export default function ForwardDialog({
  open,
  preview,
  onClose,
  onForward,
  currentUserId,
}: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSelected(new Set());
    setQuery('');
    setProfiles([]);
    setLoading(true);
    setLoadError(false);
    void (async () => {
      try {
        const { data, error } = await supabase.from('profile_directory').select('*').limit(300);
        if (error) throw error;
        const list = ((data as Profile[]) || []).filter(p => p.user_id !== currentUserId);
        if (!cancelled) setProfiles(list);
      } catch { if (!cancelled) setLoadError(true); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, currentUserId, retry]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const name = (p.display_name || '').toLowerCase();
      const user = (p.username || '').toLowerCase();
      return name.includes(q) || user.includes(q);
    });
  }, [profiles, query]);

  const toggle = (id: string) => {
    if (busy) return;
    if (!selected.has(id) && selected.size >= 5) {
      toast.message('Vous pouvez sélectionner jusqu’à 5 contacts');
      return;
    }
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);

      return next;
    });
  };

  const submit = async () => {
    if (busy || selected.size === 0) return;
    setBusy(true);
    try {
      await onForward(Array.from(selected));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Transfert non confirmé. Vérifiez la conversation avant de réessayer.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className="bg-[var(--loboko-surface)] w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-[var(--loboko-border)] p-4 shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-base">Transférer à…</h3>
          <button
            onClick={() => { if (!busy) onClose(); }}
            className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="text-xs text-[var(--loboko-text-muted)] mb-3 truncate bg-[var(--loboko-elevated)] rounded-lg px-3 py-2">
          {preview || 'Message'}
        </div>
        <div className="relative mb-2">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un contact"
            className="w-full pl-8 pr-3 py-2 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
          {loading ? <p role="status" className="py-4 text-sm">Chargement des contacts…</p> : loadError ? (
            <div role="alert" className="py-4 text-sm">Impossible de charger les contacts.
              <button onClick={() => setRetry(value => value + 1)} className="block text-[#2563eb] mt-2">Réessayer</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-6 text-sm text-[var(--loboko-text-muted)]">
              Aucun contact
            </div>
          ) : (
            filtered.map((p) => (
              <Row
                key={p.user_id}
                profile={p}
                selected={selected.has(p.user_id)}
                onToggle={() => toggle(p.user_id)}
              />
            ))
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-xs text-[var(--loboko-text-muted)]">
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={busy || loading || loadError || selected.size === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50"
          >
            <Send size={14} />
            {busy ? 'Envoi…' : 'Transférer'}
          </button>
        </div>
      </div>
    </div>
  );
}