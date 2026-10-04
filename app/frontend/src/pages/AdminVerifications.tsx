import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminHeader, AdminPagination, AdminError } from '@/components/AdminTools';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import {
  approveVerification,
  fetchPendingVerifications,
  getKycSignedUrls,
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

  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (!profile?.is_admin) return;
    const request = ++generation.current;
    setLoading(true);

    try {
      const result = await fetchPendingVerifications(page);
      const keys = result.items.flatMap(item => [item.document_front_key, item.document_back_key, item.selfie_key].filter((key): key is string => !!key));
      const urls = await getKycSignedUrls(keys);
      if (generation.current !== request) return;
      setItems(result.items.map(item => ({...item, frontUrl: urls[item.document_front_key], backUrl: item.document_back_key ? urls[item.document_back_key] : undefined, selfieUrl: urls[item.selfie_key]})));
      setTotal(result.total);
      setFailed(false);
    } catch (e) {
      if (generation.current !== request) return;
      setFailed(true);
      toast.error('Impossible de charger les vérifications');
    } finally {
      if (generation.current === request) setLoading(false);
    }
  }, [page, profile?.is_admin]);

  useEffect(() => {
    void load();
    return () => { generation.current += 1; };
  }, [load]);

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
    if (processingId) return;
    const documents = items.find(value => value.id === item.id);
    if (!documents?.frontUrl || !documents.selfieUrl) { toast.error('Chargez les documents avant de décider.'); return; }
    if (!confirm('Approuver la vérification de ce prestataire ?')) return;
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

    if (processingId || note === null) return;
    if (note.trim().length < 3) { toast.error('Un motif de refus est obligatoire.'); return; }

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
        <AdminHeader title="Vérifications prestataires" description="Validation KYC — 25 demandes par page" busy={loading || !!processingId} refresh={load} />
        {failed ? <AdminError retry={load} /> : loading ? (
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
                      disabled={!!processingId}
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
                      disabled={!!processingId}
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
        <AdminPagination page={page} total={total} size={25} busy={loading || failed || !!processingId} onChange={setPage} />
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
        {title === 'Document verso' ? 'Aucun fichier' : 'Aperçu indisponible. Actualisez avant de décider.'}
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
          loading="lazy"
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
