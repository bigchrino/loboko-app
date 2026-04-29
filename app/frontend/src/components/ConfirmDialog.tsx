import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * Lightweight confirmation dialog used for destructive actions in the
 * messaging page (archive, delete, block, block+report). Kept local to avoid
 * bringing in heavier UI deps and to preserve the current design system.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = false,
  onConfirm,
  onCancel,
  loading = false,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--loboko-surface)] w-full max-w-sm rounded-2xl border border-[var(--loboko-border)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-base">{title}</h3>
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)] shrink-0"
            aria-label="Fermer"
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        {description && (
          <p className="text-sm text-[var(--loboko-text-secondary)] mb-4 whitespace-pre-wrap">
            {description}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-full text-sm font-medium bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50 ${
              destructive
                ? 'bg-gradient-to-br from-[#ef4444] to-[#b91c1c] hover:opacity-90'
                : 'bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] hover:opacity-90'
            }`}
          >
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}