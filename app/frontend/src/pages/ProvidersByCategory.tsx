import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ArrowLeft, Search, Star, Briefcase, MessageCircle } from 'lucide-react';
import {
  fetchCategoryBySlug,
  fetchProvidersByCategory,
  ProviderProfile,
  ServiceCategory,
} from '@/lib/service-categories';
import { fetchRatingSummary, RatingSummary } from '@/lib/ratings';
import { getMediaUrl } from '@/lib/storage-helpers';

/**
 * ProvidersByCategory
 *
 * Lists all prestataires registered under a given service category.
 * Route: /services/:slug
 *
 * Filters:
 *  - Name search (display_name / username)
 *  - Minimum rating (0 / 3+ / 4+)
 */

interface ProviderCardState extends ProviderProfile {
  avatar_url?: string | null;
  rating?: RatingSummary;
}

const MIN_RATING_OPTIONS: Array<{ label: string; value: number }> = [
  { label: 'Toutes notes', value: 0 },
  { label: '3★ et +', value: 3 },
  { label: '4★ et +', value: 4 },
];

export default function ProvidersByCategory() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderCardState[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [minRating, setMinRating] = useState<number>(0);

  const loadData = useCallback(async () => {
    if (!slug) return;
    setCategoryLoading(true);
    setLoading(true);

    const cat = await fetchCategoryBySlug(slug);
    setCategory(cat);
    setCategoryLoading(false);

    if (!cat) {
      setProviders([]);
      setLoading(false);
      return;
    }

    const list = await fetchProvidersByCategory(cat.id);
    // Resolve avatars + rating summaries in parallel.
    const enriched = await Promise.all(
      list.map(async (p) => {
        const [avatar_url, rating] = await Promise.all([
          p.avatar_key ? getMediaUrl(p.avatar_key) : Promise.resolve(null),
          fetchRatingSummary(p.user_id).catch(() => ({
            average: 0,
            count: 0,
          }) as RatingSummary),
        ]);
        return { ...p, avatar_url, rating } as ProviderCardState;
      }),
    );
    setProviders(enriched);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return providers.filter((p) => {
      const name = (p.display_name || p.username || '').toLowerCase();
      if (q && !name.includes(q) && !p.username.toLowerCase().includes(q)) {
        return false;
      }
      if (minRating > 0) {
        const avg = p.rating?.average || 0;
        if (avg < minRating) return false;
      }
      return true;
    });
  }, [providers, query, minRating]);

  return (
    <Layout title={category?.name || 'Prestataires'}>
      <button
        type="button"
        onClick={() => navigate('/find')}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-3"
      >
        <ArrowLeft size={14} /> Toutes les catégories
      </button>

      <div className="mb-4">
        {categoryLoading ? (
          <div className="h-8 w-48 rounded bg-[var(--loboko-surface)] animate-pulse" />
        ) : category ? (
          <>
            <h1 className="text-2xl font-bold mb-1">{category.name}</h1>
            {category.description && (
              <p className="text-sm text-[var(--loboko-text-muted)]">
                {category.description}
              </p>
            )}
          </>
        ) : (
          <div className="p-4 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
            <div className="font-semibold mb-1">Catégorie introuvable</div>
            <p className="text-sm text-[var(--loboko-text-muted)]">
              Cette catégorie n'existe plus ou a été désactivée.
            </p>
          </div>
        )}
      </div>

      {category && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
            <Search size={16} className="text-[var(--loboko-text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un prestataire par nom"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {MIN_RATING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMinRating(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  minRating === opt.value
                    ? 'bg-[#2563eb] text-white'
                    : '!bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-[var(--loboko-text-secondary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement des prestataires…
        </div>
      ) : !category ? null : filtered.length === 0 ? (
        <div className="text-center py-12 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
          <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-3">
            <Briefcase size={22} className="text-[#2563eb]" />
          </div>
          <h3 className="font-semibold mb-1">
            Aucun prestataire disponible dans cette catégorie
          </h3>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Revenez plus tard ou essayez une autre catégorie.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => {
            const name = p.display_name || p.username;
            const initials = name.slice(0, 2).toUpperCase();
            const rating = p.rating || { average: 0, count: 0 };
            return (
              <li
                key={p.id}
                className="p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] flex items-center gap-3"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/u/${p.user_id}`)}
                  className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold flex-shrink-0"
                  aria-label={`Voir le profil de ${name}`}
                >
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/u/${p.user_id}`)}
                    className="text-sm font-semibold truncate block text-left hover:underline"
                  >
                    {name}
                  </button>
                  <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                    @{p.username}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-[var(--loboko-text-secondary)]">
                      <Star size={12} fill="#f59e0b" color="#f59e0b" />
                      {rating.count > 0 ? (
                        <>
                          <span className="font-bold">{rating.average.toFixed(1)}</span>
                          <span className="text-[var(--loboko-text-muted)]">
                            ({rating.count})
                          </span>
                        </>
                      ) : (
                        <span className="text-[var(--loboko-text-muted)]">
                          Aucun avis
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/messages/contact/${p.user_id}`)}
                  className="p-2 rounded-full bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors flex-shrink-0"
                  aria-label="Contacter"
                  title="Contacter"
                >
                  <MessageCircle size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Layout>
  );
}