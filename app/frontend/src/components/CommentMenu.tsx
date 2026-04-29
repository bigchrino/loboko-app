import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Flag, EyeOff, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  content: string;
  onHide: () => void;
  onReport: () => void;
}

export default function CommentMenu({ content, onHide, onReport }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Texte copié');
    } catch {
      toast.error('Impossible de copier');
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1 rounded-full text-[var(--loboko-text-muted)] hover:bg-[var(--loboko-surface-hover)]"
        aria-label="Options"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 min-w-[170px] rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={() => {
              onReport();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--loboko-surface-hover)] text-left"
          >
            <Flag size={13} />
            Signaler le commentaire
          </button>
          <button
            type="button"
            onClick={() => {
              onHide();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--loboko-surface-hover)] text-left"
          >
            <EyeOff size={13} />
            Masquer
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--loboko-surface-hover)] text-left"
          >
            <Copy size={13} />
            Copier le texte
          </button>
        </div>
      )}
    </div>
  );
}