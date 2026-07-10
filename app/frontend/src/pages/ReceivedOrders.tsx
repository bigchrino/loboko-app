import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

interface ServiceOrder {
  id: string;
  client_id: string;
  description: string;
  proposed_budget: number | null;
  status: string;
  payment_status: string;
  created_at: string;
  urgency_level?: string | null;
}

interface ClientProfile {
  user_id: string;
  username?: string;
  display_name?: string;
}

export default function ReceivedOrders() {
  const { user } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [orders, setOrders] = useState<ServiceOrder[]>([]);

  const [clients, setClients] = useState<
    Record<string, ClientProfile>
  >({});

  const [loading, setLoading] = useState(true);

  const statusFr: Record<string, string> = {
    requested: 'En attente',
    accepted: 'Acceptée',
    refused: 'Refusée',
    declined: 'Refusée',
    counter_price: 'Contre-proposition',
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
    const loadOrders = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('service_orders')
          .select('*')
          .eq('provider_id', user.id)
          .in('status', ['requested', 'accepted'])
          .order('created_at', {
            ascending: false,
          });

        if (error) throw error;

        const list =
          (data as ServiceOrder[]) || [];

        // Les commandes urgentes remontent tout en haut — tri stable, donc
        // l'ordre "plus récent d'abord" (déjà fait par la requête) est
        // conservé à l'intérieur de chaque groupe (urgentes / normales).
        list.sort(
          (a, b) =>
            (b.urgency_level === 'urgent' ? 1 : 0) -
            (a.urgency_level === 'urgent' ? 1 : 0),
        );

        setOrders(list);

        const clientIds = Array.from(
          new Set(
            list.map((o) => o.client_id)
          )
        );

        if (clientIds.length > 0) {
          const { data: profiles } =
            await supabase
              .from('profiles')
              .select(
                'user_id, username, display_name'
              )
              .in('user_id', clientIds);

          const map: Record<
            string,
            ClientProfile
          > = {};

          (
            (profiles as ClientProfile[]) || []
          ).forEach((p) => {
            map[p.user_id] = p;
          });

          setClients(map);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [user?.id, location.key]);

  return (
    <Layout title="Commandes reçues">
      <h1 className="text-2xl font-bold mb-4">
        Commandes reçues
      </h1>

      {loading ? (
        <div className="text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-6 text-center text-sm text-[var(--loboko-text-muted)]">
          Aucune commande reçue
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const client =
              clients[order.client_id];

            const clientName =
              client?.display_name ||
              client?.username ||
              'Client';

            return (
              <button
                key={order.id}
                onClick={() =>
                  navigate(
                    `/my-orders/${order.id}`
                  )
                }
                className={`w-full text-left bg-[var(--loboko-surface)] rounded-2xl p-4 hover:border-[#2563eb] transition ${
                  order.urgency_level === 'urgent'
                    ? 'border-2 border-red-500'
                    : 'border border-[var(--loboko-border)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold">
                      {clientName}
                    </span>
                    {order.urgency_level === 'urgent' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white">
                        🔴 URGENT
                      </span>
                    )}
                  </div>

                  <div className="text-xs px-2 py-1 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold flex-shrink-0">
                    {statusFr[order.status] || order.status}
                  </div>
                </div>

                <p className="text-sm mb-3 whitespace-pre-wrap">
                  {order.description}
                </p >

                <div className="flex items-center justify-between text-xs text-[var(--loboko-text-muted)]">
                  <span>
                    Budget :
                    {' '}
                    {order.proposed_budget ??
                      'Non défini'}
                  </span>

                  <span>
                    Paiement :
                    {' '}
                    {paymentFr[order.payment_status] || order.payment_status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
