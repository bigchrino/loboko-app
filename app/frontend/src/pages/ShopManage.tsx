import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { isPremium } from '@/lib/subscription';
import {
  fetchMyShop,
  updateShop,
  SHOP_COLORS,
  Shop,
  ShopProduct,
  fetchShopProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductImage,
} from '@/lib/shops';
import { uploadMediaEx, getMediaUrl } from '@/lib/storage-helpers';
import {
  ArrowLeft,
  Store,
  Lock,
  Check,
  Package,
  Plus,
  Pencil,
  Trash2,
  ImagePlus,
  X,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProductWithUrl extends ShopProduct {
  image_url?: string | null;
}

export default function ShopManage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const userIsPremium = isPremium(profile);

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [colorKey, setColorKey] = useState('blue');
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<ProductWithUrl[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const loadProducts = async (shopId: string) => {
    setProductsLoading(true);
    const rows = await fetchShopProducts(shopId);
    const enriched = await Promise.all(
      rows.map(async (p) => ({
        ...p,
        image_url: p.image_key ? await getMediaUrl(p.image_key) : null,
      })),
    );
    setProducts(enriched);
    setProductsLoading(false);
  };

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const s = await fetchMyShop(user.id);
      if (!s) {
        toast.error("Vous n'avez pas encore de boutique");
        navigate('/panier', { replace: true });
        return;
      }
      setShop(s);
      setName(s.name);
      setColorKey(s.color_key);
      setLoading(false);
      loadProducts(s.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, navigate]);

  const handleSave = async () => {
    if (!shop) return;
    if (!name.trim()) {
      toast.error('Le nom ne peut pas être vide');
      return;
    }
    const chosen = SHOP_COLORS.find((c) => c.key === colorKey);
    if (chosen?.premium && !userIsPremium) {
      toast.error('Cette couleur est réservée aux comptes Premium');
      return;
    }

    setSaving(true);
    const { data, error } = await updateShop(shop.id, {
      name: name.trim(),
      color_key: colorKey,
    });
    setSaving(false);

    if (!data) {
      toast.error(error || 'Impossible d\u2019enregistrer');
      return;
    }
    setShop(data);
    toast.success('Boutique mise à jour');
  };

  // ---- Produits ----
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductWithUrl | null>(null);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (p: ProductWithUrl) => {
    setEditing(p);
    setShowForm(true);
  };

  const handleDelete = async (p: ProductWithUrl) => {
    if (!confirm(`Supprimer "${p.name}" ?`)) return;
    const ok = await deleteProduct(p.id);
    if (ok) {
      setProducts((cur) => cur.filter((x) => x.id !== p.id));
      toast.success('Produit supprimé');
    } else {
      toast.error('Suppression impossible');
    }
  };

  if (loading || !shop) {
    return (
      <Layout title="Ma boutique">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      </Layout>
    );
  }

  const activeColor = SHOP_COLORS.find((c) => c.key === colorKey);

  return (
    <Layout title="Ma boutique">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${activeColor?.hex}26` }}
        >
          <Store size={22} style={{ color: activeColor?.hex }} />
        </div>
        <h1 className="text-2xl font-bold">{shop.name}</h1>
      </div>

      <button
        onClick={() => navigate('/shop/orders')}
        className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm font-semibold"
      >
        <ClipboardList size={16} />
        Commandes reçues
      </button>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1.5">Nom de la boutique</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="w-full px-4 py-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Couleur de la boutique</label>
          <div className="grid grid-cols-5 gap-3">
            {SHOP_COLORS.map((c) => {
              const locked = c.premium && !userIsPremium;
              const selected = colorKey === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    if (locked) {
                      toast.error('Couleur réservée aux comptes Premium');
                      return;
                    }
                    setColorKey(c.key);
                  }}
                  title={locked ? `${c.label} (Premium)` : c.label}
                  className={`relative aspect-square rounded-2xl flex items-center justify-center transition ${
                    selected ? 'ring-2 ring-offset-2 ring-offset-[var(--loboko-bg)] ring-[var(--loboko-text)]' : ''
                  } ${locked ? 'opacity-50' : ''}`}
                  style={{ backgroundColor: c.hex }}
                >
                  {selected && !locked && <Check size={18} className="text-white drop-shadow" />}
                  {locked && <Lock size={16} className="text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>

        <div className="pt-4 border-t border-[var(--loboko-border)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Package size={18} /> Produits
            </h2>
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold"
              style={{ backgroundColor: activeColor?.hex }}
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>

          {productsLoading ? (
            <div className="text-center py-8 text-sm text-[var(--loboko-text-muted)]">
              Chargement…
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 px-4 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
              <p className="text-sm text-[var(--loboko-text-muted)]">
                Aucun produit pour l'instant. Touchez "Ajouter" pour publier votre
                premier produit.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {products.map((p) => {
                const outOfStock = p.stock_quantity <= 0;
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] overflow-hidden ${
                      outOfStock ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="relative w-full overflow-hidden bg-black/5" style={{ paddingBottom: '100%' }}>
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
                      <div className="absolute top-1.5 right-1.5 flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          className="w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="text-sm font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-[var(--loboko-text-muted)]">
                        {p.price.toLocaleString('fr-FR')} $
                      </div>
                      <div
                        className={`text-[11px] mt-0.5 font-medium ${
                          outOfStock ? 'text-red-500' : 'text-[var(--loboko-text-muted)]'
                        }`}
                      >
                        {outOfStock ? 'Épuisé' : `Stock : ${p.stock_quantity}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && shop && (
        <ProductFormDialog
          shopId={shop.id}
          product={editing}
          onClose={() => setShowForm(false)}
          onSaved={(p) => {
            setProducts((cur) => {
              const exists = cur.some((x) => x.id === p.id);
              return exists ? cur.map((x) => (x.id === p.id ? p : x)) : [p, ...cur];
            });
            setShowForm(false);
          }}
        />
      )}
    </Layout>
  );
}

