import Layout from '@/components/Layout';
import { Link } from 'react-router-dom';
import { Building2, ClipboardList, Store, ChevronRight } from 'lucide-react';

export default function Entreprise() {
  return (
    <Layout title="Entreprise">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center">
            <Building2 size={22} className="text-[#2563eb]" />
          </div>
          <h1 className="text-2xl font-bold">Entreprise</h1>
        </div>

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