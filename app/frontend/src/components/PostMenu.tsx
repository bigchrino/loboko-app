import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Copy, Flag, Trash2, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import ReportDialog from '@/components/ReportDialog';

interface Props {
  postId: string;
  postAuthorId: string;
  currentUserId?: string;
  onDeleted?: () => void;
}

/**
 * Contextual menu on each post card.
 *
 * Non-owners can:
 *   - copy the post link
 *   - hide the post locally (UI only for now)
 *   - report the post — opens `ReportDialog`, which writes to the
 *     `reports` table. The DB-level unique constraint prevents a single
 *     user from reporting the same post twice.
 *
 * Owners can delete their own post (RLS enforces this on the server).
 */
export default function PostMenu({ postId, postAuthorId, currentUserId, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isOwner = !!currentUserId && currentUserId === postAuthorId;

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const postUrl = `${window.location.origin}/post/${postId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      toast.success('Lien copié');
    } catch {
      toast.error('Impossible de copier le lien');
    }
    setOpen(false);
  };

  const openReport = () => {
    setOpen(false);
    setReportOpen(true);
  };

  const hide = () => {
    toast.info('Publication masquée');
    setOpen(false);
  };

  const remove = async () => {
    if (!confirm('Supprimer cette publication ?')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      toast.success('Publication supprimée');
      onDeleted?.();
    } catch (e) {
      console.error(e);
      toast.error('Suppression impossible');
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] p-1"
        aria-label="Menu"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-48 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-xl shadow-lg overflow-hidden">
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--loboko-surface-hover)] text-left"
          >
            <Copy size={16} /> Copier le lien
          </button>
          {!isOwner && (
            <>
              <button
                onClick={hide}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--loboko-surface-hover)] text-left"
              >
                <EyeOff size={16} /> Masquer
              </button>
              <button
                onClick={openReport}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--loboko-surface-hover)] text-left text-[#f59e0b]"
              >
                <Flag size={16} /> Signaler
              </button>
            </>
          )}
          {isOwner && (
            <button
              onClick={remove}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--loboko-surface-hover)] text-left text-[#ef4444]"
            >
              <Trash2 size={16} /> Supprimer
            </button>
          )}
        </div>
      )}

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Signaler cette publication"
        reportedPostId={postId}
      />
    </div>
  );
}