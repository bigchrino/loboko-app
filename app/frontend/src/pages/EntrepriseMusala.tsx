import Layout from '@/components/Layout';
import { Store } from 'lucide-react';

export default function EntrepriseMusala() {
  return (
    <Layout title="Musala">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center">
            <Store size={22} className="text-[#2563eb]" />
          </div>
          <h1 className="text-2xl font-bold">Musala</h1>
        </div>

        <p className="text-[var(--loboko-text-secondary)]">
          Découvrez Musala et ses services partenaires sur LOBOKO.
        </p>

        <div className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-semibold">À propos de Musala</h2>
          <p className="text-sm text-[var(--loboko-text-secondary)]">
            Musala est un partenaire privilégié de LOBOKO, proposant une large gamme de
            services pour les professionnels et particuliers.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-4">
            <div className="text-2xl mb-2">🛍️</div>
            <div className="font-semibold">Boutique</div>
            <div className="text-sm text-[var(--loboko-text-secondary)]">
              Produits & services
            </div>
          </div>
          <div className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-4">
            <div className="text-2xl mb-2">📞</div>
            <div className="font-semibold">Contact</div>
            <div className="text-sm text-[var(--loboko-text-secondary)]">
              Support 24/7
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}