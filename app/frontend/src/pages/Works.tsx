import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import LazyMedia from '@/components/LazyMedia';
import FavoriteButton from '@/components/FavoriteButton';
import { Plus, Image as ImageIcon, Video as VideoIcon, X, Loader2, MapPin, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  createWork,
  deleteWork,
  fetchWorks,
  MARKETPLACE_PAGE_SIZE,
  ProviderWork,
} from '@/lib/marketplace';
import {
  fetchActiveCategories,
  ServiceCategory,
} from '@/lib/service-categories';
import { getMediaUrl, uploadMediaEx } from '@/lib/storage-helpers';
import { toast } from 'sonner';

/**
 * Works — "Réalisations" feed.
 *
 * - Paginated (20 items / load), infinite scroll via IntersectionObserver.
 * - Media rendered inside <LazyMedia> so off-screen images/videos skip
 *   network work entirely. Videos are never autoplayed.
 * - "Publier" dialog is only available for prestataires.
 */

interface WorkCardState extends ProviderWork {
  media_url?: string | null;
  author?: {
    display_name?: string | null;
    username?: string | null;
    avatar_key?: string | null;
    avatar_url?: string | null;
  } | null;
}

export default function Works() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<WorkCardState[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const isProvider = profile?.role === 'prestataire';

  // Arrivée depuis le bouton "Publier une réalisation" du profil
  // (/works?publish=1) : ouvre directement le formulaire, puis nettoie
  // l'URL pour que ça ne se rouvre pas si on revient sur cette page plus
  // tard (ex: bouton retour).
  useEffect(() => {
    if (searchParams.get('publish') === '1') {
      setShowCreate(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('publish');
        return next;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Petite temporisation pour ne pas relancer une recherche à chaque
  // frappe — 300ms sans nouvelle touche avant d'interroger le serveur.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    fetchActiveCategories().then(setCategories);
  }, []);

  // Catégories dont le nom correspond à la recherche — permet de retrouver
  // rapidement une catégorie précise parmi beaucoup, plutôt que de tout
  // faire défiler à l'horizontale.
  const filteredCategories = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, debouncedQuery]);

  const load = useCallback(
    async (p: number, replace: boolean) => {
      if (p === 0) setLoading(true);
      else setLoadingMore(true);
      try {
        const rows = await fetchWorks(p, {
          categoryId: categoryId || undefined,
          query: debouncedQuery || undefined,
        });
        // Enrich with media URLs + author.
        const { supabase } = await import('@/lib/supabase');
        const authorIds = Array.from(new Set(rows.map((r) => r.user_id)));
        const authorsById = new Map<string, WorkCardState['author']>();
        if (authorIds.length > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('user_id, display_name, username, avatar_key')
            .in('user_id', authorIds);
          for (const a of (data as Array<{ user_id: string } & NonNullable<WorkCardState['author']>>) || []) {
            authorsById.set(a.user_id, a);
          }
        }
        const enriched: WorkCardState[] = await Promise.all(
          rows.map(async (row) => {
            const [media_url, authorAvatar] = await Promise.all([
              row.media_key ? getMediaUrl(row.media_key) : Promise.resolve(null),
              (async () => {
                const a = authorsById.get(row.user_id);
                if (a?.avatar_key) return getMediaUrl(a.avatar_key);
                return null;
              })(),
            ]);
            const a = authorsById.get(row.user_id) || null;
            return {
              ...row,
              media_url,
              author: a ? { ...a, avatar_url: authorAvatar } : null,
            };
          }),
        );
        setItems((prev) => (replace ? enriched : [...prev, ...enriched]));
        setHasMore(rows.length === MARKETPLACE_PAGE_SIZE);
        setPage(p);
      } catch (e) {
        console.error('load works', e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [categoryId, debouncedQuery],
  );

  useEffect(() => {
    load(0, true);
  }, [load]);

  // Infinite scroll sentinel.
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          load(page + 1, false);
        }
      },
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, page, load]);

  const handleCreated = (work: ProviderWork) => {
    setShowCreate(false);
    // Reload from page 0 to include the new entry with full author info.
    load(0, true);
    toast.success('Réalisation publiée');
    void work;
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette réalisation ?')) return;
    const ok = await deleteWork(id);
    if (ok) {
      setItems((prev) => prev.filter((w) => w.id !== id));
      toast.success('Supprimé');
    } else {
      toast.error('Échec de la suppression');
    }
  };

  return (
    <Layout title="Réalisations">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Réalisations</h1>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Découvrez le travail des prestataires LOBOKO.
          </p>
        </div>
        {isProvider && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2563eb] hover:bg-[#1e4fcf] text-white text-sm font-medium shadow-sm"
          >
            <Plus size={16} />
            Publier
          </button>
        )}
      </div>

      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une catégorie, un service, un titre…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
        />
      </div>

      {/* Category filter */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
        <button
          onClick={() => setCategoryId(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !categoryId
              ? 'bg-[#2563eb] text-white border-[#2563eb]'
              : 'bg-[var(--loboko-surface)] border-[var(--loboko-border)] text-[var(--loboko-text-muted)]'
          }`}
        >
          Toutes
        </button>
        {filteredCategories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              categoryId === c.id
                ? 'bg-[#2563eb] text-white border-[#2563eb]'
                : 'bg-[var(--loboko-surface)] border-[var(--loboko-border)] text-[var(--loboko-text-muted)]'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Aucune réalisation pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((w) => (
            <WorkCard
              key={w.id}
              work={w}
              onAuthorClick={() => navigate(`/u/${w.user_id}`)}
              canDelete={user?.id === w.user_id}
              onDelete={() => handleDelete(w.id)}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-10 flex items-center justify-center">
        {loadingMore && (
          <Loader2 size={18} className="animate-spin text-[var(--loboko-text-muted)]" />
        )}
      </div>

      {showCreate && isProvider && user && (
        <CreateWorkDialog
          userId={user.id}
          categories={categories}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </Layout>
  );
}

// ------ Work card -----------------------------------------------------

interface CardProps {
  work: WorkCardState;
  onAuthorClick: () => void;
  canDelete: boolean;
  onDelete: () => void;
}

function WorkCard({ work, onAuthorClick, canDelete, onDelete }: CardProps) {
  const initials = (work.author?.display_name || work.author?.username || 'U')
    .slice(0, 2)
    .toUpperCase();
  return (
    <article className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden">
      <div className="relative aspect-square bg-black/5">
        <LazyMedia className="absolute inset-0">
          {work.media_type === 'video' ? (
            <video
              src={work.media_url || undefined}
              controls
              preload="none"
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={work.media_url || undefined}
              alt={work.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          )}
        </LazyMedia>
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <FavoriteButton type="work" targetId={work.id} />
          {canDelete && (
            <button
              onClick={onDelete}
              className="w-9 h-9 rounded-full bg-black/40 hover:bg-red-600 text-white flex items-center justify-center"
              aria-label="Supprimer"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="p-3">
        <button
          onClick={onAuthorClick}
          className="flex items-center gap-2 mb-2 text-left"
        >
          {work.author?.avatar_url ? (
            <img
              src={work.author.avatar_url}
              alt=""
              loading="lazy"
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#2563eb] text-white text-xs font-bold flex items-center justify-center">
              {initials}
            </div>
          )}
          <span className="text-sm font-medium truncate">
            {work.author?.display_name || work.author?.username || 'Prestataire'}
          </span>
        </button>
        <h3 className="font-semibold text-sm line-clamp-2">{work.title}</h3>
        {work.description && (
          <p className="text-xs text-[var(--loboko-text-muted)] mt-1 line-clamp-2">
            {work.description}
          </p>
        )}
        {work.city && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--loboko-text-muted)]">
            <MapPin size={12} />
            {work.city}
          </p>
        )}
      </div>
    </article>
  );
}

// ------ Create dialog -------------------------------------------------

interface CreateProps {
  userId: string;
  categories: ServiceCategory[];
  onClose: () => void;
  onCreated: (w: ProviderWork) => void;
}

function CreateWorkDialog({ userId, categories, onClose, onCreated }: CreateProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickFile = (accept: 'image' | 'video') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept === 'image' ? 'image/*' : 'video/*';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      setFile(f);
      setMediaType(accept);
      setPreview(URL.createObjectURL(f));
    };
    input.click();
  };

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const canSubmit = useMemo(
    () => !!title.trim() && !!file && !!mediaType && !submitting,
    [title, file, mediaType, submitting],
  );

  const handleSubmit = async () => {
    if (!canSubmit || !file || !mediaType) return;
    setSubmitting(true);
    try {
      const { key, error } = await uploadMediaEx(file, 'posts');
      if (error || !key) {
        toast.error(error || 'Échec du téléversement.');
        setSubmitting(false);
        return;
      }
      const { data: created, error: createError } = await createWork({
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        city: city.trim() || null,
        category_id: categoryId,
        media_key: key,
        media_type: mediaType,
      });
      if (!created) {
        toast.error(createError || 'Erreur lors de la publication.');
        setSubmitting(false);
        return;
      }
      onCreated(created);
    } catch (e) {
      console.error(e);
      toast.error('Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--loboko-border)]">
          <h2 className="font-semibold">Publier une réalisation</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--loboko-hover)]"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {preview ? (
            <div className="relative rounded-xl overflow-hidden bg-black/5 aspect-video">
              {mediaType === 'video' ? (
                <video src={preview} controls preload="metadata" className="w-full h-full object-contain" />
              ) : (
                <img src={preview} alt="" className="w-full h-full object-contain" />
              )}
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setMediaType(null);
                }}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => pickFile('image')}
                className="flex flex-col items-center gap-1 py-5 rounded-xl border border-dashed border-[var(--loboko-border)] hover:border-[#2563eb]"
              >
                <ImageIcon size={22} />
                <span className="text-xs">Photo</span>
              </button>
              <button
                onClick={() => pickFile('video')}
                className="flex flex-col items-center gap-1 py-5 rounded-xl border border-dashed border-[var(--loboko-border)] hover:border-[#2563eb]"
              >
                <VideoIcon size={22} />
                <span className="text-xs">Vidéo</span>
              </button>
            </div>
          )}

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre *"
            maxLength={120}
            className="w-full px-3 py-2 rounded-xl bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
            maxLength={600}
            className="w-full px-3 py-2 rounded-xl bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-sm resize-none"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ville"
            maxLength={80}
            className="w-full px-3 py-2 rounded-xl bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-sm"
          />
          <select
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value || null)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-sm"
          >
            <option value="">Catégorie (optionnel)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="p-4 border-t border-[var(--loboko-border)] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm hover:bg-[var(--loboko-hover)]"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2563eb] hover:bg-[#1e4fcf] disabled:opacity-50 text-white text-sm font-medium"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Publier
          </button>
        </div>
      </div>
    </div>
  );
}
