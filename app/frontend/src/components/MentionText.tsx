import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { splitMentionChunks, resolveUsernameToId } from '@/lib/mentions';

interface Props {
  text: string;
  className?: string;
  // Called when a mention is clicked — if provided it is invoked INSTEAD of
  // navigating, so callers can handle mention clicks inside modals.
  onMentionClick?: (username: string) => void;
  // Optional context passed as navigation state so that the target profile
  // screen can "come back" to the exact original location (including
  // re-opening the comments modal for the right post/comment).
  returnContext?: {
    // Post id if the mention was rendered inside a post or a comment.
    postId?: string;
    // Comment id if the mention was inside a specific comment.
    commentId?: string;
    // When true, UserProfile back button should re-open the comments modal
    // on that post and scroll to `commentId`.
    openComments?: boolean;
  };
}

/**
 * Render text with @mentions highlighted as clickable links that resolve
 * the username to a user id and navigate to `/u/:userId`. Shows a toast
 * "Profil introuvable" when the mentioned user no longer exists.
 *
 * When navigating, we attach the current pathname+search as `state.from`
 * along with an optional `returnContext`, so the profile page's back
 * button can bring the user back to their exact previous location
 * (e.g. the same feed scroll position + open the comments modal on the
 * original comment).
 */
export default function MentionText({
  text,
  className,
  onMentionClick,
  returnContext,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const chunks = splitMentionChunks(text || '');

  const handleClick = async (username: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onMentionClick) {
      onMentionClick(username);
      return;
    }
    try {
      const userId = await resolveUsernameToId(username);
      if (!userId) {
        toast.error('Profil introuvable');
        return;
      }
      // Preserve the "grand-parent" origin so UserProfile can forward it
      // when sending the user back to the post page. This is what lets the
      // post detail's in-app Back button return to the real origin (home,
      // a profile, a conversation) instead of feeling inert after a
      // history replace.
      const currentState = (location.state as { from?: string } | null) || null;
      const grandFrom = currentState?.from;
      const enrichedReturnCtx = returnContext
        ? { ...returnContext, originalFrom: grandFrom }
        : grandFrom
        ? { originalFrom: grandFrom }
        : null;
      navigate(`/u/${userId}`, {
        state: {
          from: `${location.pathname}${location.search}${location.hash}`,
          returnContext: enrichedReturnCtx,
        },
      });
    } catch (err) {
      console.error('Mention navigate failed:', err);
      toast.error('Profil introuvable');
    }
  };

  return (
    <span className={className ?? 'whitespace-pre-wrap break-words'}>
      {chunks.map((c, i) => {
        if (c.type === 'text') return <span key={i}>{c.value}</span>;
        if (c.type === 'link') {
          return (
            <a
              key={i}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[#60a5fa] hover:underline break-all"
            >
              {c.display}
            </a>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => handleClick(c.username, e)}
            className="text-[#60a5fa] hover:underline font-medium cursor-pointer bg-transparent border-0 p-0 inline"
          >
            @{c.username}
          </button>
        );
      })}
    </span>
  );
}
