import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { getMediaUrl } from '@/lib/storage-helpers';
import { Bell, Heart, MessageCircle, UserPlus, MessageSquare, Share2, Reply } from 'lucide-react';

interface Notif {
  id: string;
  user_id: string;
  from_user_id?: string;
  type: string;
  post_id?: string;
  message?: string;
  read?: boolean;
  created_at?: string;
}

interface SenderProfile {
  user_id: string;
  username?: string;
  display_name?: string;
  avatar_key?: string;
  avatar_url?: string;
}

const iconFor = (type: string) => {
  if (type === 'like') return Heart;
  if (type === 'comment_liked') return Heart;
  if (type === 'comment') return MessageSquare;
  if (type === 'comment_replied') return Reply;
  if (type === 'post_shared') return Share2;
  if (type === 'message') return MessageCircle;
  if (type === 'follow') return UserPlus;
  return Bell;
};

const colorFor = (type: string) => {
  if (type === 'like' || type === 'comment_liked') return 'text-[#ec4899]';
  if (type === 'comment' || type === 'comment_replied') return 'text-[#2563eb]';
  if (type === 'post_shared') return 'text-[#8b5cf6]';
  if (type === 'message') return 'text-[#10b981]';
  if (type === 'follow') return 'text-[#f59e0b]';
  return 'text-[#2563eb]';
};

const defaultTextFor = (type: string): string => {
  switch (type) {
    case 'like':
      return 'a aimé votre publication';
    case 'comment':
      return 'a commenté votre publication';
    case 'comment_liked':
      return 'a aimé votre commentaire';
    case 'comment_replied':
      return 'a répondu à votre commentaire';
    case 'post_shared':
      return 'a partagé votre publication';
    case 'follow':
      return 'vous suit désormais';
    default:
      return `Nouvelle ${type}`;
  }
};

const formatRelative = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days} j`;
  return d.toLocaleDateString('fr-FR');
};

export default function Notifications() {
  const { user } = useAuth();
  const { markAllRead, refresh } = useNotifications();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [senders, setSenders] = useState<Record<string, SenderProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .neq('type', 'message')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        const rows = (data as Notif[]) || [];
        setItems(rows);

        const fromIds = Array.from(
          new Set(rows.map((n) => n.from_user_id).filter((v): v is string => !!v)),
        );
        if (fromIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_key')
            .in('user_id', fromIds);
          const map: Record<string, SenderProfile> = {};
          await Promise.all(
            (profiles || []).map(async (p: SenderProfile) => {
              let avatar_url: string | undefined;
              if (p.avatar_key) {
                try {
                  avatar_url = (await getMediaUrl(p.avatar_key)) || undefined;
                } catch {
                  /* ignore */
                }
              }
              map[p.user_id] = { ...p, avatar_url };
            }),
          );
          setSenders(map);
        }

        // Mark all as read once the page is viewed
        await markAllRead();
        await refresh();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleClick = (n: Notif) => {
    const postTypes = ['like', 'comment', 'comment_liked', 'comment_replied', 'post_shared'];
    if (postTypes.includes(n.type) && n.post_id) {
      navigate('/home');
    }
  };

  return (
    <Layout title="Notifications">
      <h1 className="text-2xl font-bold mb-4 hidden lg:block">Notifications</h1>
      {loading ? (
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
          <div className="w-16 h-16 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-4">
            <Bell size={24} className="text-[#2563eb]" />
          </div>
          <h3 className="font-semibold mb-1">Aucune notification</h3>
          <p className="text-sm text-[var(--loboko-text-muted)]">
            Vous serez prévenu ici des nouvelles activités
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = iconFor(n.type);
            const sender = n.from_user_id ? senders[n.from_user_id] : undefined;
            const senderName =
              sender?.display_name || sender?.username || 'Quelqu\'un';
            const initials = senderName.slice(0, 2).toUpperCase();
            const text = n.message || defaultTextFor(n.type);
            const clickable =
              ['like', 'comment', 'comment_liked', 'comment_replied', 'post_shared'].includes(
                n.type,
              ) && !!n.post_id;

            return (
              <button
                key={n.id}
                onClick={() => clickable && handleClick(n)}
                disabled={!clickable}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl border transition ${
                  n.read
                    ? 'bg-[var(--loboko-surface)] border-[var(--loboko-border)]'
                    : 'bg-[rgba(37,99,235,0.08)] border-[#2563eb]'
                } ${clickable ? 'hover:border-[#2563eb] cursor-pointer' : 'cursor-default'}`}
              >
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-xs">
                    {sender?.avatar_url ? (
                      <img
                        src={sender.avatar_url}
                        alt={senderName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] flex items-center justify-center ${colorFor(
                      n.type,
                    )}`}
                  >
                    <Icon size={11} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-semibold">{senderName}</span>{' '}
                    <span className="text-[var(--loboko-text-secondary)]">{text}</span>
                  </div>
                  <div className="text-xs text-[var(--loboko-text-muted)] mt-0.5">
                    {formatRelative(n.created_at)}
                  </div>
                </div>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-[#2563eb] shrink-0" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      )}
    </Layout>
  );
}