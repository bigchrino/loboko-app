import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { Search, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import { Profile } from '@/contexts/AuthContext';

interface ProfileCardProps {
  profile: Profile;
  onMessage: (userId: string) => void;
}

function ProfileCard({ profile, onMessage }: ProfileCardProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (profile.avatar_key) getMediaUrl(profile.avatar_key).then(setAvatarUrl);
  }, [profile.avatar_key]);
  const name = profile.display_name || profile.username;
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 flex gap-3 items-center">
      <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{name}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold capitalize shrink-0">
            {profile.role}
          </span>
        </div>
        {profile.metier && (
          <div className="text-xs text-[#2563eb] font-medium truncate">{profile.metier}</div>
        )}
        {profile.bio && (
          <div className="text-xs text-[var(--loboko-text-muted)] line-clamp-2 mt-1">
            {profile.bio}
          </div>
        )}
      </div>
      <button
        onClick={() => onMessage(profile.user_id)}
        className="shrink-0 w-10 h-10 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] flex items-center justify-center hover:bg-[#2563eb] hover:text-white transition"
        aria-label="Envoyer message"
      >
        <MessageCircle size={18} />
      </button>
    </div>
  );
}

export default function Discover() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'prestataire' | 'client'>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        setProfiles((data as Profile[]) || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (filter !== 'all' && p.role !== filter) return false;
      if (!q) return true;
      return (
        p.username?.toLowerCase().includes(q) ||
        p.display_name?.toLowerCase().includes(q) ||
        p.metier?.toLowerCase().includes(q) ||
        p.bio?.toLowerCase().includes(q)
      );
    });
  }, [profiles, search, filter]);

  const handleMessage = (userId: string) => {
    navigate(`/messages?to=${encodeURIComponent(userId)}`);
  };

  return (
    <Layout title="Découverte">
      <h1 className="text-2xl font-bold mb-4 hidden lg:block">Découvrir</h1>

      <div className="relative mb-4">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un métier, un nom..."
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
        />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {([
          ['all', 'Tous'],
          ['prestataire', 'Prestataires'],
          ['client', 'Clients'],
        ] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filter === v
                ? 'bg-[#2563eb] text-white'
                : 'bg-[var(--loboko-surface)] text-[var(--loboko-text-secondary)] hover:text-[var(--loboko-text)]'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-[var(--loboko-text-muted)]">
          Aucun résultat
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <ProfileCard key={p.id} profile={p} onMessage={handleMessage} />
          ))}
        </div>
      )}
    </Layout>
  );
}