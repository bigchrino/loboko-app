import { FileText, FileArchive, FileSpreadsheet, X } from 'lucide-react';
import { FileSelection } from '@/components/FilePicker';
import { formatFileSize, fileTypeLabel } from '@/lib/file-helpers';

interface Props {
  file: FileSelection;
  onRemove: () => void;
}

function IconForType({ type, size = 22 }: { type: string; size?: number }) {
  if (type === 'zip') return <FileArchive size={size} />;
  if (type === 'xls' || type === 'xlsx') return <FileSpreadsheet size={size} />;
  return <FileText size={size} />;
}

/**
 * Compact pre-send preview of a document attachment. Shown between the
 * message list and the composer, with a cancel button. The actual "Envoyer"
 * button is rendered by the parent (Messages / GroupChat) to keep the
 * sending logic co-located with the conversation state.
 */
export default function FilePreview({ file, onRemove }: Props) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]">
      <div className="w-10 h-10 rounded-lg bg-[rgba(37,99,235,0.15)] text-[#2563eb] flex items-center justify-center shrink-0">
        <IconForType type={file.ext} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" title={file.file.name}>
          {file.file.name}
        </div>
        <div className="text-[11px] text-[var(--loboko-text-muted)] truncate">
          {fileTypeLabel(file.ext)} · {formatFileSize(file.size)}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="w-8 h-8 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] flex items-center justify-center shrink-0"
        aria-label="Annuler"
        title="Annuler"
      >
        <X size={14} />
      </button>
    </div>
  );
}