import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProduct, getShopColor, ProductWithShop } from '@/lib/shops';
import { addToCart } from '@/lib/cart';
import { placeProductOrder } from '@/lib/product-orders';
import {
  fetchProductComments,
  createProductComment,
  ProductCommentWithAuthor,
} from '@/lib/product-comments';
import FavoriteButton from '@/components/FavoriteButton';
import {
  ArrowLeft,
  Store,
  MessageCircle,
  ShoppingCart,
  Zap,
  Package,
  ImagePlus,
  Send,
  X,
  Minus,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState<ProductWithShop | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [comments, setComments] = useState<ProductCommentWithAuthor[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);

  const [commentText, setCommentText] = useState('');
  const [commentPhoto, setCommentPhoto] = useState<File | null>(null);
  const [commentPhotoPreview, setCommentPhotoPreview] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const p = await fetchProduct(id);
    setProduct(p);
    setQuantity(1);
    setLoading(false);

    setCommentsLoading(true);
    const list = await fetchProductComments(id);
    setComments(list);
    setCommentsLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const scrollToComments = () => {
    commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    commentInputRef.current?.focus();
  };

  const pickCommentPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCommentPhoto(file);
    setCommentPhotoPreview(URL.createObjectURL(file));
  };

  const submitComment = async () => {
    if (!user?.id || !product) return;
    if (!commentText.trim()) {
      toast.error('Écrivez un commentaire');
      return;
    }
    setSubmittingComment(true);
    const { data, error } = await createProductComment({
      product_id: product.id,
      user_id: user.id,
      comment: commentText,
      photoFile: commentPhoto,
    });
    setSubmittingComment(false);
    if (!data) {
      toast.error(error || 'Erreur lors de la publication');
      return;
    }
    setComments((cur) => [data, ...cur]);
    setCommentText('');
    setCommentPhoto(null);
    setCommentPhotoPreview(null);
    toast.success('Avis publié');
  };

  const handleAddToCart = async () => {
    if (!user?.id || !product) return;
    setAddingToCart(true);
    const { error } = await addToCart(user.id, product.id, quantity);
    setAddingToCart(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Ajouté au panier');
  };

  const handleOrderNow = async () => {
    if (!user?.id || !product) return;
    setOrdering(true);
    const { data, error } = await placeProductOrder(user.id, product.id, quantity);
    setOrdering(false);
    if (!data) {
      toast.error(error || 'Commande impossible');
      return;
    }
    toast.success('Commande envoyée — le vendeur va la préparer.');
    setProduct((cur) =>
      cur ? { ...cur, stock_quantity: Math.max(0, cur.stock_quantity - quantity) } : cur,
    );
    setQuantity(1);
  };

  if (loading) {
    return (
      <Layout title="Produit">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout title="Produit">
        <div className="p-4 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
          <div className="font-semibold mb-1">Produit introuvable</div>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Ce produit n'existe plus ou a été retiré.
          </p>
        </div>
      </Layout>
    );
  }

  const color = getShopColor(product.shop.color_key);
  const outOfStock = product.stock_quantity <= 0;

  return (
    <Layout title={product.name}>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      {/* 1. Photo du produit */}
      <div
        className="relative w-full overflow-hidden bg-black/5 rounded-2xl mb-4"
        style={{ paddingBottom: '100%' }}
      >
        {product.image_key ? (
          <img
            src={product.image_url || undefined}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package size={40} className="text-[var(--loboko-text-muted)]" />
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-sm font-bold px-3 py-1.5 rounded-full bg-red-600">
              Produit épuisé
            </span>
          </div>
        )}
      </div>

      {/* 2. Prix, nom, description */}
      <div className="mb-5">
        <div className="text-2xl font-bold mb-1" style={{ color: color.hex }}>
          {product.price.toLocaleString('fr-FR')} $
        </div>
        <h1 className="text-lg font-semibold mb-1">{product.name}</h1>
        {product.description && (
          <p className="text-sm text-[var(--loboko-text-secondary)] leading-relaxed">
            {product.description}
          </p>
        )}
        <p className="text-xs text-[var(--loboko-text-muted)] mt-1">
          {outOfStock ? 'Épuisé' : `${product.stock_quantity} en stock`}
        </p>

        {!outOfStock && (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs font-medium text-[var(--loboko-text-secondary)]">
              Quantité
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] flex items-center justify-center"
              >
                <Minus size={14} />
              </button>
              <span className="text-sm font-semibold w-6 text-center">{quantity}</span>
              <button
                type="button"
                onClick={() =>
                  setQuantity((q) => Math.min(product.stock_quantity, q + 1))
                }
                className="w-8 h-8 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] flex items-center justify-center"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Voir la boutique / Favoris / Commenter */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => navigate(`/shop/${product.shop.slug}`)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-xs font-semibold"
        >
          <Store size={14} /> Voir la boutique
        </button>
        {user?.id && (
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)]">
            <FavoriteButton type="product" targetId={product.id} ghost ariaLabel="Ajouter aux favoris" />
          </div>
        )}
        <button
          onClick={scrollToComments}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-xs font-semibold"
        >
          <MessageCircle size={14} /> Commenter
        </button>
      </div>

      {/* 5. Mettre au panier / Commander maintenant */}
      <div className="flex items-center gap-2 mb-8">
        <button
          onClick={handleAddToCart}
          disabled={outOfStock || addingToCart}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] font-semibold text-sm disabled:opacity-50"
        >
          <ShoppingCart size={16} />
          {addingToCart ? 'Ajout…' : 'Mettre au panier'}
        </button>
        <button
          onClick={handleOrderNow}
          disabled={outOfStock || ordering}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
          style={{ backgroundColor: color.hex }}
        >
          <Zap size={16} />
          {ordering ? 'Envoi…' : 'Commander maintenant'}
        </button>
      </div>

      {/* 3. Commentaires */}
      <div>
        <h2 className="text-lg font-bold mb-3">Avis ({comments.length})</h2>

        {user?.id && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
            <textarea
              ref={commentInputRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={2}
              placeholder="Donnez votre avis sur ce produit…"
              className="w-full bg-transparent text-sm focus:outline-none resize-none"
            />
            {commentPhotoPreview && (
              <div className="relative w-20 h-20 mt-2">
                <img src={commentPhotoPreview} alt="" className="w-full h-full object-cover rounded-lg" />
                <button
                  onClick={() => {
                    setCommentPhoto(null);
                    setCommentPhotoPreview(null);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => photoInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)]"
              >
                <ImagePlus size={16} /> Ajouter une photo
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={pickCommentPhoto}
              />
              <button
                onClick={submitComment}
                disabled={submittingComment}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold disabled:opacity-50"
                style={{ backgroundColor: color.hex }}
              >
                <Send size={12} /> {submittingComment ? 'Envoi…' : 'Publier'}
              </button>
            </div>
          </div>
        )}

        {commentsLoading ? (
          <div className="text-center py-6 text-sm text-[var(--loboko-text-muted)]">
            Chargement…
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 text-sm text-[var(--loboko-text-muted)]">
            Aucun avis pour l'instant. Soyez le premier !
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((c) => {
              const name = c.author?.display_name || c.author?.username || 'Utilisateur';
              return (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {c.author?.avatar_url ? (
                        <img src={c.author.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="text-sm font-semibold">{name}</span>
                  </div>
                  <p className="text-sm text-[var(--loboko-text-secondary)] whitespace-pre-wrap">
                    {c.comment}
                  </p>
                  {c.photo_url && (
                    <img
                      src={c.photo_url}
                      alt=""
                      className="mt-2 max-w-[160px] rounded-lg border border-[var(--loboko-border)]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
