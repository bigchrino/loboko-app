import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ComposePost from '@/components/ComposePost';
import PostCard, { PostItem } from '@/components/PostCard';
import HeroBanner from '@/components/HeroBanner';
import AdsCarousel from '@/components/AdsCarousel';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Clé générique : la position de scroll exacte de la page d'accueil, mise à
// jour en continu pendant qu'on y est. Contrairement à `home-post-id` (posé
// uniquement quand on clique sur un post précis), celle-ci couvre TOUS les
// cas où on quitte l'accueil (changement d'onglet, retour depuis Favoris,
// Menu, etc.) pour qu'on retrouve exactement la même position au retour.
const HOME_SCROLL_KEY = 'home-scroll-y';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;
  

  // Si on revient d'un post consulté OU simplement d'une autre page, on sait
  // déjà dès le premier rendu s'il y a une position à restaurer (lecture
  // synchrone du sessionStorage) — ça permet de garder le fil invisible dès
  // le départ, sans jamais l'afficher au mauvais endroit avant de sauter à
  // la bonne position.
  const [restoring, setRestoring] = useState(
    () =>
      typeof window !== 'undefined' &&
      (!!sessionStorage.getItem('home-post-id') ||
        !!sessionStorage.getItem(HOME_SCROLL_KEY))
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

  // Mémorise en continu la position de scroll pendant qu'on est sur
  // l'accueil (limité à une fois par frame pour ne pas surcharger). On ne
  // fait volontairement RIEN au démontage : au moment où le composant se
  // démonte (ex: on vient de cliquer sur un post), la page suivante a déjà
  // commencé à remplacer le contenu, et si elle est plus courte, le
  // navigateur réduit automatiquement `window.scrollY` — écrire cette
  // valeur-là écraserait la bonne position, déjà enregistrée par le dernier
  // événement de scroll avant le clic.
  useEffect(() => {
    let frame: number | null = null;
    const saveScroll = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        sessionStorage.setItem(HOME_SCROLL_KEY, String(window.scrollY));
        frame = null;
      });
    };
    window.addEventListener('scroll', saveScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', saveScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  // Ne restaurer la position qu'une seule fois par visite de la page (au
  // premier chargement), jamais lors des changements ultérieurs de
  // `posts.length` (ex: "Voir plus", nouvelle publication, suppression...).
  // Sans ce garde-fou, le fil "remontait" sans arrêt vers l'ancienne position
  // à chaque mise à jour de la liste.
  const hasRestoredScrollRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (posts.length === 0) {
      setRestoring(false);
      return;
    }
    if (hasRestoredScrollRef.current) return;
  
    const postId = sessionStorage.getItem('home-post-id');
    const savedY = sessionStorage.getItem(HOME_SCROLL_KEY);
    if (!postId && !savedY) {
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
        // On privilégie la position EXACTE mémorisée en continu (c'est
        // littéralement "l'endroit où on était", peu importe où se trouvait
        // le post visible à l'écran à ce moment-là). L'alignement sur le
        // post précis ne sert que de filet si, pour une raison quelconque,
        // on n'a pas de position brute valable.
        const targetY = savedY !== null ? parseInt(savedY, 10) || 0 : null;

        if (targetY !== null) {
          window.scrollTo(0, targetY);
        } else if (postId) {
          const el = document.getElementById(`post-card-${postId}`);
          el?.scrollIntoView({ block: 'start', behavior: 'auto' });
        }

        // On efface les traces pour que la restauration ne se reproduise pas
        // lors d'une prochaine visite non liée.
        sessionStorage.removeItem('home-post-id');
        sessionStorage.removeItem('home-scroll');
        sessionStorage.removeItem(HOME_SCROLL_KEY);
        setRestoring(false);

        // Filet de sécurité : certaines images du fil se chargent en
        // différé et peuvent légèrement décaler la mise en page juste après
        // qu'on ait repositionné le scroll. On revérifie une fois, un peu
        // plus tard, et on ne corrige que si l'écart est net — pour ne
        // jamais interrompre un scroll volontaire de l'utilisateur.
        if (targetY !== null) {
          setTimeout(() => {
            if (Math.abs(window.scrollY - targetY) > 40) {
              window.scrollTo(0, targetY);
            }
          }, 600);
        }
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
