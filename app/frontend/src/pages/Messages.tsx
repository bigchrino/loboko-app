import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth, Profile } from '@/contexts/AuthContext';
import { getMediaUrl, uploadMediaEx } from '@/lib/storage-helpers';
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
  Paperclip,
  Search,
  X,
  Archive,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker from '@/components/EmojiPicker';
import VoiceRecorder from '@/components/VoiceRecorder';
import VoiceMessage from '@/components/VoiceMessage';
import MediaMessage from '@/components/MediaMessage';
import MediaPicker, { MediaSelection } from '@/components/MediaPicker';
import MediaPreview from '@/components/MediaPreview';
import ConversationMenu, { ConversationMenuAction } from '@/components/ConversationMenu';
import ConfirmDialog from '@/components/ConfirmDialog';
import { decodePayload, encodePayload, formatDuration } from '@/lib/message-format';
import { useMessages } from '@/contexts/MessagesContext';
import { useCall } from '@/contexts/CallContext';
import { usePresence } from '@/contexts/PresenceContext';
import { sendTyping, subscribeTyping, TypingEvent } from '@/lib/presence';
import {
  archiveConversation,
  blockUser,
  ConversationState,
  clearConversation,
  loadBlockedIds,
  loadConversationStates,
  reportUser,
  unarchiveConversation,
} from '@/lib/conversation-controls';

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

const MAX_MESSAGE_VIDEO_SECONDS = 60;

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

function previewOf(m?: Message): string {
  if (!m) return '';
  const p = decodePayload(m.content);
  if (p.kind === 'text') return p.text;
  if (p.kind === 'audio') return '🎤 Note vocale';
  if (p.kind === 'image') return '📷 Photo';
  if (p.kind === 'video') return '🎬 Vidéo';
  if (p.kind === 'call_event') {
    const icon = p.mode === 'video' ? '📹 ' : '📞 ';
    if (p.event === 'missed') return icon + 'Appel manqué';
    if (p.event === 'rejected') return icon + 'Appel refusé';
    return icon + `Appel (${formatDuration(p.duration || 0)})`;
  }
  return '';
}

