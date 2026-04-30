import { useEffect, useState } from 'react';
import { X, Timer } from 'lucide-react';
import { EPHEMERAL_DURATIONS } from '@/lib/ephemeral';

interface Props {
  open: boolean;
  currentDuration: number;
  onClose: () => void;
  onConfirm: (durationSeconds: number) => Promise<void> | void;
}

export default function EphemeralSettingsDialog({
  open,
  currentDuration,
  onClose,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<number>(currentDuration);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setSelected(currentDuration);
  }, [open, currentDuration]);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(selected);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Messages éphémères"
    >
      <div className="w-full max-w-md bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl shadow-2xl overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--loboko-border)]">
          <div className="flex items-center gap-2">
            <Timer size={18} className="text-[#2563eb]" />
            <h2 className="font-semibold text-sm">Messages éphémères</h2>
          </div>
          <button
            type="button"
            onClick={busy ? undefined : onClose}
            className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </header>
        <div className="p-4 space-y-3">
          <p className="text-xs text-[var(--loboko-text-muted)]">
            Les nouveaux messages envoyés dans cette discussion disparaîtront
            automatiquement après la durée choisie. Les anciens messages ne
            sont pas affectés.
          </p>
          <div className="space-y-2">
            {EPHEMERAL_DURATIONS.map((opt) => {
              const active = selected === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelected(opt.value)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition ${
                    active
                      ? 'border-[#2563eb] bg-[rgba(37,99,235,0.12)] text-[var(--loboko-text)]'
                      : 'border-[var(--loboko-border)] bg-[var(--loboko-elevated)] hover:border-[#2563eb]/60 text-[var(--loboko-text)]'
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span
                    className={`w-4 h-4 rounded-full border-2 ${
                      active
                        ? 'border-[#2563eb] bg-[#2563eb]'
                        : 'border-[var(--loboko-border)]'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>
        <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--loboko-border)]">
          <button
            type="button"
            onClick={busy ? undefined : onClose}
            className="px-4 py-2 rounded-full text-sm bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white disabled:opacity-50"
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </footer>
      </div>
    </div>
  );
}