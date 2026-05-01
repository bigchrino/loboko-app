import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  createReport,
  REPORT_REASON_LABELS,
  ReportReason,
} from '@/lib/reports';

/**
 * Generic report dialog used from:
 *  - provider public profile ("Signaler ce prestataire")
 *  - message bubbles
 *  - posts / statuses
 *
 * Exactly one of `reportedUserId`, `reportedMessageId`, `reportedPostId`
 * must be provided.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  reportedUserId?: string;
  reportedMessageId?: string;
  reportedPostId?: string;
  onSubmitted?: () => void;
}

const REASONS: ReportReason[] = [
  'inappropriate',
  'scam',
  'spam',
  'harassment',
  'other',
];

export default function ReportDialog({
  open,
  onClose,
  title = 'Signaler',
  reportedUserId,
  reportedMessageId,
  reportedPostId,
  onSubmitted,
}: Props) {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason>('inappropriate');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!user?.id) {
      toast.error('Vous devez être connecté pour signaler');
      return;
    }
    setSubmitting(true);
    const { ok, error, alreadyReported } = await createReport(user.id, {
      reason,
      description: description.trim() || undefined,
      reportedUserId,
      reportedMessageId,
      reportedPostId,
    });
    setSubmitting(false);
    if (!ok) {
      if (alreadyReported) {
        toast.info(error || 'Vous avez déjà signalé cet élément');
        onClose();
        return;
      }
      toast.error(error || 'Envoi impossible');
      return;
    }
    toast.success('Signalement envoyé. Merci !');
    setReason('inappropriate');
    setDescription('');
    onSubmitted?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-t-2xl sm:rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-[rgba(239,68,68,0.15)] flex items-center justify-center">
            <AlertTriangle size={16} className="text-[#ef4444]" />
          </div>
          <h3 className="text-base font-bold flex-1">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full !bg-transparent !hover:bg-transparent flex items-center justify-center text-[var(--loboko-text-muted)]"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-[var(--loboko-text-muted)] mb-4">
          Merci de nous aider à protéger la communauté. Votre signalement
          reste confidentiel.
        </p>

        <div className="space-y-2 mb-4">
          <label className="block text-xs font-semibold text-[var(--loboko-text-secondary)]">
            Motif
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${
                  reason === r
                    ? 'bg-[rgba(37,99,235,0.15)] border-[#2563eb] text-[#60a5fa]'
                    : '!bg-transparent !hover:bg-transparent border-[var(--loboko-border)] text-[var(--loboko-text-secondary)]'
                }`}
              >
                <span
                  className={`inline-block w-3 h-3 rounded-full border ${
                    reason === r
                      ? 'bg-[#2563eb] border-[#2563eb]'
                      : 'border-[var(--loboko-border)]'
                  }`}
                />
                {REPORT_REASON_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-[var(--loboko-text-secondary)] mb-1">
            Description (facultatif)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ajoutez des détails pour nous aider…"
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb] resize-none"
          />
          <div className="text-[10px] text-[var(--loboko-text-muted)] text-right mt-1">
            {description.length}/500
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl !bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-sm font-semibold text-[var(--loboko-text-secondary)] disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? 'Envoi…' : 'Envoyer le signalement'}
          </button>
        </div>
      </div>
    </div>
  );
}