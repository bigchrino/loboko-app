import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { splitMentionChunks, resolveUsernameToId } from '@/lib/mentions';

interface Props {
  text: string;
  className?: string;
  // Called when a mention is clicked — if provided it is invoked INSTEAD of
  // navigating, so callers can handle mention clicks inside modals.
  onMentionClick?: (username: string) => void;
}

/**
 * Render text with @mentions highlighted as clickable links that resolve
 * the username to a user id and navigate to `/u/:userId`. Shows a toast
 * "Profil introuvable" when the mentioned user no longer exists.
 */
export default function MentionText({ text, className, onMentionClick }: Props) {
  const navigate = useNavigate();
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
      navigate(`/u/${userId}`);
    } catch (err) {
      console.error('Mention navigate failed:', err);
      toast.error('Profil introuvable');
    }
  };

  return (
    <span className={className ?? 'whitespace-pre-wrap break-words'}>
      {chunks.map((c, i) => {
        if (c.type === 'text') return <span key={i}>{c.value}</span>;
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