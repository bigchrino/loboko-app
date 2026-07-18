import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ClipboardList, Store, ChevronRight, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyCompany, getCompanyColor, Company } from '@/lib/companies';

export default function Entreprise() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    (async () => {
      const c = await fetchMyCompany(user.id);
      setCompany(c);
      setLoading(false);
    })();
  }, [user?.id]);

  const companyColor = company ? getCompanyColor(company.color_key) : null;

  return (
    <Layout title="Entreprise">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center">
            <Building2 size={22} className="text-[#2563eb]" />
          </div>
          <h1 className="text-2xl font-bold">Entreprise</h1>
        </div>

        {!loading && (
          company ? (
            <button
              onClick={() => navigate('/entreprise/manage')}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-white"
              style={{ backgroundColor: companyColor?.hex }}
            >
              <Settings size={16} />
              Gérer mon entreprise
            </button>
          ) : (
            <button
              onClick={() => navigate('/entreprise/create')}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm"
            >
              <Building2 size={16} />
              Ajouter mon entreprise
            </button>
          )
        )}

        <Link
          to="/entreprise/offres"
          className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] hover:bg-[var(--loboko-surface-hover)] transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center shrink-0">
            <ClipboardList size={22} className="text-[#2563eb]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Offres</div>
            <div className="text-sm text-[var(--loboko-text-secondary)]">
              Consultez les offres disponibles
            </div>
          </div>
          <ChevronRight size={20} className="text-[var(--loboko-text-muted)]" />
        </Link>

        <Link
          to="/entreprise/musala"
          className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] hover:bg-[var(--loboko-surface-hover)] transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center shrink-0">
            <Store size={22} className="text-[#2563eb]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Musala</div>
            <div className="text-sm text-[var(--loboko-text-secondary)]">
              Découvrez Musala et ses services
            </div>
          </div>
          <ChevronRight size={20} className="text-[var(--loboko-text-muted)]" />
        </Link>
      </div>
    </Layout>
  );
}
