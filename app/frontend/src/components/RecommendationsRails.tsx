import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ChevronRight, Zap, Award, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import { fetchRatingSummary } from '@/lib/ratings';
import { scoreProvider } from '@/lib/marketplace';

/**
 * RecommendationsRails — horizontal rails shown on Home / Find.
 *
 * All ordering is deterministic:
 *  - Top : scoreProvider() (avg × log(1+count) + availability + jobs + verified)
 *  - Mieux notés : rating avg desc (min 1 review)
 *  - Disponibles : availability_status='available', ordered by score
 *
 * Each rail displays the top 10 max; light card UI, no heavy layout.
 */

interface ProviderBase {
  user_id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_key?: string | null;
  avatar_url?: string | null;
  metier?: string | null;
  city?: string | null;
  availability_status?: 'available' | 'unavailable' | null;
  completed_jobs_count?: number | null;
  is_verified?: boolean | null;
  rating_avg?: number;
  rating_count?: number;
}

const RAIL_LIMIT = 10;
const FETCH_LIMIT = 40;

export default function RecommendationsRails() {
  const [providers, setProviders] = useState<ProviderBase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select(
            'user_id, display_name, username, avatar_key, metier, city, availability_status, completed_jobs_count, is_verified',
          )
          .eq('role', 'prestataire')
          .order('created_at', { ascending: false })
          .limit(FETCH_LIMIT);
        const rows = ((data as ProviderBase[]) || []).slice();
        // Enrich with avatar + rating summary.
        const enriched = await Promise.all(
          rows.map(async (p) => {
            const [avatar_url, rating] = await Promise.all([
              p.avatar_key ? getMediaUrl(p.avatar_key) : Promise.resolve(null),
              fetchRatingSummary(p.user_id).catch(() => ({ average: 0, count: 0 })),
            ]);
            return {
              ...p,
              avatar_url,
              rating_avg: rating.average,
              rating_count: rating.count,
            };
          }),
        );
        if (!cancelled) setProviders(enriched);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const top = useMemo(
    () =>
      providers
        .slice()
        .sort((a, b) => scoreProvider(b) - scoreProvider(a))
        .slice(0, RAIL_LIMIT),
    [providers],
  );

  const bestRated = useMemo(
    () =>
      providers
        .slice()
        .filter((p) => (p.rating_count || 0) >= 1)
        .sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0))
        .slice(0, RAIL_LIMIT),
    [providers],
  );

  const available = useMemo(
    () =>
      providers
        .slice()
        .filter((p) => p.availability_status === 'available')
        .sort((a, b) => scoreProvider(b) - scoreProvider(a))
        .slice(0, RAIL_LIMIT),
    [providers],
  );

  if (loading) {
    return (
      <div className="py-4 text-center text-xs text-[var(--loboko-text-muted)]">
        Chargement des recommandations…
      </div>
    );
  }

  if (providers.length === 0) return null;

  return (
    <div className="space-y-5">
      <Rail title="Top prestataires" icon={Award} items={top} />
      <Rail title="Mieux notés" icon={Star} items={bestRated} />
      <Rail title="Disponibles maintenant" icon={Zap} items={available} />
    </div>
  );
}

function Rail({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Sparkles;
  items: ProviderBase[];
}) {
  const navigate = useNavigate();
  if (items.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2">
          <Icon size={16} className="text-[#2563eb]" />
          {title}
        </h2>
        <button
          onClick={() => navigate('/find')}
          className="inline-flex items-center gap-0.5 text-xs text-[#2563eb]"
        >
          Voir tout <ChevronRight size={12} />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto -mx-2 px-2 pb-1 scrollbar-none">
        {items.map((p) => {
          const initials = (p.display_name || p.username || 'U').slice(0, 2).toUpperCase();
          return (
            <button
              key={p.user_id}
              onClick={() => navigate(`/u/${p.user_id}`)}
              className="shrink-0 w-36 p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-left hover:border-[#2563eb] transition-colors"
            >
              {p.avatar_url ? (
                <img
                  src={p.avatar_url}
                  alt=""
                  loading="lazy"
                  className="w-14 h-14 rounded-full object-cover mb-2"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#2563eb] text-white font-bold flex items-center justify-center mb-2">
                  {initials}
                </div>
              )}
              <div className="font-medium text-sm truncate">
                {p.display_name || p.username}
              </div>
              {p.metier && (
                <div className="text-xs text-[var(--loboko-text-muted)] truncate">{p.metier}</div>
              )}
              {(p.rating_count || 0) > 0 ? (
                <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium">
                  <Star size={12} className="text-yellow-500" fill="#eab308" />
                  {(p.rating_avg || 0).toFixed(1)}
                  <span className="text-[var(--loboko-text-muted)] font-normal">
                    ({p.rating_count})
                  </span>
                </div>
              ) : (
                <div className="mt-1 text-[10px] text-[var(--loboko-text-muted)]">Nouveau</div>
              )}
              {p.availability_status === 'available' && (
                <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Disponible
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}