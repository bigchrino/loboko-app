import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '@/lib/use-back-navigation';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Check,
  Clock,
  ShieldAlert,
  RefreshCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchAllReports,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  ReportRow,
  ReportStatus,
  updateReportStatus,
  suspendUser,
  unsuspendUser,
  banUser,
  unbanUser,
} from '@/lib/reports';

/**
 * Admin-only moderation page.
 *
 * Access control is enforced in **two** places:
 *  1. Client-side: the route bounces non-admins to `/`.
 *  2. Server-side: RLS `reports_select_admin` makes the query return an
 *     empty list for non-admins even if they reach this page.
 *
 * The UI is deliberately minimal — this is v1 moderation. We list the
 * pending / reviewed / resolved buckets, show the reason and description,
 * and let the admin flip the status.
 */

const STATUS_TABS: ReportStatus[] = ['pending', 'reviewed', 'resolved'];

export default function AdminReportsPage() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const goBack = useBackNavigation('/');

  const [tab, setTab] = useState<ReportStatus>('pending');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = profile?.is_admin === true;

  const load = useCallback(
    async (status: ReportStatus) => {
      if (!isAdmin) return;
      setLoading(true);
      const data = await fetchAllReports(status);
      setRows(data);
      setLoading(false);
    },
    [isAdmin],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      navigate('/', { replace: true });
      return;
    }
    load(tab);
  }, [authLoading, isAdmin, tab, load, navigate]);

  const counts = useMemo(() => {
    const c: Record<ReportStatus, number> = {
      pending: 0,
      reviewed: 0,
      resolved: 0,
    };
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rows]);

  const setStatus = async (id: string, status: ReportStatus) => {
    const { ok, error } = await updateReportStatus(id, status);
    if (!ok) {
      toast.error(error || 'Mise à jour impossible');
      return;
    }
    toast.success('Statut mis à jour');
    load(tab);
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="p-6 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      </Layout>
    );
  }

  if (!isAdmin) return null;

  return (
    <Layout>
      <div className="p-4 max-w-3xl mx-auto">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1 text-sm text-[var(--loboko-text-secondary)] mb-3 hover:text-[var(--loboko-text)] !bg-transparent !hover:bg-transparent"
        >
          <ArrowLeft size={16} />
          Retour
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-[rgba(239,68,68,0.15)] flex items-center justify-center">
            <ShieldAlert size={20} className="text-[#ef4444]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold leading-tight">Modération</h1>
            <p className="text-xs text-[var(--loboko-text-muted)]">
              Consultez et traitez les signalements reçus.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load(tab)}
            disabled={loading}
            aria-label="Rafraîchir"
            className="w-9 h-9 rounded-xl !bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div
          role="tablist"
          className="flex items-center gap-1.5 mb-4 overflow-x-auto"
        >
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={tab === s}
              onClick={() => setTab(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
                tab === s
                  ? 'bg-[rgba(37,99,235,0.2)] text-[#60a5fa]'
                  : '!bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-[var(--loboko-text-secondary)]'
              }`}
            >
              {REPORT_STATUS_LABELS[s]}
              {tab === s && counts[s] > 0 && (
                <span className="ml-1 text-[10px] opacity-80">
                  ({counts[s]})
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-[var(--loboko-text-muted)] py-6 text-center">
            Chargement…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-[var(--loboko-text-muted)] py-10 text-center bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl">
            Aucun signalement dans cette catégorie.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onUpdate={setStatus}
                adminId={profile.user_id}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function ReportCard({
  report,
  onUpdate,
  adminId,
}: {
  report: ReportRow;
  onUpdate: (id: string, status: ReportStatus) => void;
  adminId: string;
}) {
  const target =
    report.reported_user_id
      ? { label: 'Utilisateur', value: report.reported_user_id, link: `/u/${report.reported_user_id}` }
      : report.reported_message_id
        ? { label: 'Message', value: report.reported_message_id, link: null }
        : report.reported_post_id
          ? { label: 'Publication', value: report.reported_post_id, link: null }
          : { label: 'Inconnu', value: '—', link: null };

  return (
    <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(239,68,68,0.15)] text-[#ef4444] font-semibold">
          {REPORT_REASON_LABELS[report.reason]}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--loboko-elevated)] text-[var(--loboko-text-secondary)] font-semibold">
          {REPORT_STATUS_LABELS[report.status]}
        </span>
        <span className="ml-auto text-[10px] text-[var(--loboko-text-muted)] flex items-center gap-1">
          <Clock size={10} />
          {new Date(report.created_at).toLocaleString('fr-FR')}
        </span>
      </div>

      <div className="text-xs text-[var(--loboko-text-secondary)] mb-1">
        <span className="font-semibold">Cible :</span> {target.label} —{' '}
        {target.link ? (
          <a
            href={target.link}
            className="text-[#60a5fa] underline break-all"
          >
            {target.value}
          </a>
        ) : (
          <span className="break-all">{target.value}</span>
        )}
      </div>
      <div className="text-[11px] text-[var(--loboko-text-muted)] mb-2 break-all">
        Signalé par : {report.reporter_id}
      </div>

      {report.description && (
        <p className="text-sm text-[var(--loboko-text-secondary)] whitespace-pre-wrap mb-3 border-l-2 border-[var(--loboko-border)] pl-2">
          {report.description}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {report.status !== 'reviewed' && (
          <button
            type="button"
            onClick={() => onUpdate(report.id, 'reviewed')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(245,158,11,0.15)] text-[#f59e0b] text-xs font-semibold"
          >
            <Clock size={12} />
            En cours
          </button>
        )}
        {report.status !== 'resolved' && (
          <button
            type="button"
            onClick={() => onUpdate(report.id, 'resolved')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(34,197,94,0.15)] text-[#22c55e] text-xs font-semibold"
          >
            <Check size={12} />
            Marquer résolu
          </button>
        )}
        {report.status !== 'pending' && (
          <button
            type="button"
            onClick={() => onUpdate(report.id, 'pending')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl !bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-[var(--loboko-text-secondary)] text-xs font-semibold"
          >
            Rouvrir
          </button>
        )}

        {report.reported_user_id && (
          <>
            <button
              type="button"
              onClick={async () => {
                const res = await suspendUser(
                  report.reported_user_id!,
                  adminId,
                  1,
                  report.description || 'Signalement utilisateur',
                );
                if (!res.ok) toast.error(res.error || 'Suspension impossible');
                else toast.success('Utilisateur suspendu 24h');
              }}
              className="px-3 py-1.5 rounded-xl bg-[rgba(245,158,11,0.15)] text-[#f59e0b] text-xs font-semibold"
            >
              Suspendre 24h
            </button>
        
            <button
              type="button"
              onClick={async () => {
                const res = await suspendUser(
                  report.reported_user_id!,
                  adminId,
                  7,
                  report.description || 'Signalement utilisateur',
                );
                if (!res.ok) toast.error(res.error || 'Suspension impossible');
                else toast.success('Utilisateur suspendu 7 jours');
              }}
              className="px-3 py-1.5 rounded-xl bg-[rgba(245,158,11,0.15)] text-[#f59e0b] text-xs font-semibold"
            >
              Suspendre 7j
            </button>
        
            <button
              type="button"
              onClick={async () => {
                const ok = window.confirm('Bannir définitivement ce compte ?');
                if (!ok) return;
        
                const res = await banUser(
                  report.reported_user_id!,
                  adminId,
                  report.description || 'Bannissement admin',
                );
                if (!res.ok) toast.error(res.error || 'Bannissement impossible');
                else toast.success('Utilisateur banni');
              }}
              className="px-3 py-1.5 rounded-xl bg-[rgba(239,68,68,0.15)] text-[#ef4444] text-xs font-semibold"
            >
              Bannir
            </button>
        
            <button
              type="button"
              onClick={async () => {
                const res = await unsuspendUser(report.reported_user_id!, adminId);
                if (!res.ok) toast.error(res.error || 'Annulation impossible');
                else toast.success('Suspension annulée');
              }}
              className="px-3 py-1.5 rounded-xl border border-[var(--loboko-border)] text-xs font-semibold"
            >
              Annuler suspension
            </button>
            <button
              type="button"
              onClick={async () => {
                const res = await unbanUser(report.reported_user_id!, adminId);
                if (!res.ok) toast.error(res.error || 'Réactivation impossible');
                else toast.success('Compte réactivé');
              }}
              className="px-3 py-1.5 rounded-xl bg-[rgba(34,197,94,0.15)] text-[#22c55e] text-xs font-semibold"
            >
              Réactiver compte
            </button>
          </>
        )}
      </div>
    </div>
  );
}
