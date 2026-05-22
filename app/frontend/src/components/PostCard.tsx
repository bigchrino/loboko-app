import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import { toast } from 'sonner';
import LikesModal from './LikesModal';
import CommentsModal from './CommentsModal';
import PostMenu from './PostMenu';
import MentionText from './MentionText';
import SharePostDialog, { SharePostPreview } from './SharePostDialog';
import MediaViewer from './MediaViewer';
import { createNotification } from '@/lib/notifications';
import { formatPostTime } from '@/lib/format-time';
import { encodePayload, SharedPostPayload } from '@/lib/message-format';

export interface PostItem {
  id: string;
  user_id: string;
  content: string;
  image_key?: string;
  video_key?: string;
  media_keys?: Array<string | { key: string; type: 'image' | 'video' }>;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  created_at?: string;
}

interface Author {
  username: string;
  display_name?: string;
  metier?: string;
  avatar_key?: string;
  role?: string;
  is_admin?: boolean;
}

interface Props {
  post: PostItem;
  currentUserId?: string;
  onDeleted?: () => void;
  /**
   * `feed` (default): the card navigates to `/post/:id` when the main frame
   * is clicked, and the comments button also navigates there (no modal).
   * `detail`: used on the PostDetail page. The card does NOT navigate away
   * on frame click, and comments are rendered inline below by the page.
   */
  variant?: 'feed' | 'detail';
}

interface ReturnContextState {
  returnContext?: {
    postId?: string;
    commentId?: string;
    openComments?: boolean;
  } | null;
}