interface ProductFormProps {
  shopId: string;
  product: ProductWithUrl | null;
  onClose: () => void;
  onSaved: (p: ProductWithUrl) => void;
}

function ProductFormDialog({ shopId, product, onClose, onSaved }: ProductFormProps) {
  const [name, setNameField] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [stock, setStock] = useState(product ? String(product.stock_quantity) : '0');
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image_url || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const pickExtraImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setExtraFiles((cur) => [...cur, ...files]);
    setExtraPreviews((cur) => [...cur, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removeExtraImage = (index: number) => {
    setExtraFiles((cur) => cur.filter((_, i) => i !== index));
    setExtraPreviews((cur) => cur.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Donnez un nom au produit');
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error('Prix invalide');
      return;
    }
    const stockNum = Number(stock);
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      toast.error('Stock invalide (nombre entier positif)');
      return;
    }

    setSubmitting(true);

    let image_key = product?.image_key || null;
    if (imageFile) {
      const { key, error } = await uploadMediaEx(imageFile, 'posts');
      if (error || !key) {
        toast.error(error || "Échec de l'envoi de l'image");
        setSubmitting(false);
        return;
      }
      image_key = key;
    }

    // Photos supplémentaires (galerie) — envoyées une par une, dans l'ordre
    // où elles ont été ajoutées.
    const uploadExtraImages = async (productId: string) => {
      for (let i = 0; i < extraFiles.length; i += 1) {
        const { key, error } = await uploadMediaEx(extraFiles[i], 'posts');
        if (error || !key) {
          toast.error(`Une photo n'a pas pu être envoyée (${error || 'erreur'})`);
          continue;
        }
        await addProductImage(productId, key, i);
      }
    };

    if (product) {
      const { data, error } = await updateProduct(product.id, {
        name: name.trim(),
        description: description.trim() || null,
        price: priceNum,
        stock_quantity: stockNum,
        image_key,
      });
      if (!data) {
        setSubmitting(false);
        toast.error(error || 'Erreur lors de la mise à jour');
        return;
      }
      await uploadExtraImages(product.id);
      setSubmitting(false);
      toast.success('Produit mis à jour');
      onSaved({ ...data, image_url: imagePreview });
    } else {
      const { data, error } = await createProduct({
        shop_id: shopId,
        name: name.trim(),
        description: description.trim() || null,
        price: priceNum,
        stock_quantity: stockNum,
        image_key,
      });
      if (!data) {
        setSubmitting(false);
        toast.error(error || 'Erreur lors de la création');
        return;
      }
      await uploadExtraImages(data.id);
      setSubmitting(false);
      toast.success('Produit ajouté');
      onSaved({ ...data, image_url: imagePreview });
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-[var(--loboko-surface)] sm:rounded-2xl rounded-t-2xl border border-[var(--loboko-border)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--loboko-border)]">
          <h3 className="font-semibold text-sm">
            {product ? 'Modifier le produit' : 'Ajouter un produit'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-video rounded-xl border border-dashed border-[var(--loboko-border)] bg-[var(--loboko-elevated)] flex items-center justify-center overflow-hidden"
          >
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-[var(--loboko-text-muted)]">
                <ImagePlus size={22} />
                <span className="text-xs">Ajouter une photo</span>
              </div>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />

          <div>
            <button
              type="button"
              onClick={() => extraFileRef.current?.click()}
              className="text-xs font-semibold text-[#2563eb] flex items-center gap-1.5"
            >
              <ImagePlus size={14} /> Ajouter des photos supplémentaires
            </button>
            <input
              ref={extraFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={pickExtraImages}
            />
            {extraPreviews.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {extraPreviews.map((src, i) => (
                  <div key={i} className="relative w-14 h-14">
                    <img src={src} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => removeExtraImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Nom du produit</label>
            <input
              value={name}
              onChange={(e) => setNameField(e.target.value)}
              maxLength={80}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Description (optionnel)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Prix ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Stock disponible</label>
              <input
                type="number"
                min={0}
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
              />
            </div>
          </div>
          <p className="text-[11px] text-[var(--loboko-text-muted)] -mt-2">
            Mettez à jour ce nombre à tout moment (ex : après une vente réalisée
            en dehors de LOBOKO). À 0, le produit s'affiche comme épuisé.
          </p>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : product ? 'Enregistrer' : 'Ajouter le produit'}
          </button>
        </div>
      </div>
    </div>
  );
}
