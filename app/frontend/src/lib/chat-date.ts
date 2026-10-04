function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function chatDayKey(value?: string | null): string {
  const date = parseDate(value);
  return date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : '';
}

export function formatChatTime(value?: string | null): string {
  return parseDate(value)?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) ?? '';
}

export function formatChatDay(value?: string | null, now = new Date()): string {
  const date = parseDate(value);
  if (!date) return '';
  if (chatDayKey(value) === chatDayKey(now.toISOString())) return "Aujourd’hui";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (chatDayKey(value) === chatDayKey(yesterday.toISOString())) return 'Hier';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}
