import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { client } from '@/lib/atoms-client';
import { useAuth, Profile } from '@/contexts/AuthContext';
import { getMediaUrl } from '@/lib/storage-helpers';
import { Send, ArrowLeft, Smile, Mic, Phone, Video, PhoneMissed, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import EmojiPicker from '@/components/EmojiPicker';
import VoiceRecorder from '@/components/VoiceRecorder';
import VoiceMessage from '@/components/VoiceMessage';
import CallModal from '@/components/CallModal';
import { decodePayload, encodePayload, formatDuration } from '@/lib/message-format';

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

interface IncomingCall {
  callId: string;
  peerId: string;
  mode: 'voice' | 'video';
  sdp: string;
  messageId: number;
}

function Avatar({ profile }: { profile?: Profile }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (profile?.avatar_key) getMediaUrl(profile.avatar_key).then(setUrl);
  }, [profile?.avatar_key]);
  const name = profile?.display_name || profile?.username || '?';
  return (
    <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-sm shrink-0">
      {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function randomCallId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Messages() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const urlTo = searchParams.get('to');
  const myId = profile?.user_id || (user ? `loboko:${user.id}` : '');

  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [activeUserId, setActiveUserId] = useState<string | null>(urlTo);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [call, setCall] = useState<{
    peerId: string;
    peerName: string;
    mode: 'voice' | 'video';
    direction: 'outgoing' | 'incoming';
    callId: string;
    initialOffer?: { sdp: string } | null;
  } | null>(null);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const seenOffersRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(async () => {
    if (!myId) return;
    try {
      const res = await client.entities.messages.query({
        query: {},
        sort: '-created_at',
        limit: 400,
      });
      const items = (res?.data?.items as Message[]) || [];
      setAllMessages(items);
      // Detect incoming calls: offer signals addressed to me, not yet seen.
      if (!call) {
        for (const m of items) {
          if (m.receiver_id !== myId) continue;
          const p = decodePayload(m.content);
          if (p.kind !== 'signal') continue;
          if (p.signal.type !== 'offer') continue;
          if (seenOffersRef.current.has(p.callId)) continue;
          // Check if call already ended/rejected by scanning newer items.
          const ended = items.some((x) => {
            if (x.id <= m.id) return false;
            const xp = decodePayload(x.content);
            if (xp.kind !== 'signal') return false;
            return (
              xp.callId === p.callId &&
              (xp.signal.type === 'hangup' || xp.signal.type === 'reject')
            );
          });
          if (ended) {
            seenOffersRef.current.add(p.callId);
            continue;
          }
          // Only treat as incoming if offer is recent (last 60s).
          const ageMs = m.created_at
            ? Date.now() - new Date(m.created_at).getTime()
            : 0;
          if (ageMs > 60_000) {
            seenOffersRef.current.add(p.callId);
            continue;
          }
          seenOffersRef.current.add(p.callId);
          setIncoming({
            callId: p.callId,
            peerId: m.user_id,
            mode: p.mode,
            sdp: p.signal.sdp,
            messageId: m.id,
          });
          break;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [myId, call]);

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

  // Global short-interval polling so incoming calls are detected everywhere
  // on the Messages page.
  useEffect(() => {
    const t = setInterval(loadMessages, 2500);
    return () => clearInterval(t);
  }, [loadMessages]);

  const conversations: Conversation[] = useMemo(() => {
    const byUser: Record<string, Message> = {};
    allMessages.forEach((m) => {
      // Skip signaling noise from conversation list
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
        // Hide raw WebRTC signaling, only show call_event summaries.
        return p.kind !== 'signal';
      })
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }, [allMessages, activeUserId, myId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMessages]);

  const sendText = async () => {
    if (!draft.trim() || !activeUserId) return;
    const text = draft.trim();
    setDraft('');
    setShowEmoji(false);
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

  const sendVoiceNote = async (objectKey: string, duration: number) => {
    if (!activeUserId) return;
    try {
      await client.entities.messages.create({
        data: {
          receiver_id: activeUserId,
          content: encodePayload({ kind: 'audio', object_key: objectKey, duration }),
          read: false,
        },
      });
      await loadMessages();
    } catch (e) {
      console.error(e);
    }
  };

  const sendCallEvent = async (
    peerId: string,
    mode: 'voice' | 'video',
    callId: string,
    event: 'ended' | 'missed' | 'rejected',
    duration: number,
  ) => {
    try {
      await client.entities.messages.create({
        data: {
          receiver_id: peerId,
          content: encodePayload({
            kind: 'call_event',
            mode,
            event,
            callId,
            duration,
          }),
          read: false,
        },
      });
    } catch (e) {
      console.error(e);
    }
  };

  const startCall = (mode: 'voice' | 'video') => {
    if (!activeUserId) return;
    const callId = randomCallId();
    setCall({
      peerId: activeUserId,
      peerName:
        profilesMap[activeUserId]?.display_name ||
        profilesMap[activeUserId]?.username ||
        'Utilisateur',
      mode,
      direction: 'outgoing',
      callId,
    });
  };

  const acceptIncoming = () => {
    if (!incoming) return;
    const peerProfile = profilesMap[incoming.peerId];
    setCall({
      peerId: incoming.peerId,
      peerName: peerProfile?.display_name || peerProfile?.username || 'Utilisateur',
      mode: incoming.mode,
      direction: 'incoming',
      callId: incoming.callId,
      initialOffer: { sdp: incoming.sdp },
    });
    setActiveUserId(incoming.peerId);
    setIncoming(null);
  };

  const rejectIncoming = async () => {
    if (!incoming) return;
    try {
      await client.entities.messages.create({
        data: {
          receiver_id: incoming.peerId,
          content: encodePayload({
            kind: 'signal',
            callId: incoming.callId,
            mode: incoming.mode,
            signal: { type: 'reject' },
          }),
          read: false,
        },
      });
      await sendCallEvent(incoming.peerId, incoming.mode, incoming.callId, 'rejected', 0);
    } catch (e) {
      console.error(e);
    }
    setIncoming(null);
  };

  const onCallClose = async (result: { status: 'accepted' | 'rejected' | 'missed' | 'ended'; duration: number }) => {
    if (call) {
      const event =
        result.status === 'rejected'
          ? 'rejected'
          : result.status === 'missed'
            ? 'missed'
            : 'ended';
      await sendCallEvent(call.peerId, call.mode, call.callId, event, result.duration);
      await loadMessages();
    }
    setCall(null);
  };

  const activeProfile = activeUserId ? profilesMap[activeUserId] : undefined;

  return (
    <Layout title="Messages">
      <h1 className="text-2xl font-bold mb-4 hidden lg:block">Messages</h1>

      {incoming && !call && (
        <div className="fixed top-4 right-4 z-40 bg-[var(--loboko-elevated)] border border-[#2563eb] rounded-2xl p-4 shadow-2xl flex items-center gap-3 max-w-sm animate-in fade-in slide-in-from-top-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold">
            {(profilesMap[incoming.peerId]?.display_name ||
              profilesMap[incoming.peerId]?.username ||
              '?')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">
              {profilesMap[incoming.peerId]?.display_name ||
                profilesMap[incoming.peerId]?.username ||
                'Utilisateur'}
            </div>
            <div className="text-xs text-[var(--loboko-text-muted)]">
              Appel {incoming.mode === 'video' ? 'vidéo' : 'vocal'} entrant
            </div>
          </div>
          <button
            onClick={rejectIncoming}
            className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center"
            aria-label="Refuser"
          >
            <PhoneMissed size={16} />
          </button>
          <button
            onClick={acceptIncoming}
            className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center"
            aria-label="Accepter"
          >
            <Phone size={16} />
          </button>
        </div>
      )}

      {!activeUserId ? (
        loading ? (
          <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">Chargement...</div>
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
              onClick={() => startCall('voice')}
              className="w-9 h-9 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)] flex items-center justify-center"
              aria-label="Appel vocal"
              title="Appel vocal"
            >
              <Phone size={16} />
            </button>
            <button
              onClick={() => startCall('video')}
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
                      <div className={`flex items-center gap-2 text-xs ${color} bg-[var(--loboko-elevated)] px-3 py-1.5 rounded-full`}>
                        <Icon size={12} />
                        <span>{label}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
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

      {call && (
        <CallModal
          myId={myId}
          peerId={call.peerId}
          peerName={call.peerName}
          mode={call.mode}
          direction={call.direction}
          callId={call.callId}
          initialOffer={call.initialOffer}
          onClose={onCallClose}
        />
      )}
    </Layout>
  );
}