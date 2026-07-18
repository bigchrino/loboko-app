import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyCompany } from '@/lib/companies';
import {
  fetchAllJobOffers,
  EMPLOYMENT_TYPE_LABELS,
  EmploymentType,
  JobOfferWithCompany,
} from '@/lib/job-offers';
import { ArrowLeft, Search, ClipboardList, MapPin, Building2, Plus } from 'lucide-react';

const TYPE_FILTERS: Array<{ key: EmploymentType | null; label: string }> = [
  { key: null, label: 'Toutes' },
  { key: 'long_terme', label: 'Long terme' },
  { key: 'court_terme', label: 'Court terme' },
  { key: 'stage', label: 'Stage' },
];

export default function EntrepriseOffres() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState<EmploymentType | null>(null);
  const [offers, setOffers] = useState<JobOfferWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasCompany, setHasCompany] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!user?.id) return;
    fetchMyCompany(user.id).then((c) => setHasCompany(!!c));
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rows = await fetchAllJobOffers({ employmentType: type, query: debouncedQuery });
      if (!cancelled) setOffers(rows);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [type, debouncedQuery]);

  return (
    <Layout title="Offres d'emploi">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Offres d'emploi</h1>
        {hasCompany && (
          <button
            onClick={() => navigate('/entreprise/offres/manage')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-semibold"
          >
            <Plus size={14} /> Publier
          </button>
        )}
      </div>
      <p className="text-sm text-[var(--loboko-text-secondary)] mb-4">
        Emplois long terme, court terme et stages publiés par les entreprises LOBOKO.
      </p>

      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un poste…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setType(f.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              type === f.key
                ? 'bg-[#2563eb] text-white border-[#2563eb]'
                : 'bg-[var(--loboko-surface)] border-[var(--loboko-border)] text-[var(--loboko-text-muted)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      ) : offers.length === 0 ? (
        <div className="text-center py-12 px-4 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-3">
            <ClipboardList size={22} className="text-[#2563eb]" />
          </div>
          <p className="text-sm text-[var(--loboko-text-muted)]">Aucune offre trouvée.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {offers.map((o) => (
            <button
              key={o.id}
              onClick={() => navigate(`/entreprise/company/${o.company.slug}`)}
              className="w-full text-left p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{o.title}</div>
                  <div className="text-xs text-[var(--loboko-text-muted)] flex items-center gap-1 mt-1">
                    <Building2 size={11} /> {o.company.name}
                  </div>
                  {o.location && (
                    <div className="text-xs text-[var(--loboko-text-muted)] flex items-center gap-1 mt-0.5">
                      <MapPin size={11} /> {o.location}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold">
                  {EMPLOYMENT_TYPE_LABELS[o.employment_type]}
                </span>
              </div>
              {o.description && (
                <p className="text-xs text-[var(--loboko-text-secondary)] mt-2 line-clamp-2">
                  {o.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </Layout>
  );
}
