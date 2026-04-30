import { useRef } from 'react';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Maximum document size, in bytes (25 MB). Mirrors the `message-documents`
 * entry in `storage-helpers.ts`.
 */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/** Extensions users are allowed to send as documents. */
export const ALLOWED_DOC_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'zip',
] as const;

/**
 * Allowed MIME types, indexed by extension. We check both the extension
 * and the browser-reported MIME type so that files with a "safe" extension
 * but a suspicious content type (a disguised executable renamed to
 * `.pdf`) are rejected client-side. Browsers sometimes leave `type` empty
 * for exotic files; we accept an empty MIME only when the extension is
 * already in the allow-list.
 */
const ALLOWED_MIME_BY_EXT: Record<string, readonly string[]> = {
  pdf: ['application/pdf', 'application/x-pdf'],
  doc: ['application/msword'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  xls: ['application/vnd.ms-excel'],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  zip: [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
    'multipart/x-zip',
  ],
};

/**
 * MIME prefixes that must **always** be rejected on the client, no matter
 * what the extension claims. These match obvious dangerous content types
 * (executables, scripts, HTML) that should never travel as a document.
 */
const BLOCKED_MIME_PREFIXES: readonly string[] = [
  'application/x-msdownload',
  'application/x-dosexec',
  'application/x-sh',
  'application/x-csh',
  'application/x-bat',
  'application/javascript',
  'application/ecmascript',
  'application/x-httpd-php',
  'text/html',
  'text/javascript',
  'text/x-shellscript',
];

/** Extensions that must always be rejected for security reasons. */
export const BLOCKED_EXTENSIONS = ['exe', 'apk', 'bat', 'sh', 'js'] as const;

const ACCEPT_ATTR = '.pdf,.doc,.docx,.xls,.xlsx,.zip';

export interface FileSelection {
  file: File;
  ext: string; // lowercase extension (pdf, doc, docx, xls, xlsx, zip)
  size: number; // bytes
  mime: string; // lowercase, may be empty if the browser could not detect it
}

interface Props {
  onSelect: (selection: FileSelection) => void;
  compact?: boolean;
  disabled?: boolean;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  if (i < 0) return '';
  return name.slice(i + 1).toLowerCase();
}

/**
 * Check that the browser-reported MIME type matches the allow-list for the
 * given extension. Returns a human-readable error or `null` when valid.
 *
 * We intentionally allow an empty MIME (some browsers do not detect the
 * type of older Office formats) as long as the extension itself is in the
 * allow-list. An empty MIME combined with an already-rejected extension
 * would never reach this function.
 */
function validateMime(ext: string, mime: string): string | null {
  const lowered = mime.toLowerCase();
  for (const prefix of BLOCKED_MIME_PREFIXES) {
    if (lowered.startsWith(prefix)) {
      return 'Type de fichier bloqué pour des raisons de sécurité.';
    }
  }
  const allowed = ALLOWED_MIME_BY_EXT[ext];
  if (!allowed) return 'Format non supporté.';
  if (lowered === '') return null; // tolerate unknown MIME when ext is allowed
  if (!allowed.includes(lowered)) {
    return "Le contenu du fichier ne correspond pas à son extension.";
  }
  return null;
}

/**
 * Small button that opens a document file picker. Validates the selected
 * file (extension, MIME, size, blocked types) before forwarding it to the
 * caller. The caller is responsible for uploading.
 */
export default function FilePicker({ onSelect, compact, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (file: File) => {
    const ext = extOf(file.name);
    if (!ext) {
      toast.error('Format de fichier non reconnu.');
      return;
    }
    if ((BLOCKED_EXTENSIONS as readonly string[]).includes(ext)) {
      toast.error(
        `Les fichiers .${ext} sont interdits pour des raisons de sécurité.`,
      );
      return;
    }
    if (!(ALLOWED_DOC_EXTENSIONS as readonly string[]).includes(ext)) {
      toast.error(
        'Format non supporté. Autorisés : PDF, Word (.doc, .docx), Excel (.xls, .xlsx), ZIP.',
      );
      return;
    }
    const mime = (file.type || '').toLowerCase();
    const mimeErr = validateMime(ext, mime);
    if (mimeErr) {
      toast.error(mimeErr);
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error('Fichier trop volumineux (max 25 Mo).');
      return;
    }
    if (file.size === 0) {
      toast.error('Fichier vide.');
      return;
    }
    onSelect({ file, ext, size: file.size, mime });
  };

  const baseBtn = compact
    ? 'w-9 h-9 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] flex items-center justify-center text-[var(--loboko-text)]'
    : 'flex items-center gap-1.5 px-3 py-2 rounded-full text-[#2563eb] hover:bg-[rgba(37,99,235,0.15)] transition text-sm font-medium';

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (inputRef.current) inputRef.current.value = '';
          inputRef.current?.click();
        }}
        className={baseBtn}
        aria-label="Envoyer un document"
        title="Document (PDF, Word, Excel, ZIP)"
      >
        <FileText size={compact ? 16 : 18} />
        {!compact && <span>Document</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
        }}
      />
    </>
  );
}