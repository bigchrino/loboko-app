import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { client } from '@/lib/atoms-client';
import { useAuth, Profile } from '@/contexts/AuthContext';
import { getMediaUrl } from '@/lib/storage-helpers';
import { Send, ArrowLeft } from 'lucide-react';

interface Message {
  id: number;
  user_id: string;
  receiver_id: string;
  content: string;
  read?: boolean;
  created_at?: string;
}

interface Conversation {
  userId: string;
  profile?: Profile;
  lastMessage?: Message;
}

function Avatar({ profile }: { profile?: Profile }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (profile?.avatar_key) getMediaUrl(profile.avatar_key).then(setUrl);
  }, [profile?.avatar_key]);
  const name = profile?.display_name || profile?.username || '?';
  return (
    <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] flex items-center justify-center text-white font-bold text-sm shrink-0">
      {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const urlTo = searchParams.get('to');
  const myId = (user?.id as string) || (user?.sub as string) || (user?.user_id as string) || '';

  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [activeUserId, setActiveUserId] = useState<string | null>(urlTo);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!myId) return;
    try {
      const res = await client.entities.messages.query({
        query: {},
        sort: '-created_at',
        limit: 200,
      });
      const items = (res?.data?.items as Message[]) || [];
      setAllMessages(items);
    } catch (e) {
      console.error(e);
    }
  }, [myId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadMessages();
      try {
        const res = await client.entities.profiles.queryAll({ query: {}, limit: 200 });
        const list = (res?.data?.items as Profile[]) || [];
        const map: Record<string, Profile> = {};
        list.forEach((p) => (map[p.user_id] = p));
        setProfilesMap(map);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [loadMessages]);

  // Polling every 5s for new messages when a conversation is open
  useEffect(() => {
    if (!activeUserId) return;
    const t = setInterval(loadMessages, 5000);
    return () => clearInterval(t);
  }, [activeUserId, loadMessages]);

  const conversations: Conversation[] = useMemo(() => {
    const byUser: Record<string, Message> = {};
    allMessages.forEach((m) => {
      const other = m.user_id === myId ? m.receiver_id : m.user_id;
      if (!byUser[other]) byUser[other] = m;
    });
    return Object.entries(byUser).map(([userId, lastMessage]) => ({
      userId,
      profile: profilesMap[userId],
      lastMessage,
    }));
  }, [allMessages, myId, profilesMap]);

  const activeMessages = useMemo(() => {
    if (!activeUserId) return [];
    return allMessages
      .filter(
        (m) =>
          (m.user_id === myId && m.receiver_id === activeUserId) ||
          (m.user_id === activeUserId && m.receiver_id === myId),
      )
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }, [allMessages, activeUserId, myId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMessages]);

  const send = async () => {
    if (!draft.trim() || !activeUserId) return;
    const text = draft.trim();
    setDraft('');
    try {
      await client.entities.messages.create({
        data: {
          receiver_id: activeUserId,
          content: text,
          read: false,
        },
      });
      await loadMessages();
    } catch (e) {
      console.error(e);
    }
  };

  const activeProfile = activeUserId ? profilesMap[activeUserId] : undefined;

  return (
    <Layout title="Messages">
      <h1 className="text-2xl font-bold mb-4 hidden lg:block">Messages</h1>

      {!activeUserId ? (
        loading ? (
          <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">Chargement...</div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-16 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
            <div className="w-16 h-16 mx-auto rounded-full bg-[rgba(139,92,246,0.15)] flex items-center justify-center mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="font-semibold mb-1">Aucune conversation</h3>
            <p className="text-sm text-[var(--loboko-text-muted)]">
              Allez dans Découverte pour contacter quelqu'un
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => (
              <button
                key={c.userId}
                onClick={() => setActiveUserId(c.userId)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#8b5cf6] transition text-left"
              >
                <Avatar profile={c.profile} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {c.profile?.display_name || c.profile?.username || 'Utilisateur'}
                  </div>
                  <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                    {c.lastMessage?.user_id === myId ? 'Vous: ' : ''}
                    {c.lastMessage?.content}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col h-[calc(100vh-180px)] lg:h-[calc(100vh-160px)] bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden">
          <header className="flex items-center gap-3 p-3 border-b border-[var(--loboko-border)]">
            <button
              onClick={() => setActiveUserId(null)}
              className="p-2 rounded-full hover:bg-[var(--loboko-surface-hover)]"
            >
              <ArrowLeft size={18} />
            </button>
            <Avatar profile={activeProfile} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {activeProfile?.display_name || activeProfile?.username || 'Utilisateur'}
              </div>
              {activeProfile?.metier && (
                <div className="text-xs text-[#8b5cf6] truncate">{activeProfile.metier}</div>
              )}
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeMessages.length === 0 ? (
              <div className="text-center text-xs text-[var(--loboko-text-muted)] py-10">
                Démarrez la conversation
              </div>
            ) : (
              activeMessages.map((m) => {
                const mine = m.user_id === myId;
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                        mine
                          ? 'bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white rounded-br-md'
                          : 'bg-[var(--loboko-elevated)] text-[var(--loboko-text)] rounded-bl-md'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-[var(--loboko-border)] flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Votre message..."
              className="flex-1 px-4 py-2.5 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#8b5cf6]"
            />
            <button
              onClick={send}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] text-white flex items-center justify-center shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}