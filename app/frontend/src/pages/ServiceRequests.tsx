import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ServiceCategorySelect from '@/components/ServiceCategorySelect';
import {
  Plus,
  X,
  Loader2,
  MapPin,
  Flame,
  Clock,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  createRequest,
  fetchRequests,
  MAX_REQUESTS_PER_DAY,
  MARKETPLACE_PAGE_SIZE,
  ServiceRequest,
  countUserRequestsLast24h,
} from '@/lib/marketplace';
import {
  fetchActiveCategories,
  ServiceCategory,
} from '@/lib/service-categories';
import { toast } from 'sonner';

export default function ServiceRequests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [categoriesById, setCategoriesById] = useState<Map<string, ServiceCategory>>(new Map());
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchActiveCategories().then((list) => {
      setCategoriesById(new Map(list.map((c) => [c.id, c])));
    });
  }, []);

  const load = useCallback(
    async (p: number, replace: boolean) => {
      if (p === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        const rows = await fetchRequests(p, {
          categoryId: categoryId || undefined,
          city: city.trim() || undefined,
          urgentOnly,
          status: 'open',
        });

        setItems((prev) => (replace ? rows : [...prev, ...rows]));
        setHasMore(rows.length === MARKETPLACE_PAGE_SIZE);
        setPage(p);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [categoryId, city, urgentOnly],
  );

  useEffect(() => {
    load(0, true);
  }, [load]);

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

  const handleCreated = () => {
    setShowCreate(false);
    load(0, true);
  };

  return (
    <Layout title="Demandes de service">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">Demandes de service</h1>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Explorez les demandes des clients ou publiez la vôtre.
          </p>
        </div>

        {user && (
          <button
            onClick={() => setShowCreate(true)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2563eb] hover:bg-[#1e4fcf] text-white text-sm font-medium"
          >
            <Plus size={16} />
            Publier
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
        >
          <Filter size={14} />
          Filtres
        </button>

        <button
          onClick={() => setUrgentOnly((v) => !v)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            urgentOnly
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-[var(--loboko-surface)] text-[var(--loboko-text-muted)] border-[var(--loboko-border)]'
          }`}
        >
          <Flame size={14} />
          Urgentes
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] space-y-2">
          <ServiceCategorySelect
            value={categoryId}
            onChange={(id) => setCategoryId(id)}
            placeholder="Toutes catégories"
          />

          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ville (ex: Kinshasa)"
            className="w-full px-3 py-2 rounded-xl bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-sm"
          />

          {(categoryId || city) && (
            <button
              onClick={() => {
                setCategoryId(null);
                setCity('');
              }}
              className="text-xs text-[#2563eb]"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Aucune demande pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              categoryName={r.category_id ? categoriesById.get(r.category_id)?.name : undefined}
              onOpen={() => navigate(`/requests/${r.id}`)}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-10 flex items-center justify-center">
        {loadingMore && (
          <Loader2 size={18} className="animate-spin text-[var(--loboko-text-muted)]" />
        )}
      </div>

      {showCreate && user && (
        <CreateRequestDialog
          userId={user.id}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </Layout>
  );
}

function RequestRow({
  request,
  categoryName,
  onOpen,
}: {
  request: ServiceRequest;
  categoryName?: string;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb] transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-sm line-clamp-2">{request.title}</h3>

        {request.is_urgent && (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
            <Flame size={10} />
            URGENT
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--loboko-text-muted)] line-clamp-3">
        {request.description}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--loboko-text-muted)]">
        {categoryName && (
          <span className="px-2 py-0.5 rounded-full bg-[var(--loboko-bg)]">
            {categoryName}
          </span>
        )}

        {request.city && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {request.city}
          </span>
        )}

        {request.budget && (
          <span className="font-medium text-[var(--loboko-text)]">
            Budget : {request.budget}
          </span>
        )}

        <span className="ml-auto inline-flex items-center gap-1">
          <Clock size={12} />
          {timeAgo(request.created_at)}
        </span>
      </div>
    </button>
  );
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;

  const h = Math.floor(mins / 60);
  if (h < 24) return `il y a ${h} h`;

  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

function CreateRequestDialog({
  userId,
  onClose,
  onCreated,
}: {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [budget, setBudget] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [usedToday, setUsedToday] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    countUserRequestsLast24h(userId).then(setUsedToday);
  }, [userId]);

  const canSubmit = useMemo(
    () =>
      !!title.trim() &&
      !!description.trim() &&
      !!categoryId &&
      !submitting &&
      (usedToday == null || usedToday < MAX_REQUESTS_PER_DAY),
    [title, description, categoryId, submitting, usedToday],
  );

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);

    const result = await createRequest({
      user_id: userId,
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId,
      city: city.trim() || null,
      budget: budget.trim() || null,
      is_urgent: isUrgent,
    });

    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success('Demande publiée');
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--loboko-border)]">
          <h2 className="font-semibold">Publier une demande</h2>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--loboko-hover)]"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {usedToday != null && (
            <p className="text-xs text-[var(--loboko-text-muted)]">
              {usedToday}/{MAX_REQUESTS_PER_DAY} demandes utilisées aujourd'hui.
            </p>
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
            placeholder="Décrivez précisément votre besoin *"
            rows={4}
            maxLength={1000}
            className="w-full px-3 py-2 rounded-xl bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-sm resize-none"
          />

          <ServiceCategorySelect
            value={categoryId}
            onChange={(id) => setCategoryId(id)}
            placeholder="Catégorie *"
          />

          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ville"
            maxLength={80}
            className="w-full px-3 py-2 rounded-xl bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-sm"
          />

          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Budget (optionnel, ex: 50 000 CDF)"
            maxLength={60}
            className="w-full px-3 py-2 rounded-xl bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-sm"
          />

          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="w-4 h-4 accent-red-600"
            />
            <Flame size={14} className="text-red-600" />
            Marquer comme urgent
          </label>

          {!categoryId && (
            <p className="text-xs text-red-500">
              La catégorie est obligatoire pour publier une demande.
            </p>
          )}
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
