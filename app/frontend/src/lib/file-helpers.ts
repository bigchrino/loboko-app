/**
 * Helpers for document attachments (PDF, Word, Excel, ZIP).
 *
 * These are pure formatting helpers used by both the file preview bubble
 * before sending and the file message bubble in the conversation.
 */

/**
 * Format a byte count into a short human-readable string, e.g. `2.3 MB`.
 * Uses decimal (1 MB = 1000 KB) for consistency with most OS file managers.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  const rounded = unitIdx === 0 ? value.toFixed(0) : value.toFixed(value >= 10 ? 1 : 2);
  return `${rounded} ${units[unitIdx]}`;
}

/** Short, user-facing label for a given lowercase extension. */
export function fileTypeLabel(ext: string): string {
  switch (ext) {
    case 'pdf':
      return 'PDF';
    case 'doc':
      return 'DOC';
    case 'docx':
      return 'DOCX';
    case 'xls':
      return 'XLS';
    case 'xlsx':
      return 'XLSX';
    case 'zip':
      return 'ZIP';
    default:
      return ext.toUpperCase();
  }
}

/** Lowercase extension without the leading dot, or an empty string. */
export function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  if (i < 0) return '';
  return fileName.slice(i + 1).toLowerCase();
}