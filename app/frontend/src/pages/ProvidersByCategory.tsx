import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useBackNavigation } from '@/lib/use-back-navigation';
import Layout from '@/components/Layout';
import {
  ArrowLeft,
  Search,
  Star,
  Briefcase,
  MessageCircle,
  MapPin,
  LocateFixed,
  BadgeCheck,
  X,
} from 'lucide-react';
import {
  fetchCategoryBySlug,
  fetchProvidersByCategory,
  fetchProvidersByService,
  fetchServiceById,
  ProviderProfile,
  Service,
  ServiceCategory,
} from '@/lib/service-categories';
import { fetchRatingSummary, RatingSummary } from '@/lib/ratings';
import { getMediaUrl } from '@/lib/storage-helpers';
import { isPremium, premiumFirst } from '@/lib/subscription';
import PremiumBadge from '@/components/PremiumBadge';
import {
  Coordinates,
  distanceInMeters,
  formatDistance,
  getCurrentPosition,
} from '@/lib/geo';
import {
  getProvinceNames,
  getCitiesByProvince,
  getCommunesByCity,
} from '@/data/rdcLocations';
import { toast } from 'sonner';

type SortMode = 'recent' | 'rating' | 'jobs' | 'distance';

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
  /** Distance en mètres depuis la position du client — null si l'un des
   *  deux (client ou prestataire) n'a pas de coordonnées disponibles. */
  distanceMeters?: number | null;
}

const MIN_RATING_OPTIONS: Array<{ label: string; value: number }> = [
  { label: 'Toutes notes', value: 0 },
  { label: '3★ et +', value: 3 },
  { label: '4★ et +', value: 4 },
];

