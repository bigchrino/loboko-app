import { useEffect, useRef, useState } from 'react';
import { X, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import { toast } from 'sonner';
import { createNotification } from '@/lib/notifications';

interface CommentRow {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at?: string;
}

interface Author {
  username?: string;
  display_name?: string;
  avatar_key?: string;
  avatar_url?: string;
}

interface Props {
  postId: string;
  postAuthorId?: string;
  open: boolean;
  onClose: () => void;
  currentUserId?: string;
  onCommentAdded?: () => void;
}

export default function CommentsModal({
  postId,
  postAuthorId,
  open,
  onClose,
  currentUserId,
  onCommentAdded,
}: Props) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const loadComments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data as CommentRow[]) || [];
      setComments(rows);

      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_key')
          .in('user_id', userIds);
        const map: Record<string, Author> = {};
        await Promise.all(
          (profiles || []).map(async (p: any) => {
            let avatar_url: string | undefined;
            if (p.avatar_key) {
              try {
                avatar_url = (await getMediaUrl(p.avatar_key)) || undefined;
              } catch {
                /* ignore */
              }
            }
            map[p.user_id] = {
              username: p.username,
              display_name: p.display_name,
              avatar_key: p.avatar_key,
              avatar_url,
            };
          }),
        );
        setAuthors(map);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, postId]);

  const handleSend = async () => {
    const text = content.trim();
    if (!text || !currentUserId) return;
    setSending(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: postId,
        user_id: currentUserId,
        content: text,
      });
      if (error) throw error;
      setContent('');
      await loadComments();
      onCommentAdded?.();
      // Notify the post author (no-op if commenter is the author)
      if (postAuthorId) {
        await createNotification({
          recipientId: postAuthorId,
          fromUserId: currentUserId,
          type: 'comment',
          postId,
          message: 'a commenté votre publication',
        });
      }
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    } catch (e) {
      console.error(e);
      toast.error("Impossible d'envoyer le commentaire");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--loboko-surface)] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-[var(--loboko-border)] h-[85vh] sm:h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--loboko-border)] flex-shrink-0">
          <h3 className="font-semibold text-sm">Commentaires</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]">
            <X size={18} />
          </button>
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="py-10 text-center text-sm text-[var(--loboko-text-muted)]">Chargement...</div>
          ) : comments.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--loboko-text-muted)]">
              Soyez le premier à commenter !
            </div>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => {
                const a = authors[c.user_id];
                const name = a?.display_name || a?.username || 'Utilisateur';
                const initials = name.slice(0, 2).toUpperCase();
                return (
                  <li key={c.id} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                      {a?.avatar_url ? (
                        <img src={a.avatar_url} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-[var(--loboko-surface-hover)] rounded-2xl px-3 py-2">
                        <div className="font-semibold text-xs mb-0.5">{name}</div>
                        <div className="text-sm whitespace-pre-wrap break-words">{c.content}</div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-[var(--loboko-border)] p-3 flex items-center gap-2 flex-shrink-0">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={currentUserId ? 'Écrire un commentaire...' : 'Connectez-vous pour commenter'}
            disabled={!currentUserId || sending}
            className="flex-1 bg-[var(--loboko-surface-hover)] border border-[var(--loboko-border)] rounded-full px-4 py-2 text-sm outline-none focus:border-[#2563eb] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!currentUserId || sending || !content.trim()}
            className="w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center hover:bg-[#1d4ed8] transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}