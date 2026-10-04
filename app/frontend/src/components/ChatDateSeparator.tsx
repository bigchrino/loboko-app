import { chatDayKey, formatChatDay } from '@/lib/chat-date';

export default function ChatDateSeparator({ createdAt, previousAt }: {
  createdAt?: string | null;
  previousAt?: string | null;
}) {
  const day = chatDayKey(createdAt);
  if (!day || day === chatDayKey(previousAt)) return null;
  return (
    <div className="flex items-center gap-3 py-3 select-none" role="separator" aria-label={formatChatDay(createdAt)}>
      <span className="h-px flex-1 bg-[var(--loboko-border)]" aria-hidden="true" />
      <span className="rounded-full border border-[var(--loboko-border)] px-3 py-1 text-xs text-[var(--loboko-text-muted)]">
        {formatChatDay(createdAt)}
      </span>
      <span className="h-px flex-1 bg-[var(--loboko-border)]" aria-hidden="true" />
    </div>
  );
}
