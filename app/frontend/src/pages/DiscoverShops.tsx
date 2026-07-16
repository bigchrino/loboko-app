import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ArrowLeft, Search, Store, Star, Package } from 'lucide-react';
import {
  fetchActiveShops,
  searchProducts,
  getShopColor,
  Shop,
  ProductWithShop,
} from '@/lib/shops';
import { fetchShopRatingSummary, RatingSummary } from '@/lib/shop-ratings';

interface ShopCardState extends Shop {
  rating?: RatingSummary;
}

export default function DiscoverShops() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [shops, setShops] = useState<ShopCardState[]>([]);
  const [products, setProducts] = useState<ProductWithShop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (debouncedQuery) {
          // Une recherche : on affiche directement les PRODUITS
          // correspondants (façon Pinduoduo), tous vendeurs confondus.
          const rows = await searchProducts(debouncedQuery);
          if (!cancelled) setProducts(rows);
        } else {
          // Pas de recherche : on affiche la liste des boutiques à parcourir.
          const rows = await fetchActiveShops();
          const enriched = await Promise.all(
            rows.map(async (s) => ({ ...s, rating: await fetchShopRatingSummary(s.id) })),
          );
          if (!cancelled) setShops(enriched);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return (
    <Layout title="Boutiques">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <h1 className="text-2xl font-bold mb-1">Boutiques</h1>
      <p className="text-sm text-[var(--loboko-text-secondary)] mb-4">
        Découvrez les boutiques LOBOKO, ou cherchez directement un produit.
      </p>

      <div className="relative mb-5">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un produit…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
        />
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      ) : debouncedQuery ? (
        // ---- Résultats produits (recherche active) ----
        products.length === 0 ? (
          <div className="text-center py-12 px-4 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-3">
              <Package size={22} className="text-[#2563eb]" />
            </div>
            <h3 className="font-semibold mb-1">Aucun produit trouvé</h3>
            <p className="text-sm text-[var(--loboko-text-muted)]">Essayez un autre mot-clé.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((p) => {
              const color = getShopColor(p.shop.color_key);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/product/${p.id}`)}
                  className="text-left rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb] transition-colors overflow-hidden"
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
                        <Package size={26} className="text-[var(--loboko-text-muted)]" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="text-sm font-bold" style={{ color: color.hex }}>
                      {p.price.toLocaleString('fr-FR')} $
                    </div>
                    <div className="text-xs font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-[var(--loboko-text-muted)] truncate flex items-center gap-1 mt-0.5">
                      <Store size={10} /> {p.shop.name}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : // ---- Liste des boutiques (pas de recherche) ----
      shops.length === 0 ? (
        <div className="text-center py-12 px-4 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-3">
            <Store size={22} className="text-[#2563eb]" />
          </div>
          <h3 className="font-semibold mb-1">Aucune boutique trouvée</h3>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Aucune boutique n'a encore été créée.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {shops.map((s) => {
            const color = getShopColor(s.color_key);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/shop/${s.slug}`)}
                className="text-left p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb] transition-colors"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${color.hex}26` }}
                >
                  <Store size={20} style={{ color: color.hex }} />
                </div>
                <div className="text-sm font-semibold truncate mb-1">{s.name}</div>
                {s.rating && s.rating.count > 0 ? (
                  <div className="flex items-center gap-1 text-xs text-[var(--loboko-text-muted)]">
                    <Star size={12} fill="#f59e0b" color="#f59e0b" />
                    {s.rating.average.toFixed(1)} ({s.rating.count})
                  </div>
                ) : (
                  <div className="text-xs text-[var(--loboko-text-muted)]">Pas encore noté</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
