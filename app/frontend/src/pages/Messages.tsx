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
  Check,
  CheckCheck,
} from 'lucide-react';
import EmojiPicker from '@/components/EmojiPicker';
import VoiceRecorder from '@/components/VoiceRecorder';
import VoiceMessage from '@/components/VoiceMessage';
import { decodePayload, encodePayload, formatDuration } from '@/lib/message-format';
import { useMessages } from '@/contexts/MessagesContext';
import { useCall } from '@/contexts/CallContext';
import { usePresence } from '@/contexts/PresenceContext';
import { sendTyping, subscribeTyping, TypingEvent } from '@/lib/presence';

interface Message {
  id: string;
  user_id: string;
  receiver_id: string;
  content: string;
  read?: boolean;
  delivered_at?: string | null;
  read_at?: string | null;
  status?: 'sent' | 'delivered' | 'read' | null;
  created_at?: string;
}

interface Conversation {
  userId: string;
  profile?: Profile;
  lastMessage?: Message;
}

function Avatar({ profile, online }: { profile?: Profile; online?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (profile?.avatar_key) getMediaUrl(profile.avatar_key).then(setUrl);
  }, [profile?.avatar_key]);
  const name = profile?.display_name || profile?.username || '?';
  return (
    <div className="relative shrink-0">
      <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-sm">
        {url ? (
          <img src={url} alt={name} className="w-full h-full object-cover" />
        ) : (
          name.slice(0, 2).toUpperCase()
        )}
      </div>
      <span
        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--loboko-surface)] ${
          online ? 'bg-green-500' : 'bg-gray-400'
        }`}
        aria-label={online ? 'En ligne' : 'Hors ligne'}
      />
    </div>
  );
}

function formatMessageTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const hm = `${hh}:${mm}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return hm;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return `Hier ${hm}`;
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 7) {
    const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return `${weekday} ${hm}`;
  }
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${hm}`;
}

function MessageStatus({ m, peerOnline }: { m: Message; peerOnline: boolean }) {
  // read > delivered > sent
  const isRead = !!m.read_at || m.status === 'read' || m.read === true;
  const isDelivered = !!m.delivered_at || m.status === 'delivered' || peerOnline;

  if (isRead) {
    return <CheckCheck size={14} className="text-[#60a5fa]" aria-label="Lu" />;
  }
  if (isDelivered) {
    return <CheckCheck size={14} className="text-white/70" aria-label="Reçu" />;
  }
  return <Check size={14} className="text-white/70" aria-label="Envoyé" />;
}

export default function Messages() {
  const { user } = useAuth();
  const { changeTick, refresh: refreshMessagesBadge } = useMessages();
  const { startCall } = useCall();
  const { isOnline } = usePresence();
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
  const [peerTyping, setPeerTyping] = useState<'typing' | 'recording' | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);

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

  // Subscribe to typing/recording broadcasts from the active peer
  useEffect(() => {
    if (!myId || !activeUserId) {
      setPeerTyping(null);
      return;
    }
    const unsub = subscribeTyping((e: TypingEvent) => {
      if (e.from !== activeUserId || e.to !== myId) return;
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
      if (e.kind === 'stop') {
        setPeerTyping(null);
        return;
      }
      setPeerTyping(e.kind);
      // auto-clear after 5s in case stop event is lost
      peerTypingTimerRef.current = setTimeout(() => {
        setPeerTyping(null);
      }, 5000);
    });
    return () => {
      unsub();
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
      setPeerTyping(null);
    };
  }, [myId, activeUserId]);

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
  }, [activeMessages, peerTyping]);

  // Mark incoming messages as delivered (on receive) and read (on open)
  useEffect(() => {
    if (!myId || !activeUserId) return;
    const incoming = activeMessages.filter(
      (m) => m.user_id === activeUserId && m.receiver_id === myId,
    );
    const toDeliver = incoming.filter((m) => !m.delivered_at).map((m) => m.id);
    const toRead = incoming.filter((m) => m.read === false || !m.read_at).map((m) => m.id);
    (async () => {
      try {
        if (toDeliver.length > 0) {
          // Try with new columns; fall back silently if columns don't exist.
          const res = await supabase
            .from('messages')
            .update({
              delivered_at: new Date().toISOString(),
              status: 'delivered',
            })
            .in('id', toDeliver);
          if (res.error) {
            // ignore, old schema
          }
        }
        if (toRead.length > 0) {
          const payload: Record<string, unknown> = { read: true };
          payload.read_at = new Date().toISOString();
          payload.status = 'read';
          const { error } = await supabase
            .from('messages')
            .update(payload)
            .in('id', toRead);
          if (error) {
            // Retry with minimal payload if new columns are missing
            await supabase.from('messages').update({ read: true }).in('id', toRead);
          }
          await refreshMessagesBadge();
        }
      } catch (e) {
        console.error('[messages] mark delivered/read failed', e);
      }
    })();
  }, [activeUserId, activeMessages, myId, refreshMessagesBadge]);

  const insertMessage = async (payload: {
    receiver_id: string;
    content: string;
    read?: boolean;
  }) => {
    if (!myId) return;
    const row: Record<string, unknown> = {
      user_id: myId,
      receiver_id: payload.receiver_id,
      content: payload.content,
      read: payload.read ?? false,
    };
    row.status = 'sent';
    const res = await supabase.from('messages').insert(row);
    if (res.error) {
      // fallback without status column
      const { error } = await supabase.from('messages').insert({
        user_id: myId,
        receiver_id: payload.receiver_id,
        content: payload.content,
        read: payload.read ?? false,
      });
      if (error) throw error;
    }
  };

  const emitStopTyping = useCallback(async () => {
    if (!activeUserId) return;
    await sendTyping(activeUserId, 'stop');
  }, [activeUserId]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!activeUserId) return;
    const now = Date.now();
    // Debounce: send at most every 2s
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      sendTyping(activeUserId, 'typing').catch(() => {});
    }
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    stopTypingTimerRef.current = setTimeout(() => {
      emitStopTyping().catch(() => {});
    }, 3000);
  };

  const sendText = async () => {
    if (!draft.trim() || !activeUserId) return;
    const text = draft.trim();
    setDraft('');
    setShowEmoji(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    emitStopTyping().catch(() => {});
    try {
      await insertMessage({ receiver_id: activeUserId, content: text });
      // Note: intentionally NO `createNotification` for messages. Messages
      // appear in Messages page only, with their own unread badge.
      await loadMessages();
    } catch (e) {
      console.error(e);
    }
  };

  const sendVoiceNote = async (objectKey: string, duration: number) => {
    if (!activeUserId) return;
    emitStopTyping().catch(() => {});
    try {
      await insertMessage({
        receiver_id: activeUserId,
        content: encodePayload({ kind: 'audio', object_key: objectKey, duration }),
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

  // Broadcast "recording" while the recorder is open
  useEffect(() => {
    if (!activeUserId) return;
    if (showRecorder) {
      sendTyping(activeUserId, 'recording').catch(() => {});
      const interval = setInterval(() => {
        sendTyping(activeUserId, 'recording').catch(() => {});
      }, 2000);
      return () => {
        clearInterval(interval);
        sendTyping(activeUserId, 'stop').catch(() => {});
      };
    }
    return undefined;
  }, [showRecorder, activeUserId]);

  const activeProfile = activeUserId ? profilesMap[activeUserId] : undefined;
  const activeOnline = activeUserId ? isOnline(activeUserId) : false;

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
              const online = isOnline(c.userId);
              return (
                <button
                  key={c.userId}
                  onClick={() => setActiveUserId(c.userId)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb] transition text-left"
                >
                  <Avatar profile={c.profile} online={online} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm truncate">
                        {c.profile?.display_name || c.profile?.username || 'Utilisateur'}
                      </div>
                      <div className="text-[10px] text-[var(--loboko-text-muted)] shrink-0">
                        {formatMessageTime(c.lastMessage?.created_at)}
                      </div>
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
            <Avatar profile={activeProfile} online={activeOnline} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {activeProfile?.display_name || activeProfile?.username || 'Utilisateur'}
              </div>
              <div className="text-xs truncate">
                {peerTyping === 'typing' ? (
                  <span className="text-[#2563eb]">
                    {activeProfile?.display_name || activeProfile?.username || 'Utilisateur'} est en train d'écrire…
                  </span>
                ) : peerTyping === 'recording' ? (
                  <span className="text-[#2563eb]">
                    {activeProfile?.display_name || activeProfile?.username || 'Utilisateur'} enregistre une note vocale…
                  </span>
                ) : activeOnline ? (
                  <span className="text-green-500">En ligne</span>
                ) : (
                  <span className="text-[var(--loboko-text-muted)]">Hors ligne</span>
                )}
              </div>
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
                    <div key={m.id} className="flex flex-col items-center">
                      <div
                        className={`flex items-center gap-2 text-xs ${color} bg-[var(--loboko-elevated)] px-3 py-1.5 rounded-full`}
                      >
                        <Icon size={12} />
                        <span>{label}</span>
                      </div>
                      <div className="text-[10px] text-[var(--loboko-text-muted)] mt-0.5">
                        {formatMessageTime(m.created_at)}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
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
                    <div
                      className={`flex items-center gap-1 mt-0.5 px-1 text-[10px] text-[var(--loboko-text-muted)] ${
                        mine ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <span>{formatMessageTime(m.created_at)}</span>
                      {mine && (
                        <span className="inline-flex items-center">
                          <MessageStatus m={m} peerOnline={activeOnline} />
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
                  onChange={(e) => handleDraftChange(e.target.value)}
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