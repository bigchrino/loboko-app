import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ServiceOrder {
  id: string;
  description: string;
  proposed_budget: number | null;
  status: string;
  payment_status: string;
  created_at: string;
  provider_id: string;
}

interface ProviderProfile {
  user_id: string;
  username?: string;
  display_name?: string;
  metier?: string;
}

export default function MyOrders() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [providers, setProviders] = useState<
    Record<string, ProviderProfile>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrders = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('service_orders')
          .select('*')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const list = (data as ServiceOrder[]) || [];
        setOrders(list);

        const providerIds = Array.from(
          new Set(list.map((o) => o.provider_id))
        );

        if (providerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, metier')
            .in('user_id', providerIds);

          const map: Record<string, ProviderProfile> = {};

          ((profiles as ProviderProfile[]) || []).forEach((p) => {
            map[p.user_id] = p;
          });

          setProviders(map);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [user?.id]);

  return (
    <Layout title="Mes commandes">
      <h1 className="text-2xl font-bold mb-4">
        Mes commandes
      </h1>

      {loading ? (
        <div className="text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-6 text-center text-sm text-[var(--loboko-text-muted)]">
          Aucune commande
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const provider = providers[order.provider_id];

            const providerName =
              provider?.display_name ||
              provider?.username ||
              'Prestataire';

            return (
              <div
                key={order.id}
                className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <div className="font-semibold">
                      {providerName}
                    </div>

                    {provider?.metier && (
                      <div className="text-xs text-[var(--loboko-text-muted)]">
                        {provider.metier}
                      </div>
                    )}
                  </div>

                  <div className="text-xs px-2 py-1 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold">
                    {order.status}
                  </div>
                </div>

                <p className="text-sm mb-3 whitespace-pre-wrap">
                  {order.description}
                </p >

                <div className="flex items-center justify-between text-xs text-[var(--loboko-text-muted)]">
                  <span>
                    Budget :
                    {' '}
                    {order.proposed_budget ?? 'Non défini'}
                  </span>

                  <span>
                    Paiement :
                    {' '}
                    {order.payment_status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
