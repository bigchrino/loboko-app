import { useCallback, useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import ComposePost from '@/components/ComposePost';
import PostCard, { PostItem } from '@/components/PostCard';
import HeroBanner from '@/components/HeroBanner';
import AdsCarousel from '@/components/AdsCarousel';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = user?.id || '';

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

  return (
    <Layout title="Accueil">
      <HeroBanner />
      <AdsCarousel />
      <h1 className="text-2xl font-bold mb-4 hidden lg:block">Fil d'actualité</h1>
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
            <h3 className="font-semibold mb-1">Aucune publication pour l'instant</h3>
            <p className="text-sm text-[var(--loboko-text-muted)]">
              Soyez le premier à publier sur LOBOKO !
            </p>
          </div>
        ) : (
          posts.map((p) => (
            <PostCard key={p.id} post={p} currentUserId={userId} onDeleted={loadPosts} />
          ))
        )}
      </div>
    </Layout>
  );
}