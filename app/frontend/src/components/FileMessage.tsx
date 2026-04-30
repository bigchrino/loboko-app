import { useState } from 'react';
import { FileText, Download, FileArchive, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSignedStorageUrl } from '@/lib/storage-helpers';
import { formatFileSize, fileTypeLabel } from '@/lib/file-helpers';

interface Props {
  objectKey: string;
  fileName: string;
  fileSize: number;
  fileType: string; // lowercase extension
  mine?: boolean;
}

function IconForType({ type, size = 24 }: { type: string; size?: number }) {
  if (type === 'zip') return <FileArchive size={size} />;
  if (type === 'xls' || type === 'xlsx') return <FileSpreadsheet size={size} />;
  // PDF / DOC / DOCX / fallback
  return <FileText size={size} />;
}

/**
 * Render a document (PDF/Word/Excel/ZIP) bubble inside a conversation.
 *
 * The bubble shows an icon based on the file type, the original filename,
 * the human-readable size, and an explicit "Ouvrir" action.
 *
 * ⚠️ Security: we store files in the **private** `message-documents`
 * bucket. No URL is generated at render time. When the user clicks
 * "Ouvrir", we request a short-lived **signed URL** (60s TTL) via
 * `getSignedStorageUrl`, then open it in a new tab. If the user has no
 * access to the file (RLS check fails), the signed URL request itself
 * fails and we show a permission error.
 */
export default function FileMessage({
  objectKey,
  fileName,
  fileSize,
  fileType,
  mine,
}: Props) {
  const [loading, setLoading] = useState(false);

  const onOpen = async (e: React.MouseEvent) => {
    // Prevent long-press-to-action from firing on the wrapping bubble.
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      // Short TTL is deliberate: the signed URL is only useful for the
      // couple of seconds between the click and the browser navigating to
      // the file. It expires almost immediately afterwards, which limits
      // damage if the URL is accidentally shared or captured.
      const { url, error } = await getSignedStorageUrl(objectKey, 60);
      if (!url) {
        toast.error(error || 'Impossible d’ouvrir le fichier.');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setLoading(false);
    }
  };

  const iconBg = mine ? 'bg-white/15 text-white' : 'bg-[rgba(37,99,235,0.15)] text-[#2563eb]';
  const subText = mine ? 'text-white/80' : 'text-[var(--loboko-text-muted)]';
  const actionBg = mine
    ? 'bg-white/15 hover:bg-white/25 text-white'
    : 'bg-[rgba(37,99,235,0.15)] hover:bg-[rgba(37,99,235,0.25)] text-[#2563eb]';

  return (
    <div className="flex items-center gap-3 min-w-[220px] max-w-[280px]">
      <div
        className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
      >
        <IconForType type={fileType} size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" title={fileName}>
          {fileName}
        </div>
        <div className={`text-[11px] truncate ${subText}`}>
          {fileTypeLabel(fileType)} · {formatFileSize(fileSize)}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={loading}
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${actionBg} disabled:opacity-50`}
        aria-label="Ouvrir le fichier"
        title="Ouvrir ou télécharger (lien temporaire)"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
      </button>
    </div>
  );
}