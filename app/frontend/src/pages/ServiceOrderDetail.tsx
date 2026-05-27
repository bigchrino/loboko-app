import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ServiceOrder {
  id: string;
  client_id: string;
  provider_id: string;
  description: string;
  proposed_budget: number | null;

  status:
    | 'requested'
    | 'accepted'
    | 'completed'
    | 'cancelled'
    | 'disputed'
    | 'refused';

  payment_status:
    | 'pending'
    | 'paid'
    | 'failed'
    | 'refunded';

  decline_reason: string | null;
  decline_is_budget_related: boolean | null;
  provider_requested_budget: number | null;
  declined_at?: string | null;

  created_at: string;
}

export default function ServiceOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();

  const navigate = useNavigate();

  const { user } = useAuth();

  const [order, setOrder] =
    useState<ServiceOrder | null>(null);

  const [loading, setLoading] = useState(true);
  const [refusalReason, setRefusalReason] = useState('');

  const [isBudgetIssue, setIsBudgetIssue] =
    useState(false);
  
  const [requestedBudget, setRequestedBudget] =
    useState('');
  const statusFr: Record<string, string> = {
    requested: 'En attente',
    accepted: 'Acceptée',
    refused: 'Refusée',
    completed: 'Terminée',
    cancelled: 'Annulée',
    disputed: 'Litige',
  };
  
  const paymentFr: Record<string, string> = {
    pending: 'En attente',
    held: 'En sécurité',
    paid: 'Payé',
    failed: 'Échoué',
    refunded: 'Remboursé',
  };

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

        setOrder(data as ServiceOrder);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId]);

  if (loading) {
    return (
      <Layout title="Commande">
        <div className="text-sm">
          Chargement...
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout title="Commande">
        <div className="text-sm">
          Commande introuvable
        </div>
      </Layout>
    );
  }

  const isClient =
    user?.id === order.client_id;

  const isProvider =
    user?.id === order.provider_id;
  const confirmMissionCompleted = async () => {
    if (!order) return;
  
    try {
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          status: 'released',
          provider_confirmed: true,
          provider_confirmed_at: new Date().toISOString(),
          released_at: new Date().toISOString(),
        })
        .eq('id', order.payment_id);
  
      if (paymentError) throw paymentError;
  
      const { error: orderError } = await supabase
        .from('service_orders')
        .update({
          status: 'completed',
          payment_status: 'paid',
        })
        .eq('id', order.id);
  
      if (orderError) throw orderError;
  
      setOrder({
        ...order,
        status: 'completed',
        payment_status: 'paid',
      });
  
      toast.success('Mission confirmée');
    } catch (e: any) {
      console.error(e);
      toast.error(
        e?.message || 'Impossible de confirmer'
      );
    }
  };
  const acceptOrder = async () => {
    if (!order) return;
  
    try {
      const { error } = await supabase
        .from('service_orders')
        .update({
          status: 'accepted',
        })
        .eq('id', order.id);
  
      if (error) throw error;
  
      setOrder({
        ...order,
        status: 'accepted',
      });
  
      toast.success('Commande acceptée');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Action impossible');
    }
  };
  
  const refuseOrder = async () => {
    if (!order) return;
  
    if (!refusalReason.trim()) {
      toast.error('Ajoutez une raison');
      return;
    }
  
    if (isBudgetIssue && !requestedBudget.trim()) {
      toast.error('Ajoutez le budget demandé');
      return;
    }
  
    try {
      const { error } = await supabase
        .from('service_orders')
        .update({
          status: 'refused',
          decline_reason: refusalReason.trim(),
          decline_is_budget_related: isBudgetIssue,
          provider_requested_budget: isBudgetIssue
            ? Number(requestedBudget)
            : null,
          declined_at: new Date().toISOString(),
        })
        .eq('id', order.id);
  
      if (error) throw error;
  
      setOrder({
        ...order,
        status: 'refused',
        decline_reason: refusalReason.trim(),
        decline_is_budget_related: isBudgetIssue,
        provider_requested_budget: isBudgetIssue
          ? Number(requestedBudget)
          : null,
      });
  
      toast.success('Commande refusée');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Action impossible');
    }
  };

  const completeOrder = async () => {
    if (!order) return;
  
    try {
      const { error } = await supabase
        .from('service_orders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', order.id);
  
      if (error) throw error;
  
      await supabase.rpc('increment_completed_jobs', {
        provider_user_id: order.provider_id,
      });
  
      setOrder({
        ...order,
        status: 'completed',
      });
  
      toast.success('Mission terminée');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Action impossible');
    }
  };

  return (
    <Layout title="Commande">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm mb-4"
      >
        <ArrowLeft size={16} />
        Retour
      </button>

      <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 space-y-4">
        <div>
          <div className="text-xs text-[var(--loboko-text-muted)]">
            Statut
          </div>

          <div className="font-semibold">
            {statusFr[order.status] || order.status}
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--loboko-text-muted)]">
            Paiement
          </div>

          <div className="font-semibold">
            {paymentFr[order.payment_status] || order.payment_status}
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--loboko-text-muted)]">
            Description
          </div>

          <div className="whitespace-pre-wrap">
            {order.description}
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--loboko-text-muted)]">
            Budget proposé
          </div>

          <div>
            {order.proposed_budget ?? 'Non défini'}
          </div>
        </div>

        {order.decline_reason && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="font-semibold text-red-400 mb-2">
              Refus du prestataire
            </div>
        
            <div className="text-sm whitespace-pre-wrap">
              {order.decline_reason}
            </div>
        
            {order.decline_is_budget_related && (
              <div className="mt-3 text-sm">
                Budget minimum demandé :
                {' '}
                <span className="font-semibold">
                  {order.provider_requested_budget}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-[var(--loboko-text-muted)]">
          {isClient && 'Vous êtes le client'}
          {isProvider && 'Vous êtes le prestataire'}
        </div>
        {isProvider &&
          order.status === 'accepted' &&
          order.payment_status === 'held' && (
            <button
              onClick={confirmMissionCompleted}
              className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold"
            >
              Confirmer la mission terminée
            </button>
          )}
        {isClient &&
          order.status === 'accepted' &&
          order.payment_status === 'pending' && (
            <button
              onClick={() => navigate(`/payments/${order.id}`)}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold"
            >
              Payer le prestataire
            </button>
          )}
        {isClient && order.status === 'accepted' && (
          <button
            onClick={completeOrder}
            className="w-full py-3 rounded-xl bg-[#2563eb] text-white font-semibold"
          >
            Marquer la mission comme terminée
          </button>
        )}
        {isProvider && order.status === 'requested' && (
          <div className="space-y-4">
        
            <button
              onClick={acceptOrder}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold"
            >
              Accepter la commande
            </button>
        
            <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 space-y-3">
              <div className="font-semibold text-red-400">
                Refuser la commande
              </div>
        
              <textarea
                value={refusalReason}
                onChange={(e) =>
                  setRefusalReason(e.target.value)
                }
                placeholder="Expliquez pourquoi vous refusez..."
                className="w-full min-h-[120px] p-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] outline-none"
              />
        
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setIsBudgetIssue(true)
                  }
                  className={`px-4 py-2 rounded-xl border ${
                    isBudgetIssue
                      ? 'bg-[#2563eb] text-white border-[#2563eb]'
                      : 'border-[var(--loboko-border)]'
                  }`}
                >
                  Oui
                </button>
        
                <button
                  type="button"
                  onClick={() =>
                    setIsBudgetIssue(false)
                  }
                  className={`px-4 py-2 rounded-xl border ${
                    !isBudgetIssue
                      ? 'bg-[#2563eb] text-white border-[#2563eb]'
                      : 'border-[var(--loboko-border)]'
                  }`}
                >
                  Non
                </button>
        
                <span className="text-sm">
                  Problème de budget ?
                </span>
              </div>
        
              {isBudgetIssue && (
                <input
                  type="number"
                  value={requestedBudget}
                  onChange={(e) =>
                    setRequestedBudget(
                      e.target.value
                    )
                  }
                  placeholder="Budget minimum demandé"
                  className="w-full p-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] outline-none"
                />
              )}
        
              <button
                onClick={refuseOrder}
                className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold"
              >
                Refuser définitivement
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
