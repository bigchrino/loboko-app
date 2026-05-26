import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ArrowLeft } from 'lucide-react';

export default function ServiceOrder() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  return (
    <Layout title="Commander un service">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm mb-4"
      >
        <ArrowLeft size={16} />
        Retour
      </button>

      <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4">
        <h2 className="text-xl font-bold mb-2">
          Nouvelle commande
        </h2>

        <p className="text-sm text-[var(--loboko-text-muted)] mb-4">
          Prestataire : {userId}
        </p >

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">
              Description du besoin
            </label>

            <textarea
              className="w-full mt-1 p-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] min-h-[120px] outline-none"
              placeholder="Expliquez votre besoin..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Budget proposé
            </label>

            <input
              type="number"
              className="w-full mt-1 p-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] outline-none"
              placeholder="Ex: 50"
            />
          </div>

          <button
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold"
          >
            Envoyer la commande
          </button>
        </div>
      </div>
    </Layout>
  );
}
