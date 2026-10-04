import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { getMediaUrl } from '@/lib/storage-helpers';
import { chatDayKey, formatChatDay } from '@/lib/chat-date';
import { logger } from '@/lib/logger';
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

interface PostPreview {
  id: string;
  image_key?: string;
  media_keys?: Array<string | { key: string; type: 'image' | 'video'; poster?: string }>;
}

function previewKey(post: PostPreview): string | undefined {
  const first = post.media_keys?.[0];
  if (typeof first === 'string') {
    return /\.(mp4|webm|mov)(?:\?|$)/i.test(first) ? undefined : first;
  }
  if (first) return first.type === 'video' ? first.poster : first.key;
  return post.image_key || undefined;
}

export default function Notifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const { refresh } = useNotifications();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [senders, setSenders] = useState<Record<string, SenderProfile>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [owner, setOwner] = useState<string | undefined>(userId);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reload, setReload] = useState(0);
  const accountRef = useRef(userId);

  useEffect(() => {
    accountRef.current = userId;
    let cancelled = false;
    let request = 0;
    setOwner(userId);
    setItems([]);
    setSenders({});
    setPreviews({});
    setUnreadOnly(false);
    setActionError('');
    setMarkingAll(false);
    setLoading(!!userId);
    setLoadError(false);
    if (!userId) return;

    const load = async () => {
      const current = ++request;
      const valid = () => !cancelled && current === request;
      try {
        const { data, error } = await supabase.from('notifications')
          .select('*').eq('user_id', userId).neq('type', 'message')
          .order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        if (!valid()) return;
        const rows = (data as Notif[]) || [];
        setItems(rows);
        setLoading(false);
        setLoadError(false);
        const fromIds = [...new Set(rows.flatMap((n) => n.from_user_id ? [n.from_user_id] : []))];
        const postIds = [...new Set(rows.flatMap((n) => n.post_id ? [n.post_id] : []))];
        // Enrich in parallel; avatars/miniatures never delay the activity list.
        await Promise.all([
          (async () => {
            if (!fromIds.length) { if (valid()) setSenders({}); return; }
            const { data: profiles, error: profileError } = await supabase.from('profiles')
              .select('user_id, username, display_name, avatar_key').in('user_id', fromIds);
            if (profileError) return;
            const entries = await Promise.all((profiles || []).map(async (profile: SenderProfile) => {
              const avatar_url = profile.avatar_key
                ? (await getMediaUrl(profile.avatar_key).catch(() => null)) || undefined : undefined;
              return [profile.user_id, { ...profile, avatar_url }] as const;
            }));
            if (valid()) setSenders(Object.fromEntries(entries));
          })(),
          (async () => {
            if (!postIds.length) { if (valid()) setPreviews({}); return; }
            const { data: posts, error: postError } = await supabase.from('posts')
              .select('id, image_key, media_keys').in('id', postIds)
              .or('hidden_by_moderation.is.null,hidden_by_moderation.eq.false');
            if (postError) return;
            const entries = await Promise.all((posts as PostPreview[] || []).map(async (post) => {
              const key = previewKey(post);
              const url = key ? await getMediaUrl(key).catch(() => null) : null;
              return [post.id, url] as const;
            }));
            if (valid()) setPreviews(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => !!entry[1])));
          })(),
        ]);
      } catch (error) {
        if (valid()) {
          setLoadError(true);
          logger.error('notifications load failed', { context: 'Notifications.load', error });
        }
      } finally {
        if (valid()) setLoading(false);
      }
    };
    void load();
    const channel = supabase.channel(`notifications-page-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => { void load(); })
      .subscribe();
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      void supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  const currentItems = owner === userId ? items : [];
  const unreadCount = currentItems.filter((item) => !item.read).length;
  const visibleItems = unreadOnly ? currentItems.filter((item) => !item.read) : currentItems;
  const pending = loading || owner !== userId;

  const markRead = async (id?: string) => {
    if (!userId) return;
    const account = userId;
    setActionError('');
    if (!id) setMarkingAll(true);
    try {
      let query = supabase.from('notifications').update({ read: true })
        .eq('user_id', account).neq('type', 'message');
      if (id) query = query.eq('id', id);
      else query = query.eq('read', false);
      const { data, error } = await query.select('id');
      if (error) throw error;
      if (accountRef.current !== account) return;
      const updated = new Set((data || []).map((row: { id: string }) => row.id));
      if (!updated.size) throw new Error('Aucune notification mise à jour');
      setItems((current) => current.map((item) => updated.has(item.id) ? { ...item, read: true } : item));
      await refresh();
    } catch (error) {
      if (accountRef.current === account) {
        setActionError('Impossible de marquer comme lu. Réessayez.');
        logger.error('notification update failed', { context: 'Notifications.markRead', error });
      }
    } finally {
      if (!id && accountRef.current === account) setMarkingAll(false);
    }
  };

  const handleClick = (item: Notif) => {
    if (!item.read) void markRead(item.id);
    if (['like', 'comment', 'comment_liked', 'comment_replied', 'post_shared'].includes(item.type) && item.post_id) {
      navigate(`/post/${item.post_id}`);
    }
  };

  return (
    <Layout title="Notifications">
      <div className="mb-5">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Notifications</h1>
        <p className="mt-1 text-[var(--loboko-text-muted)]">Vos dernières activités</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center gap-2" role="group" aria-label="Filtrer les notifications">
          {[{ label: 'Toutes', unread: false }, { label: 'Non lues', unread: true }].map((filter) => (
            <button key={filter.label} type="button" aria-pressed={unreadOnly === filter.unread}
              onClick={() => setUnreadOnly(filter.unread)}
              className={`min-h-11 rounded-full px-5 py-2.5 text-sm font-semibold border transition ${unreadOnly === filter.unread ? 'bg-[#2563eb] border-[#2563eb] text-white' : 'bg-[var(--loboko-elevated)] border-[var(--loboko-border)] text-[var(--loboko-text)] hover:border-[#2563eb]'}`}>
              {filter.label}{filter.unread && unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { void markRead(); }} disabled={pending || markingAll || unreadCount === 0}
          className="ml-auto min-h-11 px-1 text-xs sm:text-sm font-semibold text-[#2563eb] disabled:opacity-40 hover:underline disabled:no-underline">
          {markingAll ? 'Mise à jour…' : 'Tout marquer comme lu'}
        </button>
      </div>
      {actionError && <p role="alert" className="mb-4 text-sm text-red-500">{actionError}</p>}
      {pending ? (
        <div role="status" aria-label="Chargement des notifications" className="space-y-3">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} aria-hidden="true" className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] motion-safe:animate-pulse">
              <div className="w-12 h-12 rounded-full bg-[var(--loboko-border)] shrink-0" />
              <div className="flex-1 space-y-2"><div className="h-3 w-3/4 rounded bg-[var(--loboko-border)]" /><div className="h-3 w-1/3 rounded bg-[var(--loboko-border)]" /></div>
            </div>
          ))}
        </div>
      ) : loadError && currentItems.length === 0 ? (
        <div role="alert" className="text-center py-12 px-4 rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)]">
          <p className="mb-3">Impossible de charger les notifications.</p>
          <button type="button" onClick={() => setReload((value) => value + 1)} className="px-5 py-2.5 rounded-full bg-[#2563eb] text-white">Réessayer</button>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="text-center py-16 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
          <div className="w-16 h-16 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-4"><Bell size={24} className="text-[#2563eb]" /></div>
          <h2 className="font-semibold mb-1">{unreadOnly ? 'Vous êtes à jour' : 'Aucune notification'}</h2>
          <p className="text-sm text-[var(--loboko-text-muted)]">{unreadOnly ? 'Aucune notification non lue.' : 'Vous serez prévenu ici des nouvelles activités.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item, index) => {
            const Icon = iconFor(item.type);
            const sender = item.from_user_id ? senders[item.from_user_id] : undefined;
            const senderName = sender?.display_name || sender?.username || "Quelqu’un";
            const preview = item.post_id ? previews[item.post_id] : undefined;
            const newDay = index === 0 || chatDayKey(item.created_at) !== chatDayKey(visibleItems[index - 1].created_at);
            return (
              <Fragment key={item.id}>
                {newDay && <h2 className="pt-2 pb-1 text-base font-semibold text-[var(--loboko-text-secondary)]">{formatChatDay(item.created_at) || 'Activités'}</h2>}
                <button type="button" onClick={() => handleClick(item)}
                  aria-label={`${senderName} ${item.message || defaultTextFor(item.type)}${item.read ? '' : ' · Non lue'}`}
                  className={`relative overflow-hidden w-full text-left flex items-center gap-3 p-4 rounded-2xl border border-[var(--loboko-border)] transition hover:border-[#2563eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] ${item.read ? 'bg-[var(--loboko-elevated)]' : 'bg-[rgba(37,99,235,0.06)]'}`}>
                  {!item.read && <span className="absolute inset-y-0 left-0 w-1 bg-[#2563eb]" aria-hidden="true" />}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-sm">
                      {sender?.avatar_url ? <img src={sender.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : senderName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-[var(--loboko-bg)] flex items-center justify-center ${item.read ? `bg-[var(--loboko-surface)] ${colorFor(item.type)}` : 'bg-[#2563eb] text-white'}`} aria-hidden="true"><Icon size={12} /></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base break-words"><span className="font-semibold">{senderName}</span>{' '}<span className="text-[var(--loboko-text-secondary)]">{item.message || defaultTextFor(item.type)}</span></p>
                    <p className="text-xs text-[var(--loboko-text-muted)] mt-1.5">{formatRelative(item.created_at)}</p>
                  </div>
                  {preview && <img src={preview} alt="" loading="lazy" className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0" onError={() => setPreviews((current) => { const next = { ...current }; if (item.post_id) delete next[item.post_id]; return next; })} />}
                  {!item.read && <span className="w-2 h-2 rounded-full bg-[#2563eb] shrink-0" aria-hidden="true" />}
                </button>
              </Fragment>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
