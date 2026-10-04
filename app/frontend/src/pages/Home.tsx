import { useCallback, useEffect, useState, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ComposePost from '@/components/ComposePost';
import PostCard, { PostItem } from '@/components/PostCard';
import HeroBanner from '@/components/HeroBanner';
import AdsCarousel from '@/components/AdsCarousel';
import RecommendedServices from '@/components/RecommendedServices';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Keep the loaded pages for this tab's current account. A return from a
// publication must not replace a long feed with only its first ten posts.
interface FeedSnapshot {
  userId: string;
  posts: PostItem[];
  hasMore: boolean;
  y: number;
  heights: Record<string, number>;
}
let feedSnapshot: FeedSnapshot | null = null;

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') feedSnapshot = null;
});

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id || '';
  const [initial] = useState(() =>
    feedSnapshot?.userId === userId ? feedSnapshot : null
  );
  const [posts, setPosts] = useState<PostItem[]>(initial?.posts ?? []);
  const [loading, setLoading] = useState(!initial);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initial?.hasMore ?? true);
  const PAGE_SIZE = 10;

  const loadPosts = useCallback(async () => {
    setLoading(true);
  
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('hidden_by_moderation', false)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
  
      if (error) throw error;
  
      const list = (data as PostItem[]) || [];
      setPosts(list);
      setHasMore(list.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore || posts.length === 0) return;
  
    setLoadingMore(true);
  
    try {
      const lastPost = posts[posts.length - 1];
  
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('hidden_by_moderation', false)
        .order('created_at', { ascending: false })
        .lt('created_at', lastPost.created_at)
        .limit(PAGE_SIZE);
  
      if (error) throw error;
  
      const list = (data as PostItem[]) || [];
  
      setPosts((current) => [...current, ...list]);
      setHasMore(list.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, posts]);

    

  useEffect(() => {
    if (!initial) void loadPosts();
  }, [initial, loadPosts]);

  // Reconcile edits/deletions without replacing the cached order or hiding
  // the feed. Newly published items are loaded on an explicit page refresh.
  useEffect(() => {
    if (!initial?.posts.length) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .in('id', initial.posts.map((post) => post.id))
        .eq('hidden_by_moderation', false);
      if (cancelled || error || !data) return;
      const updated = new Map((data as PostItem[]).map((post) => [post.id, post]));
      const cachedIds = new Set(initial.posts.map((post) => post.id));
      setPosts((current) => current.flatMap((post) => {
        if (!cachedIds.has(post.id)) return [post];
        const fresh = updated.get(post.id);
        return fresh ? [fresh] : [];
      }));
    })();
    return () => { cancelled = true; };
  }, [initial]);

  // Restore before paint. Reserved card heights keep late-loading media
  // from shortening the page and clamping a deep scroll position to the top.
  useLayoutEffect(() => {
    window.scrollTo({ top: initial?.y ?? 0, behavior: 'instant' });
  }, [initial]);

  useLayoutEffect(() => {
    if (loading) return;
    const snapshot: FeedSnapshot = {
      userId,
      posts,
      hasMore,
      y: initial?.y ?? 0,
      heights: { ...initial?.heights },
    };
    const save = () => {
      snapshot.y = window.scrollY;
      feedSnapshot = snapshot;
    };
    const cards = document.querySelectorAll<HTMLElement>('[data-home-post]');
    const sizes = new ResizeObserver((entries) => {
      for (const { target } of entries) {
        const card = target as HTMLElement;
        snapshot.heights[card.dataset.homePost!] = card.getBoundingClientRect().height;
      }
    });
    cards.forEach((card) => {
      snapshot.heights[card.dataset.homePost!] = card.getBoundingClientRect().height;
      sizes.observe(card);
    });
    save();
    // Capture clicks/keyboard navigation before the next route replaces
    // the DOM. Never sample scrollY during unmount: the page may be shorter.
    window.addEventListener('scroll', save, { passive: true });
    document.addEventListener('click', save, true);
    document.addEventListener('keydown', save, true);
    return () => {
      sizes.disconnect();
      window.removeEventListener('scroll', save);
      document.removeEventListener('click', save, true);
      document.removeEventListener('keydown', save, true);
    };
  }, [loading, posts, hasMore, userId, initial]);

  return (
    <Layout title="Accueil">
      <HeroBanner onFindProvider={() => navigate('/find')} />

      <AdsCarousel />

      {/* Marketplace shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => navigate('/works')}
          className="p-4 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-left hover:bg-[var(--loboko-surface-hover)] transition-all"
        >
          <div className="text-2xl mb-2">🎨</div>
          <div className="font-semibold">Réalisations</div>
          <div className="text-sm text-[var(--loboko-text-secondary)]">
            Voir les travaux des prestataires
          </div>
        </button>

        <button
          onClick={() => navigate('/requests')}
          className="p-4 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-left hover:bg-[var(--loboko-surface-hover)] transition-all"
        >
          <div className="text-2xl mb-2">🛠️</div>
          <div className="font-semibold">Demandes</div>
          <div className="text-sm text-[var(--loboko-text-secondary)]">
            Publier ou consulter des demandes
          </div>
        </button>

        <button
          onClick={() => navigate('/favorites')}
          className="p-4 rounded-2xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-left hover:bg-[var(--loboko-surface-hover)] transition-all"
        >
          <div className="text-2xl mb-2">⭐</div>
          <div className="font-semibold">Favoris</div>
          <div className="text-sm text-[var(--loboko-text-secondary)]">
            Retrouver vos prestataires favoris
          </div>
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-4 hidden lg:block">
        Fil d'actualité
      </h1>

      <div id="loboko-compose">
        <ComposePost
          onPosted={async () => {
            await loadPosts();
        
            requestAnimationFrame(() => {
              const compose = document.getElementById('loboko-compose');
              compose?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }}
        />
      </div>

      <div id="loboko-feed" className="grid">
        {loading && (
          <div className="col-start-1 row-start-1 text-center py-10 text-sm text-[var(--loboko-text-muted)]">
            Chargement des publications...
          </div>
        )}

        {!loading && (
          <div
            className="col-start-1 row-start-1"
          >
            {posts.length === 0 ? (
              <>
              <RecommendedServices key={userId} userId={userId} />
              <div className="text-center py-16 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
                <div className="w-16 h-16 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-4">
                  <span className="text-2xl">✨</span>
                </div>

                <h3 className="font-semibold mb-1">
                  Aucune publication pour l'instant
                </h3>

                <p className="text-sm text-[var(--loboko-text-muted)]">
                  Soyez le premier à publier sur LOBOKO !
                </p>
              </div>
              </>
            ) : (
              posts.map((p) => (
                <div
                  key={p.id}
                  className="flow-root"
                  data-home-post={p.id}
                  style={{ minHeight: initial?.heights[p.id] }}
                >
                  <PostCard
                    post={p}
                    currentUserId={userId}
                    onDeleted={() => setPosts((current) => current.filter((post) => post.id !== p.id))}
                  />
                  {p.id === posts[Math.min(2, posts.length - 1)]?.id && (
                    <RecommendedServices key={userId} userId={userId} />
                  )}
                </div>
              ))
            )}

            {hasMore && (
              <button
                onClick={loadMorePosts}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm font-semibold text-[var(--loboko-text-secondary)] hover:text-[var(--loboko-text)] disabled:opacity-50"
              >
                {loadingMore ? 'Chargement...' : 'Voir plus'}
              </button>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
