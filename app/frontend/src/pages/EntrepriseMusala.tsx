import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyCompany } from '@/lib/companies';
import {
  fetchAllMusalaRequests,
  MUSALA_TYPE_LABELS,
  MusalaRequestType,
  MusalaRequestWithAuthor,
} from '@/lib/musala';
import { ArrowLeft, Search, UserRound, MapPin, Plus } from 'lucide-react';

const TYPE_FILTERS: Array<{ key: MusalaRequestType | null; label: string }> = [
  { key: null, label: 'Toutes' },
  { key: 'emploi', label: 'Emploi' },
  { key: 'stage', label: 'Stage' },
];

export default function EntrepriseMusala() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState<MusalaRequestType | null>(null);
  const [requests, setRequests] = useState<MusalaRequestWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasCompany, setHasCompany] = useState(false);
  const [checkingCompany, setCheckingCompany] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!user?.id) {
      setCheckingCompany(false);
      return;
    }
    fetchMyCompany(user.id).then((c) => {
      setHasCompany(!!c);
      setCheckingCompany(false);
    });
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rows = await fetchAllMusalaRequests({ requestType: type, query: debouncedQuery });
      if (!cancelled) setRequests(rows);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [type, debouncedQuery]);

  return (
    <Layout title="Musala">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Musala</h1>
        {!checkingCompany && !hasCompany && user?.id && (
          <button
            onClick={() => navigate('/musala/manage')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-semibold"
          >
            <Plus size={14} /> Publier ma demande
          </button>
        )}
      </div>
      <p className="text-sm text-[var(--loboko-text-secondary)] mb-4">
        Demandes d'emploi et de stage publiées par des particuliers.
        {hasCompany && ' En tant qu\u2019entreprise, vous pouvez les consulter mais pas en publier.'}
      </p>

      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un profil…"
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
      ) : requests.length === 0 ? (
        <div className="text-center py-12 px-4 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-3">
            <UserRound size={22} className="text-[#2563eb]" />
          </div>
          <p className="text-sm text-[var(--loboko-text-muted)]">Aucune demande trouvée.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => {
            const name = r.author?.display_name || r.author?.username || 'Utilisateur';
            return (
              <div
                key={r.id}
                className="p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{r.title}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white text-[8px] font-bold shrink-0">
                        {r.author?.avatar_url ? (
                          <img src={r.author.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <span className="text-xs text-[var(--loboko-text-muted)]">{name}</span>
                    </div>
                    {r.location && (
                      <div className="text-xs text-[var(--loboko-text-muted)] flex items-center gap-1 mt-1">
                        <MapPin size={11} /> {r.location}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold">
                    {MUSALA_TYPE_LABELS[r.request_type]}
                  </span>
                </div>
                {r.description && (
                  <p className="text-xs text-[var(--loboko-text-secondary)] mt-2 whitespace-pre-wrap">
                    {r.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
