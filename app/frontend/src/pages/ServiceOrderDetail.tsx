import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ServiceOrder {
  id: string;
  title?: string;
  description: string;
  proposed_budget: number | null;
  provider_id?: string;
  prestataire_id?: string;
  client_id: string;
  status: string;
  payment_status: string;
  decline_reason?: string | null;
  decline_is_budget_related?: boolean | null;
  provider_requested_budget?: number | null;
  created_at: string;
}

const statusFr: Record<string, string> = {
  requested: 'En attente',
  accepted: 'Acceptée',
  completed: 'Terminée',
  disputed: 'Litige',
  cancelled: 'Annulée',
  declined: 'Refusée',
};

const paymentFr: Record<string, string> = {
  pending: 'En attente',
  paid: 'Payé',
  failed: 'Échoué',
  refunded: 'Remboursé',
};

export default function ServiceOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [budgetRelated, setBudgetRelated] = useState(false);
  const [requestedBudget, setRequestedBudget] = useState('');
  const [busy, setBusy] = useState(false);

  const loadOrder = async () => {
    if (!orderId) return;

    setLoading(true);

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

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const providerId = order?.provider_id || order?.prestataire_id;
  const isProvider = !!user?.id && !!providerId && user.id === providerId;
  const canManage = isProvider && order?.status === 'requested';

  const acceptOrder = async () => {
    if (!order) return;

    setBusy(true);

    try {
      const { error } = await supabase
        .from('service_orders')
        .update({
          status: 'accepted',
        })
        .eq('id', order.id);

      if (error) throw error;

      toast.success('Commande acceptée');
      await loadOrder();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  const declineOrder = async () => {
    if (!order) return;

    if (!declineReason.trim()) {
      toast.error('Écris la raison du refus');
      return;
    }

    if (budgetRelated && !requestedBudget.trim()) {
      toast.error('Ajoute le budget demandé');
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase
        .from('service_orders')
        .update({
          status: 'declined',
          decline_reason: declineReason.trim(),
          decline_is_budget_related: budgetRelated,
          provider_requested_budget: budgetRelated
            ? Number(requestedBudget)
            : null,
          declined_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      toast.success('Commande refusée');
      setShowDeclineModal(false);
      await loadOrder();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Refus impossible');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Commande">
        <div className="text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout title="Commande">
        <div className="text-sm text-[var(--loboko-text-muted)]">
          Commande introuvable
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Commande">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm mb-4"
      >
        <ArrowLeft size={16} />
        Retour
      </button>

      <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4">
        <h1 className="text-xl font-bold mb-2">
          {order.title || 'Commande de service'}
        </h1>

        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          <span className="px-2 py-1 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold">
            {statusFr[order.status] || order.status}
          </span>

          <span className="px-2 py-1 rounded-full bg-[var(--loboko-elevated)] text-[var(--loboko-text-muted)]">
            Paiement : {paymentFr[order.payment_status] || order.payment_status}
          </span>
        </div>

        <p className="text-sm whitespace-pre-wrap mb-4">
          {order.description}
        </p >

        <div className="text-sm text-[var(--loboko-text-muted)] mb-4">
          Budget proposé : {order.proposed_budget ?? 'Non défini'}
        </div>

        {order.status === 'declined' && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm mb-4">
            <div className="font-semibold text-red-400 mb-1">
              Commande refusée
            </div>

            <p className="whitespace-pre-wrap">
              {order.decline_reason}
            </p >

            {order.decline_is_budget_related && (
              <div className="mt-2 font-semibold">
                Budget demandé par le prestataire :{' '}
                {order.provider_requested_budget}
              </div>
            )}
          </div>
        )}

        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={acceptOrder}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-50"
            >
              Accepter
            </button>

            <button
              onClick={() => setShowDeclineModal(true)}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-50"
            >
              Refuser
            </button>
          </div>
        )}
      </div>

      {showDeclineModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4">
            <h2 className="text-lg font-bold mb-3">
              Refuser la commande
            </h2>

            <div className="mb-3">
              <label className="text-sm font-medium">
                Le refus est-il lié au budget ?
              </label>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => setBudgetRelated(true)}
                  className={`py-2 rounded-xl border ${
                    budgetRelated
                      ? 'bg-[#2563eb] text-white border-[#2563eb]'
                      : 'border-[var(--loboko-border)]'
                  }`}
                >
                  Oui
                </button>

                <button
                  onClick={() => setBudgetRelated(false)}
                  className={`py-2 rounded-xl border ${
                    !budgetRelated
                      ? 'bg-[#2563eb] text-white border-[#2563eb]'
                      : 'border-[var(--loboko-border)]'
                  }`}
                >
                  Non
                </button>
              </div>
            </div>

            {budgetRelated && (
              <div className="mb-3">
                <label className="text-sm font-medium">
                  Budget demandé
                </label>

                <input
                  type="number"
                  value={requestedBudget}
                  onChange={(e) => setRequestedBudget(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] outline-none"
                  placeholder="Ex: 100"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="text-sm font-medium">
                Raison du refus
              </label>

              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full mt-1 p-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] min-h-[110px] outline-none"
                placeholder={
                  budgetRelated
                    ? 'Expliquez pourquoi le budget proposé est insuffisant...'
                    : 'Expliquez votre raison...'
                }
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeclineModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--loboko-border)]"
              >
                Annuler
              </button>

              <button
                onClick={declineOrder}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
