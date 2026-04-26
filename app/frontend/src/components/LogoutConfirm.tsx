import { LogOut, X } from 'lucide-react';

interface LogoutConfirmProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export default function LogoutConfirm({ open, onCancel, onConfirm, loading }: LogoutConfirmProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-[var(--loboko-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(239,68,68,0.15)] flex items-center justify-center">
              <LogOut size={20} className="text-[#ef4444]" />
            </div>
            <div>
              <div className="font-semibold text-[var(--loboko-text)]">Déconnexion</div>
              <div className="text-xs text-[var(--loboko-text-secondary)]">Confirmer votre choix</div>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] hover:bg-[var(--loboko-surface-hover)] transition"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-[var(--loboko-text-secondary)]">
            Voulez-vous vraiment vous déconnecter de votre compte LOBOKO ?
          </p>
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl !bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-[var(--loboko-text)] font-semibold hover:border-[var(--loboko-text-muted)] transition disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#ef4444] text-white font-semibold hover:bg-[#dc2626] transition disabled:opacity-50"
          >
            {loading ? '...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}