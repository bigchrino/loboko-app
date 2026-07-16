import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyShop, fetchProduct, ProductWithShop } from '@/lib/shops';
import {
  fetchShopProductOrders,
  completeProductOrder,
  ProductOrder,
} from '@/lib/product-orders';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Package, User } from 'lucide-react';
import { toast } from 'sonner';

interface ClientInfo {
  display_name?: string | null;
  username?: string | null;
}

interface OrderRow extends ProductOrder {
  product?: ProductWithShop | null;
  client?: ClientInfo | null;
}

const statusFr: Record<string, string> = {
  pending: 'En attente',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

const paymentFr: Record<string, string> = {
  pending: 'En attente',
  paid: 'Payé',
  refunded: 'Remboursé',
};

export default function ShopReceivedOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);

    const shop = await fetchMyShop(user.id);
    if (!shop) {
      toast.error("Vous n'avez pas encore de boutique");
      navigate('/panier', { replace: true });
      return;
    }

    const rows = await fetchShopProductOrders(shop.id);
    const clientIds = Array.from(new Set(rows.map((o) => o.client_id)));
    const { data: clients } = await supabase
      .from('profiles')
      .select('user_id, display_name, username')
      .in('user_id', clientIds.length > 0 ? clientIds : ['00000000-0000-0000-0000-000000000000']);
    const clientMap = new Map(((clients as any[]) || []).map((c) => [c.user_id, c]));

    const enriched = await Promise.all(
      rows.map(async (o) => ({
        ...o,
        product: await fetchProduct(o.product_id),
        client: clientMap.get(o.client_id) || null,
      })),
    );
    setOrders(enriched);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleComplete = async (order: OrderRow) => {
    setCompletingId(order.id);
    const { data, error } = await completeProductOrder(order.id);
    setCompletingId(null);
    if (!data) {
      toast.error(error || 'Action impossible');
      return;
    }
    setOrders((cur) => cur.map((o) => (o.id === order.id ? { ...o, status: 'completed' } : o)));
    toast.success('Commande marquée comme terminée');
  };

  return (
    <Layout title="Commandes reçues">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="text-2xl font-bold mb-4">Commandes reçues</h1>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 px-4 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-3">
            <Package size={22} className="text-[#2563eb]" />
          </div>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Aucune commande reçue pour l'instant.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex gap-3 p-3 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/5 shrink-0">
                {o.product?.image_url && (
                  <img
                    src={o.product.image_url}
                    alt={o.product.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{o.product?.name || 'Produit'}</div>
                <div className="text-xs text-[var(--loboko-text-muted)] flex items-center gap-1 mt-0.5">
                  <User size={11} />
                  {o.client?.display_name || o.client?.username || 'Client'}
                </div>
                <div className="text-xs text-[var(--loboko-text-muted)]">
                  Quantité : {o.quantity} · {o.total_price.toLocaleString('fr-FR')} $
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold">
                    {statusFr[o.status] || o.status}
                  </span>
                  <span className="text-[11px] text-[var(--loboko-text-muted)]">
                    Paiement : {paymentFr[o.payment_status] || o.payment_status}
                  </span>
                </div>
                {o.status === 'pending' && (
                  <button
                    onClick={() => handleComplete(o)}
                    disabled={completingId === o.id}
                    className="mt-2 px-3 py-1.5 rounded-full bg-green-600 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {completingId === o.id ? 'Enregistrement…' : 'Marquer comme terminée'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
