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

/** Extensions that must always be rejected for security reasons. */
export const BLOCKED_EXTENSIONS = ['exe', 'apk', 'bat', 'sh', 'js'] as const;

const ACCEPT_ATTR = '.pdf,.doc,.docx,.xls,.xlsx,.zip';

export interface FileSelection {
  file: File;
  ext: string; // lowercase extension (pdf, doc, docx, xls, xlsx, zip)
  size: number; // bytes
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
 * Small button that opens a document file picker. Validates the selected
 * file (size / extension / blocked types) before forwarding it to the
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
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error('Fichier trop volumineux (max 25 Mo).');
      return;
    }
    if (file.size === 0) {
      toast.error('Fichier vide.');
      return;
    }
    onSelect({ file, ext, size: file.size });
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