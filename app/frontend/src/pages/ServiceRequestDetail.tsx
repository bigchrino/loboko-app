import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import {
  ArrowLeft,
  Flame,
  MapPin,
  Clock,
  Send,
  Lock,
  Unlock,
  Trash2,
  MessageCircle,
  Loader2,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBackNavigation } from '@/lib/use-back-navigation';
import {
  closeRequest,
  createResponse,
  deleteRequest,
  fetchRequestById,
  fetchResponses,
  reopenRequest,
  ServiceRequest,
  ServiceRequestResponse,
} from '@/lib/marketplace';
import { fetchCategoryById, ServiceCategory } from '@/lib/service-categories';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import { toast } from 'sonner';

interface ResponderProfile {
  user_id: string;
  username: string;
  display_name?: string | null;
  avatar_key?: string | null;
  avatar_url?: string | null;
}

export default function ServiceRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const goBack = useBackNavigation('/requests');

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [owner, setOwner] = useState<ResponderProfile | null>(null);
  const [responses, setResponses] = useState<ServiceRequestResponse[]>([]);
  const [profilesById, setProfilesById] = useState<Map<string, ResponderProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [priceOffer, setPriceOffer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;

    setLoading(true);

    try {
      const req = await fetchRequestById(id);
      setRequest(req);

      if (!req) {
        setLoading(false);
        return;
      }

      if (req.category_id) {
        fetchCategoryById(req.category_id).then(setCategory);
      }

      const { data: ownerData } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_key')
        .eq('user_id', req.user_id)
        .maybeSingle();

      if (ownerData) {
        const avatar_url = ownerData.avatar_key ? await getMediaUrl(ownerData.avatar_key) : null;
        setOwner({ ...(ownerData as ResponderProfile), avatar_url });
      }

      const resp = await fetchResponses(id);
      setResponses(resp);

      if (resp.length > 0) {
        const providerIds = Array.from(new Set(resp.map((r) => r.provider_id)));

        const { data } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_key')
          .in('user_id', providerIds);

        const entries = await Promise.all(
          ((data as ResponderProfile[]) || []).map(async (p) => {
            const avatar_url = p.avatar_key ? await getMediaUrl(p.avatar_key) : null;
            return [p.user_id, { ...p, avatar_url }] as const;
          }),
        );

        setProfilesById(new Map(entries));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = !!user && !!request && user.id === request.user_id;
  const isProvider = profile?.role === 'prestataire';
  const myResponse = user ? responses.find((r) => r.provider_id === user.id) : null;

  const handleSubmitResponse = async () => {
    if (!user || !request || !message.trim()) return;

    if (!isProvider) {
      toast.error('Seuls les prestataires peuvent répondre.');
      return;
    }

    if (request.status !== 'open') {
      toast.error('Cette demande est fermée.');
      return;
    }

    setSubmitting(true);

    const saved = await createResponse({
      request_id: request.id,
      provider_id: user.id,
      message: message.trim(),
      price_offer: priceOffer.trim() || null,
    });

    setSubmitting(false);

    if (!saved) {
      toast.error('Envoi impossible.');
      return;
    }

    toast.success('Réponse envoyée');
    setMessage('');
    setPriceOffer('');
    load();
  };

  const handleClose = async () => {
    if (!request) return;

    const ok = await closeRequest(request.id);

    if (ok) {
      setRequest({ ...request, status: 'closed', closed_at: new Date().toISOString() });
      toast.success('Demande fermée');
    } else {
      toast.error('Action impossible.');
    }
  };

  const handleReopen = async () => {
    if (!request) return;

    const ok = await reopenRequest(request.id);

    if (ok) {
      setRequest({ ...request, status: 'open', closed_at: null });
      toast.success('Demande rouverte');
    } else {
      toast.error('Action impossible.');
    }
  };

  const handleDelete = async () => {
    if (!request) return;
    if (!confirm('Supprimer définitivement cette demande ?')) return;

    const ok = await deleteRequest(request.id);

    if (ok) {
      toast.success('Supprimée');
      goBack();
    } else {
      toast.error('Action impossible.');
    }
  };

  const openChatWith = (otherUserId: string) => {
    navigate(`/messages/contact/${otherUserId}`);
  };

  if (loading) {
    return (
      <Layout>
        <div className="py-10 text-center text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      </Layout>
    );
  }

  if (!request) {
    return (
      <Layout>
        <div className="py-10 text-center text-sm text-[var(--loboko-text-muted)]">
          Demande introuvable.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <button
        onClick={goBack}
        className="inline-flex items-center gap-1 text-sm text-[var(--loboko-text-muted)] mb-3 hover:text-[var(--loboko-text)]"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <article className="p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h1 className="text-xl font-bold">{request.title}</h1>

          {request.is_urgent && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-600 text-white text-xs font-bold">
              <Flame size={12} /> URGENT
            </span>
          )}
        </div>

        {request.status === 'closed' && (
          <div className="mb-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-200 text-gray-700 text-xs font-medium">
            <Lock size={12} /> Fermée
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap">{request.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--loboko-text-muted)]">
          {category && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--loboko-bg)]">
              {category.name}
            </span>
          )}

          {request.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} /> {request.city}
            </span>
          )}

          {request.budget && (
            <span className="font-medium text-[var(--loboko-text)]">
              Budget : {request.budget}
            </span>
          )}

          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {new Date(request.created_at).toLocaleString('fr-FR')}
          </span>
        </div>

        {owner && !isOwner && (
          <button
            onClick={() => navigate(`/u/${owner.user_id}`)}
            className="mt-3 inline-flex items-center gap-2 text-sm text-[#2563eb]"
          >
            {owner.avatar_url ? (
              <img src={owner.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#2563eb] text-white text-[10px] font-bold flex items-center justify-center">
                {(owner.display_name || owner.username).slice(0, 2).toUpperCase()}
              </div>
            )}

            {owner.display_name || owner.username}
          </button>
        )}

        {isOwner && (
          <div className="mt-4 flex flex-wrap gap-2">
            {request.status === 'open' ? (
              <button
                onClick={handleClose}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-xs"
              >
                <Lock size={12} /> Fermer
              </button>
            ) : (
              <button
                onClick={handleReopen}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-xs"
              >
                <Unlock size={12} /> Rouvrir
              </button>
            )}

            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200 text-xs"
            >
              <Trash2 size={12} /> Supprimer
            </button>
          </div>
        )}
      </article>

      {user && !isOwner && isProvider && request.status === 'open' && (
        <section className="mt-4 p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
          <h2 className="font-semibold text-sm mb-2">
            {myResponse ? 'Modifier votre proposition' : 'Répondre à cette demande'}
          </h2>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Décrivez votre proposition…"
            rows={3}
            maxLength={800}
            className="w-full px-3 py-2 rounded-xl bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-sm resize-none"
          />

          <input
            value={priceOffer}
            onChange={(e) => setPriceOffer(e.target.value)}
            placeholder="Prix proposé (optionnel)"
            maxLength={60}
            className="mt-2 w-full px-3 py-2 rounded-xl bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-sm"
          />

          <div className="mt-2 flex justify-end">
            <button
              onClick={handleSubmitResponse}
              disabled={!message.trim() || submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2563eb] hover:bg-[#1e4fcf] disabled:opacity-50 text-white text-sm font-medium"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Envoyer
            </button>
          </div>
        </section>
      )}

      {user && !isOwner && !isProvider && request.status === 'open' && (
        <section className="mt-4 p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Seuls les prestataires peuvent répondre à une demande de service.
          </p>
        </section>
      )}

      <section className="mt-4">
        <h2 className="font-semibold text-sm mb-2">Réponses ({responses.length})</h2>

        {responses.length === 0 ? (
          <div className="text-center py-6 text-sm text-[var(--loboko-text-muted)]">
            Aucune réponse pour le moment.
          </div>
        ) : (
          <div className="space-y-2">
            {responses.map((r) => {
              const p = profilesById.get(r.provider_id);
              const initials = (p?.display_name || p?.username || 'U').slice(0, 2).toUpperCase();

              return (
                <div
                  key={r.id}
                  className="p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => navigate(`/u/${r.provider_id}`)}
                      className="flex items-center gap-2"
                    >
                      {p?.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#2563eb] text-white text-xs font-bold flex items-center justify-center">
                          {initials}
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">
                          {p?.display_name || p?.username || 'Prestataire'}
                        </span>

                        {p?.is_verified && p?.verification_status === 'approved' && (
                          <BadgeCheck size={14} className="text-[#60a5fa]" />
                        )}
                      </div>
                    </button>

                    <span className="ml-auto text-xs text-[var(--loboko-text-muted)]">
                      {new Date(r.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  <p className="text-sm whitespace-pre-wrap">{r.message}</p>

                  {r.price_offer && (
                    <p className="mt-1 text-xs font-medium">Prix proposé : {r.price_offer}</p>
                  )}

                  {(isOwner || user?.id === r.provider_id) && (
                    <button
                      onClick={() => openChatWith(isOwner ? r.provider_id : request.user_id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-[#2563eb]"
                    >
                      <MessageCircle size={12} /> Discuter
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </Layout>
  );
}
