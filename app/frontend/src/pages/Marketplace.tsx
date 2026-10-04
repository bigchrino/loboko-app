import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { fetchLatestProducts, fetchMyShop, getShopColor, ProductWithShop, Shop } from '@/lib/shops';
import { ArrowRight, ClipboardList, Heart, Package, Search, ShoppingBag, ShoppingCart, Store } from 'lucide-react';

function MarketplaceAction({ title, description, icon: Icon, onClick, accent = false }: {
  title: string; description: string; icon: typeof Store; onClick: () => void; accent?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-24 items-center gap-3 rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] p-4 text-left transition hover:border-[#2563eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb]">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-[#2563eb]/15 text-[#2563eb]' : 'bg-[var(--loboko-elevated)] text-[var(--loboko-text-secondary)]'}`}><Icon size={21} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="mt-1 block text-xs leading-relaxed text-[var(--loboko-text-muted)]">{description}</span></span>
      <ArrowRight size={16} className="shrink-0 text-[var(--loboko-text-muted)]" aria-hidden="true" />
    </button>
  );
}

export default function Marketplace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<ProductWithShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      user?.id ? fetchMyShop(user.id) : Promise.resolve(null),
      fetchLatestProducts(8),
    ]).then(([myShop, latest]) => {
      if (cancelled) return;
      setShop(myShop);
      setProducts(latest);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(query.trim() ? `/shops?query=${encodeURIComponent(query.trim())}` : '/shops');
  };

  return (
    <Layout title="Marketplace">
      <div className="space-y-6">
        <section className="rounded-3xl border border-[var(--loboko-border)] bg-gradient-to-br from-[#102454] via-[#101827] to-[var(--loboko-surface)] p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">LOBOKO · Boutiques & produits</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Achetez auprès des boutiques LOBOKO</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--loboko-text-secondary)]">Découvrez des produits, contactez les vendeurs et retrouvez vos commandes au même endroit.</p>
          <form onSubmit={submitSearch} className="mt-5 flex gap-2 rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-bg)] p-1.5">
            <Search size={20} className="ml-2 mt-2.5 shrink-0 text-[var(--loboko-text-muted)]" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Rechercher un produit" placeholder="Rechercher un produit ou une boutique" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base outline-none" />
            <button className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white">Chercher</button>
          </form>
        </section>

        <section aria-label="Raccourcis Marketplace" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MarketplaceAction title="Explorer les boutiques" description="Parcourir les boutiques et chercher un article précis." icon={Store} accent onClick={() => navigate('/shops')} />
          <MarketplaceAction title="Mon panier" description="Vérifier les articles ajoutés et envoyer une commande." icon={ShoppingCart} onClick={() => navigate('/cart')} />
          <MarketplaceAction title="Mes commandes" description="Suivre les demandes envoyées aux vendeurs." icon={ClipboardList} onClick={() => navigate('/my-product-orders')} />
          <MarketplaceAction title="Mes favoris" description="Retrouver les produits et services enregistrés." icon={Heart} onClick={() => navigate('/favorites')} />
          <MarketplaceAction title={shop ? 'Gérer ma boutique' : 'Ouvrir une boutique'} description={shop ? 'Modifier le catalogue et les informations de votre boutique.' : 'Créer votre espace vendeur sur LOBOKO.'} icon={shop ? ShoppingBag : Store} onClick={() => navigate(shop ? '/shop/manage' : '/shop/create')} />
          {shop && <MarketplaceAction title="Commandes reçues" description="Consulter les commandes passées dans votre boutique." icon={Package} onClick={() => navigate('/shop/orders')} />}
        </section>

        <section aria-labelledby="marketplace-new-title">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div><h2 id="marketplace-new-title" className="text-xl font-bold">Nouveautés</h2><p className="mt-1 text-sm text-[var(--loboko-text-muted)]">Produits récemment ajoutés au catalogue</p></div>
            <button type="button" onClick={() => navigate('/shops')} className="shrink-0 text-sm font-semibold text-[#2563eb]">Tout voir</button>
          </div>
          {loading ? <div role="status" className="py-8 text-center text-sm text-[var(--loboko-text-muted)]">Chargement des produits…</div> : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--loboko-border)] p-8 text-center"><Package size={28} className="mx-auto mb-2 text-[var(--loboko-text-muted)]" /><p className="font-medium">Aucun produit disponible pour le moment</p><p className="mt-1 text-sm text-[var(--loboko-text-muted)]">Les nouvelles offres des boutiques apparaîtront ici.</p></div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => {
                const color = getShopColor(product.shop.color_key);
                return <button key={product.id} type="button" onClick={() => navigate(`/product/${product.id}`)} className="overflow-hidden rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] text-left transition hover:border-[#2563eb]">
                  <div className="relative aspect-square bg-[var(--loboko-elevated)]">{product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover" /> : <Package size={30} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]" />}</div>
                  <div className="p-3"><p className="truncate text-sm font-semibold">{product.name}</p><p className="mt-1 text-sm font-bold" style={{ color: color.hex }}>{Number(product.price).toLocaleString('fr-FR')} $</p><p className="mt-1 truncate text-xs text-[var(--loboko-text-muted)]">{product.shop.name}</p></div>
                </button>;
              })}
            </div>
          )}
        </section>
        <p className="rounded-xl bg-[var(--loboko-surface)] px-4 py-3 text-xs leading-relaxed text-[var(--loboko-text-muted)]">Retrouvez le paiement Mobile Money et le suivi de vos livraisons dans Mes commandes. Le paiement nécessite l’activation du compte marchand LOBOKO. Les étapes de livraison sont mises à jour par le vendeur.</p>
      </div>
    </Layout>
  );
}
