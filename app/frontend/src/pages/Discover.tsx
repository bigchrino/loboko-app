import { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { Search, MessageCircle, Star, MapPin, SlidersHorizontal, ChevronDown } from 'lucide-react';
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
    let cancelled = false;
    setAvatarUrl(null);
    if (profile.avatar_key) void getMediaUrl(profile.avatar_key).then(url => {
      if (!cancelled) setAvatarUrl(url || null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [profile.avatar_key]);
  const name = profile.display_name || profile.username;
  const initials = name.slice(0, 2).toUpperCase();
  const isAdmin = profile.is_admin === true;
  const isPrestataire = profile.role === 'prestataire' && !isAdmin;
  const completedJobs = profile.completed_jobs_count || 0;
  const level = completedJobs >= 50 ? '🥇 Expert' : completedJobs >= 10 ? '🥈 Confirmé' : '🥉 Débutant';
  return (
    <article className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] transition-colors hover:border-[#2563eb]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-b-[50%] bg-gradient-to-br from-[#2563eb]/30 to-[#2563eb]/5" />
      <button type="button" onClick={() => onOpen(profile.user_id)} aria-label={`Voir le profil de ${name}`} className="relative flex flex-1 flex-col items-start p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#2563eb] sm:p-4">
        <div className="mb-2 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2563eb] text-lg font-bold text-white sm:h-16 sm:w-16">
          {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : initials}
        </div>
        <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${isAdmin ? 'bg-purple-500/15 text-purple-400' : 'bg-[#2563eb]/15 text-[#2563eb]'}`}>{isAdmin ? '💎 Admin' : profile.role}</span>
        <span className="w-full break-words text-sm font-semibold leading-snug sm:text-base">{name}</span>
        {isPrestataire && profile.metier && <span className="mt-1 w-full break-words text-xs font-medium leading-snug text-[#2563eb]">{profile.metier}</span>}
        {isPrestataire && <span className="mt-1 text-[11px] font-medium text-amber-500">{level}</span>}
        {isPrestataire && summary && summary.count > 0 && <span className="mt-1 flex flex-wrap items-center gap-1"><Star size={13} fill="#f59e0b" color="#f59e0b" aria-hidden="true" /><span className="text-xs font-semibold">{summary.average.toFixed(1)}</span><span className="text-[11px] text-[var(--loboko-text-secondary)]">· {summary.count} avis</span></span>}
        {profile.bio && <span className="mt-2 line-clamp-2 w-full break-words text-xs leading-relaxed text-[var(--loboko-text-secondary)]">{profile.bio}</span>}
        {isPrestataire && (profile.commune || profile.city) && <span className="mt-2 flex items-start gap-1 text-[11px] leading-relaxed text-[var(--loboko-text-secondary)]"><MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" /><span className="break-words">{[profile.commune, profile.city].filter(Boolean).join(' · ')}</span></span>}
      </button>
      <div className="relative px-3 pb-3 sm:px-4 sm:pb-4">
        <button type="button" onClick={() => onMessage(profile.user_id)} aria-label={`Envoyer un message à ${name}`} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-2 text-xs font-semibold text-white hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] sm:text-sm"><MessageCircle size={17} aria-hidden="true" />Message</button>
      </div>
    </article>
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
  const [locationOpen, setLocationOpen] = useState(false);

  
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
          .from('profile_directory')
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
  
    const result = profiles.filter((p) => {
      if (filter !== 'all' && p.role !== filter) return false;
  
      if (
        availableOnly &&
        p.role === 'prestataire' &&
        p.availability_status !== 'available'
      ) {
        return false;
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
  
    return result.sort((a, b) => {
      const aAvailable = a.availability_status === 'available' ? 1 : 0;
      const bAvailable = b.availability_status === 'available' ? 1 : 0;
  
      if (aAvailable !== bAvailable) {
        return bAvailable - aAvailable;
      }
  
      const aJobs = a.completed_jobs_count || 0;
      const bJobs = b.completed_jobs_count || 0;
  
      if (aJobs !== bJobs) {
        return bJobs - aJobs;
      }
  
      const aRating = ratingMap[a.user_id]?.average || 0;
      const bRating = ratingMap[b.user_id]?.average || 0;
  
      return bRating - aRating;
    });
  }, [
    profiles,
    search,
    filter,
    provinceFilter,
    cityFilter,
    communeFilter,
    availableOnly,
    ratingMap,
  ]);

  const handleMessage = (userId: string) => {
    navigate(`/messages?to=${encodeURIComponent(userId)}`);
  };

  const handleOpen = (userId: string) => {
    navigate(`/u/${encodeURIComponent(userId)}`);
  };

  return (
    <Layout title="Découverte" hideHeaderTitle>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Découverte</h1>
      <p className="mb-4 mt-1 text-sm text-[var(--loboko-text-secondary)]">Des talents et des rencontres près de vous</p>
      <div className="relative mb-3">
        <Search size={19} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]" />
        <input aria-label="Rechercher un métier ou un nom" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un métier, un nom…" className="min-h-12 w-full rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] py-3 pl-11 pr-4 text-base focus:outline-none focus:border-[#2563eb]" />
      </div>
      <div role="group" aria-label="Type de profil" className="mb-3 grid grid-cols-3 gap-2">
        {([['all', 'Tous'], ['prestataire', 'Prestataires'], ['client', 'Clients']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 rounded-full px-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] sm:text-sm ${filter === value ? 'bg-[#2563eb] text-white' : 'bg-[var(--loboko-surface)] text-[var(--loboko-text-secondary)] hover:text-[var(--loboko-text)]'}`}>{label}</button>)}
      </div>
      <section aria-label="Filtres de découverte" className="mb-5 rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
          <button type="button" aria-expanded={locationOpen} aria-controls="discover-location" onClick={() => setLocationOpen(open => !open)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb]">
            <SlidersHorizontal size={20} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Localisation</span><span className="block truncate text-[11px] text-[var(--loboko-text-secondary)]">{[provinceFilter, cityFilter, communeFilter].filter(Boolean).join(' · ') || 'Province, ville, commune'}</span></span>
            <ChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform ${locationOpen ? 'rotate-180' : ''}`} />
          </button>
          <button type="button" role="switch" aria-checked={availableOnly} onClick={() => setAvailableOnly(value => !value)} className="flex min-h-11 shrink-0 items-center gap-2 text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb]">
            Disponibles uniquement
            <span aria-hidden="true" className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${availableOnly ? 'bg-[#22c55e]' : 'bg-[var(--loboko-border)]'}`}><span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${availableOnly ? 'translate-x-4' : ''}`} /></span>
          </button>
        </div>
        <div id="discover-location" hidden={!locationOpen} className="border-t border-[var(--loboko-border)] p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="min-w-0 text-xs font-medium">Province<select value={provinceFilter} onChange={e => { setProvinceFilter(e.target.value); setCityFilter(''); setCommuneFilter(''); }} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-elevated)] px-3 text-sm"><option value="">Toutes les provinces</option>{provinces.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
            <label className="min-w-0 text-xs font-medium">Ville<select value={cityFilter} onChange={e => { setCityFilter(e.target.value); setCommuneFilter(''); }} disabled={!provinceFilter} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-elevated)] px-3 text-sm disabled:opacity-50"><option value="">Toutes les villes</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
            <label className="min-w-0 text-xs font-medium">Commune<select value={communeFilter} onChange={e => setCommuneFilter(e.target.value)} disabled={!cityFilter} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-elevated)] px-3 text-sm disabled:opacity-50"><option value="">Toutes les communes</option>{communes.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
          </div>
        </div>
      </section>
      <h2 className="mb-3 text-xl font-bold">La communauté</h2>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-[var(--loboko-text-muted)]">
          Aucun résultat
        </div>
      ) : (
        <div className="grid grid-cols-2 items-stretch gap-2 sm:gap-3">
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
