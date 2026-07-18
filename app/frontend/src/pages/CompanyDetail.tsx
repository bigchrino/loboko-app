import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCompanyBySlug, getCompanyColor, Company } from '@/lib/companies';
import {
  fetchCompanyJobOffers,
  EMPLOYMENT_TYPE_LABELS,
  JobOffer,
} from '@/lib/job-offers';
import { ArrowLeft, Building2, Settings, MapPin, ClipboardList } from 'lucide-react';

export default function CompanyDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [company, setCompany] = useState<Company | null>(null);
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const c = await fetchCompanyBySlug(slug);
      setCompany(c);
      if (c) {
        const rows = await fetchCompanyJobOffers(c.id);
        setOffers(rows.filter((o) => o.is_active));
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <Layout title="Entreprise">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      </Layout>
    );
  }

  if (!company) {
    return (
      <Layout title="Entreprise">
        <div className="p-4 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
          <div className="font-semibold mb-1">Entreprise introuvable</div>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Cette entreprise n'existe plus ou a été désactivée.
          </p>
        </div>
      </Layout>
    );
  }

  const color = getCompanyColor(company.color_key);
  const isOwner = user?.id === company.owner_id;

  return (
    <Layout title={company.name}>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <div
        className="rounded-2xl p-5 mb-5 text-white"
        style={{ background: `linear-gradient(135deg, ${color.hex}, ${color.hex}cc)` }}
      >
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
          <Building2 size={26} />
        </div>
        <h1 className="text-xl font-bold mb-1">{company.name}</h1>
        {company.description && (
          <p className="text-sm text-white/80 mb-2">{company.description}</p>
        )}

        {isOwner && (
          <button
            onClick={() => navigate('/entreprise/manage')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-xs font-semibold"
          >
            <Settings size={12} /> Gérer mon entreprise
          </button>
        )}
      </div>

      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
        <ClipboardList size={18} /> Offres d'emploi
      </h2>

      {offers.length === 0 ? (
        <div className="text-center py-8 px-4 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Aucune offre d'emploi publiée pour l'instant.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {offers.map((o) => (
            <div
              key={o.id}
              className="p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold">{o.title}</div>
                <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold">
                  {EMPLOYMENT_TYPE_LABELS[o.employment_type]}
                </span>
              </div>
              {o.location && (
                <div className="text-xs text-[var(--loboko-text-muted)] flex items-center gap-1 mt-1">
                  <MapPin size={11} /> {o.location}
                </div>
              )}
              {o.description && (
                <p className="text-xs text-[var(--loboko-text-secondary)] mt-2 whitespace-pre-wrap">
                  {o.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
