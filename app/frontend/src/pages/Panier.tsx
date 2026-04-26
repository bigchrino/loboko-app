import Layout from '@/components/Layout';
import { ShoppingCart } from 'lucide-react';

export default function Panier() {
  return (
    <Layout title="Panier">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center">
            <ShoppingCart size={22} className="text-[#2563eb]" />
          </div>
          <h1 className="text-2xl font-bold">Panier</h1>
        </div>

        <p className="text-[var(--loboko-text-secondary)]">
          Achetez vos articles et gardez-les ici pour les payer plus tard.
        </p>

        <div className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-10 flex flex-col items-center text-center gap-3">
          <div className="text-5xl">🛒</div>
          <div className="font-semibold">Votre panier est vide</div>
          <div className="text-sm text-[var(--loboko-text-secondary)]">
            Explorez les offres pour ajouter des articles.
          </div>
        </div>
      </div>
    </Layout>
  );
}