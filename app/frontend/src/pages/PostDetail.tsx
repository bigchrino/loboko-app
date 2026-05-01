import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useBackNavigation } from '@/lib/use-back-navigation';
import Layout from '@/components/Layout';
import PostCard, { PostItem } from '@/components/PostCard';
import CommentsModal from '@/components/CommentsModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';

interface LocationState {
  from?: string;
  returnContext?: {
    postId?: string;
    commentId?: string;
    openComments?: boolean;
  } | null;
}

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fallbackBack = useBackNavigation('/');
  const { user } = useAuth();
  const [post, setPost] = useState<PostItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const commentsRef = useRef<HTMLDivElement>(null);

  const state = (location.state as LocationState | null) || null;
  const returnCtx =
    state?.returnContext && state.returnContext.postId === postId
      ? state.returnContext
      : null;
  const [consumedReturnCtx, setConsumedReturnCtx] = useState<
    LocationState['returnContext'] | null
  >(null);
  const activeReturnCtx = returnCtx || consumedReturnCtx;
  const highlightCommentId = activeReturnCtx?.commentId || undefined;
  const shouldFocusComments =
    !!highlightCommentId || location.hash === '#comments';

  /**
   * Once we've captured the `returnContext` on mount, strip it from
   * `location.state` by replacing the current history entry. This way
   * pressing "back" does NOT re-navigate forward into the state that
   * would send the user back to the profile page (profile ↔ post loop).
   * We keep `state.from` around so the back button can still return to
   * the original origin if it is not a profile page.
   */
  useEffect(() => {
    if (!returnCtx) return;
    setConsumedReturnCtx(returnCtx);
    const cleanedState: LocationState = state?.from ? { from: state.from } : {};
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: cleanedState,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnCtx]);

  const loadPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
        setPost(null);
      } else {
        setPost(data as PostItem);
      }
    } catch (e) {
      console.error(e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  // If the user arrived with #comments or a highlighted comment, scroll to
  // the comments section once the post is loaded.
  useEffect(() => {
    if (!post) return;
    if (!shouldFocusComments) return;
    const t = window.setTimeout(() => {
      const el = commentsRef.current;
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        el.scrollIntoView();
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [post, shouldFocusComments]);

  /**
   * Back navigation: if we have an explicit `from` url (usually set by
   * PostCard when opening detail), return there — but NEVER if `from`
   * points to a user profile (that would re-create the profile ↔ post
   * loop when the profile sent the user back here via `state.from`).
   * Otherwise fall back to the standard back helper which tries
   * `navigate(-1)` then `/`.
   */
  const handleBack = () => {
    const from = state?.from;
    if (from && !/^\/u\//.test(from)) {
      navigate(from);
      return;
    }
    fallbackBack();
  };

  return (
    <Layout title="Publication">
      <button
        onClick={handleBack}
        className="flex items-center gap-1 text-sm text-[var(--loboko-text-secondary)] mb-3 hover:text-[var(--loboko-text)] !bg-transparent !hover:bg-transparent"
      >
        <ArrowLeft size={16} />
        Retour
      </button>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      ) : notFound || !post ? (
        <div className="text-center py-16 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
          <div className="w-16 h-16 mx-auto rounded-full bg-[rgba(239,68,68,0.15)] flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="font-semibold mb-1">Contenu indisponible</h3>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Cette publication n'existe plus ou a été supprimée.
          </p>
        </div>
      ) : (
        <>
          <div ref={cardRef}>
            <PostCard
              post={post}
              currentUserId={user?.id || ''}
              onDeleted={() => navigate('/home')}
              variant="detail"
            />
          </div>
          <div id="comments" ref={commentsRef} className="scroll-mt-4">
            <CommentsModal
              postId={post.id}
              postAuthorId={post.user_id}
              open={true}
              onClose={() => {
                /* inline mode: no-op */
              }}
              currentUserId={user?.id || ''}
              highlightCommentId={highlightCommentId}
              inline
            />
          </div>
        </>
      )}
    </Layout>
  );
}