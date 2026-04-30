import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth, Profile } from '@/contexts/AuthContext';
import { useCall } from '@/contexts/CallContext';
import { useMissedCalls } from '@/contexts/MissedCallsContext';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import {
  loadCallHistory,
  CallHistoryEntry,
} from '@/lib/call-history';
import { formatDuration } from '@/lib/message-format';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  MessageSquare,
  RefreshCcw,
} from 'lucide-react';

function PeerAvatar({ profile }: { profile?: Profile }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (profile?.avatar_key) {
      getMediaUrl(profile.avatar_key).then((u) => {
        if (!cancelled) setUrl(u);
      });
    } else {
      setUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [profile?.avatar_key]);
  const name = profile?.display_name || profile?.username || '?';
  return (
    <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-sm shrink-0">
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const hm = `${hh}:${mm}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `Aujourd'hui · ${hm}`;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate();
  if (isYesterday) return `Hier · ${hm}`;
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${hm}`;
}

type FilterKind = 'all' | 'missed' | 'incoming' | 'outgoing';

const FILTERS: Array<{ id: FilterKind; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'missed', label: 'Manqués' },
  { id: 'incoming', label: 'Entrants' },
  { id: 'outgoing', label: 'Sortants' },
];

function EntryIcon({ entry }: { entry: CallHistoryEntry }) {
  const { event, direction } = entry;
  if (event === 'missed') {
    return <PhoneMissed size={14} className="text-red-400" />;
  }
  if (event === 'rejected') {
    return <PhoneOff size={14} className="text-red-400" />;
  }
  return direction === 'incoming' ? (
    <PhoneIncoming size={14} className="text-green-400" />
  ) : (
    <PhoneOutgoing size={14} className="text-[#60a5fa]" />
  );
}

function entryLabel(entry: CallHistoryEntry): string {
  if (entry.event === 'missed') {
    return entry.direction === 'incoming' ? 'Appel manqué' : 'Sans réponse';
  }
  if (entry.event === 'rejected') {
    return entry.direction === 'incoming' ? 'Refusé' : 'Refusé par le contact';
  }
  return `Terminé · ${formatDuration(entry.duration || 0)}`;
}

export default function Calls() {
  const { user } = useAuth();
  const myId = user?.id || '';
  const navigate = useNavigate();
  const { startCall } = useCall();
  const { markSeen } = useMissedCalls();

  // Mark all missed calls as seen the moment the page opens so the badge
  // clears immediately across the app (desktop sidebar + mobile menu).
  useEffect(() => {
    if (myId) markSeen();
  }, [myId, markSeen]);

  const [entries, setEntries] = useState<CallHistoryEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKind>('all');

  const loadAll = useCallback(
    async (withSpinner = false) => {
      if (!myId) return;
      if (withSpinner) setRefreshing(true);
      try {
        const rows = await loadCallHistory(myId, 300);
        setEntries(rows);
        // Resolve missing peer profiles
        const missing = Array.from(
          new Set(rows.map((r) => r.peerId).filter((id) => id && !profiles[id])),
        );
        if (missing.length > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', missing);
          if (data) {
            setProfiles((prev) => {
              const next = { ...prev };
              (data as Profile[]).forEach((p) => {
                next[p.user_id] = p;
              });
              return next;
            });
          }
        }
      } catch (e) {
        console.error('[calls] load failed', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myId],
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    if (filter === 'missed') {
      return entries.filter(
        (e) => e.event === 'missed' || e.event === 'rejected',
      );
    }
    return entries.filter((e) => e.direction === filter);
  }, [entries, filter]);

  const counts = useMemo(() => {
    const c = { all: entries.length, missed: 0, incoming: 0, outgoing: 0 };
    entries.forEach((e) => {
      if (e.event === 'missed' || e.event === 'rejected') c.missed += 1;
      if (e.direction === 'incoming') c.incoming += 1;
      if (e.direction === 'outgoing') c.outgoing += 1;
    });
    return c;
  }, [entries]);

  const handleCallBack = async (entry: CallHistoryEntry) => {
    const p = profiles[entry.peerId];
    const name = p?.display_name || p?.username || 'Utilisateur';
    await startCall(entry.peerId, name, entry.mode);
  };

  return (
    <Layout title="Appels">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold hidden lg:block">Historique des appels</h1>
        <button
          type="button"
          onClick={() => loadAll(true)}
          disabled={refreshing}
          className="lg:ml-auto flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb] disabled:opacity-50"
          aria-label="Rafraîchir"
        >
          <RefreshCcw size={12} className={refreshing ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = counts[f.id];
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`text-xs px-3 py-1.5 rounded-full border shrink-0 flex items-center gap-1.5 ${
                active
                  ? 'bg-[#2563eb] text-white border-[#2563eb]'
                  : 'bg-[var(--loboko-surface)] border-[var(--loboko-border)] text-[var(--loboko-text)]'
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--loboko-elevated)] text-[var(--loboko-text-muted)]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
          <div className="w-16 h-16 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-4">
            <Phone size={22} className="text-[#2563eb]" />
          </div>
          <h3 className="font-semibold mb-1">Aucun appel</h3>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            {filter === 'all'
              ? "Passez un appel depuis une conversation pour qu'il apparaisse ici."
              : "Aucun appel ne correspond à ce filtre."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const profile = profiles[entry.peerId];
            const name =
              profile?.display_name || profile?.username || 'Utilisateur';
            const missed =
              entry.event === 'missed' || entry.event === 'rejected';
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/messages/contact/${entry.peerId}`)}
                  className="shrink-0"
                  aria-label={`Voir le profil de ${name}`}
                >
                  <PeerAvatar profile={profile} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div
                      className={`font-semibold text-sm truncate ${
                        missed ? 'text-red-400' : ''
                      }`}
                    >
                      {name}
                    </div>
                    {entry.mode === 'video' ? (
                      <Video size={12} className="text-[var(--loboko-text-muted)] shrink-0" />
                    ) : (
                      <Phone size={12} className="text-[var(--loboko-text-muted)] shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--loboko-text-muted)] truncate">
                    <EntryIcon entry={entry} />
                    <span className="truncate">{entryLabel(entry)}</span>
                    <span>·</span>
                    <span className="truncate">{formatDateTime(entry.createdAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/messages?to=${entry.peerId}`)}
                  className="w-9 h-9 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)] flex items-center justify-center shrink-0"
                  aria-label="Ouvrir la conversation"
                  title="Ouvrir la conversation"
                >
                  <MessageSquare size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleCallBack(entry)}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white flex items-center justify-center shrink-0"
                  aria-label={`Rappeler ${name}`}
                  title={`Rappeler (${entry.mode === 'video' ? 'vidéo' : 'vocal'})`}
                >
                  {entry.mode === 'video' ? <Video size={14} /> : <Phone size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}