import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyProductOrders, cancelProductOrder, ProductOrder } from '@/lib/product-orders';
import { fetchProduct, ProductWithShop } from '@/lib/shops';
import { ArrowLeft, Package } from 'lucide-react';
import { toast } from 'sonner';

interface OrderWithProduct extends ProductOrder {
  product?: ProductWithShop | null;
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

export default function MyProductOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const rows = await fetchMyProductOrders(user.id);
    const enriched = await Promise.all(
      rows.map(async (o) => ({ ...o, product: await fetchProduct(o.product_id) })),
    );
    setOrders(enriched);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleCancel = async (order: OrderWithProduct) => {
    if (!confirm('Annuler cette commande ? Le stock sera remis à disposition.')) return;
    setCancellingId(order.id);
    const { data, error } = await cancelProductOrder(order.id);
    setCancellingId(null);
    if (!data) {
      toast.error(error || "Impossible d'annuler cette commande");
      return;
    }
    setOrders((cur) => cur.map((o) => (o.id === order.id ? { ...o, status: 'cancelled' } : o)));
    toast.success('Commande annulée, le stock a été restitué');
  };

  return (
    <Layout title="Mes commandes produits">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="text-2xl font-bold mb-4">Mes commandes produits</h1>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 px-4 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-3">
            <Package size={22} className="text-[#2563eb]" />
          </div>
          <p className="text-sm text-[var(--loboko-text-muted)]">Aucune commande pour l'instant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex gap-3 p-3 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
            >
              <button
                onClick={() => o.product && navigate(`/product/${o.product.id}`)}
                className="w-16 h-16 rounded-xl overflow-hidden bg-black/5 shrink-0"
              >
                {o.product?.image_url && (
                  <img
                    src={o.product.image_url}
                    alt={o.product.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => o.product && navigate(`/product/${o.product.id}`)}
                  className="text-sm font-semibold truncate text-left"
                >
                  {o.product?.name || 'Produit'}
                </button>
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
                    onClick={() => handleCancel(o)}
                    disabled={cancellingId === o.id}
                    className="mt-2 text-xs font-semibold text-red-500 hover:underline disabled:opacity-50"
                  >
                    {cancellingId === o.id ? 'Annulation…' : 'Annuler la commande'}
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
