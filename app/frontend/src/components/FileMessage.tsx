import { useState } from 'react';
import {
  FileText,
  Download,
  FileArchive,
  FileSpreadsheet,
  Loader2,
  Check,
} from 'lucide-react';
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

type DownloadState = 'idle' | 'loading' | 'done' | 'error';

/**
 * Detect iOS (including iPadOS running in "desktop" mode). iOS Safari
 * ignores the <a download> attribute for cross-origin URLs, so we must
 * fall back to opening the signed URL in a new tab and instruct the user
 * to long-press to save.
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as Mac but is touch-capable.
  const maxTouch = (navigator as unknown as { maxTouchPoints?: number })
    .maxTouchPoints;
  return (
    /Macintosh/.test(ua) && typeof maxTouch === 'number' && maxTouch > 1
  );
}

/**
 * Trigger a real file download by fetching the signed URL as a Blob and
 * anchoring it through `URL.createObjectURL`. This bypasses the browser
 * `Content-Disposition: inline` heuristic that PDFs and images suffer
 * from, and guarantees that `<a download>` is honored on desktop
 * browsers and Android Chrome.
 *
 * Returns `true` on success, `false` if the fetch itself failed (which
 * lets the caller fall back to opening the signed URL in a new tab).
 */
async function triggerBlobDownload(
  url: string,
  fileName: string,
): Promise<boolean> {
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) return false;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Some browsers need the element to live one tick before revoking.
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    }, 1000);
    return true;
  } catch (e) {
    console.warn('[triggerBlobDownload] failed', e);
    return false;
  }
}

/**
 * Render a document (PDF/Word/Excel/ZIP) bubble inside a conversation.
 *
 * The bubble shows an icon based on the file type, the original filename,
 * the human-readable size, and an explicit "Télécharger" action.
 *
 * ⚠️ Security: we store files in the **private** `message-documents`
 * bucket. No URL is generated at render time. When the user clicks
 * "Télécharger", we request a short-lived **signed URL** (60s TTL) via
 * `getSignedStorageUrl`, then force a real download:
 *
 * 1. **Desktop + Android**: fetch the signed URL, wrap it in a Blob,
 *    use `<a download="filename">` + programmatic click. This forces a
 *    real "Save as" download even for PDFs/images that browsers would
 *    normally render inline.
 * 2. **iOS / iPadOS**: `<a download>` is not honored cross-origin, so we
 *    open the signed URL in a new tab and show a toast telling the user
 *    to long-press the file to save it.
 *
 * The button shows three visible states: idle (download icon),
 * "Téléchargement…" (spinner), and briefly a green check on success.
 * Errors go through `toast.error` so the user always sees feedback.
 */
export default function FileMessage({
  objectKey,
  fileName,
  fileSize,
  fileType,
  mine,
}: Props) {
  const [state, setState] = useState<DownloadState>('idle');

  const onDownload = async (e: React.MouseEvent) => {
    // Prevent long-press-to-action from firing on the wrapping bubble.
    e.stopPropagation();
    if (state === 'loading') return;
    setState('loading');
    try {
      // Short TTL is deliberate: the signed URL is only useful for the
      // couple of seconds between the click and the actual download.
      // It expires almost immediately afterwards, which limits damage
      // if the URL is accidentally shared or captured.
      const { url, error } = await getSignedStorageUrl(objectKey, 60);
      if (!url) {
        toast.error(error || 'Impossible de télécharger le fichier.');
        setState('error');
        // Auto-reset to idle so the user can retry.
        setTimeout(() => setState('idle'), 1500);
        return;
      }

      if (isIOS()) {
        // iOS Safari / iPadOS: <a download> is ignored for cross-origin
        // URLs. Best we can do is open in a new tab and let the user
        // long-press to save into Files.
        window.open(url, '_blank', 'noopener,noreferrer');
        toast.info('Maintenez le fichier pour l’enregistrer.');
        setState('done');
        setTimeout(() => setState('idle'), 1500);
        return;
      }

      const ok = await triggerBlobDownload(url, fileName);
      if (ok) {
        setState('done');
        toast.success('Téléchargement lancé');
        setTimeout(() => setState('idle'), 1500);
        return;
      }

      // Fallback: direct anchor with `download` attribute. Works on most
      // desktop browsers and Android Chrome even if the fetch above was
      // blocked (e.g. strict CORS on the Storage CDN).
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener';
      a.target = '_blank';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setState('done');
      toast.success('Téléchargement lancé');
      setTimeout(() => setState('idle'), 1500);
    } catch (err) {
      console.error('[FileMessage] download error', err);
      toast.error('Échec du téléchargement.');
      setState('error');
      setTimeout(() => setState('idle'), 1500);
    }
  };

  const iconBg = mine
    ? 'bg-white/15 text-white'
    : 'bg-[rgba(37,99,235,0.15)] text-[#2563eb]';
  const subText = mine ? 'text-white/80' : 'text-[var(--loboko-text-muted)]';
  const actionBg = mine
    ? 'bg-white/15 hover:bg-white/25 text-white'
    : 'bg-[rgba(37,99,235,0.15)] hover:bg-[rgba(37,99,235,0.25)] text-[#2563eb]';

  const actionLabel =
    state === 'loading'
      ? 'Téléchargement…'
      : state === 'done'
        ? 'Téléchargé'
        : 'Télécharger le fichier';

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
          {state === 'loading'
            ? 'Téléchargement…'
            : `${fileTypeLabel(fileType)} · ${formatFileSize(fileSize)}`}
        </div>
      </div>
      <button
        type="button"
        onClick={onDownload}
        disabled={state === 'loading'}
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${actionBg} disabled:opacity-70`}
        aria-label={actionLabel}
        title={actionLabel}
      >
        {state === 'loading' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : state === 'done' ? (
          <Check size={16} />
        ) : (
          <Download size={16} />
        )}
      </button>
    </div>
  );
}