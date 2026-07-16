import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Heart, Users, Briefcase, Image as ImageIcon, Package, Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  FavoriteRow,
  FavoriteType,
  listFavorites,
  removeFavorite,
} from '@/lib/marketplace';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import { getShopColor } from '@/lib/shops';
import {
  fetchActiveCategories,
  ServiceCategory,
} from '@/lib/service-categories';
import { toast } from 'sonner';

type Tab = FavoriteType;

interface ProviderFav {
  user_id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_key?: string | null;
  avatar_url?: string | null;
  metier?: string | null;
  city?: string | null;
}

interface WorkFav {
  id: string;
  title: string;
  media_key: string;
  media_type: 'image' | 'video';
  media_url?: string | null;
  user_id: string;
}

interface ProductFav {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  image_key: string | null;
  image_url?: string | null;
  shop_name: string;
  shop_color_key: string;
}

export default function Favorites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('provider');
  const [rows, setRows] = useState<FavoriteRow[]>([]);
  const [providers, setProviders] = useState<ProviderFav[]>([]);
  const [works, setWorks] = useState<WorkFav[]>([]);
  const [products, setProducts] = useState<ProductFav[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setProviders([]);
      setWorks([]);
      setProducts([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const favs = await listFavorites(user.id, tab);
      setRows(favs);

      const ids = favs.map((f) => f.target_id);

      if (ids.length === 0) {
        setProviders([]);
        setWorks([]);
        setProducts([]);
        setCategories([]);
        setLoading(false);
        return;
      }

      if (tab === 'provider') {
        const { data } = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_key, metier, city')
          .in('user_id', ids);

        const list = ((data as ProviderFav[]) || []).map(async (p) => ({
          ...p,
          avatar_url: p.avatar_key ? await getMediaUrl(p.avatar_key) : null,
        }));

        setProviders(await Promise.all(list));
        setWorks([]);
        setProducts([]);
        setCategories([]);
      }

      if (tab === 'work') {
        const { data } = await supabase
          .from('provider_works')
          .select('id, title, media_key, media_type, user_id')
          .in('id', ids);

        const list = ((data as WorkFav[]) || []).map(async (w) => ({
          ...w,
          media_url: w.media_key ? await getMediaUrl(w.media_key) : null,
        }));

        setWorks(await Promise.all(list));
        setProviders([]);
        setProducts([]);
        setCategories([]);
      }

      if (tab === 'product') {
        const { data } = await supabase
          .from('shop_products')
          .select('id, name, price, stock_quantity, image_key, shops!inner(name, color_key)')
          .in('id', ids);

        const list = ((data || []) as any[]).map(async (p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock_quantity: p.stock_quantity,
          image_key: p.image_key,
          image_url: p.image_key ? await getMediaUrl(p.image_key) : null,
          shop_name: p.shops?.name || '',
          shop_color_key: p.shops?.color_key || 'blue',
        }));

        setProducts(await Promise.all(list));
        setProviders([]);
        setWorks([]);
        setCategories([]);
      }

      if (tab === 'service') {
        const all = await fetchActiveCategories();
        setCategories(all.filter((c) => ids.includes(c.slug) || ids.includes(c.id)));
        setProviders([]);
        setWorks([]);
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = async (type: FavoriteType, targetId: string) => {
    if (!user) return;

    const ok = await removeFavorite(user.id, type, targetId);

    if (ok) {
      setRows((prev) => prev.filter((r) => r.target_id !== targetId));

      if (type === 'provider') {
        setProviders((prev) => prev.filter((p) => p.user_id !== targetId));
      }

      if (type === 'work') {
        setWorks((prev) => prev.filter((w) => w.id !== targetId));
      }

      if (type === 'product') {
        setProducts((prev) => prev.filter((p) => p.id !== targetId));
      }

      if (type === 'service') {
        setCategories((prev) =>
          prev.filter((c) => c.slug !== targetId && c.id !== targetId),
        );
      }

      toast.success('Retiré des favoris');
    }
  };

  const TabButton = ({
    id,
    label,
    icon: Icon,
  }: {
    id: Tab;
    label: string;
    icon: typeof Users;
  }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 inline-flex items-center justify-center gap-2 py-2 text-sm font-medium border-b-2 transition-colors ${
        tab === id
          ? 'border-[#2563eb] text-[#2563eb]'
          : 'border-transparent text-[var(--loboko-text-muted)]'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  const emptyText = useMemo(() => {
    if (tab === 'provider') return 'Aucun prestataire en favoris.';
    if (tab === 'work') return 'Aucune réalisation en favoris.';
    if (tab === 'product') return 'Aucun produit en favoris.';
    return 'Aucun service en favoris.';
  }, [tab]);

  if (!user) {
    return (
      <Layout title="Favoris">
        <div className="text-center py-16 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
          <Heart size={32} className="mx-auto mb-3 text-red-500" />
          <h1 className="text-xl font-bold mb-2">Connectez-vous</h1>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Vous devez être connecté pour voir vos favoris.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Favoris">
      <div className="mb-4">
        <h1 className="text-2xl font-bold inline-flex items-center gap-2">
          <Heart size={20} className="text-red-500" fill="#ef4444" /> Favoris
        </h1>
      </div>

      <div className="flex bg-[var(--loboko-surface)] rounded-xl border border-[var(--loboko-border)] overflow-hidden mb-4">
        <TabButton id="provider" label="Prestataires" icon={Users} />
        <TabButton id="service" label="Services" icon={Briefcase} />
        <TabButton id="work" label="Réalisations" icon={ImageIcon} />
        <TabButton id="product" label="Produits" icon={Package} />
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          {emptyText}
        </div>
      ) : tab === 'provider' ? (
        <div className="space-y-2">
          {providers.map((p) => (
            <button
              key={p.user_id}
              onClick={() => navigate(`/u/${p.user_id}`)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb]"
            >
              <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold shrink-0">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (p.display_name || p.username || '?').slice(0, 2).toUpperCase()
                )}
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className="font-medium truncate">{p.display_name || p.username}</div>
                <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                  {p.metier || p.city || `@${p.username}`}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove('provider', p.user_id);
                }}
                className="p-2 rounded-full hover:bg-[var(--loboko-hover)]"
                aria-label="Retirer"
              >
                <Heart size={16} fill="#ef4444" stroke="#ef4444" />
              </button>
            </button>
          ))}
        </div>
      ) : tab === 'work' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {works.map((w) => (
            <div
              key={w.id}
              className="relative rounded-xl overflow-hidden bg-[var(--loboko-surface)] border border-[var(--loboko-border)] w-full"
              style={{ paddingBottom: '100%' }}
            >
              <button
                onClick={() => navigate('/works')}
                className="absolute inset-0"
                aria-label="Voir les réalisations"
              >
                {w.media_type === 'video' ? (
                  <video
                    src={w.media_url || undefined}
                    preload="none"
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={w.media_url || undefined}
                    alt={w.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
              </button>

              <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
                <p className="text-xs text-white font-medium line-clamp-1">{w.title}</p>
              </div>

              <button
                onClick={() => handleRemove('work', w.id)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center"
                aria-label="Retirer"
              >
                <Heart size={14} fill="#ef4444" stroke="#ef4444" />
              </button>
            </div>
          ))}
        </div>
      ) : tab === 'product' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {products.map((p) => {
            const color = getShopColor(p.shop_color_key);
            const outOfStock = p.stock_quantity <= 0;
            return (
              <div
                key={p.id}
                className="relative rounded-xl overflow-hidden bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
              >
                <button
                  onClick={() => navigate(`/product/${p.id}`)}
                  className="block w-full text-left"
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
                        <Package size={24} className="text-[var(--loboko-text-muted)]" />
                      </div>
                    )}
                    {outOfStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold px-2 py-1 rounded-full bg-red-600">
                          Épuisé
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="text-sm font-bold" style={{ color: color.hex }}>
                      {p.price.toLocaleString('fr-FR')} $
                    </div>
                    <div className="text-xs font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-[var(--loboko-text-muted)] truncate flex items-center gap-1">
                      <Store size={9} /> {p.shop_name}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleRemove('product', p.id)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center"
                  aria-label="Retirer"
                >
                  <Heart size={13} fill="#ef4444" stroke="#ef4444" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/services/${c.slug}`)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb]"
            >
              <div className="w-10 h-10 rounded-lg bg-[#2563eb]/10 text-[#2563eb] flex items-center justify-center">
                <Briefcase size={18} />
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className="font-medium truncate">{c.name}</div>
                {c.description && (
                  <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                    {c.description}
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove('service', c.slug);
                }}
                className="p-2 rounded-full hover:bg-[var(--loboko-hover)]"
                aria-label="Retirer"
              >
                <Heart size={16} fill="#ef4444" stroke="#ef4444" />
              </button>
            </button>
          ))}
        </div>
      )}
    </Layout>
  );
}
