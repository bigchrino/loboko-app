import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Search, Briefcase, Wrench, ArrowRight } from 'lucide-react';
import {
  fetchCategoriesWithCounts,
  fetchActiveServices,
  ServiceCategoryWithCount,
  Service,
} from '@/lib/service-categories';

/**
 * FindProviders
 *
 * Displays every active service category as a card (icon + name + provider
 * count). Clicking a card navigates to the providers list for that category.
 *
 * The search box matches BOTH the broad categories (ex: "Transport") AND
 * the precise services underneath them (ex: "Chauffeur") — before this fix,
 * typing "Chauffeur" found nothing since no *category* is named that way,
 * only the service is. Matched services are shown above the category grid
 * and link straight to that service's providers (pre-filtered).
 *
 * Also supports a shortcut: /find?slug=<slug> — if a valid slug is provided
 * in the query string, we redirect straight to the corresponding category
 * page. This is what the "Voir" buttons on the home ads carousel use.
 */

export default function FindProviders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cats, setCats] = useState<ServiceCategoryWithCount[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [catList, serviceList] = await Promise.all([
        fetchCategoriesWithCounts(),
        fetchActiveServices(),
      ]);
      if (cancelled) return;
      setCats(catList);
      setServices(serviceList);
      setLoading(false);

      // Shortcut redirect: /find?slug=plombier -> /services/plombier
      const slug = searchParams.get('slug');
      if (slug) {
        const match = catList.find((c) => c.slug === slug);
        if (match) navigate(`/services/${match.slug}`, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  const categoryById = useMemo(() => {
    const map = new Map<string, ServiceCategoryWithCount>();
    for (const c of cats) map.set(c.id, c);
    return map;
  }, [cats]);

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

  // N'affiche les services correspondants que lorsqu'une recherche est en
  // cours — par défaut, on garde l'écran de navigation par catégories tel
  // quel plutôt que de lister des dizaines de services d'un coup.
  const matchedServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return services.filter(
      (s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q),
    );
  }, [services, query]);

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
      ) : filtered.length === 0 && matchedServices.length === 0 ? (
        <div className="text-center py-12 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
          <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-3">
            <Briefcase size={22} className="text-[#2563eb]" />
          </div>
          <h3 className="font-semibold mb-1">Aucun résultat trouvé</h3>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Essayez un autre mot-clé.
          </p>
        </div>
      ) : (
        <>
          {matchedServices.length > 0 && (
            <div className="mb-5">
              <h2 className="text-xs font-semibold text-[var(--loboko-text-muted)] uppercase tracking-wide mb-2">
                Services correspondants
              </h2>
              <div className="space-y-2">
                {matchedServices.map((s) => {
                  const cat = categoryById.get(s.category_id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        navigate(
                          cat
                            ? `/services/${cat.slug}?service=${s.id}`
                            : `/services/${s.slug}?service=${s.id}`,
                        )
                      }
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb] transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-[rgba(37,99,235,0.15)] text-[#60a5fa] flex items-center justify-center flex-shrink-0">
                        <Wrench size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{s.name}</div>
                        {cat && (
                          <div className="text-[11px] text-[var(--loboko-text-muted)] truncate">
                            {cat.name}
                          </div>
                        )}
                      </div>
                      <ArrowRight size={14} className="text-[var(--loboko-text-muted)] flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filtered.length > 0 && (
            <>
              {matchedServices.length > 0 && (
                <h2 className="text-xs font-semibold text-[var(--loboko-text-muted)] uppercase tracking-wide mb-2">
                  Catégories
                </h2>
              )}
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
            </>
          )}
        </>
      )}
    </Layout>
  );
}
