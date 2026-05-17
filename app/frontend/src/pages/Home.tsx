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
  

  const userId = user?.id || '';
  useEffect(() => {
    window.history.scrollRestoration = 'manual';
  
    const saved = sessionStorage.getItem('home-scroll');
  
    if (saved) {
      setTimeout(() => {
        window.scrollTo(0, Number(saved));
      }, 0);
    }
  
    const saveScroll = () => {
      sessionStorage.setItem('home-scroll', String(window.scrollY));
    };
  
    window.addEventListener('scroll', saveScroll);
  
    return () => {
      window.removeEventListener('scroll', saveScroll);
    };
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setPosts((data as PostItem[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (loading) return;
    if (posts.length === 0) return;
  
    const postId = sessionStorage.getItem('home-post-id');
    if (!postId) return;
  
    setTimeout(() => {
      const el = document.getElementById(`post-card-${postId}`);
      if (el) {
        el.scrollIntoView({
          block: 'start',
          behavior: 'auto',
        });
        
        window.scrollBy(0, -20);
      }
    }, 300);
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
        <ComposePost onPosted={loadPosts} />
      </div>

      <div id="loboko-feed">
        {loading ? (
          <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
            Chargement des publications...
          </div>
        ) : posts.length === 0 ? (
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
      </div>
    </Layout>
  );
}
