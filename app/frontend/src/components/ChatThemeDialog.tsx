import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { CHAT_THEMES, saveChatTheme, useChatTheme, type ChatTheme } from '@/lib/chat-theme';

export default function ChatThemeDialog({ open, owner, conversation, onClose }: {
  open: boolean; owner: string; conversation: string; onClose: () => void;
}) {
  const { theme } = useChatTheme(owner, conversation);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <section ref={panel} role="dialog" aria-modal="true" aria-labelledby="chat-theme-title"
        onKeyDown={event => {
          if (event.key === 'Escape') onClose();
          if (event.key !== 'Tab') return;
          const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button');
          if (!buttons?.length) return;
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}
        className="w-full max-w-sm rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] p-4"
        onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 id="chat-theme-title" className="font-semibold">Thème de la discussion</h2>
          <button onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        </div>
        <p className="text-sm text-[var(--loboko-text-secondary)] mb-4">Ce choix s’applique uniquement à votre compte sur ce navigateur.</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CHAT_THEMES) as ChatTheme[]).map(value => (
            <button key={value} aria-pressed={theme === value}
              style={{ backgroundColor: CHAT_THEMES[value].background }}
              className="rounded-xl border border-[var(--loboko-border)] p-3 text-sm"
              onClick={() => {
                try {
                  saveChatTheme(owner, conversation, value);
                  toast.success('Thème enregistré');
                  onClose();
                } catch { toast.error('Impossible d’enregistrer le thème sur ce navigateur'); }
              }}>
              {CHAT_THEMES[value].label}{theme === value ? ' ✓' : ''}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
