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
import { supabase } from '@/lib/supabase';
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
  const [productRating, setProductRating] = useState(0);
  const [canRate, setCanRate] = useState(false);
  const [commentPhoto, setCommentPhoto] = useState<File | null>(null);
  const [commentPhotoPreview, setCommentPhotoPreview] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const [activeImage, setActiveImage] = useState(0);

  const handleGalleryScroll = () => {
    const el = galleryRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveImage(Math.round(el.scrollLeft / el.clientWidth));
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setProduct(null);
    setComments([]);
    setCommentsLoading(true);
    setCanRate(false);
    setQuantity(1);
    setActiveImage(0);
    void Promise.allSettled([
      (async () => {
        try {
          const item = await fetchProduct(id);
          if (!cancelled) setProduct(item);
        } finally { if (!cancelled) setLoading(false); }
      })(),
      (async () => {
        try {
          const list = await fetchProductComments(id);
          if (!cancelled) setComments(list);
        } finally { if (!cancelled) setCommentsLoading(false); }
      })(),
      (async () => {
        if (!user?.id) return;
        const { data, error } = await supabase.from('product_orders').select('id')
          .eq('product_id', id).eq('client_id', user.id).eq('status', 'completed')
          .limit(1).maybeSingle();
        if (!cancelled && !error) setCanRate(Boolean(data));
      })(),
    ]).then((results) => {
      if (!cancelled) results.forEach((result) => {
        if (result.status === 'rejected') console.error(result.reason);
      });
    });
    return () => { cancelled = true; };
  }, [id, user?.id]);

  useEffect(() => () => {
    if (commentPhotoPreview) URL.revokeObjectURL(commentPhotoPreview);
  }, [commentPhotoPreview]);

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
    if (!commentText.trim() && !productRating) {
      toast.error('Écrivez un commentaire ou choisissez une note');
      return;
    }
    if (productRating && !canRate) {
      toast.error('Une note est réservée aux clients ayant reçu leur commande');
      return;
    }
    setSubmittingComment(true);
    const { data, error } = await createProductComment({
      product_id: product.id,
      user_id: user.id,
      comment: commentText,
      rating: productRating || null,
      photoFile: commentPhoto,
    });
    setSubmittingComment(false);
    if (!data) {
      toast.error(error || 'Erreur lors de la publication');
      return;
    }
    setComments((cur) => [data, ...cur]);
    setCommentText('');
    setProductRating(0);
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
    toast.success('Commande créée. Retrouvez le paiement dans Mes commandes.');
    setProduct((cur) =>
      cur ? { ...cur, stock_quantity: Math.max(0, cur.stock_quantity - quantity) } : cur,
    );
    setQuantity(1);
    navigate('/my-product-orders');
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
  const ratedComments = comments.filter((comment) => comment.rating !== null && comment.rating !== undefined);
  const averageProductRating = ratedComments.length
    ? ratedComments.reduce((sum, comment) => sum + (comment.rating || 0), 0) / ratedComments.length
    : 0;

  return (
    <Layout title={product.name}>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      {/* 1. Photo(s) du produit */}
      <div
        className="relative w-full overflow-hidden bg-black/5 rounded-2xl mb-4"
        style={{ paddingBottom: '100%' }}
      >
        {(() => {
          const images = [
            product.image_url,
            ...(product.gallery?.map((g) => g.image_url) || []),
          ].filter((src): src is string => !!src);

          if (images.length === 0) {
            return (
              <div className="absolute inset-0 flex items-center justify-center">
                <Package size={40} className="text-[var(--loboko-text-muted)]" />
              </div>
            );
          }

          return (
            <>
              <div
                ref={galleryRef}
                onScroll={handleGalleryScroll}
                className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
              >
                {images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={product.name}
                    className="w-full h-full object-cover shrink-0 snap-center"
                  />
                ))}
              </div>
              {images.length > 1 && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-medium">
                  {activeImage + 1}/{images.length}
                </div>
              )}
            </>
          );
        })()}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
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
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => navigate(`/shop/${product.shop.slug}`)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-xs font-semibold"
        >
          <Store size={14} /> Voir la boutique
        </button>
        {user?.id && product.shop.owner_id !== user.id && (
          <button
            type="button"
            onClick={() => navigate(`/messages?to=${encodeURIComponent(product.shop.owner_id)}`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-xs font-semibold"
          >
            <MessageCircle size={14} /> Contacter le vendeur
          </button>
        )}
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
        <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">Avis ({comments.length})</h2>{ratedComments.length > 0 && <span className="text-sm text-amber-500" aria-label={`${averageProductRating.toFixed(1)} sur 5, ${ratedComments.length} notes`}>★ {averageProductRating.toFixed(1)} · {ratedComments.length} note{ratedComments.length > 1 ? 's' : ''}</span>}</div>

        {user?.id && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
            {canRate && <div className="mb-3"><p className="mb-1 text-xs text-[var(--loboko-text-muted)]">Votre note après réception</p><div className="flex gap-1" role="group" aria-label="Note du produit sur cinq étoiles">{[1,2,3,4,5].map((star) => <button key={star} type="button" onClick={() => setProductRating(star)} aria-label={`${star} étoile${star > 1 ? 's' : ''}`} aria-pressed={productRating === star} className="p-1 text-xl leading-none">{star <= productRating ? '★' : '☆'}</button>)}</div></div>}
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
                  {c.rating && <p className="mt-1 text-sm tracking-wide text-amber-500" aria-label={`${c.rating} sur 5 étoiles`}>{'★'.repeat(c.rating)}<span className="text-[var(--loboko-text-muted)]">{'☆'.repeat(5 - c.rating)}</span></p>}
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
