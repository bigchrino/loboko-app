import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyCompany, Company } from '@/lib/companies';
import {
  fetchCompanyJobOffers,
  createJobOffer,
  updateJobOffer,
  deleteJobOffer,
  EMPLOYMENT_TYPE_LABELS,
  EmploymentType,
  JobOffer,
} from '@/lib/job-offers';
import { ArrowLeft, ClipboardList, Plus, Pencil, Trash2, X, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function CompanyJobOffersManage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<JobOffer | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const c = await fetchMyCompany(user.id);
    if (!c) {
      toast.error("Vous n'avez pas encore d'entreprise");
      navigate('/entreprise', { replace: true });
      return;
    }
    setCompany(c);
    const rows = await fetchCompanyJobOffers(c.id);
    setOffers(rows);
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
  const openEdit = (o: JobOffer) => {
    setEditing(o);
    setShowForm(true);
  };

  const handleDelete = async (o: JobOffer) => {
    if (!confirm(`Supprimer l'offre "${o.title}" ?`)) return;
    const ok = await deleteJobOffer(o.id);
    if (ok) {
      setOffers((cur) => cur.filter((x) => x.id !== o.id));
      toast.success('Offre supprimée');
    } else {
      toast.error('Suppression impossible');
    }
  };

  if (loading || !company) {
    return (
      <Layout title="Mes offres d'emploi">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Mes offres d'emploi">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] mb-4"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList size={22} /> Mes offres d'emploi
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-semibold"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-10 px-4 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Aucune offre publiée pour l'instant.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {offers.map((o) => (
            <div
              key={o.id}
              className="p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{o.title}</div>
                  <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold">
                    {EMPLOYMENT_TYPE_LABELS[o.employment_type]}
                  </span>
                  {o.location && (
                    <div className="text-xs text-[var(--loboko-text-muted)] mt-1 flex items-center gap-1">
                      <MapPin size={11} /> {o.location}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(o)}
                    className="w-8 h-8 rounded-full bg-[var(--loboko-elevated)] flex items-center justify-center"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(o)}
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

      {showForm && (
        <JobOfferFormDialog
          companyId={company.id}
          offer={editing}
          onClose={() => setShowForm(false)}
          onSaved={(o) => {
            setOffers((cur) => {
              const exists = cur.some((x) => x.id === o.id);
              return exists ? cur.map((x) => (x.id === o.id ? o : x)) : [o, ...cur];
            });
            setShowForm(false);
          }}
        />
      )}
    </Layout>
  );
}

interface FormProps {
  companyId: string;
  offer: JobOffer | null;
  onClose: () => void;
  onSaved: (o: JobOffer) => void;
}

function JobOfferFormDialog({ companyId, offer, onClose, onSaved }: FormProps) {
  const [title, setTitle] = useState(offer?.title || '');
  const [description, setDescription] = useState(offer?.description || '');
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    offer?.employment_type || 'long_terme',
  );
  const [location, setLocation] = useState(offer?.location || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Donnez un titre à l'offre");
      return;
    }
    setSubmitting(true);

    if (offer) {
      const { data, error } = await updateJobOffer(offer.id, {
        title: title.trim(),
        description: description.trim() || null,
        employment_type: employmentType,
        location: location.trim() || null,
      });
      setSubmitting(false);
      if (!data) {
        toast.error(error || 'Erreur lors de la mise à jour');
        return;
      }
      toast.success('Offre mise à jour');
      onSaved(data);
    } else {
      const { data, error } = await createJobOffer({
        company_id: companyId,
        title: title.trim(),
        description: description.trim() || null,
        employment_type: employmentType,
        location: location.trim() || null,
      });
      setSubmitting(false);
      if (!data) {
        toast.error(error || 'Erreur lors de la publication');
        return;
      }
      toast.success('Offre publiée');
      onSaved(data);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-[var(--loboko-surface)] sm:rounded-2xl rounded-t-2xl border border-[var(--loboko-border)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--loboko-border)]">
          <h3 className="font-semibold text-sm">
            {offer ? "Modifier l'offre" : 'Nouvelle offre'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Titre du poste</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Ex : Développeur web junior"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Type</label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm"
            >
              {(Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]).map((k) => (
                <option key={k} value={k}>
                  {EMPLOYMENT_TYPE_LABELS[k]}
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
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb] resize-none"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : offer ? 'Enregistrer' : "Publier l'offre"}
          </button>
        </div>
      </div>
    </div>
  );
}
