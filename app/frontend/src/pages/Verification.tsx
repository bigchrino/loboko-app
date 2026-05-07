import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import {
  DocumentType,
  fetchMyVerification,
  ProviderVerification,
  submitProviderVerification,
  uploadKycFile,
} from '@/lib/kyc';
import { Loader2, ShieldCheck, Upload, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function Verification() {
  const { user, profile, refreshProfile } = useAuth();

  const [verification, setVerification] = useState<ProviderVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('id_card');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      setLoading(true);

      try {
        const data = await fetchMyVerification(user.id);
        setVerification(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const canSubmit =
    !!user &&
    !!fullName.trim() &&
    !!frontFile &&
    !!selfieFile &&
    !submitting;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;

    setSubmitting(true);

    try {
      const frontKey = await uploadKycFile(user.id, frontFile!, 'document-front');
      const backKey = backFile
        ? await uploadKycFile(user.id, backFile, 'document-back')
        : null;
      const selfieKey = await uploadKycFile(user.id, selfieFile!, 'selfie');

      const created = await submitProviderVerification({
        userId: user.id,
        fullName: fullName.trim(),
        documentType,
        documentFrontKey: frontKey,
        documentBackKey: backKey,
        selfieKey,
      });

      setVerification(created);
      await refreshProfile();

      toast.success('Demande de vérification envoyée');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || !profile) {
    return (
      <Layout title="Vérification">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Vous devez être connecté.
        </div>
      </Layout>
    );
  }

  if (profile.role !== 'prestataire') {
    return (
      <Layout title="Vérification">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          La vérification est réservée aux prestataires.
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout title="Vérification">
        <div className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-[var(--loboko-text-muted)]" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Vérification">
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="text-[#2563eb]" />
            Vérification prestataire
          </h1>
          <p className="mt-2 text-sm text-[var(--loboko-text-muted)]">
            Envoyez vos documents pour obtenir le badge “Prestataire vérifié”.
          </p >
        </div>

        {verification?.status === 'approved' && (
          <StatusBox
            icon={<ShieldCheck size={20} />}
            title="Profil vérifié"
            text="Votre profil est approuvé. Le badge vérifié est maintenant visible."
            color="green"
          />
        )}

        {verification?.status === 'pending' && (
          <StatusBox
            icon={<Clock size={20} />}
            title="Demande en attente"
            text="Votre demande est en cours de vérification par l’équipe LOBOKO."
            color="blue"
          />
        )}

        {verification?.status === 'rejected' && (
          <StatusBox
            icon={<XCircle size={20} />}
            title="Demande refusée"
            text={verification.admin_note || 'Votre demande a été refusée. Vous pouvez renvoyer une nouvelle demande.'}
            color="red"
          />
        )}

        {verification?.status !== 'approved' && verification?.status !== 'pending' && (
          <div className="p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] space-y-3">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nom complet officiel"
              className="w-full px-3 py-2 rounded-xl bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-sm"
            />

            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--loboko-bg)] border border-[var(--loboko-border)] text-sm"
            >
              <option value="id_card">Carte d’identité</option>
              <option value="passport">Passeport</option>
              <option value="driver_license">Permis de conduire</option>
              <option value="other">Autre document</option>
            </select>

            <FileInput
              label="Document recto *"
              file={frontFile}
              onChange={setFrontFile}
            />

            <FileInput
              label="Document verso (optionnel)"
              file={backFile}
              onChange={setBackFile}
            />

            <FileInput
              label="Selfie avec document *"
              file={selfieFile}
              onChange={setSelfieFile}
            />

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1e4fcf] disabled:opacity-50 text-white text-sm font-semibold"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Envoyer la demande
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

function FileInput({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className="w-full text-sm"
      />
      {file && (
        <p className="mt-1 text-xs text-[var(--loboko-text-muted)]">
          Sélectionné : {file.name}
        </p >
      )}
    </label>
  );
}

function StatusBox({
  icon,
  title,
  text,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  color: 'green' | 'blue' | 'red';
}) {
  const styles = {
    green: 'bg-green-500/10 border-green-500/40 text-green-500',
    blue: 'bg-blue-500/10 border-blue-500/40 text-blue-500',
    red: 'bg-red-500/10 border-red-500/40 text-red-500',
  };

  return (
    <div className={`p-4 rounded-2xl border ${styles[color]}`}>
      <div className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-sm">{text}</p >
    </div>
  );
}
