import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBackNavigation } from '@/lib/use-back-navigation';
import Layout from '@/components/Layout';
import PostCard, { PostItem } from '@/components/PostCard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';

export default function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const goBack = useBackNavigation('/');
  const { user } = useAuth();
  const [post, setPost] = useState<PostItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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

  // Scroll + highlight after post is loaded
  useEffect(() => {
    if (!post || !cardRef.current) return;
    const el = cardRef.current;
    // Slight delay to allow layout/images to settle
    const t = window.setTimeout(() => {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        el.scrollIntoView();
      }
      el.classList.add('loboko-post-highlight');
      window.setTimeout(() => {
        el.classList.remove('loboko-post-highlight');
      }, 2200);
    }, 120);
    return () => window.clearTimeout(t);
  }, [post]);

  return (
    <Layout title="Publication">
      <style>{`
        .loboko-post-highlight {
          animation: lobokoPostHighlight 2s ease-out;
          border-radius: 1rem;
        }
        @keyframes lobokoPostHighlight {
          0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.55); }
          40% { box-shadow: 0 0 0 8px rgba(37, 99, 235, 0.25); }
          100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        }
      `}</style>

      <button
        onClick={goBack}
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
        <div ref={cardRef}>
          <PostCard
            post={post}
            currentUserId={user?.id || ''}
            onDeleted={() => navigate('/home')}
          />
        </div>
      )}
    </Layout>
  );
}