export default function Messages() {
  const { user } = useAuth();
  const { changeTick, refresh: refreshMessagesBadge } = useMessages();
  const { startCall } = useCall();
  const { isOnline } = usePresence();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlTo = searchParams.get('to');
  const urlSearch = searchParams.get('search') === '1';
  const myId = user?.id || '';

  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [activeUserId, setActiveUserId] = useState<string | null>(urlTo);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<MediaSelection | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [peerTyping, setPeerTyping] = useState<'typing' | 'recording' | null>(
    null,
  );

  // Phase 1 state
  const [listQuery, setListQuery] = useState('');
  const [viewMode, setViewMode] = useState<'main' | 'archived'>('main');
  const [states, setStates] = useState<Record<string, ConversationState>>({});
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [convSearchOpen, setConvSearchOpen] = useState(urlSearch);
  const [convQuery, setConvQuery] = useState('');
  const [convMatchIndex, setConvMatchIndex] = useState(0);

  // Confirm dialogs
  const [pendingAction, setPendingAction] = useState<{
    kind: ConversationMenuAction;
    peerId: string;
    peerName: string;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadStates = useCallback(async () => {
    if (!myId) return;
    const rows = await loadConversationStates(myId);
    const map: Record<string, ConversationState> = {};
    rows.forEach((s) => (map[s.peer_id] = s));
    setStates(map);
    const b = await loadBlockedIds(myId);
    setBlocked(b);
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
      await loadStates();
      setLoading(false);
    })();
  }, [loadMessages, loadStates]);

  useEffect(() => {
    loadMessages();
  }, [changeTick, loadMessages]);

  useEffect(() => {
    const t = setInterval(loadMessages, 30_000);
    return () => clearInterval(t);
  }, [loadMessages]);

  // Keep active user in sync with URL
  useEffect(() => {
    setActiveUserId(urlTo);
    setConvSearchOpen(urlSearch);
    if (urlSearch) {
      const params = new URLSearchParams(searchParams);
      params.delete('search');
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTo]);

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

  // Build conversation list respecting cleared_at (soft delete) and blocked set.
  const conversations: Conversation[] = useMemo(() => {
    const byUser: Record<string, Message> = {};
    allMessages.forEach((m) => {
      const p = decodePayload(m.content);
      if (p.kind === 'signal') return;
      const other = m.user_id === myId ? m.receiver_id : m.user_id;
      // Respect cleared_at for this peer
      const st = states[other];
      if (st?.cleared_at && m.created_at) {
        if (new Date(m.created_at).getTime() <= new Date(st.cleared_at).getTime()) {
          return;
        }
      }
      if (!byUser[other] && m.created_at) {
        byUser[other] = m;
      } else if (
        byUser[other]?.created_at &&
        m.created_at &&
        new Date(m.created_at).getTime() >
          new Date(byUser[other].created_at!).getTime()
      ) {
        byUser[other] = m;
      }
    });
    return Object.entries(byUser)
      .map(([userId, lastMessage]) => ({
        userId,
        profile: profilesMap[userId],
        lastMessage,
      }))
      .sort((a, b) =>
        (b.lastMessage?.created_at || '').localeCompare(a.lastMessage?.created_at || ''),
      );
  }, [allMessages, myId, profilesMap, states]);

  // Partition by archived / not archived
  const archivedList = useMemo(
    () => conversations.filter((c) => states[c.userId]?.archived),
    [conversations, states],
  );
  const mainList = useMemo(
    () => conversations.filter((c) => !states[c.userId]?.archived),
    [conversations, states],
  );

  // Apply list search to the currently viewed list
  const visibleList = useMemo(() => {
    const base = viewMode === 'archived' ? archivedList : mainList;
    const q = listQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) => {
      const name = (c.profile?.display_name || c.profile?.username || '').toLowerCase();
      if (name.includes(q)) return true;
      const preview = previewOf(c.lastMessage).toLowerCase();
      if (preview.includes(q)) return true;
      // Also search in all messages of this conversation
      const hasMatch = allMessages.some((m) => {
        const other = m.user_id === myId ? m.receiver_id : m.user_id;
        if (other !== c.userId) return false;
        const p = decodePayload(m.content);
        if (p.kind !== 'text') return false;
        return p.text.toLowerCase().includes(q);
      });
      return hasMatch;
    });
  }, [viewMode, archivedList, mainList, listQuery, allMessages, myId]);

  const activeMessages = useMemo(() => {
    if (!activeUserId) return [];
    const st = states[activeUserId];
    const clearedAt = st?.cleared_at ? new Date(st.cleared_at).getTime() : 0;
    return allMessages
      .filter((m) => {
        const involved =
          (m.user_id === myId && m.receiver_id === activeUserId) ||
          (m.user_id === activeUserId && m.receiver_id === myId);
        if (!involved) return false;
        const p = decodePayload(m.content);
        if (p.kind === 'signal') return false;
        if (clearedAt && m.created_at) {
          if (new Date(m.created_at).getTime() <= clearedAt) return false;
        }
        return true;
      })
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }, [allMessages, activeUserId, myId, states]);

  // Matches inside active conversation
  const convMatches = useMemo(() => {
    const q = convQuery.trim().toLowerCase();
    if (!q) return [] as string[];
    return activeMessages
      .filter((m) => {
        const p = decodePayload(m.content);
        if (p.kind !== 'text') return false;
        return p.text.toLowerCase().includes(q);
      })
      .map((m) => m.id);
  }, [convQuery, activeMessages]);

  // Reset match index when query changes
  useEffect(() => {
    setConvMatchIndex(0);
  }, [convQuery]);

  // Scroll to current match
  useEffect(() => {
    if (!convSearchOpen || convMatches.length === 0) return;
    const id = convMatches[convMatchIndex];
    if (!id) return;
    const el = document.getElementById(`msg-${id}`);
    if (el && scrollRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [convMatchIndex, convMatches, convSearchOpen]);

  useEffect(() => {
    if (scrollRef.current && !convSearchOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, peerTyping, convSearchOpen]);

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
          const res = await supabase
            .from('messages')
            .update({
              delivered_at: new Date().toISOString(),
              status: 'delivered',
            })
            .in('id', toDeliver);
          if (res.error) {
            // ignore - old schema
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
    if (blocked.has(activeUserId)) {
      toast.error('Vous avez bloqué ce contact. Débloquez-le pour lui écrire.');
      return;
    }
    const text = draft.trim();
    setDraft('');
    setShowEmoji(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    emitStopTyping().catch(() => {});
    try {
      await insertMessage({ receiver_id: activeUserId, content: text });
      await loadMessages();
    } catch (e) {
      console.error(e);
      toast.error("Échec de l'envoi du message");
    }
  };

  const sendVoiceNote = async (objectKey: string, duration: number) => {
    if (!activeUserId) return;
    if (blocked.has(activeUserId)) {
      toast.error('Vous avez bloqué ce contact.');
      return;
    }
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

  const clearPendingMedia = useCallback(() => {
    setPendingMedia((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }, []);

  const sendPendingMedia = async () => {
    if (!activeUserId || !pendingMedia) return;
    if (blocked.has(activeUserId)) {
      toast.error('Vous avez bloqué ce contact.');
      return;
    }
    setSendingMedia(true);
    try {
      const { key, error } = await uploadMediaEx(pendingMedia.file, 'message-media');
      if (error || !key) {
        toast.error(error || "Échec de l'upload du média");
        return;
      }
      const content =
        pendingMedia.kind === 'image'
          ? encodePayload({ kind: 'image', object_key: key })
          : encodePayload({
              kind: 'video',
              object_key: key,
              duration: pendingMedia.duration,
            });
      await insertMessage({ receiver_id: activeUserId, content });
      clearPendingMedia();
      await loadMessages();
    } catch (e) {
      console.error(e);
      toast.error("Échec de l'envoi du média");
    } finally {
      setSendingMedia(false);
    }
  };

  const initiateCall = async (mode: 'voice' | 'video') => {
    if (!activeUserId) return;
    const peerProfile = profilesMap[activeUserId];
    const peerName =
      peerProfile?.display_name || peerProfile?.username || 'Utilisateur';
    await startCall(activeUserId, peerName, mode);
  };

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

  // Cleanup pending media when unmounting or switching conversation
  useEffect(() => {
    return () => {
      if (pendingMedia) URL.revokeObjectURL(pendingMedia.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

  // ---- Conversation actions ----------------------------------------------

  const openConversation = (peerId: string) => {
    setActiveUserId(peerId);
    const params = new URLSearchParams(searchParams);
    params.set('to', peerId);
    setSearchParams(params, { replace: false });
  };

  const closeConversation = () => {
    setActiveUserId(null);
    setConvSearchOpen(false);
    setConvQuery('');
    const params = new URLSearchParams(searchParams);
    params.delete('to');
    setSearchParams(params, { replace: false });
  };

  const askAction = (action: ConversationMenuAction, peerId: string) => {
    const p = profilesMap[peerId];
    const peerName = p?.display_name || p?.username || 'ce contact';
    setPendingAction({ kind: action, peerId, peerName });
  };

  const runPendingAction = async () => {
    if (!pendingAction || !myId) return;
    const { kind, peerId, peerName } = pendingAction;
    setActionBusy(true);
    try {
      if (kind === 'archive') {
        await archiveConversation(myId, peerId);
        toast.success(`Conversation avec ${peerName} archivée`);
      } else if (kind === 'unarchive') {
        await unarchiveConversation(myId, peerId);
        toast.success(`Conversation avec ${peerName} désarchivée`);
      } else if (kind === 'delete') {
        await clearConversation(myId, peerId);
        toast.success(`Discussion avec ${peerName} supprimée`);
        if (activeUserId === peerId) closeConversation();
      } else if (kind === 'block') {
        await blockUser(myId, peerId);
        toast.success(`${peerName} bloqué`);
      } else if (kind === 'block_and_report') {
        await blockUser(myId, peerId);
        await reportUser(myId, peerId, 'blocked_and_reported_from_messages');
        toast.success(`${peerName} bloqué et signalé`);
      }
      await loadStates();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    } finally {
      setActionBusy(false);
      setPendingAction(null);
    }
  };

  const confirmTextFor = (a: ConversationMenuAction | undefined, peerName: string) => {
    switch (a) {
      case 'archive':
        return {
          title: `Archiver la conversation avec ${peerName} ?`,
          description:
            "Elle sera déplacée dans Archivées. Vous pourrez la désarchiver à tout moment.",
          confirmLabel: 'Archiver',
          destructive: false,
        };
      case 'unarchive':
        return {
          title: `Désarchiver la conversation avec ${peerName} ?`,
          description: 'Elle reviendra dans votre liste principale.',
          confirmLabel: 'Désarchiver',
          destructive: false,
        };
      case 'delete':
        return {
          title: `Supprimer la discussion avec ${peerName} ?`,
          description:
            "Tous les messages seront masqués de votre côté. Votre contact pourra toujours les voir.",
          confirmLabel: 'Supprimer',
          destructive: true,
        };
      case 'block':
        return {
          title: `Bloquer ${peerName} ?`,
          description: 'Cette personne ne pourra plus vous écrire ni vous appeler.',
          confirmLabel: 'Bloquer',
          destructive: true,
        };
      case 'block_and_report':
        return {
          title: `Bloquer et signaler ${peerName} ?`,
          description:
            "Le contact sera bloqué et un signalement sera envoyé à l'équipe de modération.",
          confirmLabel: 'Bloquer et signaler',
          destructive: true,
        };
      default:
        return {
          title: 'Confirmer ?',
          description: '',
          confirmLabel: 'Confirmer',
          destructive: false,
        };
    }
  };

  // Long-press support on conversation list items
  const startLongPress = (peerId: string) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      // Open a simple menu via confirm ask: archive / delete / block / block+report
      // We reuse ConversationMenu logic by opening via a toast prompt-less flow:
      // trigger the first action (archive) would be wrong; instead prompt user to use header menu.
      // Better: directly offer archive/unarchive via long-press as the quick action.
      const currentArchived = states[peerId]?.archived;
      askAction(currentArchived ? 'unarchive' : 'archive', peerId);
    }, 600);
  };
  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const activeProfile = activeUserId ? profilesMap[activeUserId] : undefined;
  const activeOnline = activeUserId ? isOnline(activeUserId) : false;
  const activeState = activeUserId ? states[activeUserId] : undefined;
  const activeBlocked = activeUserId ? blocked.has(activeUserId) : false;

  const handleConvMenu = (action: ConversationMenuAction) => {
    if (!activeUserId) return;
    askAction(action, activeUserId);
  };

  const highlightText = (text: string, q: string) => {
    if (!q) return text;
    const lower = text.toLowerCase();
    const qLower = q.toLowerCase();
    const out: React.ReactNode[] = [];
    let i = 0;
    while (i < text.length) {
      const idx = lower.indexOf(qLower, i);
      if (idx === -1) {
        out.push(text.slice(i));
        break;
      }
      if (idx > i) out.push(text.slice(i, idx));
      out.push(
        <mark
          key={idx}
          className="bg-yellow-400/40 text-inherit rounded px-0.5"
        >
          {text.slice(idx, idx + q.length)}
        </mark>,
      );
      i = idx + q.length;
    }
    return <>{out}</>;
  };

  return (
    <Layout title="Messages">
      <h1 className="text-2xl font-bold mb-4 hidden lg:block">Messages</h1>

      {!activeUserId ? (
        <>
          {/* Search bar */}
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--loboko-text-muted)]"
              />
              <input
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder="Rechercher un contact, un pseudo, un mot…"
                className="w-full pl-9 pr-9 py-2.5 rounded-full bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
              />
              {listQuery && (
                <button
                  type="button"
                  onClick={() => setListQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--loboko-surface-hover)]"
                  aria-label="Effacer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Archived entry */}
          {viewMode === 'main' && archivedList.length > 0 && (
            <button
              type="button"
              onClick={() => setViewMode('archived')}
              className="w-full mb-3 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb] transition"
            >
              <div className="w-9 h-9 rounded-full bg-[var(--loboko-elevated)] flex items-center justify-center text-[#2563eb]">
                <Archive size={16} />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-sm">Archivées</div>
                <div className="text-xs text-[var(--loboko-text-muted)]">
                  {archivedList.length} conversation
                  {archivedList.length > 1 ? 's' : ''}
                </div>
              </div>
              <ChevronRight size={16} className="text-[var(--loboko-text-muted)]" />
            </button>
          )}

          {viewMode === 'archived' && (
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMode('main')}
                className="flex items-center gap-2 text-sm text-[var(--loboko-text-muted)] hover:text-[var(--loboko-text)]"
              >
                <ArrowLeft size={14} />
                Retour
              </button>
              <div className="font-semibold text-sm">Archivées</div>
              <div className="w-12" />
            </div>
          )}

          {loading ? (
            <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
              Chargement...
            </div>
          ) : visibleList.length === 0 ? (
            <div className="text-center py-16 px-4 bg-[var(--loboko-surface)] rounded-2xl border border-[var(--loboko-border)]">
              <div className="w-16 h-16 mx-auto rounded-full bg-[rgba(37,99,235,0.15)] flex items-center justify-center mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="font-semibold mb-1">
                {viewMode === 'archived'
                  ? 'Aucune conversation archivée'
                  : listQuery
                    ? 'Aucun résultat'
                    : 'Aucune conversation'}
              </h3>
              <p className="text-sm text-[var(--loboko-text-muted)]">
                {viewMode === 'archived'
                  ? 'Archivez une conversation pour la retrouver ici.'
                  : listQuery
                    ? 'Essayez un autre terme.'
                    : "Allez dans Découverte pour contacter quelqu'un"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleList.map((c) => {
                const preview = previewOf(c.lastMessage);
                const online = isOnline(c.userId);
                const displayName =
                  c.profile?.display_name || c.profile?.username || 'Utilisateur';
                const isBlocked = blocked.has(c.userId);
                return (
                  <button
                    key={c.userId}
                    onClick={() => openConversation(c.userId)}
                    onMouseDown={() => startLongPress(c.userId)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    onTouchStart={() => startLongPress(c.userId)}
                    onTouchEnd={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      askAction(
                        states[c.userId]?.archived ? 'unarchive' : 'archive',
                        c.userId,
                      );
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#2563eb] transition text-left"
                  >
                    <Avatar profile={c.profile} online={online} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-sm truncate flex items-center gap-1">
                          {highlightText(displayName, listQuery)}
                          {isBlocked && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">
                              BLOQUÉ
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--loboko-text-muted)] shrink-0">
                          {formatMessageTime(c.lastMessage?.created_at)}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                        {c.lastMessage?.user_id === myId ? 'Vous: ' : ''}
                        {highlightText(preview, listQuery)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col h-[calc(100vh-180px)] lg:h-[calc(100vh-160px)] bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden">
          <header className="flex items-center gap-2 p-3 border-b border-[var(--loboko-border)]">
            <button
              onClick={closeConversation}
              className="p-2 rounded-full hover:bg-[var(--loboko-surface-hover)]"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() =>
                activeUserId && navigate(`/messages/contact/${activeUserId}`)
              }
              className="flex items-center gap-3 flex-1 min-w-0 hover:bg-[var(--loboko-surface-hover)] rounded-xl px-1 py-1"
              title="Voir les infos du contact"
            >
              <Avatar profile={activeProfile} online={activeOnline} />
              <div className="flex-1 min-w-0 text-left">
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
            </button>
            <button
              onClick={() => setConvSearchOpen((v) => !v)}
              className={`w-9 h-9 rounded-full flex items-center justify-center ${
                convSearchOpen
                  ? 'bg-[#2563eb] text-white'
                  : 'bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)]'
              }`}
              aria-label="Rechercher dans la conversation"
              title="Rechercher dans la conversation"
            >
              <Search size={16} />
            </button>
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
            <ConversationMenu
              archived={!!activeState?.archived}
              onAction={handleConvMenu}
            />
          </header>

          {convSearchOpen && (
            <div className="px-3 py-2 border-b border-[var(--loboko-border)] flex items-center gap-2 bg-[var(--loboko-elevated)]">
              <Search size={14} className="text-[var(--loboko-text-muted)]" />
              <input
                value={convQuery}
                onChange={(e) => setConvQuery(e.target.value)}
                placeholder="Rechercher dans la conversation…"
                className="flex-1 bg-transparent text-sm outline-none"
                autoFocus
              />
              <span className="text-[11px] text-[var(--loboko-text-muted)] shrink-0">
                {convMatches.length > 0
                  ? `${convMatchIndex + 1}/${convMatches.length}`
                  : convQuery
                    ? '0'
                    : ''}
              </span>
              <button
                type="button"
                disabled={convMatches.length === 0}
                onClick={() =>
                  setConvMatchIndex((i) =>
                    convMatches.length ? (i - 1 + convMatches.length) % convMatches.length : 0,
                  )
                }
                className="p-1 rounded hover:bg-[var(--loboko-surface-hover)] disabled:opacity-40"
                aria-label="Résultat précédent"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                disabled={convMatches.length === 0}
                onClick={() =>
                  setConvMatchIndex((i) =>
                    convMatches.length ? (i + 1) % convMatches.length : 0,
                  )
                }
                className="p-1 rounded hover:bg-[var(--loboko-surface-hover)] disabled:opacity-40"
                aria-label="Résultat suivant"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setConvSearchOpen(false);
                  setConvQuery('');
                }}
                className="p-1 rounded hover:bg-[var(--loboko-surface-hover)]"
                aria-label="Fermer la recherche"
              >
                <X size={14} />
              </button>
            </div>
          )}

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
                    <div key={m.id} id={`msg-${m.id}`} className="flex flex-col items-center">
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

                const isMedia = payload.kind === 'image' || payload.kind === 'video';
                const isCurrentMatch =
                  convSearchOpen && convMatches[convMatchIndex] === m.id;

                return (
                  <div
                    key={m.id}
                    id={`msg-${m.id}`}
                    className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`${
                        isMedia ? 'p-1' : 'px-4 py-2'
                      } max-w-[75%] rounded-2xl text-sm ${
                        mine
                          ? 'bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white rounded-br-md'
                          : 'bg-[var(--loboko-elevated)] text-[var(--loboko-text)] rounded-bl-md'
                      } ${isCurrentMatch ? 'ring-2 ring-yellow-400' : ''}`}
                    >
                      {payload.kind === 'audio' ? (
                        <VoiceMessage
                          objectKey={payload.object_key}
                          duration={payload.duration}
                          mine={mine}
                        />
                      ) : payload.kind === 'image' ? (
                        <MediaMessage kind="image" objectKey={payload.object_key} />
                      ) : payload.kind === 'video' ? (
                        <MediaMessage
                          kind="video"
                          objectKey={payload.object_key}
                          duration={payload.duration}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap break-words">
                          {payload.kind === 'text'
                            ? convSearchOpen && convQuery
                              ? highlightText(payload.text, convQuery)
                              : payload.text
                            : ''}
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

          {pendingMedia && (
            <div className="p-3 border-t border-[var(--loboko-border)] bg-[var(--loboko-elevated)]">
              <MediaPreview media={pendingMedia} onRemove={clearPendingMedia} />
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="text-[11px] text-[var(--loboko-text-muted)]">
                  {pendingMedia.kind === 'image'
                    ? 'Photo prête à être envoyée'
                    : `Vidéo · ${formatDuration(pendingMedia.duration || 0)} (max ${MAX_MESSAGE_VIDEO_SECONDS}s)`}
                </div>
                <button
                  type="button"
                  onClick={sendPendingMedia}
                  disabled={sendingMedia}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50"
                >
                  <Send size={14} />
                  {sendingMedia ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </div>
          )}

          {activeBlocked ? (
            <div className="p-3 border-t border-[var(--loboko-border)] text-center text-xs text-red-400 bg-[var(--loboko-elevated)]">
              Vous avez bloqué ce contact. Vous ne pouvez plus lui écrire.
            </div>
          ) : (
            <div className="p-3 border-t border-[var(--loboko-border)] flex gap-2 relative items-center">
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
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setShowMediaPicker((v) => !v)}
                      className="w-10 h-10 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] flex items-center justify-center text-[var(--loboko-text)]"
                      aria-label="Joindre un média"
                      title="Photo ou vidéo"
                      type="button"
                    >
                      <Paperclip size={18} />
                    </button>
                    {showMediaPicker && (
                      <div className="absolute bottom-12 left-0 z-20 bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl shadow-lg p-2">
                        <MediaPicker
                          maxVideoSeconds={MAX_MESSAGE_VIDEO_SECONDS}
                          compact
                          onSelect={(m) => {
                            setShowMediaPicker(false);
                            if (pendingMedia) URL.revokeObjectURL(pendingMedia.previewUrl);
                            setPendingMedia(m);
                          }}
                        />
                        <div className="text-[10px] text-[var(--loboko-text-muted)] mt-1 px-1">
                          Vidéo : {MAX_MESSAGE_VIDEO_SECONDS}s max
                        </div>
                      </div>
                    )}
                  </div>
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
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingAction}
        {...confirmTextFor(pendingAction?.kind, pendingAction?.peerName || '')}
        loading={actionBusy}
        onConfirm={runPendingAction}
        onCancel={() => (actionBusy ? undefined : setPendingAction(null))}
      />
    </Layout>
  );
}