import Layout from '@/components/Layout';
import { Link } from 'react-router-dom';
import { Siren, Hospital, Shield, Flame, ChevronRight } from 'lucide-react';

export default function Urgences() {
  return (
    <Layout title="Urgences">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(239,68,68,0.15)] flex items-center justify-center">
            <Siren size={22} className="text-[#ef4444]" />
          </div>
          <h1 className="text-2xl font-bold">Urgences</h1>
        </div>

        <p className="text-[var(--loboko-text-secondary)]">
          Contactez les urgences pour un quelconque problème grave.
        </p>

        <Link
          to="/urgences/hopitaux"
          className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] hover:bg-[var(--loboko-surface-hover)] transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-[rgba(239,68,68,0.15)] flex items-center justify-center shrink-0">
            <Hospital size={22} className="text-[#ef4444]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Hôpitaux</div>
            <div className="text-sm text-[var(--loboko-text-secondary)]">
              Trouvez un hôpital proche de vous
            </div>
          </div>
          <ChevronRight size={20} className="text-[var(--loboko-text-muted)]" />
        </Link>

        <Link
          to="/urgences/polices"
          className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] hover:bg-[var(--loboko-surface-hover)] transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center shrink-0">
            <Shield size={22} className="text-[#2563eb]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Polices</div>
            <div className="text-sm text-[var(--loboko-text-secondary)]">
              Contactez les forces de l'ordre
            </div>
          </div>
          <ChevronRight size={20} className="text-[var(--loboko-text-muted)]" />
        </Link>

        <Link
          to="/urgences/casernes"
          className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] hover:bg-[var(--loboko-surface-hover)] transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-[rgba(249,115,22,0.15)] flex items-center justify-center shrink-0">
            <Flame size={22} className="text-[#f97316]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Casernes</div>
            <div className="text-sm text-[var(--loboko-text-secondary)]">
              Appelez les pompiers en cas d'urgence
            </div>
          </div>
          <ChevronRight size={20} className="text-[var(--loboko-text-muted)]" />
        </Link>
      </div>
    </Layout>
  );
}