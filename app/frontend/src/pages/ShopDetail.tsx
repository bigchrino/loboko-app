import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchShopBySlug,
  fetchShopProducts,
  getShopColor,
  Shop,
  ShopProduct,
} from '@/lib/shops';
import { getMediaUrl } from '@/lib/storage-helpers';
import { fetchShopRatingSummary, RatingSummary } from '@/lib/shop-ratings';
import ShopRatingModal from '@/components/ShopRatingModal';
import { ArrowLeft, Store, Star, Package, Settings } from 'lucide-react';

interface ProductWithUrl extends ShopProduct {
  image_url?: string | null;
}

export default function ShopDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<ProductWithUrl[]>([]);
  const [rating, setRating] = useState<RatingSummary>({ average: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [showRating, setShowRating] = useState(false);

  const load = async () => {
    if (!slug) return;
    setLoading(true);
    const s = await fetchShopBySlug(slug);
    if (!s) {
      setLoading(false);
      return;
    }
    setShop(s);

    const [rows, summary] = await Promise.all([
      fetchShopProducts(s.id),
      fetchShopRatingSummary(s.id),
    ]);
    const enriched = await Promise.all(
      rows
        .filter((p) => p.is_active)
        .map(async (p) => ({
          ...p,
          image_url: p.image_key ? await getMediaUrl(p.image_key) : null,
        })),
    );
    setProducts(enriched);
    setRating(summary);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (loading) {
    return (
      <Layout title="Boutique">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      </Layout>
    );
  }

  if (!shop) {
    return (
      <Layout title="Boutique">
        <div className="p-4 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
          <div className="font-semibold mb-1">Boutique introuvable</div>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Cette boutique n'existe plus ou a été désactivée.
          </p>
        </div>
      </Layout>
    );
  }

  const color = getShopColor(shop.color_key);
  const isOwner = user?.id === shop.owner_id;

  return (
    <Layout title={shop.name}>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <div
        className="rounded-2xl p-5 mb-5 text-white"
        style={{ background: `linear-gradient(135deg, ${color.hex}, ${color.hex}cc)` }}
      >
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
          <Store size={26} />
        </div>
        <h1 className="text-xl font-bold mb-1">{shop.name}</h1>
        {shop.description && <p className="text-sm text-white/80 mb-2">{shop.description}</p>}

        <div className="flex items-center gap-3 flex-wrap">
          {rating.count > 0 ? (
            <div className="flex items-center gap-1 text-sm font-medium">
              <Star size={14} fill="#fff" color="#fff" />
              {rating.average.toFixed(1)} ({rating.count} avis)
            </div>
          ) : (
            <div className="text-sm text-white/70">Pas encore noté</div>
          )}

          {isOwner ? (
            <button
              onClick={() => navigate('/shop/manage')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-xs font-semibold"
            >
              <Settings size={12} /> Gérer ma boutique
            </button>
          ) : (
            user?.id && (
              <button
                onClick={() => setShowRating(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-xs font-semibold"
              >
                <Star size={12} /> Noter cette boutique
              </button>
            )
          )}
        </div>
      </div>

      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
        <Package size={18} /> Produits
      </h2>

      {products.length === 0 ? (
        <div className="text-center py-8 px-4 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Aucun produit publié pour l'instant.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {products.map((p) => {
            const outOfStock = p.stock_quantity <= 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/product/${p.id}`)}
                className={`text-left rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] overflow-hidden hover:border-[#2563eb] transition-colors ${
                  outOfStock ? 'opacity-60' : ''
                }`}
              >
                <div
                  className="relative w-full overflow-hidden bg-black/5"
                  style={{ paddingBottom: '100%' }}
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Package size={28} className="text-[var(--loboko-text-muted)]" />
                    </div>
                  )}
                  {outOfStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-xs font-bold px-2 py-1 rounded-full bg-red-600">
                        Produit épuisé
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="text-sm font-semibold truncate">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                      {p.description}
                    </div>
                  )}
                  <div className="text-sm font-bold mt-1" style={{ color: color.hex }}>
                    {p.price.toLocaleString('fr-FR')} $
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {user?.id && (
        <ShopRatingModal
          open={showRating}
          onClose={() => setShowRating(false)}
          fromUserId={user.id}
          shopId={shop.id}
          shopName={shop.name}
          onSubmitted={load}
        />
      )}
    </Layout>
  );
}
