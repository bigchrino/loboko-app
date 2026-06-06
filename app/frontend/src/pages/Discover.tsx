import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { Search, MessageCircle, Star, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import { Profile } from '@/contexts/AuthContext';
import {
  getProvinceNames,
  getCitiesByProvince,
  getCommunesByCity,
} from '@/data/rdcLocations';

interface ProfileCardProps {
  profile: Profile;
  onMessage: (userId: string) => void;
  onOpen: (userId: string) => void;
  summary?: { average: number; count: number };
}

function ProfileCard({ profile, onMessage, onOpen, summary }: ProfileCardProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    if (profile.avatar_key) getMediaUrl(profile.avatar_key).then(setAvatarUrl);
  }, [profile.avatar_key]);
  const name = profile.display_name || profile.username;
  const initials = name.slice(0, 2).toUpperCase();
  const isAdmin = profile.is_admin === true;
  const isPrestataire = profile.role === 'prestataire' && !isAdmin;
  return (
    <div
      className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 flex gap-3 items-center cursor-pointer hover:border-[#2563eb] transition"
      onClick={() => onOpen(profile.user_id)}
    >
      <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{name}</span>
          {isAdmin ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(147,51,234,0.18)] text-[#c084fc] font-semibold shrink-0">
              💎 Admin
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold capitalize shrink-0">
              {profile.role}
            </span>
          )}
        </div>
        {isPrestataire && profile.metier && (
          <div className="text-xs text-[#2563eb] font-medium truncate">{profile.metier}</div>
        )}
        {isPrestataire && summary && summary.count > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Star size={11} fill="#f59e0b" color="#f59e0b" />
            <span className="text-xs font-semibold">{summary.average.toFixed(1)}</span>
            <span className="text-[10px] text-[var(--loboko-text-muted)]">
              · {summary.count} avis
            </span>
          </div>
        )}
        {profile.bio && (
          <div className="text-xs text-[var(--loboko-text-muted)] line-clamp-2 mt-1">
            {profile.bio}
          </div>
        )}
        {isPrestataire &&
          (profile.commune || profile.city) && (
            <div className="flex items-center gap-1 mt-1 text-xs text-[var(--loboko-text-muted)]">
              <MapPin size={11} />
              {[profile.commune, profile.city]
                .filter(Boolean)
                .join(' • ')}
            </div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMessage(profile.user_id);
        }}
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
  const [ratingMap, setRatingMap] = useState<Record<string, { average: number; count: number }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'prestataire' | 'client'>('all');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [provinceFilter, setProvinceFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [communeFilter, setCommuneFilter] = useState('');

  
  const provinces = getProvinceNames();
  const cities = getCitiesByProvince(provinceFilter);
  const communes = getCommunesByCity(
    provinceFilter,
    cityFilter,
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('banned', false)
          .eq('suspended', false)
          .order('created_at', { ascending: false })
          .limit(1000);
        if (error) throw error;
        const list = (data as Profile[]) || [];
        setProfiles(list);

        const presIds = list
          .filter((p) => p.role === 'prestataire')
          .map((p) => p.user_id);
        if (presIds.length) {
          const { data: ratings } = await supabase
            .from('ratings')
            .select('to_user_id, rating')
            .in('to_user_id', presIds);
          const acc: Record<string, { sum: number; count: number }> = {};
          ((ratings as { to_user_id: string; rating: number }[]) || []).forEach((r) => {
            if (!acc[r.to_user_id]) acc[r.to_user_id] = { sum: 0, count: 0 };
            acc[r.to_user_id].sum += Number(r.rating);
            acc[r.to_user_id].count += 1;
          });
          const map: Record<string, { average: number; count: number }> = {};
          Object.entries(acc).forEach(([uid, v]) => {
            map[uid] = { average: v.sum / v.count, count: v.count };
          });
          setRatingMap(map);
        }
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
  
      if (availableOnly && p.role === 'prestataire') {
        return p.availability_status === 'available';
      }
  
      if (provinceFilter && p.province !== provinceFilter) return false;
      if (cityFilter && p.city !== cityFilter) return false;
      if (communeFilter && p.commune !== communeFilter) return false;
  
      if (!q) return true;
  
      return (
        p.username?.toLowerCase().includes(q) ||
        p.display_name?.toLowerCase().includes(q) ||
        p.metier?.toLowerCase().includes(q) ||
        p.bio?.toLowerCase().includes(q)
      );
    });
  }, [
    profiles,
    search,
    filter,
    provinceFilter,
    cityFilter,
    communeFilter,
    availableOnly,
  ]);

  const handleMessage = (userId: string) => {
    navigate(`/messages?to=${encodeURIComponent(userId)}`);
  };

  const handleOpen = (userId: string) => {
    navigate(`/u/${encodeURIComponent(userId)}`);
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
        <select
          value={provinceFilter}
          onChange={(e) => {
            setProvinceFilter(e.target.value);
            setCityFilter('');
            setCommuneFilter('');
          }}
          className="px-3 py-2 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm"
        >
          <option value="">Toutes les provinces</option>
      
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      
        <select
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setCommuneFilter('');
          }}
          disabled={!provinceFilter}
          className="px-3 py-2 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm"
        >
          <option value="">Toutes les villes</option>
      
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      
        <select
          value={communeFilter}
          onChange={(e) => setCommuneFilter(e.target.value)}
          disabled={!cityFilter}
          className="px-3 py-2 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm"
        >
          <option value="">Toutes les communes</option>
      
          {communes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
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
      <div className="mb-4">
        <button
          onClick={() => setAvailableOnly(!availableOnly)}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
            availableOnly
              ? 'bg-green-600 text-white'
              : 'bg-[var(--loboko-surface)] text-[var(--loboko-text-secondary)]'
          }`}
        >
          {availableOnly
            ? '✓ Disponibles uniquement'
            : 'Disponibles uniquement'}
        </button>
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
            <ProfileCard
              key={p.id}
              profile={p}
              onMessage={handleMessage}
              onOpen={handleOpen}
              summary={ratingMap[p.user_id]}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}
