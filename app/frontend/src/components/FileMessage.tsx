import { useEffect, useState } from 'react';
import { FileText, Download, FileArchive, FileSpreadsheet } from 'lucide-react';
import { getMediaUrl } from '@/lib/storage-helpers';
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
 * the human-readable size, and an explicit "Ouvrir" action that resolves the
 * Supabase Storage key into a URL on click. We never render the file
 * contents inline — the user must explicitly open or download it.
 */
export default function FileMessage({
  objectKey,
  fileName,
  fileSize,
  fileType,
  mine,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Preload the URL so that the "Ouvrir" action opens instantly.
    getMediaUrl(objectKey).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [objectKey]);

  const onOpen = async (e: React.MouseEvent) => {
    // Safety: prevent long-press-to-action from firing on the wrapping bubble.
    e.stopPropagation();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setLoading(true);
    try {
      const u = await getMediaUrl(objectKey);
      if (u) window.open(u, '_blank', 'noopener,noreferrer');
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
        title="Ouvrir ou télécharger"
      >
        <Download size={16} />
      </button>
    </div>
  );
}