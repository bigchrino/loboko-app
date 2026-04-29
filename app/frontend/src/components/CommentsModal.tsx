import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Send, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import { toast } from 'sonner';
import { createNotification } from '@/lib/notifications';
import { formatPostTime } from '@/lib/format-time';
import CommentMenu from './CommentMenu';
import EmojiPickerMini from './EmojiPickerMini';

interface CommentRow {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at?: string;
  parent_comment_id?: string | null;
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

interface ReplyTarget {
  // The comment the user is replying to (can be a top-level comment or another reply).
  targetCommentId: string;
  // The thread root (top-level comment id) where the reply will be stored.
  rootCommentId: string;
  // Display name of the person being replied to (for "— name" prefix and placeholder).
  targetName: string;
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
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [likesSupported, setLikesSupported] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

      // Load likes (graceful fallback if table does not exist yet)
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: likeRows, error: likeErr } = await supabase
          .from('comment_likes')
          .select('comment_id, user_id')
          .in('comment_id', ids);
        if (likeErr) {
          const code = (likeErr as { code?: string }).code;
          if (code === '42P01' || likeErr.message?.toLowerCase().includes('does not exist')) {
            setLikesSupported(false);
          } else {
            console.error('[comments] likes load error:', likeErr);
          }
          setLikeCounts({});
          setMyLikes(new Set());
        } else {
          setLikesSupported(true);
          const counts: Record<string, number> = {};
          const mine = new Set<string>();
          (likeRows || []).forEach((l: { comment_id: string; user_id: string }) => {
            counts[l.comment_id] = (counts[l.comment_id] || 0) + 1;
            if (currentUserId && l.user_id === currentUserId) mine.add(l.comment_id);
          });
          setLikeCounts(counts);
          setMyLikes(mine);
        }
      } else {
        setLikeCounts({});
        setMyLikes(new Set());
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
    setReplyTo(null);
    setExpandedThreads(new Set());
    setHidden(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, postId]);

  // Build thread structure: top-level comments and their replies.
  const { topLevel, repliesByRoot } = useMemo(() => {
    const visible = comments.filter((c) => !hidden.has(c.id));
    const byId = new Map(visible.map((c) => [c.id, c] as const));
    const top: CommentRow[] = [];
    const replies = new Map<string, CommentRow[]>();

    // Helper: find the root of a thread (top-level ancestor).
    const findRoot = (c: CommentRow): string => {
      let cur = c;
      // Walk up parent chain using full list (not filtered) so hidden parents still resolve root.
      const all = new Map(comments.map((x) => [x.id, x] as const));
      while (cur.parent_comment_id) {
        const parent = all.get(cur.parent_comment_id);
        if (!parent) break;
        cur = parent;
      }
      return cur.id;
    };

    for (const c of visible) {
      if (!c.parent_comment_id) {
        top.push(c);
      } else {
        // This is a reply. Store under its thread root.
        const rootId = findRoot(c);
        // Skip if its own id is the root (shouldn't happen) or if parent missing entirely in visible.
        if (rootId === c.id) {
          top.push(c);
          continue;
        }
        if (!byId.has(rootId) && !comments.find((x) => x.id === rootId)) {
          // Root not found at all, treat as top-level
          top.push(c);
          continue;
        }
        const arr = replies.get(rootId) || [];
        arr.push(c);
        replies.set(rootId, arr);
      }
    }
    // Sort replies by created_at ascending
    replies.forEach((arr) => {
      arr.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    });
    return { topLevel: top, repliesByRoot: replies };
  }, [comments, hidden]);

  const getName = (userId: string): string => {
    const a = authors[userId];
    return a?.display_name || a?.username || 'Utilisateur';
  };

  const handleSend = async () => {
    const text = content.trim();
    if (!text) return;
    if (!currentUserId) {
      toast.error('Vous devez être connecté pour commenter');
      return;
    }
    setSending(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) console.error('[comments] auth.getUser error:', authErr);
      const authUid = authData?.user?.id;
      if (!authUid) {
        toast.error('Session expirée, reconnectez-vous');
        return;
      }

      const payload: Record<string, unknown> = {
        post_id: postId,
        user_id: authUid,
        content: text,
      };
      if (replyTo) {
        // Store parent as the thread root so listing stays flat (single-level visual).
        payload.parent_comment_id = replyTo.rootCommentId;
      }

      let { data: inserted, error } = await supabase
        .from('comments')
        .insert(payload)
        .select()
        .single();

      // Fallback if parent_comment_id column does not exist yet.
      if (
        error &&
        replyTo &&
        (error.message?.toLowerCase().includes('parent_comment_id') ||
          (error as { code?: string }).code === '42703')
      ) {
        const retry = await supabase
          .from('comments')
          .insert({ post_id: postId, user_id: authUid, content: text })
          .select()
          .single();
        inserted = retry.data;
        error = retry.error;
        if (!error) {
          toast.message(
            "Réponse enregistrée comme commentaire normal (exécutez COMMENTS_SOCIAL_SETUP.md pour activer les réponses).",
          );
        }
      }

      if (error) {
        console.error('[comments] insert error:', error);
        const code = (error as { code?: string }).code;
        let userMsg = "Impossible d'envoyer le commentaire";
        if (error.message?.toLowerCase().includes('row-level security') || code === '42501') {
          userMsg =
            'Erreur de permissions (RLS). Exécutez le SQL de COMMENTS_SETUP.md dans Supabase.';
        } else if (code === '42P01' || error.message?.toLowerCase().includes('does not exist')) {
          userMsg =
            "La table 'comments' n'existe pas. Exécutez le SQL de COMMENTS_SETUP.md dans Supabase.";
        } else if (error.message) {
          userMsg = `Erreur: ${error.message}`;
        }
        toast.error(userMsg);
        return;
      }
      setContent('');
      const wasReply = !!replyTo;
      const rootForExpand = replyTo?.rootCommentId;
      setReplyTo(null);
      await loadComments();
      if (wasReply && rootForExpand) {
        setExpandedThreads((prev) => {
          const next = new Set(prev);
          next.add(rootForExpand);
          return next;
        });
      }
      onCommentAdded?.();
      if (postAuthorId) {
        try {
          await createNotification({
            recipientId: postAuthorId,
            fromUserId: authUid,
            type: 'comment',
            postId,
            message: 'a commenté votre publication',
          });
        } catch (nErr) {
          console.error('[comments] notification error (non-blocking):', nErr);
        }
      }
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    } catch (e) {
      const err = e as { message?: string };
      console.error('[comments] unexpected error:', e);
      toast.error(err?.message || "Impossible d'envoyer le commentaire");
    } finally {
      setSending(false);
    }
  };

  const handleToggleLike = async (commentId: string) => {
    if (!currentUserId) {
      toast.error('Connectez-vous pour aimer un commentaire');
      return;
    }
    if (!likesSupported) {
      toast.error(
        'Les likes de commentaires ne sont pas encore activés. Exécutez COMMENTS_SOCIAL_SETUP.md.',
      );
      return;
    }
    const liked = myLikes.has(commentId);
    // Optimistic update
    setMyLikes((prev) => {
      const next = new Set(prev);
      if (liked) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    setLikeCounts((prev) => ({
      ...prev,
      [commentId]: Math.max(0, (prev[commentId] || 0) + (liked ? -1 : 1)),
    }));
    try {
      if (liked) {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: currentUserId });
        if (error && (error as { code?: string }).code !== '23505') throw error;
      }
    } catch (e) {
      const err = e as { message?: string; code?: string };
      console.error('[comments] like toggle error:', err);
      if (err?.code === '42P01') {
        setLikesSupported(false);
        toast.error('Table comment_likes absente. Exécutez COMMENTS_SOCIAL_SETUP.md.');
      } else {
        toast.error(err?.message || 'Action impossible');
      }
      // Revert optimistic state
      setMyLikes((prev) => {
        const next = new Set(prev);
        if (liked) next.add(commentId);
        else next.delete(commentId);
        return next;
      });
      setLikeCounts((prev) => ({
        ...prev,
        [commentId]: Math.max(0, (prev[commentId] || 0) + (liked ? 1 : -1)),
      }));
    }
  };

  const startReply = (target: CommentRow, rootId: string) => {
    const targetName = getName(target.user_id);
    setReplyTo({
      targetCommentId: target.id,
      rootCommentId: rootId,
      targetName,
    });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelReply = () => setReplyTo(null);

  const hideComment = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    toast.success('Commentaire masqué');
  };

  const reportComment = () => {
    toast.success('Merci, votre signalement a été envoyé');
  };

  const deleteComment = async (id: string) => {
    if (!currentUserId) return;
    const ok = window.confirm('Supprimer ce commentaire ? Cette action est irréversible.');
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUserId);
      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== id && c.parent_comment_id !== id));
      setLikeCounts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setMyLikes((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Commentaire supprimé');
    } catch (e) {
      const err = e as { message?: string; code?: string };
      console.error('[comments] delete error:', err);
      if (err?.code === '42501' || err?.message?.toLowerCase().includes('row-level security')) {
        toast.error('Permissions insuffisantes pour supprimer ce commentaire.');
      } else {
        toast.error(err?.message || 'Impossible de supprimer');
      }
    }
  };

  const insertEmoji = (e: string) => {
    setContent((c) => c + e);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const toggleThread = (rootId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  };

  if (!open) return null;

  const renderCommentBubble = (c: CommentRow, opts: { isReply: boolean; replyToName?: string }) => {
    const a = authors[c.user_id];
    const name = getName(c.user_id);
    const initials = name.slice(0, 2).toUpperCase();
    const likes = likeCounts[c.id] || 0;
    const liked = myLikes.has(c.id);
    return (
      <div className="flex items-start gap-2">
        <div
          className={`${
            opts.isReply ? 'w-7 h-7 text-[9px]' : 'w-9 h-9 text-[10px]'
          } rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold flex-shrink-0`}
        >
          {a?.avatar_url ? (
            <img src={a.avatar_url} alt={name} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-[var(--loboko-surface-hover)] rounded-2xl px-3 py-2 relative">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-xs mb-0.5 flex flex-wrap items-center gap-1">
                  <span className="truncate">{name}</span>
                  {opts.replyToName && (
                    <span className="text-[var(--loboko-text-muted)] font-normal">
                      — {opts.replyToName}
                    </span>
                  )}
                </div>
                <div className="text-sm whitespace-pre-wrap break-words">{c.content}</div>
              </div>
              <CommentMenu
                content={c.content}
                isOwner={!!currentUserId && c.user_id === currentUserId}
                onHide={() => hideComment(c.id)}
                onReport={reportComment}
                onDelete={() => deleteComment(c.id)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1 px-2 text-[11px] text-[var(--loboko-text-muted)]">
            {c.created_at && <span>{formatPostTime(c.created_at)}</span>}
            <button
              type="button"
              onClick={() => handleToggleLike(c.id)}
              className={`flex items-center gap-1 hover:text-[var(--loboko-text)] transition ${
                liked ? 'text-[#ef4444] font-semibold' : ''
              }`}
            >
              <Heart size={11} className={liked ? 'fill-current' : ''} />
              <span>J'aime{likes > 0 ? ` · ${likes}` : ''}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const rootId =
                  (c.parent_comment_id && comments.find((x) => x.id === c.parent_comment_id)?.id) ||
                  c.id;
                // If this comment is itself a reply, its root is already the parent.
                const effectiveRoot = c.parent_comment_id ? c.parent_comment_id : c.id;
                startReply(c, effectiveRoot);
              }}
              className="hover:text-[var(--loboko-text)] transition"
            >
              Répondre
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--loboko-surface)] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-[var(--loboko-border)] h-[85vh] sm:h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--loboko-border)] flex-shrink-0">
          <h3 className="font-semibold text-sm">Commentaires</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]"
          >
            <X size={18} />
          </button>
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="py-10 text-center text-sm text-[var(--loboko-text-muted)]">
              Chargement...
            </div>
          ) : topLevel.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--loboko-text-muted)]">
              Soyez le premier à commenter !
            </div>
          ) : (
            <ul className="space-y-4">
              {topLevel.map((c) => {
                const replies = repliesByRoot.get(c.id) || [];
                const expanded = expandedThreads.has(c.id);
                return (
                  <li key={c.id} className="space-y-2">
                    {renderCommentBubble(c, { isReply: false })}
                    {replies.length > 0 && (
                      <div className="pl-10">
                        <button
                          type="button"
                          onClick={() => toggleThread(c.id)}
                          className="text-[11px] text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)] transition"
                        >
                          {expanded
                            ? 'Masquer les réponses'
                            : `Afficher ${replies.length} ${
                                replies.length > 1 ? 'réponses' : 'réponse'
                              }`}
                        </button>
                        {expanded && (
                          <ul className="mt-2 space-y-3">
                            {replies.map((r) => {
                              // Determine who this reply is addressed to.
                              // If parent is the root (top-level comment), show "author — rootAuthor".
                              // If parent is another reply, show "author — thatReplyAuthor".
                              let replyToName: string | undefined;
                              if (r.parent_comment_id) {
                                // Find most recent sibling reply this one follows, if any.
                                // Simpler: if parent_comment_id is the root, show root author;
                                // else show parent's author (but we flatten to root, so parent IS root).
                                const parent = comments.find((x) => x.id === r.parent_comment_id);
                                if (parent) replyToName = getName(parent.user_id);
                              }
                              return (
                                <li key={r.id}>
                                  {renderCommentBubble(r, {
                                    isReply: true,
                                    replyToName,
                                  })}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {replyTo && (
          <div className="px-4 py-2 border-t border-[var(--loboko-border)] text-[11px] text-[var(--loboko-text-muted)] flex items-center justify-between flex-shrink-0 bg-[var(--loboko-surface-hover)]">
            <span>
              Réponse à <span className="font-semibold">{replyTo.targetName}</span>
            </span>
            <button
              type="button"
              onClick={cancelReply}
              className="hover:text-[var(--loboko-text)]"
            >
              Annuler
            </button>
          </div>
        )}

        <div className="border-t border-[var(--loboko-border)] p-3 flex items-center gap-2 flex-shrink-0">
          <EmojiPickerMini onSelect={insertEmoji} disabled={!currentUserId || sending} />
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              !currentUserId
                ? 'Connectez-vous pour commenter'
                : replyTo
                ? `Répondre à ${replyTo.targetName}...`
                : 'Écrire un commentaire...'
            }
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