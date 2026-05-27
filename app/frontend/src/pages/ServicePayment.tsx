import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  createPaymentForOrder,
  calculateTotalPayment,
  PaymentCurrency,
} from '@/lib/payments';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

interface ServiceOrder {
  id: string;
  client_id: string;
  provider_id: string;
  proposed_budget: number | null;
  description: string;
  status: string;
  payment_status: string;
}

export default function ServicePayment() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [currency, setCurrency] = useState<PaymentCurrency>('USD');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) return;

      try {
        const { data, error } = await supabase
          .from('service_orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();

        if (error) throw error;

        setOrder(data as ServiceOrder | null);
      } catch (e) {
        console.error(e);
        toast.error('Impossible de charger la commande');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

  const amount = order?.proposed_budget || 0;
  const { commission, total } = calculateTotalPayment(amount);

  const handleCreatePayment = async () => {
    if (!user?.id || !order) return;

    if (user.id !== order.client_id) {
      toast.error('Seul le client peut payer cette commande');
      return;
    }

    if (!order.provider_id) {
      toast.error('Prestataire introuvable');
      return;
    }

    if (!amount || amount <= 0) {
      toast.error('Budget invalide');
      return;
    }

    setPaying(true);

    try {
      const payment = await createPaymentForOrder({
        orderId: order.id,
        clientId: order.client_id,
        providerId: order.provider_id,
        amount,
        currency,
      });

      if (!payment) {
        toast.error('Paiement impossible');
        return;
      }

      await supabase
        .from('service_orders')
        .update({
          payment_id: payment.id,
          payment_status: 'held',
          is_paid: true,
          paid_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      toast.success('Paiement préparé');

      navigate(`/my-orders/${order.id}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erreur paiement');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Paiement">
        <div className="text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout title="Paiement">
        <div className="text-sm text-[var(--loboko-text-muted)]">
          Commande introuvable
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Paiement">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm mb-4"
      >
        <ArrowLeft size={16} />
        Retour
      </button>

      <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 space-y-4">
        <h1 className="text-xl font-bold">
          Payer le prestataire
        </h1>

        <div>
          <div className="text-xs text-[var(--loboko-text-muted)]">
            Budget mission
          </div>
          <div className="font-semibold">
            {amount} {currency}
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--loboko-text-muted)]">
            Commission LOBOKO
          </div>
          <div className="font-semibold">
            {commission} {currency}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[rgba(37,99,235,0.12)] border border-[rgba(37,99,235,0.35)]">
          <div className="text-xs text-[var(--loboko-text-muted)]">
            Total à payer
          </div>
          <div className="text-xl font-bold text-[#2563eb]">
            {total} {currency}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">
            Devise
          </label>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`py-2 rounded-xl border ${
                currency === 'USD'
                  ? 'bg-[#2563eb] text-white border-[#2563eb]'
                  : 'border-[var(--loboko-border)]'
              }`}
            >
              USD
            </button>

            <button
              type="button"
              onClick={() => setCurrency('CDF')}
              className={`py-2 rounded-xl border ${
                currency === 'CDF'
                  ? 'bg-[#2563eb] text-white border-[#2563eb]'
                  : 'border-[var(--loboko-border)]'
              }`}
            >
              CDF
            </button>
          </div>
        </div>

        <button
          onClick={handleCreatePayment}
          disabled={paying}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold disabled:opacity-50"
        >
          {paying ? 'Préparation...' : 'Préparer le paiement'}
        </button>

        <p className="text-xs text-[var(--loboko-text-muted)]">
          Pour l’instant, cette étape prépare le paiement. L’intégration Netikash viendra ensuite.
        </p >
      </div>
    </Layout>
  );
}
