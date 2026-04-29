import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth, Profile } from '@/contexts/AuthContext';
import { getMediaUrl } from '@/lib/storage-helpers';
import {
  Send,
  ArrowLeft,
  Smile,
  Mic,
  Phone,
  Video,
  PhoneMissed,
  PhoneIncoming,
  PhoneOutgoing,
} from 'lucide-react';
import EmojiPicker from '@/components/EmojiPicker';
import VoiceRecorder from '@/components/VoiceRecorder';
import VoiceMessage from '@/components/VoiceMessage';
import { decodePayload, encodePayload, formatDuration } from '@/lib/message-format';
import { createNotification } from '@/lib/notifications';
import { useMessages } from '@/contexts/MessagesContext';
import { useCall } from '@/contexts/CallContext';

interface Message {
  id: string;
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
    <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-sm shrink-0">
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const { changeTick, refresh: refreshMessagesBadge } = useMessages();
  const { startCall } = useCall();
  const [searchParams] = useSearchParams();
  const urlTo = searchParams.get('to');
  const myId = user?.id || '';

  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [activeUserId, setActiveUserId] = useState<string | null>(urlTo);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(async () => {
    if (!myId) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`user_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: false })
        .limit(400);
      if (error) throw error;
      setAllMessages((data as Message[]) || []);
    } catch (e) {
      console.error(e);
    }
  }, [myId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadMessages();
      try {
        const { data, error } = await supabase.from('profiles').select('*').limit(200);
        if (error) throw error;
        const list = (data as Profile[]) || [];
        const map: Record<string, Profile> = {};
        list.forEach((p) => (map[p.user_id] = p));
        setProfilesMap(map);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, [loadMessages]);

  useEffect(() => {
    loadMessages();
  }, [changeTick, loadMessages]);

  useEffect(() => {
    const t = setInterval(loadMessages, 30_000);
    return () => clearInterval(t);
  }, [loadMessages]);

  const conversations: Conversation[] = useMemo(() => {
    const byUser: Record<string, Message> = {};
    allMessages.forEach((m) => {
      const p = decodePayload(m.content);
      if (p.kind === 'signal') return;
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
      .filter((m) => {
        const involved =
          (m.user_id === myId && m.receiver_id === activeUserId) ||
          (m.user_id === activeUserId && m.receiver_id === myId);
        if (!involved) return false;
        const p = decodePayload(m.content);
        return p.kind !== 'signal';
      })
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }, [allMessages, activeUserId, myId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMessages]);

  useEffect(() => {
    if (!myId || !activeUserId) return;
    const unreadIds = activeMessages
      .filter((m) => m.user_id === activeUserId && m.receiver_id === myId && m.read === false)
      .map((m) => m.id);
    if (unreadIds.length === 0) return;
    (async () => {
      try {
        const { error } = await supabase
          .from('messages')
          .update({ read: true })
          .in('id', unreadIds);
        if (error) throw error;
        await refreshMessagesBadge();
      } catch (e) {
        console.error('[messages] mark read failed', e);
      }
    })();
  }, [activeUserId, activeMessages, myId, refreshMessagesBadge]);

  const insertMessage = async (payload: {
    receiver_id: string;
    content: string;
    read?: boolean;
  }) => {
    if (!myId) return;
    const { error } = await supabase.from('messages').insert({
      user_id: myId,
      receiver_id: payload.receiver_id,
      content: payload.content,
      read: payload.read ?? false,
    });
    if (error) throw error;
  };

  const sendText = async () => {
    if (!draft.trim() || !activeUserId) return;
    const text = draft.trim();
    setDraft('');
    setShowEmoji(false);
    try {
      await insertMessage({ receiver_id: activeUserId, content: text });
      await createNotification({
        recipientId: activeUserId,
        fromUserId: myId,
        type: 'message',
        message: text.length > 80 ? `${text.slice(0, 80)}…` : text,
      });
      await loadMessages();
    } catch (e) {
      console.error(e);
    }
  };

  const sendVoiceNote = async (objectKey: string, duration: number) => {
    if (!activeUserId) return;
    try {
      await insertMessage({
        receiver_id: activeUserId,
        content: encodePayload({ kind: 'audio', object_key: objectKey, duration }),
      });
      await createNotification({
        recipientId: activeUserId,
        fromUserId: myId,
        type: 'message',
        message: '🎤 Nouvelle note vocale',
      });
      await loadMessages();
    } catch (e) {
      console.error(e);
    }
  };

  const initiateCall = async (mode: 'voice' | 'video') => {
    if (!activeUserId) return;
    const peerProfile = profilesMap[activeUserId];
    const peerName =
      peerProfile?.display_name || peerProfile?.username || 'Utilisateur';
    await startCall(activeUserId, peerName, mode);
  };

  const activeProfile = activeUserId ? profilesMap[activeUserId] : undefined;

  return (
    <Layout title="Messages">
      <h1 className="text-2xl font-bold mb-4 hidden lg:block">Messages</h1>

      {!activeUserId ? (
        loading ? (
          <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
            Chargement...
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-16 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
            <div className="w-16 h-16 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-4">
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="font-semibold mb-1">Aucune conversation</h3>
            <p className="text-sm text-[var(--loboko-text-muted)]">
              Allez dans Découverte pour contacter quelqu'un
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => {
              const lastPayload = decodePayload(c.lastMessage?.content);
              let preview = '';
              if (lastPayload.kind === 'text') preview = lastPayload.text;
              else if (lastPayload.kind === 'audio') preview = '🎤 Note vocale';
              else if (lastPayload.kind === 'call_event')
                preview =
                  (lastPayload.mode === 'video' ? '📹 ' : '📞 ') +
                  (lastPayload.event === 'missed'
                    ? 'Appel manqué'
                    : lastPayload.event === 'rejected'
                      ? 'Appel refusé'
                      : `Appel (${formatDuration(lastPayload.duration || 0)})`);
              return (
                <button
                  key={c.userId}
                  onClick={() => setActiveUserId(c.userId)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb] transition text-left"
                >
                  <Avatar profile={c.profile} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {c.profile?.display_name || c.profile?.username || 'Utilisateur'}
                    </div>
                    <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                      {c.lastMessage?.user_id === myId ? 'Vous: ' : ''}
                      {preview}
                    </div>
                  </div>
                </button>
              );
            })}
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
                <div className="text-xs text-[#2563eb] truncate">{activeProfile.metier}</div>
              )}
            </div>
            <button
              onClick={() => initiateCall('voice')}
              className="w-9 h-9 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)] flex items-center justify-center"
              aria-label="Appel vocal"
              title="Appel vocal"
            >
              <Phone size={16} />
            </button>
            <button
              onClick={() => initiateCall('video')}
              className="w-9 h-9 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)] flex items-center justify-center"
              aria-label="Appel vidéo"
              title="Appel vidéo"
            >
              <Video size={16} />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeMessages.length === 0 ? (
              <div className="text-center text-xs text-[var(--loboko-text-muted)] py-10">
                Démarrez la conversation
              </div>
            ) : (
              activeMessages.map((m) => {
                const mine = m.user_id === myId;
                const payload = decodePayload(m.content);

                if (payload.kind === 'call_event') {
                  const label =
                    payload.event === 'missed'
                      ? mine
                        ? 'Appel sans réponse'
                        : 'Appel manqué'
                      : payload.event === 'rejected'
                        ? mine
                          ? 'Appel refusé'
                          : 'Vous avez refusé'
                        : `Appel ${payload.mode === 'video' ? 'vidéo' : 'vocal'} · ${formatDuration(payload.duration || 0)}`;
                  const Icon =
                    payload.event === 'missed' || payload.event === 'rejected'
                      ? PhoneMissed
                      : mine
                        ? PhoneOutgoing
                        : PhoneIncoming;
                  const color =
                    payload.event === 'missed' || payload.event === 'rejected'
                      ? 'text-red-400'
                      : 'text-[var(--loboko-text-muted)]';
                  return (
                    <div key={m.id} className="flex justify-center">
                      <div
                        className={`flex items-center gap-2 text-xs ${color} bg-[var(--loboko-elevated)] px-3 py-1.5 rounded-full`}
                      >
                        <Icon size={12} />
                        <span>{label}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                        mine
                          ? 'bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white rounded-br-md'
                          : 'bg-[var(--loboko-elevated)] text-[var(--loboko-text)] rounded-bl-md'
                      }`}
                    >
                      {payload.kind === 'audio' ? (
                        <VoiceMessage
                          objectKey={payload.object_key}
                          duration={payload.duration}
                          mine={mine}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap break-words">
                          {payload.kind === 'text' ? payload.text : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-[var(--loboko-border)] flex gap-2 relative">
            {showRecorder ? (
              <VoiceRecorder onSend={sendVoiceNote} onClose={() => setShowRecorder(false)} />
            ) : (
              <>
                <button
                  onClick={() => setShowEmoji((v) => !v)}
                  className="w-10 h-10 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] flex items-center justify-center shrink-0 text-[var(--loboko-text)]"
                  aria-label="Emojis"
                  type="button"
                >
                  <Smile size={18} />
                </button>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendText()}
                  placeholder="Votre message..."
                  className="flex-1 px-4 py-2.5 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
                />
                {draft.trim() ? (
                  <button
                    onClick={sendText}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white flex items-center justify-center shrink-0"
                    aria-label="Envoyer"
                  >
                    <Send size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowRecorder(true)}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white flex items-center justify-center shrink-0"
                    aria-label="Note vocale"
                    type="button"
                  >
                    <Mic size={16} />
                  </button>
                )}
                {showEmoji && (
                  <EmojiPicker
                    onSelect={(emoji) => setDraft((d) => d + emoji)}
                    onClose={() => setShowEmoji(false)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}