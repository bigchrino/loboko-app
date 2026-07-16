import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ShoppingCart, Store, Settings, Compass, Minus, Plus, Trash2, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyShop, getShopColor, Shop } from '@/lib/shops';
import {
  fetchCart,
  updateCartQuantity,
  removeFromCart,
  CartItemWithProduct,
} from '@/lib/cart';
import { placeProductOrder } from '@/lib/product-orders';
import { toast } from 'sonner';

export default function Panier() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loadingShop, setLoadingShop] = useState(true);

  const [cart, setCart] = useState<CartItemWithProduct[]>([]);
  const [cartLoading, setCartLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);

  const loadCart = async () => {
    if (!user?.id) return;
    setCartLoading(true);
    const rows = await fetchCart(user.id);
    setCart(rows);
    setCartLoading(false);
  };

  useEffect(() => {
    if (!user?.id) {
      setLoadingShop(false);
      setCartLoading(false);
      return;
    }
    (async () => {
      const s = await fetchMyShop(user.id);
      setShop(s);
      setLoadingShop(false);
    })();
    loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const shopColor = shop ? getShopColor(shop.color_key) : null;

  const changeQuantity = async (item: CartItemWithProduct, delta: number) => {
    const next = item.quantity + delta;
    setCart((cur) =>
      next <= 0
        ? cur.filter((x) => x.id !== item.id)
        : cur.map((x) => (x.id === item.id ? { ...x, quantity: next } : x)),
    );
    await updateCartQuantity(item.id, next);
  };

  const remove = async (item: CartItemWithProduct) => {
    setCart((cur) => cur.filter((x) => x.id !== item.id));
    await removeFromCart(item.id);
  };

  const total = cart.reduce((sum, c) => sum + c.product.price * c.quantity, 0);

  const orderItem = async (item: CartItemWithProduct) => {
    if (!user?.id) return;
    const { data, error } = await placeProductOrder(user.id, item.product_id, item.quantity);
    if (!data) {
      toast.error(error || 'Commande impossible');
      return;
    }
    await removeFromCart(item.id);
    setCart((cur) => cur.filter((x) => x.id !== item.id));
    toast.success(`Commande envoyée pour "${item.product.name}"`);
  };

  const orderAll = async () => {
    if (!user?.id || cart.length === 0) return;
    setOrdering(true);
    let successCount = 0;
    for (const item of cart) {
      const { data } = await placeProductOrder(user.id, item.product_id, item.quantity);
      if (data) {
        await removeFromCart(item.id);
        successCount += 1;
      }
    }
    setOrdering(false);
    await loadCart();
    if (successCount > 0) {
      toast.success(`${successCount} commande${successCount > 1 ? 's' : ''} envoyée${successCount > 1 ? 's' : ''}`);
    } else {
      toast.error('Aucune commande n\u2019a pu être envoyée (stock épuisé ?)');
    }
  };

  return (
    <Layout title="Panier">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center">
            <ShoppingCart size={22} className="text-[#2563eb]" />
          </div>
          <h1 className="text-2xl font-bold">Panier</h1>
        </div>

        {!loadingShop && (
          <div className="flex flex-wrap gap-2">
            {shop ? (
              <button
                onClick={() => navigate('/shop/manage')}
                className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm text-white"
                style={{ backgroundColor: shopColor?.hex }}
              >
                <Settings size={16} />
                Gérer ma boutique
              </button>
            ) : (
              <button
                onClick={() => navigate('/shop/create')}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm"
              >
                <Store size={16} />
                Créer sa boutique
              </button>
            )}
            <button
              onClick={() => navigate('/shops')}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] font-semibold text-sm"
            >
              <Compass size={16} />
              Voir des boutiques
            </button>
            <button
              onClick={() => navigate('/my-product-orders')}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] font-semibold text-sm"
            >
              <Package size={16} />
              Mes commandes
            </button>
          </div>
        )}

        <p className="text-[var(--loboko-text-secondary)]">
          Achetez vos articles et gardez-les ici pour les payer plus tard.
        </p>

        {cartLoading ? (
          <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
            Chargement…
          </div>
        ) : cart.length === 0 ? (
          <div className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-10 flex flex-col items-center text-center gap-3">
            <div className="text-5xl">🛒</div>
            <div className="font-semibold">Votre panier est vide</div>
            <div className="text-sm text-[var(--loboko-text-secondary)]">
              Explorez les boutiques pour ajouter des articles.
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {cart.map((item) => {
                const unavailable = !item.product.is_active || item.product.stock_quantity <= 0;
                return (
                  <div
                    key={item.id}
                    className="flex gap-3 p-3 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
                  >
                    <button
                      onClick={() => navigate(`/product/${item.product_id}`)}
                      className="w-16 h-16 rounded-xl overflow-hidden bg-black/5 shrink-0"
                    >
                      {item.product.image_url && (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => navigate(`/product/${item.product_id}`)}
                        className="text-left"
                      >
                        <div className="text-sm font-semibold truncate">{item.product.name}</div>
                        <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                          {item.shop.name}
                        </div>
                      </button>
                      <div className="text-sm font-bold text-[#2563eb] mt-0.5">
                        {item.product.price.toLocaleString('fr-FR')} $
                      </div>
                      {unavailable && (
                        <div className="text-[11px] text-red-500 font-medium mt-0.5">
                          Produit épuisé
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => changeQuantity(item, -1)}
                            className="w-7 h-7 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] flex items-center justify-center"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-sm font-semibold w-5 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => changeQuantity(item, 1)}
                            className="w-7 h-7 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] flex items-center justify-center"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => remove(item)}
                            className="w-7 h-7 rounded-full text-red-500 flex items-center justify-center"
                            aria-label="Retirer"
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            onClick={() => orderItem(item)}
                            disabled={unavailable}
                            className="px-3 py-1.5 rounded-full bg-[#2563eb] text-white text-xs font-semibold disabled:opacity-50"
                          >
                            Commander
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] flex items-center justify-between">
              <div>
                <div className="text-xs text-[var(--loboko-text-muted)]">Total</div>
                <div className="text-xl font-bold">{total.toLocaleString('fr-FR')} $</div>
              </div>
              <button
                onClick={orderAll}
                disabled={ordering}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50"
              >
                {ordering ? 'Envoi…' : 'Commander tout'}
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
