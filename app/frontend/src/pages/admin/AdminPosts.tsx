import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface PostRow {
  id: string;
  content?: string | null;
  user_id: string;
  created_at: string;
}

export default function AdminPosts() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) {
      setPosts((data as PostRow[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const removePost = async (id: string) => {
    const ok = confirm('Supprimer cette publication ?');

    if (!ok) return;

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erreur suppression');
      return;
    }

    setPosts((prev) => prev.filter((p) => p.id !== id));

    toast.success('Publication supprimée');
  };

  return (
    <Layout title="Publications">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">
          📰 Publications
        </h1>

        <p className="text-sm text-[var(--loboko-text-muted)] mt-1">
          Gestion des contenus publiés
        </p >
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement...
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Aucune publication
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="p-4 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
            >
              <div className="text-sm whitespace-pre-wrap mb-3">
                {post.content || 'Publication média'}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-[var(--loboko-text-muted)]">
                  {new Date(post.created_at).toLocaleString('fr-FR')}
                </div>

                <button
                  onClick={() => removePost(post.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[rgba(239,68,68,0.15)] text-[#ef4444] text-sm font-semibold"
                >
                  <Trash2 size={14} />
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
