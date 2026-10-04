import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CreditCard } from 'lucide-react';

export default function ServicePayment() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setOrder(null);
    async function loadOrder() {
      try {
        if (!orderId) return;
        const { data, error: loadError } = await supabase
          .from('service_orders').select('id').eq('id', orderId).maybeSingle();
        if (loadError) throw loadError;
        if (!cancelled) setOrder(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadOrder();
    return () => { cancelled = true; };
  }, [orderId]);

  return (
    <Layout title="Paiement">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm mb-4">
        <ArrowLeft size={16} /> Retour
      </button>
      {loading ? (
        <p role="status">Chargement…</p>
      ) : error ? (
        <p role="alert">Impossible de charger la commande. Réessayez en ouvrant à nouveau cette page.</p>
      ) : !order ? (
        <p>Commande introuvable</p>
      ) : (
        <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-5 space-y-4">
          <CreditCard size={28} className="text-[#2563eb]" aria-hidden="true" />
          <h1 className="text-xl font-bold">Paiement en ligne indisponible</h1>
          <p className="text-sm text-[var(--loboko-text-secondary)]">
            Vous pouvez demander un service et convenir du prix avec le prestataire.
            LOBOKO ne collecte, ne conserve et ne verse aucun fonds pour le moment.
          </p>
          <p className="text-sm text-[var(--loboko-text-secondary)]">
            Les remboursements automatiques ne sont pas disponibles. Un paiement effectué
            en dehors de LOBOKO ne bénéficie pas d’une protection des fonds par LOBOKO.
          </p>
          <button
            onClick={() => navigate(`/my-orders/${order.id}`)}
            className="w-full py-3 rounded-xl bg-[#2563eb] text-white font-semibold"
          >
            Retour à la commande
          </button>
        </div>
      )}
    </Layout>
  );
}
