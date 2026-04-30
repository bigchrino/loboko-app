import { useEffect, useState } from 'react';
import { X, Eye, Loader2 } from 'lucide-react';
import { getMediaUrl } from '@/lib/storage-helpers';
import { loadStatusViewers, StatusViewer } from '@/lib/status-helpers';

interface Props {
  statusId: string | null;
  open: boolean;
  onClose: () => void;
}

/** List of users who viewed a given status (owner-only view). */
export default function StatusViewsModal({ statusId, open, onClose }: Props) {
  const [viewers, setViewers] = useState<StatusViewer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !statusId) return;
    let cancelled = false;
    setLoading(true);
    loadStatusViewers(statusId)
      .then((list) => {
        if (!cancelled) setViewers(list);
      })
      .catch(() => {
        if (!cancelled) setViewers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, statusId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-[var(--loboko-elevated)] sm:rounded-2xl rounded-t-2xl border border-[var(--loboko-border)] shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--loboko-border)]">
          <div className="flex items-center gap-2">
            <Eye size={18} className="text-[#2563eb]" />
            <h3 className="font-semibold">Vues ({viewers.length})</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[var(--loboko-surface-hover)] flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-[var(--loboko-text-muted)]">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : viewers.length === 0 ? (
            <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
              Personne n'a encore vu ce statut.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--loboko-border)]">
              {viewers.map((v) => (
                <ViewerRow key={v.id} viewer={v} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewerRow({ viewer }: { viewer: StatusViewer }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const k = viewer.author.avatar_key;
    if (!k) {
      setUrl(null);
      return;
    }
    getMediaUrl(k).then((u) => {
      if (!cancelled) setUrl(u || null);
    });
    return () => {
      cancelled = true;
    };
  }, [viewer.author.avatar_key]);
  const label =
    viewer.author.display_name || viewer.author.username || 'utilisateur';
  const when = new Date(viewer.viewed_at).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="w-10 h-10 rounded-full bg-[var(--loboko-surface)] overflow-hidden flex items-center justify-center text-sm font-bold">
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span>{label.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{label}</div>
        <div className="text-xs text-[var(--loboko-text-muted)] truncate">
          {when}
        </div>
      </div>
    </li>
  );
}