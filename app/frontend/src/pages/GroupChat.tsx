import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useBackNavigation } from '@/lib/use-back-navigation';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth, Profile } from '@/contexts/AuthContext';
import { getMediaUrl, uploadMediaEx } from '@/lib/storage-helpers';
import {
  ArrowLeft,
  Send,
  Smile,
  Mic,
  Paperclip,
  Info,
  X as XIcon,
  Star as StarIcon,
  Reply as ReplyIcon,
  Timer,
  MoreVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker from '@/components/EmojiPicker';
import VoiceRecorder from '@/components/VoiceRecorder';
import VoiceMessage from '@/components/VoiceMessage';
import MediaMessage from '@/components/MediaMessage';
import MediaPicker, { MediaSelection } from '@/components/MediaPicker';
import MediaPreview from '@/components/MediaPreview';
import FilePicker, { FileSelection } from '@/components/FilePicker';
import FileMessage from '@/components/FileMessage';
import SharedPostMessage from '@/components/SharedPostMessage';
import FilePreview from '@/components/FilePreview';
import MessageActionsMenu, { MessageAction } from '@/components/MessageActionsMenu';
import ReportDialog from '@/components/ReportDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import GroupMentionSuggestions from '@/components/GroupMentionSuggestions';
import MentionText from '@/components/MentionText';
import {
  applyMention,
  extractMentionQuery,
  resolveMentionedUserIds,
  type MentionSuggestion,
} from '@/lib/mentions';
import { createNotification } from '@/lib/notifications';
import { decodePayload, encodePayload, formatDuration } from '@/lib/message-format';
import {
  deleteGroupMessageForEveryone,
  Group,
  GroupMember,
  GroupMessage,
  sendGroupMessage,
} from '@/lib/group-helpers';
import LoadOlderTrigger from '@/components/LoadOlderTrigger';
import {
  setActiveConversation,
  clearActiveConversation,
} from '@/lib/active-conversation';
import {
  triggerGroupPushFanout,
  notificationPreview,
} from '@/lib/push-trigger';
import {
  GROUP_PAGE_SIZE,
  loadLatestGroupPage,
  loadOlderGroupPage,
  mergeMessagesById,
} from '@/lib/message-pagination';
import { loadReactionsForMessages, Reaction, toggleReaction } from '@/lib/message-actions';
import { markGroupRead } from '@/lib/group-reads';
import { supabase as sb } from '@/lib/supabase'; // alias for clarity
import {
  broadcastGroupEphemeral,
  formatEphemeralSystemLabel,
  insertEphemeralSystemMessageGroup,
  computeExpiresAt,
  durationShort,
  isExpired,
  loadGroupEphemeralDuration,
  setGroupEphemeralDuration,
  subscribeGroupEphemeral,
} from '@/lib/ephemeral';
import EphemeralSettingsDialog from '@/components/EphemeralSettingsDialog';
import EphemeralBadge from '@/components/EphemeralBadge';

const MAX_MESSAGE_VIDEO_SECONDS = 60;

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function Avatar({ profile }: { profile?: Profile }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (profile?.avatar_key) getMediaUrl(profile.avatar_key).then(setUrl);
  }, [profile?.avatar_key]);
  const name = profile?.display_name || profile?.username || '?';
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-[10px] shrink-0">
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}

