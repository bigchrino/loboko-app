import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import {
  approveVerification,
  fetchPendingVerifications,
  getKycSignedUrl,
  ProviderVerification,
  rejectVerification,
} from '@/lib/kyc';
import { Loader2, ShieldCheck, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface VerificationWithUrls extends ProviderVerification {
  frontUrl?: string;
  backUrl?: string;
  selfieUrl?: string;
}

export default function AdminVerifications() {
  const { profile, user } = useAuth();

  const [items, setItems] = useState<VerificationWithUrls[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);

    try {
      const data = await fetchPendingVerifications();

      const withUrls = await Promise.all(
        data.map(async (item) => ({
          ...item,
          frontUrl: await getKycSignedUrl(item.document_front_key),
          backUrl: item.document_back_key
            ? await getKycSignedUrl(item.document_back_key)
            : undefined,
          selfieUrl: await getKycSignedUrl(item.selfie_key),
        })),
      );

      setItems(withUrls);
    } catch (e) {
      console.error(e);
      toast.error('Impossible de charger les vérifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!user || !profile?.is_admin) {
    return (
      <Layout title="Admin">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Accès refusé.
        </div>
      </Layout>
    );
  }

  const handleApprove = async (item: ProviderVerification) => {
    setProcessingId(item.id);

    try {
      await approveVerification(item, user.id);

      toast.success('Prestataire vérifié');
      await load();
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Action impossible';
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (item: ProviderVerification) => {
    const note = prompt('Raison du refus :');

    if (note === null) return;

    setProcessingId(item.id);

    try {
      await rejectVerification(item, user.id, note);

      toast.success('Demande refusée');
      await load();
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Action impossible';
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Layout title="Admin vérifications">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">
            Vérifications prestataires
          </h1>

          <p className="text-sm text-[var(--loboko-text-muted)] mt-1">
            Gérez les demandes KYC des prestataires.
          </p >
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="animate-spin text-[var(--loboko-text-muted)]" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
            Aucune demande.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const processing = processingId === item.id;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h2 className="font-semibold">
                        {item.full_name}
                      </h2>

                      <p className="text-xs text-[var(--loboko-text-muted)]">
                        {item.document_type}
                      </p >

                      <p className="text-xs text-[var(--loboko-text-muted)] mt-1">
                        {new Date(item.created_at).toLocaleString('fr-FR')}
                      </p >
                    </div>

                    <div className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
                      {item.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <KycPreview
                      title="Document recto"
                      url={item.frontUrl}
                    />

                    <KycPreview
                      title="Document verso"
                      url={item.backUrl}
                    />

                    <KycPreview
                      title="Selfie"
                      url={item.selfieUrl}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleApprove(item)}
                      disabled={processing}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold"
                    >
                      {processing ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={16} />
                      )}
                      Approuver
                    </button>

                    <button
                      onClick={() => handleReject(item)}
                      disabled={processing}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold"
                    >
                      <XCircle size={16} />
                      Refuser
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

function KycPreview({
  title,
  url,
}: {
  title: string;
  url?: string;
}) {
  if (!url) {
    return (
      <div className="rounded-xl border border-[var(--loboko-border)] p-3 text-sm text-[var(--loboko-text-muted)]">
        Aucun fichier
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group block rounded-xl overflow-hidden border border-[var(--loboko-border)] bg-[var(--loboko-bg)]"
    >
      <div className="aspect-video bg-black">
        <img
          src={url}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
        />
      </div>

      <div className="p-2 flex items-center justify-between text-xs">
        <span>{title}</span>

        <Eye size={14} />
      </div>
    </a >
  );
}
