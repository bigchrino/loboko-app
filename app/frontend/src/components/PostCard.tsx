import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import { toast } from 'sonner';
import LikesModal from './LikesModal';
import CommentsModal from './CommentsModal';
import PostMenu from './PostMenu';
import { createNotification } from '@/lib/notifications';

export interface PostItem {
  id: string;
  user_id: string;
  content: string;
  image_key?: string;
  video_key?: string;
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
}

interface Props {
  post: PostItem;
  currentUserId?: string;
  onDeleted?: () => void;
}

export default function PostCard({ post, currentUserId, onDeleted }: Props) {
  const [author, setAuthor] = useState<Author | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeId, setLikeId] = useState<string | null>(null);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [showLikes, setShowLikes] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username,display_name,metier,avatar_key,role')
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
      if (post.image_key) {
        const url = await getMediaUrl(post.image_key);
        setImageUrl(url);
      }
      if (post.video_key) {
        const url = await getMediaUrl(post.video_key);
        setVideoUrl(url);
      }
      // Real counts from DB
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
  }, [post.id, post.user_id, post.image_key, post.video_key, currentUserId]);

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
        // Create a notification for the post author (no-op if self)
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

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    const shareData = {
      title: 'LOBOKO',
      text: post.content.slice(0, 120),
      url,
    };
    try {
      if (navigator.share && typeof navigator.canShare !== 'function') {
        await navigator.share(shareData);
        return;
      }
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié dans le presse-papier');
    } catch (e) {
      // User cancelled or share failed
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Lien copié');
      } catch {
        toast.error('Partage impossible');
      }
    }
  };

  const authorName = author?.display_name || author?.username || 'Utilisateur';
  const initials = authorName.slice(0, 2).toUpperCase();

  return (
    <>
      <article className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 mb-4">
        <header className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-sm">
            {avatarUrl ? (
              <img src={avatarUrl} alt={authorName} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">{authorName}</span>
              {author?.role === 'prestataire' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] font-semibold">
                  PRO
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--loboko-text-muted)] truncate">
              {author?.metier || `@${author?.username || 'user'}`}
            </div>
          </div>
          <PostMenu
            postId={post.id}
            postAuthorId={post.user_id}
            currentUserId={currentUserId}
            onDeleted={onDeleted}
          />
        </header>

        <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>

        {imageUrl && (
          <div className="rounded-xl overflow-hidden mb-3 border border-[var(--loboko-border)]">
            <img src={imageUrl} alt="" className="w-full h-auto object-cover max-h-[480px]" />
          </div>
        )}

        {videoUrl && (
          <div className="rounded-xl overflow-hidden mb-3 border border-[var(--loboko-border)] bg-black">
            <video
              src={videoUrl}
              className="w-full max-h-[480px] block"
              controls
              playsInline
              preload="metadata"
            />
          </div>
        )}

        <footer className="flex items-center gap-1 text-sm text-[var(--loboko-text-secondary)]">
          <button
            onClick={toggleLike}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[var(--loboko-surface-hover)] transition ${
              liked ? 'text-[#ec4899]' : ''
            }`}
            aria-label="Aimer"
          >
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => setShowLikes(true)}
            className="text-xs font-medium px-1 hover:underline"
            aria-label="Voir les personnes qui ont aimé"
          >
            {likesCount}
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-[var(--loboko-surface-hover)] transition ml-2"
            aria-label="Commenter"
          >
            <MessageCircle size={18} />
            <span className="text-xs font-medium">{commentsCount}</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-[var(--loboko-surface-hover)] transition ml-auto"
            aria-label="Partager"
          >
            <Share2 size={18} />
          </button>
        </footer>
      </article>

      <LikesModal postId={post.id} open={showLikes} onClose={() => setShowLikes(false)} />
      <CommentsModal
        postId={post.id}
        postAuthorId={post.user_id}
        open={showComments}
        onClose={() => setShowComments(false)}
        currentUserId={currentUserId}
        onCommentAdded={() => setCommentsCount((c) => c + 1)}
      />
    </>
  );
}