function GroupAvatar({ group }: { group: Group }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (group.avatar_key) getMediaUrl(group.avatar_key).then(setUrl);
  }, [group.avatar_key]);
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold text-sm shrink-0">
      {url ? (
        <img src={url} alt={group.name} className="w-full h-full object-cover" />
      ) : (
        group.name.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}

export default function GroupChat() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const goBack = useBackNavigation('/messages');
  const [searchParams, setSearchParams] = useSearchParams();
  const urlMessageId = searchParams.get('messageId');
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const { user } = useAuth();
  const myId = user?.id || '';

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  // Pagination bookkeeping: whether another older page exists, and whether
  // we are currently fetching one.
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [deletedForMe, setDeletedForMe] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [mentionState, setMentionState] = useState<{
    open: boolean;
    query: string;
    start: number;
    end: number;
  }>({ open: false, query: '', start: 0, end: 0 });
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<MediaSelection | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [pendingFile, setPendingFile] = useState<FileSelection | null>(null);
  const [sendingFile, setSendingFile] = useState(false);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [reportMessage, setReportMessage] = useState<GroupMessage | null>(null);
  const [actionsMenu, setActionsMenu] = useState<{
    message: GroupMessage;
    x: number;
    y: number;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    message: GroupMessage;
    mode: 'me' | 'everyone';
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [ephemeralDuration, setEphemeralDuration] = useState<number>(0);
  const [showEphemeralDialog, setShowEphemeralDialog] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Preserve scroll position when an older page is prepended on scroll-up.
  const preserveScrollRef = useRef<{ prevHeight: number } | null>(null);
  // Tracks the id of the last rendered message to distinguish "new message
  // at the bottom" from "older page prepended at the top".
  const lastMessageIdRef = useRef<string | null>(null);

  // Broadcast to the service worker which group is currently open, so that
  // incoming push notifs for that same group can be suppressed.
  useEffect(() => {
    if (groupId) {
      setActiveConversation({ type: 'group', id: groupId });
    } else {
      clearActiveConversation();
    }
    return () => clearActiveConversation();
  }, [groupId]);

  const myMember = useMemo(
    () => members.find((m) => m.user_id === myId),
    [members, myId],
  );
  const isAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';

  // ---------- Loaders ------------------------------------------------------

  const loadAll = useCallback(async () => {
    if (!groupId || !myId) return;
    try {
      const { data: g, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();
      if (error) throw error;
      if (!g || (g as Group).deleted_at) {
        setGroup(null);
        setLoading(false);
        return;
      }
      setGroup(g as Group);

      const { data: mems } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId);
      const memberList = (mems as GroupMember[]) || [];
      setMembers(memberList);

      const userIds = Array.from(new Set(memberList.map((m) => m.user_id)));
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', userIds);
        const map: Record<string, Profile> = {};
        ((profs as Profile[]) || []).forEach((p) => (map[p.user_id] = p));
        setProfilesMap(map);
      }

      // Load only the most recent page to keep memory / bandwidth low on
      // mobile. Older pages are fetched on scroll-up via LoadOlderTrigger.
      const firstPage = await loadLatestGroupPage(groupId, GROUP_PAGE_SIZE);
      setMessages(firstPage.messages as GroupMessage[]);
      setHasMoreOlder(firstPage.hasMore);
      lastMessageIdRef.current = null;

      // Starred / deleted for me (group-scoped tables)
      const { data: starRows } = await supabase
        .from('group_starred_messages')
        .select('message_id')
        .eq('user_id', myId);
      setStarred(new Set(((starRows as { message_id: string }[]) || []).map((r) => r.message_id)));

      const { data: delRows } = await supabase
        .from('group_message_deletions')
        .select('message_id')
        .eq('user_id', myId);
      setDeletedForMe(
        new Set(((delRows as { message_id: string }[]) || []).map((r) => r.message_id)),
      );
    } catch (e) {
      console.error('[group-chat] loadAll', e);
    } finally {
      setLoading(false);
    }
  }, [groupId, myId]);

  useEffect(() => {
    setLoading(true);
    loadAll();
  }, [loadAll]);

  // Load the user's ephemeral duration setting for this group and listen
  // for realtime updates broadcast by other group members.
  useEffect(() => {
    if (!myId || !groupId) return;
    let cancelled = false;
    loadGroupEphemeralDuration(myId, groupId).then((d) => {
      if (!cancelled) setEphemeralDuration(d);
    });
    const unsub = subscribeGroupEphemeral(myId, groupId, ({ durationSeconds }) => {
      if (cancelled) return;
      setEphemeralDuration(durationSeconds);
      if (durationSeconds > 0) {
        toast.message(
          `Messages éphémères activés dans le groupe (${durationShort(durationSeconds)})`,
        );
      } else {
        toast.message('Messages éphémères désactivés dans le groupe');
      }
      // Reload so the system message inserted by the actor appears inline.
      // Merge the latest page only; older pages loaded via scroll-up are
      // preserved.
      loadLatestGroupPage(groupId, GROUP_PAGE_SIZE)
        .then((fresh) => {
          if (!cancelled) {
            setMessages((prev) =>
              mergeMessagesById(prev, fresh.messages as GroupMessage[]),
            );
          }
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [myId, groupId]);

  // Force a re-render every minute so expired messages disappear.
  const [, setExpireTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setExpireTick((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Mark this group as read whenever we enter / new messages arrive.
  useEffect(() => {
    if (!groupId || !myId) return;
    markGroupRead(myId, groupId).catch(() => {});
  }, [groupId, myId, messages.length]);

  // Refresh reactions when messages change
  useEffect(() => {
    if (!messages.length) {
      setReactions([]);
      return;
    }
    const ids = messages.map((m) => m.id);
    let cancelled = false;
    // Use group_message_reactions table
    (async () => {
      const { data, error } = await sb
        .from('group_message_reactions')
        .select('*')
        .in('message_id', ids);
      if (!cancelled && !error) {
        setReactions((data as Reaction[]) || []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messages]);

  // Poll for new messages periodically. We only fetch the latest page and
  // MERGE it into the existing store (deduping by id), so older pages
  // loaded via scroll-up are never discarded and the user keeps their
  // scroll position. This is the realtime "new messages arrive" path.
  useEffect(() => {
    if (!groupId) return;
    const t = setInterval(async () => {
      const fresh = await loadLatestGroupPage(groupId, GROUP_PAGE_SIZE);
      setMessages((prev) =>
        mergeMessagesById(prev, fresh.messages as GroupMessage[]),
      );
    }, 15_000);
    return () => clearInterval(t);
  }, [groupId]);

  // Load the next older page (cursor = oldest known created_at). Preserves
  // scroll position by snapshotting the container height before prepending.
  const loadOlder = useCallback(async () => {
    if (!groupId) return;
    if (loadingOlder || !hasMoreOlder) return;
    if (messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest?.created_at) return;
    setLoadingOlder(true);
    const container = scrollRef.current;
    preserveScrollRef.current = container
      ? { prevHeight: container.scrollHeight }
      : null;
    try {
      const page = await loadOlderGroupPage(groupId, oldest.created_at);
      setHasMoreOlder(page.hasMore);
      if (page.messages.length > 0) {
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          const older = (page.messages as GroupMessage[]).filter(
            (m) => !known.has(m.id),
          );
          if (older.length === 0) return prev;
          return [...older, ...prev];
        });
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [groupId, hasMoreOlder, loadingOlder, messages]);

  // Restore scroll position after an older page has been prepended so the
  // currently-visible message does not jump.
  useEffect(() => {
    const snap = preserveScrollRef.current;
    if (!snap) return;
    const container = scrollRef.current;
    if (!container) {
      preserveScrollRef.current = null;
      return;
    }
    const diff = container.scrollHeight - snap.prevHeight;
    if (diff > 0) container.scrollTop = diff;
    preserveScrollRef.current = null;
  }, [messages.length]);

  // Auto-scroll to bottom. Scrolls on first paint, follows new messages
  // only when the user is already near the bottom, and does NOT scroll
  // when an older page is prepended on scroll-up (the last-message id
  // doesn't change in that case and scroll is preserved separately).
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const lastId = messages.length ? messages[messages.length - 1].id : null;
    const prevLast = lastMessageIdRef.current;
    lastMessageIdRef.current = lastId;
    if (prevLast === null && lastId !== null) {
      container.scrollTop = container.scrollHeight;
      return;
    }
    if (lastId !== prevLast) {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 120) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages]);

  // Deep-link: scroll to a specific message and highlight it (from Starred Messages, etc.)
  useEffect(() => {
    if (!urlMessageId || messages.length === 0) return;
    const exists = messages.some((m) => m.id === urlMessageId);
    if (!exists) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`gmsg-${urlMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(urlMessageId);
        window.setTimeout(() => {
          setHighlightedMessageId((current) =>
            current === urlMessageId ? null : current,
          );
          const params = new URLSearchParams(searchParams);
          if (params.get('messageId') === urlMessageId) {
            params.delete('messageId');
            setSearchParams(params, { replace: true });
          }
        }, 2600);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [urlMessageId, messages, searchParams, setSearchParams]);

  // ---------- Derived ------------------------------------------------------

  const visibleMessages = useMemo(() => {
    return messages
      .filter((m) => !deletedForMe.has(m.id))
      .filter((m) => !isExpired(m.expires_at))
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  }, [messages, deletedForMe]);

  const messageById = useMemo(() => {
    const map: Record<string, GroupMessage> = {};
    messages.forEach((m) => (map[m.id] = m));
    return map;
  }, [messages]);

  const reactionsByMessage = useMemo(() => {
    const map: Record<string, Reaction[]> = {};
    reactions.forEach((r) => {
      if (!map[r.message_id]) map[r.message_id] = [];
      map[r.message_id].push(r);
    });
    return map;
  }, [reactions]);

  const nameOf = (uid: string) => {
    if (uid === myId) return 'Vous';
    const p = profilesMap[uid];
    return p?.display_name || p?.username || 'Utilisateur';
  };

  // ---------- Send ---------------------------------------------------------

  const clearPendingMedia = useCallback(() => {
    setPendingMedia((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }, []);

  const handlePickMention = (s: MentionSuggestion) => {
    // Resolve token: use username, fallback to @tous for the "all" item,
    // or build a safe slug from display_name when username is missing.
    let token = s.username;
    if (!token) {
      if (s.user_id === '__all__') {
        token = 'tous';
      } else if (s.display_name) {
        token = s.display_name
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[^\w.]+/g, '')
          .slice(0, 32);
      }
    }
    if (!token) return;
    const { text, caret } = applyMention(
      draft,
      { start: mentionState.start, end: mentionState.end },
      token,
    );
    setDraft(text);
    setMentionState((p) => ({ ...p, open: false }));
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  const handleSendText = async () => {
    if (!draft.trim() || !groupId || !myId) return;
    const text = draft.trim();
    const replyId = replyTo?.id ?? null;
    setDraft('');
    setReplyTo(null);
    setShowEmoji(false);
    setMentionState((p) => ({ ...p, open: false }));
    try {
      await sendGroupMessage({
        groupId,
        userId: myId,
        content: text,
        replyToMessageId: replyId,
        expiresAt: computeExpiresAt(ephemeralDuration),
      });
      // Merge the latest page instead of overwriting, so older pages
      // already loaded via scroll-up are preserved.
      const fresh = await loadLatestGroupPage(groupId, GROUP_PAGE_SIZE);
      setMessages((prev) =>
        mergeMessagesById(prev, fresh.messages as GroupMessage[]),
      );
      // Notify any @mentioned users (non-blocking).
      let mentionedIds: string[] = [];
      try {
        const mentionMap = await resolveMentionedUserIds(text);
        mentionedIds = Object.values(mentionMap).filter((uid) => uid && uid !== myId);
        await Promise.all(
          mentionedIds.map((uid) =>
            createNotification({
              recipientId: uid,
              fromUserId: myId,
              type: 'message',
              message: 'vous a mentionné dans un groupe',
            }),
          ),
        );
      } catch (nErr) {
        console.error('[group-chat] mention notifications failed', nErr);
      }
      // Fire-and-forget push fan-out to all members.
      try {
        const senderName =
          profilesMap[myId]?.display_name ||
          profilesMap[myId]?.username ||
          'Nouveau message';
        const title = group?.name ? `${senderName} • ${group.name}` : senderName;
        triggerGroupPushFanout({
          groupId,
          senderId: myId,
          memberIds: members.map((m) => m.user_id),
          mentionedUserIds: mentionedIds,
          title,
          body: notificationPreview(text, 'Nouveau message'),
        });
      } catch (pErr) {
        console.warn('[group-chat] push fan-out failed', pErr);
      }
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || "Échec de l'envoi");
    }
  };

  const handleSendVoice = async (objectKey: string, duration: number) => {
    if (!groupId || !myId) return;
    setShowRecorder(false);
    try {
      await sendGroupMessage({
        groupId,
        userId: myId,
        content: encodePayload({ kind: 'audio', object_key: objectKey, duration }),
        expiresAt: computeExpiresAt(ephemeralDuration),
      });
      const fresh = await loadLatestGroupPage(groupId, GROUP_PAGE_SIZE);
      setMessages((prev) =>
        mergeMessagesById(prev, fresh.messages as GroupMessage[]),
      );
      try {
        const senderName =
          profilesMap[myId]?.display_name || profilesMap[myId]?.username || 'Nouveau message';
        const title = group?.name ? `${senderName} • ${group.name}` : senderName;
        triggerGroupPushFanout({
          groupId,
          senderId: myId,
          memberIds: members.map((m) => m.user_id),
          title,
          body: '🎤 Note vocale',
        });
      } catch (pErr) {
        console.warn('[group-chat] push fan-out failed', pErr);
      }
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || "Échec de l'envoi");
    }
  };

  const handleSendMedia = async () => {
    if (!groupId || !myId || !pendingMedia) return;
    setSendingMedia(true);
    try {
      const { key, error } = await uploadMediaEx(pendingMedia.file, 'message-media');
      if (error || !key) {
        toast.error(error || "Échec de l'upload");
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
      await sendGroupMessage({
        groupId,
        userId: myId,
        content,
        expiresAt: computeExpiresAt(ephemeralDuration),
      });
      const mediaKind = pendingMedia.kind;
      clearPendingMedia();
      const fresh = await loadLatestGroupPage(groupId, GROUP_PAGE_SIZE);
      setMessages((prev) =>
        mergeMessagesById(prev, fresh.messages as GroupMessage[]),
      );
      try {
        const senderName =
          profilesMap[myId]?.display_name || profilesMap[myId]?.username || 'Nouveau message';
        const title = group?.name ? `${senderName} • ${group.name}` : senderName;
        triggerGroupPushFanout({
          groupId,
          senderId: myId,
          memberIds: members.map((m) => m.user_id),
          title,
          body: mediaKind === 'image' ? '📷 Photo' : '🎬 Vidéo',
        });
      } catch (pErr) {
        console.warn('[group-chat] push fan-out failed', pErr);
      }
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || "Échec de l'envoi");
    } finally {
      setSendingMedia(false);
    }
  };

  const handleSendFile = async () => {
    if (!groupId || !myId || !pendingFile) return;
    setSendingFile(true);
    try {
      const { key, error } = await uploadMediaEx(
        pendingFile.file,
        'message-documents',
      );
      if (error || !key) {
        toast.error(error || "Échec de l'upload du fichier");
        return;
      }
      const content = encodePayload({
        kind: 'file',
        object_key: key,
        file_name: pendingFile.file.name,
        file_size: pendingFile.size,
        file_type: pendingFile.ext,
        mime: pendingFile.file.type || undefined,
      });
      await sendGroupMessage({
        groupId,
        userId: myId,
        content,
        expiresAt: computeExpiresAt(ephemeralDuration),
      });
      setPendingFile(null);
      const fresh = await loadLatestGroupPage(groupId, GROUP_PAGE_SIZE);
      setMessages((prev) =>
        mergeMessagesById(prev, fresh.messages as GroupMessage[]),
      );
      try {
        const senderName =
          profilesMap[myId]?.display_name || profilesMap[myId]?.username || 'Nouveau message';
        const title = group?.name ? `${senderName} • ${group.name}` : senderName;
        triggerGroupPushFanout({
          groupId,
          senderId: myId,
          memberIds: members.map((m) => m.user_id),
          title,
          body: '📎 Document',
        });
      } catch (pErr) {
        console.warn('[group-chat] push fan-out failed', pErr);
      }
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || "Échec de l'envoi");
    } finally {
      setSendingFile(false);
    }
  };

  // ---------- Actions ------------------------------------------------------

  const openMenu = (m: GroupMessage, x: number, y: number) => {
    if (m.deleted_for_everyone_at) return;
    setActionsMenu({ message: m, x, y });
  };

  const refreshReactions = async () => {
    const ids = messages.map((m) => m.id);
    const { data } = await sb
      .from('group_message_reactions')
      .select('*')
      .in('message_id', ids);
    setReactions((data as Reaction[]) || []);
  };

  const handleReactionPick = async (emoji: string) => {
    if (!actionsMenu || !myId) return;
    const msgId = actionsMenu.message.id;
    setActionsMenu(null);
    try {
      // Reuse toggleReaction against `group_message_reactions` via direct query
      const { data: existing } = await sb
        .from('group_message_reactions')
        .select('id')
        .eq('message_id', msgId)
        .eq('user_id', myId)
        .eq('emoji', emoji)
        .maybeSingle();
      if (existing) {
        await sb
          .from('group_message_reactions')
          .delete()
          .eq('id', (existing as { id: string }).id);
      } else {
        const { error } = await sb
          .from('group_message_reactions')
          .insert({ message_id: msgId, user_id: myId, emoji });
        if (error && error.code !== '23505') throw error;
      }
      await refreshReactions();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Réaction impossible');
    }
    // Silence unused-import warning: toggleReaction used elsewhere
    void toggleReaction;
    void loadReactionsForMessages;
  };

  const handleQuickToggleReaction = async (msgId: string, emoji: string) => {
    if (!myId) return;
    try {
      const { data: existing } = await sb
        .from('group_message_reactions')
        .select('id')
        .eq('message_id', msgId)
        .eq('user_id', myId)
        .eq('emoji', emoji)
        .maybeSingle();
      if (existing) {
        await sb
          .from('group_message_reactions')
          .delete()
          .eq('id', (existing as { id: string }).id);
      } else {
        await sb
          .from('group_message_reactions')
          .insert({ message_id: msgId, user_id: myId, emoji });
      }
      await refreshReactions();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    }
  };

  const handleMessageAction = async (a: MessageAction) => {
    if (!actionsMenu || !myId) return;
    const m = actionsMenu.message;
    setActionsMenu(null);
    const payload = decodePayload(m.content);

    if (a === 'reply') {
      setReplyTo(m);
      inputRef.current?.focus();
      return;
    }
    if (a === 'forward') {
      toast.message('Transfert depuis un groupe : bientôt disponible');
      return;
    }
    if (a === 'copy') {
      if (payload.kind === 'text') {
        try {
          await navigator.clipboard.writeText(payload.text);
          toast.success('Message copié');
        } catch {
          toast.error('Copie impossible');
        }
      }
      return;
    }
    if (a === 'star' || a === 'unstar') {
      const wasStarred = starred.has(m.id);
      try {
        if (wasStarred) {
          await sb
            .from('group_starred_messages')
            .delete()
            .eq('user_id', myId)
            .eq('message_id', m.id);
        } else {
          const { error } = await sb
            .from('group_starred_messages')
            .insert({ user_id: myId, message_id: m.id });
          if (error && error.code !== '23505') throw error;
        }
        setStarred((prev) => {
          const next = new Set(prev);
          if (wasStarred) next.delete(m.id);
          else next.add(m.id);
          return next;
        });
        toast.success(wasStarred ? 'Retiré des importants' : 'Ajouté aux importants');
      } catch (e) {
        const err = e as { message?: string };
        toast.error(err?.message || 'Action impossible');
      }
      return;
    }
    if (a === 'delete_for_me') {
      setPendingDelete({ message: m, mode: 'me' });
      return;
    }
    if (a === 'delete_for_everyone') {
      setPendingDelete({ message: m, mode: 'everyone' });
      return;
    }
    if (a === 'report') {
      setReportMessage(m);
      return;
    }
  };

  const runDelete = async () => {
    if (!pendingDelete || !myId) return;
    const { message: m, mode } = pendingDelete;
    setDeleteBusy(true);
    try {
      if (mode === 'me') {
        const { error } = await sb
          .from('group_message_deletions')
          .insert({ user_id: myId, message_id: m.id });
        if (error && error.code !== '23505') throw error;
        setDeletedForMe((prev) => {
          const next = new Set(prev);
          next.add(m.id);
          return next;
        });
        toast.success('Message supprimé pour vous');
      } else {
        await deleteGroupMessageForEveryone(m.id, myId);
        toast.success('Message supprimé pour tout le monde');
        if (groupId) {
          // `deleted_for_everyone_at` is an UPDATE, not an insert, so the
          // existing row (potentially in an older page) must reflect it.
          // Patch locally for immediate feedback, then merge the latest
          // page to sync any metadata changes.
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === m.id
                ? {
                    ...msg,
                    deleted_for_everyone_at: new Date().toISOString(),
                    deleted_by: myId,
                  }
                : msg,
            ),
          );
          const fresh = await loadLatestGroupPage(groupId, GROUP_PAGE_SIZE);
          setMessages((prev) =>
            mergeMessagesById(prev, fresh.messages as GroupMessage[]),
          );
        }
      }
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Suppression impossible');
    } finally {
      setDeleteBusy(false);
      setPendingDelete(null);
    }
  };

  const handleEphemeralConfirm = async (durationSeconds: number) => {
    if (!myId || !groupId) return;
    try {
      await setGroupEphemeralDuration(myId, groupId, durationSeconds);
      setEphemeralDuration(durationSeconds);
      // Broadcast to every other member of the group so their UI updates
      // instantly, without waiting for a reload.
      broadcastGroupEphemeral(myId, groupId, durationSeconds).catch(() => {});
      // Insert a non-editable system message visible to every member. Best-
      // effort — do not block on failure.
      insertEphemeralSystemMessageGroup({
        actorUserId: myId,
        groupId,
        durationSeconds,
      })
        .then(async () => {
          try {
            const fresh = await loadLatestGroupPage(groupId, GROUP_PAGE_SIZE);
            setMessages((prev) =>
              mergeMessagesById(prev, fresh.messages as GroupMessage[]),
            );
          } catch {
            /* ignore */
          }
        })
        .catch(() => {});
      if (durationSeconds > 0) {
        toast.success(
          `Messages éphémères activés (${durationShort(durationSeconds)})`,
        );
      } else {
        toast.success('Messages éphémères désactivés');
      }
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || 'Action impossible');
    }
  };

  const buildReplyPreview = (m: GroupMessage): string => {
    const p = decodePayload(m.content);
    if (p.kind === 'text') return p.text.slice(0, 80);
    if (p.kind === 'audio') return '🎤 Note vocale';
    if (p.kind === 'image') return '📷 Photo';
    if (p.kind === 'video') return '🎬 Vidéo';
    if (p.kind === 'file') return `📎 ${p.file_name}`;
    return '';
  };

  // ---------- Render -------------------------------------------------------

  if (loading) {
    return (
      <Layout title="Groupe">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Chargement…
        </div>
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout title="Groupe">
        <div className="text-center py-10 text-sm text-[var(--loboko-text-muted)]">
          Groupe introuvable ou supprimé.
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={group.name}>
      <div className="flex flex-col min-h-[calc(100dvh-120px)] max-h-[calc(100dvh-120px)] lg:h-[calc(100vh-160px)] bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden">
        <header className="flex items-center gap-2 p-3 border-b border-[var(--loboko-border)]">
          <button
            onClick={goBack}
            className="p-2 rounded-full hover:bg-[var(--loboko-surface-hover)]"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => navigate(`/messages/group/${group.id}/info`)}
            className="flex items-center gap-3 flex-1 min-w-0 hover:bg-[var(--loboko-surface-hover)] rounded-xl px-1 py-1"
          >
            <GroupAvatar group={group} />
            <div className="flex-1 min-w-0 text-left">
              <div className="font-semibold text-sm truncate">{group.name}</div>
              <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                {members.length} membre{members.length > 1 ? 's' : ''}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => navigate(`/messages/group/${group.id}/info`)}
            className="w-9 h-9 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)] flex items-center justify-center"
            aria-label="Infos du groupe"
            title="Infos du groupe"
          >
            <Info size={16} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHeaderMenu((v) => !v)}
              className="w-9 h-9 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)] flex items-center justify-center"
              aria-label="Options du groupe"
              title="Options"
            >
              <MoreVertical size={16} />
            </button>
            {showHeaderMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowHeaderMenu(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 mt-2 w-60 bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-xl shadow-xl z-50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setShowHeaderMenu(false);
                      setShowEphemeralDialog(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)]"
                  >
                    <Timer size={16} />
                    <span className="flex-1">Messages éphémères</span>
                    {ephemeralDuration > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(37,99,235,0.18)] text-[#60a5fa] font-semibold">
                        {durationShort(ephemeralDuration)}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {ephemeralDuration > 0 && (
          <div className="px-3 py-1.5 text-[11px] text-[#60a5fa] bg-[rgba(37,99,235,0.10)] border-b border-[var(--loboko-border)] flex items-center gap-1.5">
            <Timer size={12} />
            <span>
              Messages éphémères activés · {durationShort(ephemeralDuration)}
            </span>
          </div>
        )}

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 space-y-2"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <LoadOlderTrigger
            hasMore={hasMoreOlder}
            loading={loadingOlder}
            onLoadMore={loadOlder}
          />
          {visibleMessages.length === 0 ? (
            <div className="text-center text-xs text-[var(--loboko-text-muted)] py-10">
              Démarrez la conversation
            </div>
          ) : (
            visibleMessages.map((m, idx) => {
              const mine = m.user_id === myId;
              const payload = decodePayload(m.content);

              // Centered, read-only system message (e.g. ephemeral setting
              // changes). No avatar, no actions, no long-press menu.
              if (payload.kind === 'system') {
                const selfActor = payload.actor_id === myId;
                const actorName = selfActor ? 'Vous' : nameOf(payload.actor_id);
                const label =
                  payload.system_type === 'ephemeral_setting'
                    ? formatEphemeralSystemLabel({
                        durationSeconds: payload.duration_seconds,
                        selfActor,
                        actorName,
                      })
                    : '';
                return (
                  <div key={m.id} id={`gmsg-${m.id}`} className="flex flex-col items-center">
                    <div className="flex items-center gap-2 text-[11px] text-[var(--loboko-text-muted)] bg-[var(--loboko-elevated)]/60 px-3 py-1 rounded-full select-none">
                      <span>{label}</span>
                    </div>
                  </div>
                );
              }

              const isMedia = payload.kind === 'image' || payload.kind === 'video';
              const isDeleted = !!m.deleted_for_everyone_at;
              const isStarred = starred.has(m.id);
              const msgReactions = reactionsByMessage[m.id] || [];
              const reactionGroups: Record<string, { count: number; mine: boolean }> = {};
              msgReactions.forEach((r) => {
                if (!reactionGroups[r.emoji]) {
                  reactionGroups[r.emoji] = { count: 0, mine: false };
                }
                reactionGroups[r.emoji].count += 1;
                if (r.user_id === myId) reactionGroups[r.emoji].mine = true;
              });
              const prev = idx > 0 ? visibleMessages[idx - 1] : null;
              const showName = !mine && (!prev || prev.user_id !== m.user_id);
              const replySource = m.reply_to_message_id
                ? messageById[m.reply_to_message_id]
                : undefined;

              let pressTimer: ReturnType<typeof setTimeout> | null = null;
              const startPress = (x: number, y: number) => {
                if (isDeleted) return;
                if (pressTimer) clearTimeout(pressTimer);
                pressTimer = setTimeout(() => openMenu(m, x, y), 450);
              };
              const cancelPress = () => {
                if (pressTimer) {
                  clearTimeout(pressTimer);
                  pressTimer = null;
                }
              };

              const isHighlighted = highlightedMessageId === m.id;
              return (
                <div
                  key={m.id}
                  id={`gmsg-${m.id}`}
                  className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''} ${
                    isHighlighted
                      ? 'rounded-lg ring-2 ring-yellow-400/70 ring-offset-2 ring-offset-transparent bg-yellow-200/20 transition-[background,box-shadow] duration-500'
                      : 'transition-[background,box-shadow] duration-500'
                  }`}
                >
                  {!mine && (
                    <div className="pt-1">
                      {showName ? <Avatar profile={profilesMap[m.user_id]} /> : <div className="w-8" />}
                    </div>
                  )}
                  <div
                    className={`flex flex-col ${mine ? 'items-end' : 'items-start'} max-w-[75%]`}
                  >
                    {showName && (
                      <div className="text-[11px] text-[#2563eb] font-semibold mb-0.5 px-1">
                        {nameOf(m.user_id)}
                      </div>
                    )}
                    <div
                      onMouseDown={(e) => startPress(e.clientX, e.clientY)}
                      onMouseUp={cancelPress}
                      onMouseLeave={cancelPress}
                      onTouchStart={(e) => {
                        const t = e.touches[0];
                        if (t) startPress(t.clientX, t.clientY);
                      }}
                      onTouchEnd={cancelPress}
                      onTouchCancel={cancelPress}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        cancelPress();
                        openMenu(m, e.clientX, e.clientY);
                      }}
                      className={`${
                        isMedia && !isDeleted ? 'p-1' : 'px-4 py-2'
                      } rounded-2xl text-sm select-none ${
                        mine
                          ? 'bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white rounded-br-md'
                          : 'bg-[var(--loboko-elevated)] text-[var(--loboko-text)] rounded-bl-md'
                      } ${isDeleted ? 'italic opacity-70' : ''}`}
                    >
                      {!isDeleted && replySource && (
                        <div
                          className={`mb-1.5 px-2 py-1 rounded-lg text-[11px] border-l-2 ${
                            mine
                              ? 'bg-white/10 border-white/60'
                              : 'bg-black/20 border-[#2563eb]'
                          }`}
                        >
                          <div className="font-semibold truncate">
                            {nameOf(replySource.user_id)}
                          </div>
                          <div
                            className={`truncate ${
                              mine ? 'text-white/80' : 'text-[var(--loboko-text-muted)]'
                            }`}
                          >
                            {replySource.deleted_for_everyone_at
                              ? 'Message supprimé'
                              : buildReplyPreview(replySource)}
                          </div>
                        </div>
                      )}

                      {isDeleted ? (
                        <span className="flex items-center gap-1">
                          <XIcon size={12} /> Ce message a été supprimé
                        </span>
                      ) : payload.kind === 'audio' ? (
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
                      ) : payload.kind === 'file' ? (
                        <FileMessage
                          objectKey={payload.object_key}
                          fileName={payload.file_name}
                          fileSize={payload.file_size}
                          fileType={payload.file_type}
                          mine={mine}
                        />
                      ) : payload.kind === 'shared_post' ? (
                        <SharedPostMessage payload={payload} mine={mine} />
                      ) : (
                        <MentionText
                          text={payload.kind === 'text' ? payload.text : ''}
                        />
                      )}
                    </div>
                    {!isDeleted && Object.keys(reactionGroups).length > 0 && (
                      <div
                        className={`flex flex-wrap gap-1 mt-1 ${
                          mine ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {Object.entries(reactionGroups).map(([emoji, info]) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleQuickToggleReaction(m.id, emoji)}
                            className={`text-[11px] px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                              info.mine
                                ? 'bg-[rgba(37,99,235,0.25)] border-[#2563eb]'
                                : 'bg-[var(--loboko-elevated)] border-[var(--loboko-border)]'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[var(--loboko-text-muted)]">
                              {info.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div
                      className={`flex items-center gap-1 mt-0.5 px-1 text-[10px] text-[var(--loboko-text-muted)] ${
                        mine ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <span>{formatTime(m.created_at)}</span>
                      {(m.is_ephemeral || m.expires_at) && !isDeleted && (
                        <EphemeralBadge expiresAt={m.expires_at} size={10} />
                      )}
                      {isStarred && !isDeleted && (
                        <StarIcon
                          size={10}
                          className="text-yellow-400 fill-yellow-400"
                        />
                      )}
                    </div>
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
                  : `Vidéo · ${formatDuration(pendingMedia.duration || 0)}`}
              </div>
              <button
                type="button"
                onClick={handleSendMedia}
                disabled={sendingMedia}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50"
              >
                <Send size={14} />
                {sendingMedia ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </div>
        )}

        {pendingFile && (
          <div className="p-3 border-t border-[var(--loboko-border)] bg-[var(--loboko-elevated)]">
            <FilePreview file={pendingFile} onRemove={() => setPendingFile(null)} />
            <div className="flex items-center justify-between mt-2 gap-2">
              <div className="text-[11px] text-[var(--loboko-text-muted)]">
                Fichier prêt à être envoyé (max 25 Mo)
              </div>
              <button
                type="button"
                onClick={handleSendFile}
                disabled={sendingFile}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50"
              >
                <Send size={14} />
                {sendingFile ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </div>
        )}

        {replyTo && (
          <div className="px-3 pt-2 bg-[var(--loboko-elevated)] border-t border-[var(--loboko-border)] flex items-start gap-2">
            <ReplyIcon size={14} className="text-[#2563eb] mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-[#2563eb]">
                Réponse à {nameOf(replyTo.user_id)}
              </div>
              <div className="text-xs text-[var(--loboko-text-muted)] truncate">
                {buildReplyPreview(replyTo) || 'Message'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="p-1 rounded-full hover:bg-[var(--loboko-surface-hover)] shrink-0"
              aria-label="Annuler la réponse"
            >
              <XIcon size={14} />
            </button>
          </div>
        )}

        <div className="p-2 sm:p-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] border-t border-[var(--loboko-border)] flex items-center gap-1.5 sm:gap-2 relative w-full min-w-0 bg-[var(--loboko-surface)]">
          {showRecorder ? (
            <VoiceRecorder onSend={handleSendVoice} onClose={() => setShowRecorder(false)} />
          ) : (
            <>
              <button
                onClick={() => setShowEmoji((v) => !v)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] flex items-center justify-center shrink-0 text-[var(--loboko-text)]"
                aria-label="Emojis"
                type="button"
              >
                <Smile size={18} />
              </button>
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowMediaPicker((v) => !v)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] flex items-center justify-center text-[var(--loboko-text)]"
                  aria-label="Joindre un média"
                  title="Photo ou vidéo"
                  type="button"
                >
                  <Paperclip size={18} />
                </button>
                {showMediaPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMediaPicker(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute bottom-12 left-0 z-50 bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl shadow-lg p-2">
                      <MediaPicker
                        maxVideoSeconds={MAX_MESSAGE_VIDEO_SECONDS}
                        compact
                        onSelect={(sel) => {
                          setShowMediaPicker(false);
                          if (pendingMedia) URL.revokeObjectURL(pendingMedia.previewUrl);
                          setPendingMedia(sel);
                        }}
                      />
                      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-[var(--loboko-border)]">
                        <FilePicker
                          compact
                          onSelect={(f) => {
                            setShowMediaPicker(false);
                            setPendingFile(f);
                          }}
                        />
                        <span className="text-[10px] text-[var(--loboko-text-muted)]">
                          Document (PDF, DOC, XLS, ZIP · 25 Mo max)
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--loboko-text-muted)] mt-1 px-1">
                        Vidéo : {MAX_MESSAGE_VIDEO_SECONDS}s max
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="flex-1 min-w-0 relative">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => {
                    const v = e.target.value;
                    const caret = e.target.selectionStart ?? v.length;
                    setDraft(v);
                    const r = extractMentionQuery(v, caret);
                    if (r) {
                      setMentionState({ open: true, query: r.query, start: r.start, end: r.end });
                    } else {
                      setMentionState((p) => (p.open ? { ...p, open: false } : p));
                    }
                  }}
                  onKeyUp={(e) => {
                    const el = e.currentTarget;
                    const caret = el.selectionStart ?? el.value.length;
                    const r = extractMentionQuery(el.value, caret);
                    if (r) {
                      setMentionState({ open: true, query: r.query, start: r.start, end: r.end });
                    } else if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
                      setMentionState((p) => (p.open ? { ...p, open: false } : p));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !mentionState.open) handleSendText();
                  }}
                  placeholder="Votre message... (@ pour mentionner)"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
                />
                <GroupMentionSuggestions
                  open={mentionState.open}
                  query={mentionState.query}
                  position="above"
                  memberProfiles={members
                    .filter((m) => m.user_id !== myId)
                    .map((m) => {
                      const p = profilesMap[m.user_id];
                      return {
                        user_id: m.user_id,
                        username: p?.username ?? null,
                        display_name: p?.display_name ?? null,
                        avatar_key: p?.avatar_key ?? null,
                      };
                    })}
                  onSelect={handlePickMention}
                  onClose={() => setMentionState((p) => ({ ...p, open: false }))}
                />
              </div>
              {draft.trim() ? (
                <button
                  onClick={handleSendText}
                  type="button"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white flex items-center justify-center shrink-0"
                  aria-label="Envoyer"
                >
                  <Send size={16} />
                </button>
              ) : (
                <button
                  onClick={() => setShowRecorder(true)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white flex items-center justify-center shrink-0"
                  aria-label="Note vocale"
                  title="Note vocale"
                  type="button"
                >
                  <Mic size={16} />
                </button>
              )}
              {showEmoji && (
                <div className="absolute bottom-[calc(100%+6px)] left-2 right-2 z-30">
                  <EmojiPicker
                    onSelect={(emoji) => setDraft((d) => d + emoji)}
                    onClose={() => setShowEmoji(false)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {actionsMenu && (
        <MessageActionsMenu
          anchor={{ x: actionsMenu.x, y: actionsMenu.y }}
          // For the "mine" visibility rule we use strict ownership
          // (not admin) so admins still see "Signaler" on others'
          // messages. Admin moderation is done from /admin/reports.
          mine={actionsMenu.message.user_id === myId}
          isText={decodePayload(actionsMenu.message.content).kind === 'text'}
          starred={starred.has(actionsMenu.message.id)}
          onAction={handleMessageAction}
          onClose={() => setActionsMenu(null)}
          onPickEmoji={handleReactionPick}
        />
      )}

      <ReportDialog
        open={!!reportMessage}
        onClose={() => setReportMessage(null)}
        title="Signaler ce message"
        reportedMessageId={reportMessage?.id}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title={
          pendingDelete?.mode === 'everyone'
            ? 'Supprimer pour tout le monde ?'
            : 'Supprimer pour moi ?'
        }
        description={
          pendingDelete?.mode === 'everyone'
            ? 'Le message sera remplacé par "Ce message a été supprimé" pour tous les membres du groupe. Action irréversible.'
            : 'Le message sera masqué de votre côté uniquement.'
        }
        confirmLabel="Supprimer"
        destructive
        loading={deleteBusy}
        onConfirm={runDelete}
        onCancel={() => (deleteBusy ? undefined : setPendingDelete(null))}
      />

      <EphemeralSettingsDialog
        open={showEphemeralDialog}
        currentDuration={ephemeralDuration}
        onClose={() => setShowEphemeralDialog(false)}
        onConfirm={handleEphemeralConfirm}
      />
    </Layout>
  );
}
