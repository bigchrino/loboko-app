import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Search, Briefcase, ArrowRight } from 'lucide-react';
import {
  fetchCategoriesWithCounts,
  ServiceCategoryWithCount,
} from '@/lib/service-categories';

/**
 * FindProviders
 *
 * Displays every active service category as a card (icon + name + provider
 * count). Clicking a card navigates to the providers list for that category.
 *
 * Also supports a shortcut: /find?slug=<slug> — if a valid slug is provided
 * in the query string, we redirect straight to the corresponding category
 * page. This is what the "Voir" buttons on the home ads carousel use.
 */

export default function FindProviders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cats, setCats] = useState<ServiceCategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await fetchCategoriesWithCounts();
      if (cancelled) return;
      setCats(list);
      setLoading(false);

      // Shortcut redirect: /find?slug=plombier -> /services/plombier
      const slug = searchParams.get('slug');
      if (slug) {
        const match = list.find((c) => c.slug === slug);
        if (match) navigate(`/services/${match.slug}`, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cats;
    return cats.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q),
    );
  }, [cats, query]);

  return (
    <Layout title="Trouver un prestataire">
      <div className="mb-5">
        <h1 className="text-2xl font-bold mb-1">Trouver un prestataire</h1>
        <p className="text-sm text-[var(--loboko-text-muted)]">
          Choisissez un service pour voir les professionnels disponibles.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
        <Search size={16} className="text-[var(--loboko-text-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une catégorie (ex: plombier, coiffeur…)"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement des catégories…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
          <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-3">
            <Briefcase size={22} className="text-[#2563eb]" />
          </div>
          <h3 className="font-semibold mb-1">Aucune catégorie trouvée</h3>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Essayez un autre mot-clé.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/services/${c.slug}`)}
              className="group text-left p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-[rgba(37,99,235,0.15)] text-[#60a5fa] flex items-center justify-center mb-3">
                <Briefcase size={18} />
              </div>
              <div className="text-sm font-semibold text-[var(--loboko-text)] mb-1 line-clamp-2">
                {c.name}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--loboko-text-muted)]">
                  {c.provider_count} prestataire{c.provider_count !== 1 ? 's' : ''}
                </span>
                <ArrowRight
                  size={14}
                  className="text-[var(--loboko-text-muted)] group-hover:text-[#60a5fa] transition-colors"
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </Layout>
  );
}
