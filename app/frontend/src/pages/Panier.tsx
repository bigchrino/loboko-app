import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ShoppingCart, Store, Settings, Compass } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyShop, getShopColor, Shop } from '@/lib/shops';

export default function Panier() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loadingShop, setLoadingShop] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoadingShop(false);
      return;
    }
    (async () => {
      const s = await fetchMyShop(user.id);
      setShop(s);
      setLoadingShop(false);
    })();
  }, [user?.id]);

  const shopColor = shop ? getShopColor(shop.color_key) : null;

  return (
    <Layout title="Panier">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center">
            <ShoppingCart size={22} className="text-[#2563eb]" />
          </div>
          <h1 className="text-2xl font-bold">Panier</h1>
        </div>

        {/* Boutiques — Phase A/C : créer/gérer sa boutique, et découvrir
            celles des autres. */}
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
          </div>
        )}

        <p className="text-[var(--loboko-text-secondary)]">
          Achetez vos articles et gardez-les ici pour les payer plus tard.
        </p>

        <div className="bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl p-10 flex flex-col items-center text-center gap-3">
          <div className="text-5xl">🛒</div>
          <div className="font-semibold">Votre panier est vide</div>
          <div className="text-sm text-[var(--loboko-text-secondary)]">
            Explorez les offres pour ajouter des articles.
          </div>
        </div>
      </div>
    </Layout>
  );
}
