import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ComposePost from '@/components/ComposePost';
import PostCard, { PostItem } from '@/components/PostCard';
import HeroBanner from '@/components/HeroBanner';
import AdsCarousel from '@/components/AdsCarousel';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;
  

  // Si on revient d'un post consulté, on connaît déjà l'ID à restaurer dès le
  // premier rendu (lecture synchrone du sessionStorage) — ça permet de garder
  // le fil invisible dès le départ, sans jamais l'afficher en haut avant de
  // sauter à la bonne position.
  const [restoring, setRestoring] = useState(
    () => typeof window !== 'undefined' && !!sessionStorage.getItem('home-post-id')
  );

  const userId = user?.id || '';
  

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
    loadPosts();
  }, [loadPosts]);

  // Ne restaurer la position de scroll qu'une seule fois par visite de la
  // page (au premier chargement), jamais lors des changements ultérieurs de
  // `posts.length` (ex: "Voir plus", nouvelle publication, suppression...).
  // Sans ce garde-fou, le fil "remontait" sans arrêt vers l'ancien post à
  // chaque mise à jour de la liste.
  const hasRestoredScrollRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (posts.length === 0) {
      setRestoring(false);
      return;
    }
    if (hasRestoredScrollRef.current) return;
  
    const postId = sessionStorage.getItem('home-post-id');
    if (!postId) {
      setRestoring(false);
      return;
    }
  
    hasRestoredScrollRef.current = true;
  
    // Deux frames suffisent pour que le fil (encore invisible) ait fini de
    // se mettre en page avant qu'on calcule où scroller — inutile d'attendre
    // un délai arbitraire pendant lequel l'utilisateur voyait le fil non
    // positionné.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`post-card-${postId}`);
        if (el) {
          el.scrollIntoView({
            block: 'start',
            behavior: 'auto',
          });
        }
        // On efface la trace pour que la restauration ne se reproduise pas
        // lors d'une prochaine visite non liée (ex: clic sur "Accueil" dans le menu).
        sessionStorage.removeItem('home-post-id');
        sessionStorage.removeItem('home-scroll');
        setRestoring(false);
      });
    });
  }, [loading, posts.length]);

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
        {(loading || restoring) && (
          <div className="col-start-1 row-start-1 text-center py-10 text-sm text-[var(--loboko-text-muted)]">
            Chargement des publications...
          </div>
        )}

        {!loading && (
          <div
            className={`col-start-1 row-start-1 ${restoring ? 'invisible pointer-events-none' : ''}`}
          >
            {posts.length === 0 ? (
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
            ) : (
              posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  currentUserId={userId}
                  onDeleted={loadPosts}
                />
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