export default function ProvidersByCategory() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const serviceId = searchParams.get('service');
  const navigate = useNavigate();
  const goBack = useBackNavigation('/find');

  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [service, setService] = useState<Service | null>(null);
  const [providers, setProviders] = useState<ProviderCardState[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [minRating, setMinRating] = useState<number>(0);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>('recent');

  // Géolocalisation du client (Phase 2). Tant qu'on n'a pas de position,
  // on propose le repli Province / Ville / Commune plutôt qu'un simple
  // champ "ville" en texte libre.
  const [clientCoords, setClientCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [manualProvince, setManualProvince] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualCommune, setManualCommune] = useState('');
  const manualProvinces = getProvinceNames();
  const manualCities = getCitiesByProvince(manualProvince);
  const manualCommunes = getCommunesByCity(manualProvince, manualCity);

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const { coords, error } = await getCurrentPosition();
      if (!coords) {
        if (error === 'denied') {
          toast.error(
            'Localisation refusée. Utilisez le filtre par zone ci-dessous.',
          );
        } else if (error === 'unsupported') {
          toast.error("La géolocalisation n'est pas disponible sur cet appareil.");
        } else {
          toast.error('Impossible de récupérer votre position pour le moment.');
        }
        return;
      }
      setClientCoords(coords);
      setSort('distance');
    } finally {
      setLocating(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!slug) return;
    setCategoryLoading(true);
    setLoading(true);

    const cat = await fetchCategoryBySlug(slug);
    setCategory(cat);
    setCategoryLoading(false);

    if (!cat) {
      setService(null);
      setProviders([]);
      setLoading(false);
      return;
    }

    // Si on arrive via un service précis (ex: "Chauffeur" cliqué depuis la
    // recherche), on ne montre que ses prestataires — sinon, toute la
    // catégorie comme avant.
    const svc = serviceId ? await fetchServiceById(serviceId) : null;
    setService(svc);

    const list = svc
      ? await fetchProvidersByService(svc.id)
      : await fetchProvidersByCategory(cat.id);
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
  }, [slug, serviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const withDistance: ProviderCardState[] = providers.map((p) => {
      const hasBoth =
        clientCoords && p.latitude != null && p.longitude != null;
      return {
        ...p,
        distanceMeters: hasBoth
          ? distanceInMeters(clientCoords as Coordinates, {
              latitude: p.latitude as number,
              longitude: p.longitude as number,
            })
          : null,
      };
    });

    const list = withDistance.filter((p) => {
      const name = (p.display_name || p.username || '').toLowerCase();
      if (q && !name.includes(q) && !p.username.toLowerCase().includes(q)) {
        return false;
      }
      if (minRating > 0) {
        const avg = p.rating?.average || 0;
        if (avg < minRating) return false;
      }
      if (availableOnly && (p.availability_status || 'available') !== 'available') {
        return false;
      }
      if (
        verifiedOnly &&
        !(p.is_verified && p.verification_status === 'approved')
      ) {
        return false;
      }
      // Repli Province / Ville / Commune : uniquement quand le client n'a
      // pas (ou pas encore) partagé sa position GPS.
      if (!clientCoords) {
        if (manualProvince && p.province !== manualProvince) return false;
        if (manualCity && p.city !== manualCity) return false;
        if (manualCommune && p.commune !== manualCommune) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sort === 'rating') {
      sorted.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0));
    } else if (sort === 'jobs') {
      sorted.sort(
        (a, b) => (b.completed_jobs_count || 0) - (a.completed_jobs_count || 0),
      );
    } else if (sort === 'distance') {
      sorted.sort((a, b) => {
        // Les prestataires sans position connue passent en fin de liste,
        // plutôt que d'être exclus des résultats.
        if (a.distanceMeters == null && b.distanceMeters == null) return 0;
        if (a.distanceMeters == null) return 1;
        if (b.distanceMeters == null) return -1;
        return a.distanceMeters - b.distanceMeters;
      });
    }
    // 'recent' keeps the server order (created_at DESC).
    // Finally, premium providers are always surfaced first (within each
    // sort mode). This is a stable sort in modern JS engines so ties
    // preserve the ordering chosen above.
    sorted.sort(premiumFirst);
    return sorted;
  }, [
    providers,
    query,
    minRating,
    availableOnly,
    verifiedOnly,
    sort,
    clientCoords,
    manualProvince,
    manualCity,
    manualCommune,
  ]);

  return (
    <Layout title={service?.name || category?.name || 'Prestataires'}>
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-3"
      >
        <ArrowLeft size={14} /> Retour
      </button>

      <div className="mb-4">
        {categoryLoading ? (
          <div className="h-8 w-48 rounded bg-[var(--loboko-surface)] animate-pulse" />
        ) : category ? (
          <>
            <h1 className="text-2xl font-bold mb-1">
              {service ? service.name : category.name}
            </h1>
            {service ? (
              <button
                type="button"
                onClick={() => setSearchParams({}, { replace: true })}
                className="inline-flex items-center gap-1 text-xs text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] underline"
              >
                <X size={11} /> Voir toute la catégorie {category.name}
              </button>
            ) : (
              category.description && (
                <p className="text-sm text-[var(--loboko-text-muted)]">
                  {category.description}
                </p>
              )
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

          {clientCoords ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)]">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#22c55e]">
                <LocateFixed size={14} /> Triés par distance depuis votre position
              </span>
              <button
                type="button"
                onClick={() => {
                  setClientCoords(null);
                  setSort('recent');
                }}
                className="text-xs text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] underline flex-shrink-0"
              >
                Modifier
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-semibold disabled:opacity-60"
              >
                <LocateFixed size={16} className={locating ? 'animate-pulse' : ''} />
                {locating
                  ? 'Localisation en cours…'
                  : 'Utiliser ma position pour voir les plus proches'}
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={manualProvince}
                  onChange={(e) => {
                    setManualProvince(e.target.value);
                    setManualCity('');
                    setManualCommune('');
                  }}
                  className="px-3 py-2 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-xs focus:outline-none focus:border-[#2563eb]"
                >
                  <option value="">Toute province</option>
                  {manualProvinces.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  value={manualCity}
                  onChange={(e) => {
                    setManualCity(e.target.value);
                    setManualCommune('');
                  }}
                  disabled={!manualProvince}
                  className="px-3 py-2 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-xs focus:outline-none focus:border-[#2563eb] disabled:opacity-50"
                >
                  <option value="">Toute ville</option>
                  {manualCities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={manualCommune}
                  onChange={(e) => setManualCommune(e.target.value)}
                  disabled={!manualCity}
                  className="px-3 py-2 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-xs focus:outline-none focus:border-[#2563eb] disabled:opacity-50"
                >
                  <option value="">Toute commune</option>
                  {manualCommunes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
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
            <button
              type="button"
              onClick={() => setAvailableOnly((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                availableOnly
                  ? 'bg-[#22c55e] text-white'
                  : '!bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-[var(--loboko-text-secondary)]'
              }`}
              aria-pressed={availableOnly}
            >
              ● Disponible
            </button>
            <button
              type="button"
              onClick={() => setVerifiedOnly((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                verifiedOnly
                  ? 'bg-[#2563eb] text-white'
                  : '!bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-[var(--loboko-text-secondary)]'
              }`}
              aria-pressed={verifiedOnly}
            >
              <BadgeCheck size={12} /> Vérifié
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[11px] text-[var(--loboko-text-muted)] whitespace-nowrap">
              Trier :
            </span>
            {([
              { key: 'recent', label: 'Plus récent' },
              { key: 'rating', label: 'Meilleure note' },
              { key: 'jobs', label: 'Plus de missions' },
              ...(clientCoords
                ? [{ key: 'distance', label: '📍 Plus proche' }]
                : []),
            ] as Array<{ key: SortMode; label: string }>).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  sort === s.key
                    ? 'bg-[#2563eb] text-white'
                    : '!bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-[var(--loboko-text-secondary)]'
                }`}
              >
                {s.label}
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
            {service
              ? `Aucun prestataire "${service.name}" pour l'instant`
              : 'Aucun prestataire disponible dans cette catégorie'}
          </h3>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            {service
              ? `Essayez de voir toute la catégorie ${category.name}, ou revenez plus tard.`
              : 'Revenez plus tard ou essayez une autre catégorie.'}
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
                    <img src={p.avatar_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => navigate(`/u/${p.user_id}`)}
                      className="text-sm font-semibold truncate text-left hover:underline"
                    >
                      {name}
                    </button>
                    {isPremium(p) && <PremiumBadge />}
                    {p.is_verified && p.verification_status === 'approved' && (
                      <BadgeCheck
                        size={14}
                        className="text-[#60a5fa] shrink-0"
                        aria-label="Vérifié"
                      />
                    )}
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        (p.availability_status || 'available') === 'available'
                          ? 'bg-[#22c55e]'
                          : 'bg-[#ef4444]'
                      }`}
                      aria-label={
                        (p.availability_status || 'available') === 'available'
                          ? 'Disponible'
                          : 'Indisponible'
                      }
                    />
                  </div>
                  <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                    @{p.username}
                    {p.city && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5">
                        · <MapPin size={10} /> {p.city}
                      </span>
                    )}
                    {p.distanceMeters != null && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[#22c55e] font-semibold">
                        · <LocateFixed size={10} /> {formatDistance(p.distanceMeters)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] flex-wrap">
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
                    <span className="inline-flex items-center gap-1 text-[var(--loboko-text-secondary)]">
                      <Briefcase size={11} />
                      {p.completed_jobs_count || 0} mission
                      {(p.completed_jobs_count || 0) !== 1 ? 's' : ''}
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
