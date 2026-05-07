import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import LazyMedia from '@/components/LazyMedia';
import { Heart, Users, Briefcase, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  FavoriteRow,
  FavoriteType,
  listFavorites,
  removeFavorite,
} from '@/lib/marketplace';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import {
  fetchActiveCategories,
  ServiceCategory,
} from '@/lib/service-categories';
import { toast } from 'sonner';

type Tab = FavoriteType;

interface ProviderFav {
  user_id: string;
  display_name?: string | null;
  username?: string | null;
  avatar_key?: string | null;
  avatar_url?: string | null;
  metier?: string | null;
  city?: string | null;
}

interface WorkFav {
  id: string;
  title: string;
  media_key: string;
  media_type: 'image' | 'video';
  media_url?: string | null;
  user_id: string;
}

export default function Favorites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('provider');
  const [rows, setRows] = useState<FavoriteRow[]>([]);
  const [providers, setProviders] = useState<ProviderFav[]>([]);
  const [works, setWorks] = useState<WorkFav[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setProviders([]);
      setWorks([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const favs = await listFavorites(user.id, tab);
      setRows(favs);

      const ids = favs.map((f) => f.target_id);

      if (ids.length === 0) {
        setProviders([]);
        setWorks([]);
        setCategories([]);
        setLoading(false);
        return;
      }

      if (tab === 'provider') {
        const { data } = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_key, metier, city')
          .in('user_id', ids);

        const list = ((data as ProviderFav[]) || []).map(async (p) => ({
          ...p,
          avatar_url: p.avatar_key ? await getMediaUrl(p.avatar_key) : null,
        }));

        setProviders(await Promise.all(list));
        setWorks([]);
        setCategories([]);
      }

      if (tab === 'work') {
        const { data } = await supabase
          .from('provider_works')
          .select('id, title, media_key, media_type, user_id')
          .in('id', ids);

        const list = ((data as WorkFav[]) || []).map(async (w) => ({
          ...w,
          media_url: w.media_key ? await getMediaUrl(w.media_key) : null,
        }));

        setWorks(await Promise.all(list));
        setProviders([]);
        setCategories([]);
      }

      if (tab === 'service') {
        const all = await fetchActiveCategories();
        setCategories(all.filter((c) => ids.includes(c.slug) || ids.includes(c.id)));
        setProviders([]);
        setWorks([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = async (type: FavoriteType, targetId: string) => {
    if (!user) return;

    const ok = await removeFavorite(user.id, type, targetId);

    if (ok) {
      setRows((prev) => prev.filter((r) => r.target_id !== targetId));

      if (type === 'provider') {
        setProviders((prev) => prev.filter((p) => p.user_id !== targetId));
      }

      if (type === 'work') {
        setWorks((prev) => prev.filter((w) => w.id !== targetId));
      }

      if (type === 'service') {
        setCategories((prev) =>
          prev.filter((c) => c.slug !== targetId && c.id !== targetId),
        );
      }

      toast.success('Retiré des favoris');
    }
  };

  const TabButton = ({
    id,
    label,
    icon: Icon,
  }: {
    id: Tab;
    label: string;
    icon: typeof Users;
  }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 inline-flex items-center justify-center gap-2 py-2 text-sm font-medium border-b-2 transition-colors ${
        tab === id
          ? 'border-[#2563eb] text-[#2563eb]'
          : 'border-transparent text-[var(--loboko-text-muted)]'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  const emptyText = useMemo(() => {
    if (tab === 'provider') return 'Aucun prestataire en favoris.';
    if (tab === 'work') return 'Aucune réalisation en favoris.';
    return 'Aucun service en favoris.';
  }, [tab]);

  if (!user) {
    return (
      <Layout title="Favoris">
        <div className="text-center py-16 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
          <Heart size={32} className="mx-auto mb-3 text-red-500" />
          <h1 className="text-xl font-bold mb-2">Connectez-vous</h1>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Vous devez être connecté pour voir vos favoris.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Favoris">
      <div className="mb-4">
        <h1 className="text-2xl font-bold inline-flex items-center gap-2">
          <Heart size={20} className="text-red-500" fill="#ef4444" /> Favoris
        </h1>
      </div>

      <div className="flex bg-[var(--loboko-surface)] rounded-xl border border-[var(--loboko-border)] overflow-hidden mb-4">
        <TabButton id="provider" label="Prestataires" icon={Users} />
        <TabButton id="service" label="Services" icon={Briefcase} />
        <TabButton id="work" label="Réalisations" icon={ImageIcon} />
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          {emptyText}
        </div>
      ) : tab === 'provider' ? (
        <div className="space-y-2">
          {providers.map((p) => (
            <button
              key={p.user_id}
              onClick={() => navigate(`/u/${p.user_id}`)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb]"
            >
              {p.avatar_url ? (
                <img src={p.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#2563eb] text-white font-bold flex items-center justify-center">
                  {(p.display_name || p.username || 'U').slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="flex-1 min-w-0 text-left">
                <div className="font-medium truncate">{p.display_name || p.username}</div>
                <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                  {p.metier || ''} {p.city ? `· ${p.city}` : ''}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove('provider', p.user_id);
                }}
                className="p-2 rounded-full hover:bg-[var(--loboko-hover)]"
                aria-label="Retirer"
              >
                <Heart size={16} fill="#ef4444" stroke="#ef4444" />
              </button>
            </button>
          ))}
        </div>
      ) : tab === 'work' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {works.map((w) => (
            <div
              key={w.id}
              className="relative rounded-xl overflow-hidden bg-[var(--loboko-surface)] border border-[var(--loboko-border)] aspect-square"
            >
              <button
                onClick={() => navigate(`/works/${w.id}`)}
                className="absolute inset-0"
                aria-label="Voir la réalisation"
              >
                <LazyMedia className="absolute inset-0">
                  {w.media_type === 'video' ? (
                    <video
                      src={w.media_url || undefined}
                      preload="none"
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={w.media_url || undefined}
                      alt={w.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  )}
                </LazyMedia>
              </button>

              <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-xs text-white font-medium line-clamp-1">{w.title}</p>
              </div>

              <button
                onClick={() => handleRemove('work', w.id)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center"
                aria-label="Retirer"
              >
                <Heart size={14} fill="#ef4444" stroke="#ef4444" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/services/${c.slug}`)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb]"
            >
              <div className="w-10 h-10 rounded-lg bg-[#2563eb]/10 text-[#2563eb] flex items-center justify-center">
                <Briefcase size={18} />
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className="font-medium truncate">{c.name}</div>
                {c.description && (
                  <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                    {c.description}
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove('service', c.slug);
                }}
                className="p-2 rounded-full hover:bg-[var(--loboko-hover)]"
                aria-label="Retirer"
              >
                <Heart size={16} fill="#ef4444" stroke="#ef4444" />
              </button>
            </button>
          ))}
        </div>
      )}
    </Layout>
  );
}