export default function PostCard({
  post,
  currentUserId,
  onDeleted,
  variant = 'feed',
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [author, setAuthor] = useState<Author | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<
    { url: string; type: 'image' | 'video' }[]
  >([]);
  const [liked, setLiked] = useState(false);
  const [likeId, setLikeId] = useState<string | null>(null);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [sharesCount, setSharesCount] = useState(post.shares_count || 0);
  const [showLikes, setShowLikes] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username,display_name,metier,avatar_key,role,is_admin')
          .eq('user_id', post.user_id)
          .maybeSingle();
        if (data) {
          setAuthor(data as Author);
          if ((data as Author).avatar_key) {
            const url = await getMediaUrl((data as Author).avatar_key!);
            setAvatarUrl(url);
          }
        }
      } catch (e) {
        console.error(e);
      }
      if (post.media_keys?.length) {
        const medias = await Promise.all(
          post.media_keys.map(async (m) => {
            const key = typeof m === 'string' ? m : m.key;
            const url = await getMediaUrl(key);
      
            if (!url) return null;
      
            const lower = key.toLowerCase();
            const fallbackType =
              lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')
                ? 'video'
                : 'image';
      
            return {
              url,
              type: typeof m === 'string' ? fallbackType : m.type,
            };
          })
        );
      
        setMediaUrls(
          medias.filter(
            (m): m is { url: string; type: 'image' | 'video' } => !!m
          )
        );
      } else if (post.image_key) {
        const url = await getMediaUrl(post.image_key);
      
        if (url) {
          setMediaUrls([{ url, type: 'image' }]);
        } else {
          setMediaUrls([]);
        }
      } else if (post.video_key) {
        const url = await getMediaUrl(post.video_key);
      
        if (url) {
          setMediaUrls([{ url, type: 'video' }]);
        } else {
          setMediaUrls([]);
        }
      } else {
        setMediaUrls([]);
      }
      
      
      try {
        const { count: lc } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);
        if (typeof lc === 'number') setLikesCount(lc);

        const { count: cc } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);
        if (typeof cc === 'number') setCommentsCount(cc);

        try {
          const { count: sc, error: scErr } = await supabase
            .from('post_shares')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);
          if (!scErr && typeof sc === 'number') setSharesCount(sc);
        } catch {
          /* ignore, table may not exist yet */
        }
      } catch (e) {
        console.error(e);
      }
      if (currentUserId) {
        try {
          const { data } = await supabase
            .from('likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', currentUserId)
            .maybeSingle();
          if (data?.id) {
            setLiked(true);
            setLikeId(data.id as string);
          }
        } catch (e) {
          console.error(e);
        }
      }
    })();
  }, [post.id, post.user_id, post.image_key, post.video_key, post.media_keys, currentUserId]);

  /**
   * Auto-open the comments modal with a highlighted comment when returning
   * from a profile page reached via a mention inside one of this post's
   * comments. Only applicable in feed variant (detail page handles this
   * differently via its own inline comments).
   */
  useEffect(() => {
    if (variant !== 'feed') return;
    const state = (location.state as ReturnContextState | null) || null;
    const ctx = state?.returnContext;
    if (!ctx || !ctx.openComments) return;
    if (ctx.postId !== post.id) return;
    // Prefer navigating into the detail page when coming from a mention-return
    // so the experience matches the new "click opens detail" model.
    navigate(`/post/${post.id}#comments`, {
      state: { returnContext: ctx },
      replace: true,
    });
  }, [location.state, post.id, navigate, variant]);

  const toggleLike = async () => {
    if (!currentUserId) {
      toast.error('Connectez-vous pour aimer');
      return;
    }
    try {
      if (liked && likeId) {
        const { error } = await supabase.from('likes').delete().eq('id', likeId);
        if (error) throw error;
        setLiked(false);
        setLikeId(null);
        setLikesCount((c) => Math.max(0, c - 1));
      } else {
        const { data, error } = await supabase
          .from('likes')
          .insert({ post_id: post.id, user_id: currentUserId })
          .select()
          .single();
        if (error) throw error;
        setLiked(true);
        if (data?.id) setLikeId(data.id as string);
        setLikesCount((c) => c + 1);
        await createNotification({
          recipientId: post.user_id,
          fromUserId: currentUserId,
          type: 'like',
          postId: post.id,
          message: 'a aimé votre publication',
        });
      }
    } catch (e) {
      console.error(e);
      toast.error('Action impossible');
    }
  };

  const recordShare = async () => {
    if (!currentUserId) return;
    try {
      const { error } = await supabase
        .from('post_shares')
        .insert({ post_id: post.id, user_id: currentUserId });
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === '42P01' || error.message?.toLowerCase().includes('does not exist')) {
          console.warn('[post] post_shares table missing; run SOCIAL_NOTIFICATIONS_SETUP.md');
        } else {
          console.error('[post] share insert error:', error);
        }
      } else {
        setSharesCount((c) => c + 1);
      }
    } catch (e) {
      console.error('[post] share insert unexpected error:', e);
    }
    await createNotification({
      recipientId: post.user_id,
      fromUserId: currentUserId,
      type: 'post_shared',
      postId: post.id,
      message: 'a partagé votre publication',
    });
  };

  const handleShare = () => {
    if (!currentUserId) {
      toast.error('Connectez-vous pour partager');
      return;
    }
    setShowShare(true);
  };

  const buildSharePreview = async (): Promise<SharePostPreview> => {
    const img = post.image_key ? await getMediaUrl(post.image_key) : null;
    return {
      post_id: post.id,
      author_id: post.user_id,
      author_name: author?.display_name || author?.username || 'Utilisateur',
      text: post.content,
      image_url: img || undefined,
    };
  };

  const buildPayload = (preview: SharePostPreview): SharedPostPayload => ({
    kind: 'shared_post',
    post_id: preview.post_id,
    preview: {
      author_id: preview.author_id,
      author_name: preview.author_name,
      text: preview.text?.slice(0, 500),
      image_url: preview.image_url,
    },
  });

  const sendSharedPostMessage = async (
    receiverId: string,
    preview: SharePostPreview,
  ) => {
    if (!currentUserId) return;
    const content = encodePayload(buildPayload(preview));
    const { error } = await supabase.from('messages').insert({
      user_id: currentUserId,
      receiver_id: receiverId,
      content,
      read: false,
    });
    if (error) throw error;
  };

  const sendSharedPostToGroup = async (
    groupId: string,
    preview: SharePostPreview,
  ) => {
    if (!currentUserId) return;
    const content = encodePayload(buildPayload(preview));
    const { error } = await supabase.from('group_messages').insert({
      group_id: groupId,
      user_id: currentUserId,
      content,
    });
    if (error) throw error;
  };

  const handleShareToUsers = async (
    userIds: string[],
    preview: SharePostPreview,
  ) => {
    let ok = 0;
    for (const uid of userIds) {
      try {
        await sendSharedPostMessage(uid, preview);
        ok += 1;
      } catch (err) {
        console.error('share to user failed', err);
      }
    }
    if (ok > 0) {
      await recordShare();
      toast.success(
        ok === 1 ? 'Publication partagée' : `Partagée à ${ok} contacts`,
      );
    }
    const fallbackUrl = `${window.location.origin}/post/${post.id}`;
    if (ok === 0) {
      try {
        await navigator.clipboard.writeText(fallbackUrl);
        toast.success('Lien copié');
      } catch {
        toast.error('Partage impossible');
      }
    }
  };

  const handleShareToGroups = async (
    groupIds: string[],
    preview: SharePostPreview,
  ) => {
    let ok = 0;
    for (const gid of groupIds) {
      try {
        await sendSharedPostToGroup(gid, preview);
        ok += 1;
      } catch (err) {
        console.error('share to group failed', err);
      }
    }
    if (ok > 0) {
      await recordShare();
      toast.success(
        ok === 1 ? 'Partagée au groupe' : `Partagée à ${ok} groupes`,
      );
    }
  };

  /**
   * Open the post detail page. Only triggered from the feed variant's frame
   * click. The click handler checks that the click didn't originate from an
   * interactive element via `data-stop-card-click`.
   */
  const openDetail = () => {
    sessionStorage.setItem('home-scroll', String(window.scrollY));
    sessionStorage.setItem('home-post-id', post.id);
  
    navigate(`/post/${post.id}`, {
      state: {
        from: `${location.pathname}${location.search}${location.hash}`,
      },
    });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (variant !== 'feed') return;
    const target = e.target as HTMLElement;
    // Any descendant marked with data-stop-card-click (or its ancestors up to
    // the card) should NOT trigger frame navigation. This covers like,
    // comment, share, menu, author, avatar, images, videos, mentions.
    if (target.closest('[data-stop-card-click="1"]')) return;
    // Also skip if user is selecting text.
    const selection = window.getSelection?.();
    if (selection && selection.toString().length > 0) return;
    openDetail();
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (variant !== 'feed') return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target as HTMLElement;
    // Only trigger when the  itself is the focused target.
    if (target !== e.currentTarget) return;
    e.preventDefault();
    openDetail();
  };

  const handleCommentClick = () => {
    if (variant === 'feed') {
      navigate(`/post/${post.id}#comments`, {
        state: {
          from: `${location.pathname}${location.search}${location.hash}`,
        },
      });
      return;
    }
    // In detail variant, the page renders inline comments and handles focus
    // itself; fall back to a modal only if somehow used elsewhere.
    setShowComments(true);
  };

  const authorName = author?.display_name || author?.username || 'Utilisateur';
  const initials = authorName.slice(0, 2).toUpperCase();
  const isFeed = variant === 'feed';

  const MAX_CONTENT_LENGTH = 220;

  const isLongPost = post.content.length > MAX_CONTENT_LENGTH;
  
  const displayedContent =
    expanded || !isLongPost
      ? post.content
      : `${post.content.slice(0, MAX_CONTENT_LENGTH)}...`;

  return (
    <>
      <article
        id={`post-card-${post.id}`}
        className={`bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 mb-4 ${
          isFeed
            ? 'cursor-pointer hover:border-[rgba(37,99,235,0.45)] transition-colors'
            : ''
        }`}
        role={isFeed ? 'link' : undefined}
        tabIndex={isFeed ? 0 : undefined}
        aria-label={isFeed ? 'Ouvrir la publication' : undefined}
        onClick={isFeed ? handleCardClick : undefined}
        onKeyDown={isFeed ? handleCardKeyDown : undefined}
      >
        <header className="flex items-center gap-3 mb-3">
          <button
            type="button"
            data-stop-card-click="1"
            onClick={(e) => {
              e.stopPropagation();
              sessionStorage.setItem('home-scroll', String(window.scrollY));
              sessionStorage.setItem('home-post-id', post.id);
              navigate(`/u/${post.user_id}`);
            }}
            className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-sm !bg-transparent-off"
            aria-label={`Voir le profil de ${authorName}`}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={authorName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <span className="bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] w-full h-full flex items-center justify-center">
                {initials}
              </span>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-stop-card-click="1"
                onClick={(e) => {
                  e.stopPropagation();
                  sessionStorage.setItem('home-scroll', String(window.scrollY));
                  sessionStorage.setItem('home-post-id', post.id);
                  navigate(`/u/${post.user_id}`);
                }}
                className="font-semibold text-sm truncate !bg-transparent !hover:bg-transparent hover:underline text-left"
              >
                {authorName}
              </button>
              {author?.is_admin ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(147,51,234,0.18)] text-[#c084fc] font-semibold">
                  💎 Admin
                </span>
              ) : author?.role === 'prestataire' ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold">
                  PRO
                </span>
              ) : null}
            </div>
            <div className="text-xs text-[var(--loboko-text-muted)] truncate flex items-center gap-1.5">
              <span className="truncate">
                {author?.is_admin
                  ? `@${author?.username || 'user'}`
                  : author?.metier || `@${author?.username || 'user'}`}
              </span>
              {post.created_at && (
                <>
                  <span aria-hidden="true">·</span>
                  <time
                    dateTime={post.created_at}
                    title={new Date(post.created_at).toLocaleString('fr-FR')}
                    className="shrink-0"
                  >
                    {formatPostTime(post.created_at)}
                  </time>
                </>
              )}
            </div>
          </div>
          <div data-stop-card-click="1" onClick={(e) => e.stopPropagation()}>
            <PostMenu
              postId={post.id}
              postAuthorId={post.user_id}
              currentUserId={currentUserId}
              onDeleted={onDeleted}
            />
          </div>
        </header>

        <div
          className="mb-3"
          data-stop-card-click="1"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            <MentionText
              text={displayedContent}
              returnContext={{ postId: post.id }}
            />
          </p >
        
          {isLongPost && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-sm font-semibold text-[#2563eb] hover:underline !bg-transparent !hover:bg-transparent p-0"
            >
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}
        </div>

        {mediaUrls.length > 0 && (
          <div
            className={`mb-3 grid gap-2 ${
              mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
            }`}
            data-stop-card-click="1"
            onClick={(e) => e.stopPropagation()}
          >
            {mediaUrls.slice(0, 4).map((media, index) => (
              <div
                key={media.url}
                className="relative rounded-xl overflow-hidden border border-[var(--loboko-border)] bg-black"
              >
                {media.type === 'image' ? (
                  <button
                    type="button"
                    onClick={() => setViewerIndex(index)}
                    className="block w-full !bg-transparent !p-0"
                  >
                    <img
                      src={media.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={`w-full object-cover ${
                        mediaUrls.length === 1 ? 'max-h-[480px]' : 'h-44'
                      }`}
                    />
                  </button>
                ) : (
                  <video
                    src={media.url}
                    controls
                    playsInline
                    preload="metadata"
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full object-cover bg-black ${
                      mediaUrls.length === 1 ? 'max-h-[480px]' : 'h-44'
                    }`}
                  />
                )}
            
                {index === 3 && mediaUrls.length > 4 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xl font-bold pointer-events-none">
                    +{mediaUrls.length - 4}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        

        <footer
          className="flex items-center gap-1 text-sm text-[var(--loboko-text-secondary)]"
          data-stop-card-click="1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLike();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[var(--loboko-surface-hover)] transition ${
              liked ? 'text-[#ec4899]' : ''
            }`}
            aria-label="Aimer"
          >
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowLikes(true);
            }}
            className="text-xs font-medium px-1 hover:underline"
            aria-label="Voir les personnes qui ont aimé"
          >
            {likesCount}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCommentClick();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-[var(--loboko-surface-hover)] transition ml-2"
            aria-label="Commenter"
          >
            <MessageCircle size={18} />
            <span className="text-xs font-medium">{commentsCount}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-[var(--loboko-surface-hover)] transition ml-auto"
            aria-label="Partager"
          >
            <Share2 size={18} />
            <span className="text-xs font-medium">{sharesCount}</span>
          </button>
        </footer>
      </article>

      {viewerIndex !== null && (
        <MediaViewer
          items={mediaUrls}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      <LikesModal postId={post.id} open={showLikes} onClose={() => setShowLikes(false)} />
      {showShare && currentUserId && (
        <SharePostDialogLoader
          open={showShare}
          currentUserId={currentUserId}
          buildPreview={buildSharePreview}
          onClose={() => setShowShare(false)}
          onShareToUsers={handleShareToUsers}
          onShareToGroups={handleShareToGroups}
        />
      )}
      {showComments && (
        <CommentsModal
          postId={post.id}
          postAuthorId={post.user_id}
          open={showComments}
          onClose={() => {
            setShowComments(false);
            setHighlightCommentId(null);
          }}
          currentUserId={currentUserId}
          onCommentAdded={() => setCommentsCount((c) => c + 1)}
          highlightCommentId={highlightCommentId || undefined}
        />
      )}
    </>
  );
}

interface SharePostDialogLoaderProps {
  open: boolean;
  currentUserId: string;
  buildPreview: () => Promise<SharePostPreview>;
  onClose: () => void;
  onShareToUsers: (ids: string[], preview: SharePostPreview) => Promise<void> | void;
  onShareToGroups: (ids: string[], preview: SharePostPreview) => Promise<void> | void;
}

function SharePostDialogLoader({
  open,
  currentUserId,
  buildPreview,
  onClose,
  onShareToUsers,
  onShareToGroups,
}: SharePostDialogLoaderProps) {
  const [preview, setPreview] = useState<SharePostPreview | null>(null);
  useEffect(() => {
    let active = true;
    buildPreview().then((p) => {
      if (active) setPreview(p);
    });
    return () => {
      active = false;
    };
  }, [buildPreview]);
  if (!preview) return null;
  return (
    <SharePostDialog
      open={open}
      preview={preview}
      onClose={onClose}
      currentUserId={currentUserId}
      onShareToUsers={onShareToUsers}
      onShareToGroups={onShareToGroups}
    />
  );
}
