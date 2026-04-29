/**
 * Format a post's `created_at` timestamp into a short, French, human-readable
 * relative label used under the author's name in `PostCard`.
 *
 * Rules:
 * - < 1 minute: "À l'instant"
 * - 1-59 minutes: "il y a X min"
 * - 1-23 hours: "il y a X h"
 * - exactly 1 day: "il y a 1 jour"
 * - >= 2 days, same year: "DD/MM" (e.g. "15/09")
 * - different year: "DD/MM/YY" (e.g. "06/07/25")
 */
export function formatPostTime(createdAt?: string | null): string {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  // Future timestamps (clock skew) → treat as "À l'instant"
  if (diffMs < 0) return "À l'instant";

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHour < 24) return `il y a ${diffHour} h`;
  if (diffDay === 1) return 'il y a 1 jour';

  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  if (d.getFullYear() === now.getFullYear()) {
    return `${dd}/${mm}`;
  }
  const yy = d.getFullYear().toString().slice(-2);
  return `${dd}/${mm}/${yy}`;
}