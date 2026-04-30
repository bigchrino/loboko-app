import { Link } from 'react-router-dom';
import { splitMentionChunks } from '@/lib/mentions';

interface Props {
  text: string;
  className?: string;
  // Called when a mention is clicked — if provided it is invoked INSTEAD of
  // navigating, so callers can handle mention clicks inside modals.
  onMentionClick?: (username: string) => void;
}

/**
 * Render text with @mentions highlighted as links to /profile/:username.
 * Preserves whitespace and line breaks via `whitespace-pre-wrap` on the
 * outer span (callers can override with className).
 */
export default function MentionText({ text, className, onMentionClick }: Props) {
  const chunks = splitMentionChunks(text || '');
  return (
    <span className={className ?? 'whitespace-pre-wrap break-words'}>
      {chunks.map((c, i) => {
        if (c.type === 'text') return <span key={i}>{c.value}</span>;
        if (onMentionClick) {
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMentionClick(c.username);
              }}
              className="text-[#60a5fa] hover:underline font-medium"
            >
              @{c.username}
            </button>
          );
        }
        return (
          <Link
            key={i}
            to={`/profile/${c.username}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[#60a5fa] hover:underline font-medium"
          >
            @{c.username}
          </Link>
        );
      })}
    </span>
  );
}