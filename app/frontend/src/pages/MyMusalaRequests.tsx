import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyCompany } from '@/lib/companies';
import {
  fetchMyMusalaRequests,
  createMusalaRequest,
  updateMusalaRequest,
  deleteMusalaRequest,
  MUSALA_TYPE_LABELS,
  MusalaRequestType,
  MusalaRequest,
} from '@/lib/musala';
import { ArrowLeft, Plus, Pencil, Trash2, X, MapPin, UserRound } from 'lucide-react';
import { toast } from 'sonner';

export default function MyMusalaRequests() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState<MusalaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MusalaRequest | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);

    // Une entreprise ne publie pas de demande Musala — seulement les
    // particuliers. Redirection cohérente avec la page de consultation.
    const company = await fetchMyCompany(user.id);
    if (company) {
      toast.error('Les entreprises ne peuvent que consulter Musala.');
      navigate('/entreprise/musala', { replace: true });
      return;
    }

    const rows = await fetchMyMusalaRequests(user.id);
    setRequests(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (r: MusalaRequest) => {
    setEditing(r);
    setShowForm(true);
  };

  const handleDelete = async (r: MusalaRequest) => {
    if (!confirm(`Supprimer la demande "${r.title}" ?`)) return;
    const ok = await deleteMusalaRequest(r.id);
    if (ok) {
      setRequests((cur) => cur.filter((x) => x.id !== r.id));
      toast.success('Demande supprimée');
    } else {
      toast.error('Suppression impossible');
    }
  };

  if (loading) {
    return (
      <Layout title="Mes demandes Musala">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Mes demandes Musala">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserRound size={22} /> Mes demandes
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-semibold"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-10 px-4 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Aucune demande publiée pour l'instant.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div
              key={r.id}
              className="p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{r.title}</div>
                  <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold">
                    {MUSALA_TYPE_LABELS[r.request_type]}
                  </span>
                  {r.location && (
                    <div className="text-xs text-[var(--loboko-text-muted)] mt-1 flex items-center gap-1">
                      <MapPin size={11} /> {r.location}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(r)}
                    className="w-8 h-8 rounded-full bg-[var(--loboko-elevated)] flex items-center justify-center"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    className="w-8 h-8 rounded-full bg-[var(--loboko-elevated)] text-red-500 flex items-center justify-center"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && user?.id && (
        <MusalaFormDialog
          userId={user.id}
          request={editing}
          onClose={() => setShowForm(false)}
          onSaved={(r) => {
            setRequests((cur) => {
              const exists = cur.some((x) => x.id === r.id);
              return exists ? cur.map((x) => (x.id === r.id ? r : x)) : [r, ...cur];
            });
            setShowForm(false);
          }}
        />
      )}
    </Layout>
  );
}

interface FormProps {
  userId: string;
  request: MusalaRequest | null;
  onClose: () => void;
  onSaved: (r: MusalaRequest) => void;
}

function MusalaFormDialog({ userId, request, onClose, onSaved }: FormProps) {
  const [title, setTitle] = useState(request?.title || '');
  const [description, setDescription] = useState(request?.description || '');
  const [requestType, setRequestType] = useState<MusalaRequestType>(
    request?.request_type || 'emploi',
  );
  const [location, setLocation] = useState(request?.location || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Donnez un titre à votre demande');
      return;
    }
    setSubmitting(true);

    if (request) {
      const { data, error } = await updateMusalaRequest(request.id, {
        title: title.trim(),
        description: description.trim() || null,
        request_type: requestType,
        location: location.trim() || null,
      });
      setSubmitting(false);
      if (!data) {
        toast.error(error || 'Erreur lors de la mise à jour');
        return;
      }
      toast.success('Demande mise à jour');
      onSaved(data);
    } else {
      const { data, error } = await createMusalaRequest({
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        request_type: requestType,
        location: location.trim() || null,
      });
      setSubmitting(false);
      if (!data) {
        toast.error(error || 'Erreur lors de la publication');
        return;
      }
      toast.success('Demande publiée');
      onSaved(data);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-[var(--loboko-surface)] sm:rounded-2xl rounded-t-2xl border border-[var(--loboko-border)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--loboko-border)]">
          <h3 className="font-semibold text-sm">
            {request ? 'Modifier la demande' : 'Nouvelle demande'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Titre</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Ex : Recherche poste de comptable"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Type</label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as MusalaRequestType)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm"
            >
              {(Object.keys(MUSALA_TYPE_LABELS) as MusalaRequestType[]).map((k) => (
                <option key={k} value={k}>
                  {MUSALA_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Lieu (optionnel)</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex : Kinshasa"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Description (optionnel)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Parlez de votre profil, vos compétences, ce que vous recherchez…"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb] resize-none"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : request ? 'Enregistrer' : 'Publier la demande'}
          </button>
        </div>
      </div>
    </div>
  );
}
