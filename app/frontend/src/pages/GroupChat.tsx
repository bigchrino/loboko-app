import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
} from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker from '@/components/EmojiPicker';
import VoiceRecorder from '@/components/VoiceRecorder';
import VoiceMessage from '@/components/VoiceMessage';
import MediaMessage from '@/components/MediaMessage';
import MediaPicker, { MediaSelection } from '@/components/MediaPicker';
import MediaPreview from '@/components/MediaPreview';
import MessageActionsMenu, { MessageAction } from '@/components/MessageActionsMenu';
import ConfirmDialog from '@/components/ConfirmDialog';
import { decodePayload, encodePayload, formatDuration } from '@/lib/message-format';
import {
  deleteGroupMessageForEveryone,
  Group,
  GroupMember,
  GroupMessage,
  loadGroupMessages,
  sendGroupMessage,
} from '@/lib/group-helpers';
import { loadReactionsForMessages, Reaction, toggleReaction } from '@/lib/message-actions';
import { supabase as sb } from '@/lib/supabase'; // alias for clarity

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
  const { user } = useAuth();
  const myId = user?.id || '';

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [deletedForMe, setDeletedForMe] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<MediaSelection | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

      const msgs = await loadGroupMessages(groupId);
      setMessages(msgs);

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

  // Poll for new messages periodically
  useEffect(() => {
    if (!groupId) return;
    const t = setInterval(async () => {
      const fresh = await loadGroupMessages(groupId);
      setMessages(fresh);
    }, 15_000);
    return () => clearInterval(t);
  }, [groupId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ---------- Derived ------------------------------------------------------

  const visibleMessages = useMemo(() => {
    return messages
      .filter((m) => !deletedForMe.has(m.id))
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

  const handleSendText = async () => {
    if (!draft.trim() || !groupId || !myId) return;
    const text = draft.trim();
    const replyId = replyTo?.id ?? null;
    setDraft('');
    setReplyTo(null);
    setShowEmoji(false);
    try {
      await sendGroupMessage({
        groupId,
        userId: myId,
        content: text,
        replyToMessageId: replyId,
      });
      const fresh = await loadGroupMessages(groupId);
      setMessages(fresh);
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
      });
      const fresh = await loadGroupMessages(groupId);
      setMessages(fresh);
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
      await sendGroupMessage({ groupId, userId: myId, content });
      clearPendingMedia();
      const fresh = await loadGroupMessages(groupId);
      setMessages(fresh);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message || "Échec de l'envoi");
    } finally {
      setSendingMedia(false);
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
          const fresh = await loadGroupMessages(groupId);
          setMessages(fresh);
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

  const buildReplyPreview = (m: GroupMessage): string => {
    const p = decodePayload(m.content);
    if (p.kind === 'text') return p.text.slice(0, 80);
    if (p.kind === 'audio') return '🎤 Note vocale';
    if (p.kind === 'image') return '📷 Photo';
    if (p.kind === 'video') return '🎬 Vidéo';
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
      <div className="flex flex-col h-[calc(100vh-180px)] lg:h-[calc(100vh-160px)] bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden">
        <header className="flex items-center gap-2 p-3 border-b border-[var(--loboko-border)]">
          <button
            onClick={() => navigate('/messages')}
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
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {visibleMessages.length === 0 ? (
            <div className="text-center text-xs text-[var(--loboko-text-muted)] py-10">
              Démarrez la conversation
            </div>
          ) : (
            visibleMessages.map((m, idx) => {
              const mine = m.user_id === myId;
              const payload = decodePayload(m.content);
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

              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}
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
                      ) : (
                        <span className="whitespace-pre-wrap break-words">
                          {payload.kind === 'text' ? payload.text : ''}
                        </span>
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

        <div className="p-2 sm:p-3 border-t border-[var(--loboko-border)] flex items-center gap-1.5 sm:gap-2 relative w-full min-w-0 overflow-x-hidden">
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
                  <div className="absolute bottom-12 left-0 z-20 bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-2xl shadow-lg p-2">
                    <MediaPicker
                      maxVideoSeconds={MAX_MESSAGE_VIDEO_SECONDS}
                      compact
                      onSelect={(sel) => {
                        setShowMediaPicker(false);
                        if (pendingMedia) URL.revokeObjectURL(pendingMedia.previewUrl);
                        setPendingMedia(sel);
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
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                placeholder="Votre message..."
                className="flex-1 min-w-0 w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-sm focus:outline-none focus:border-[#2563eb]"
              />
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
                <EmojiPicker
                  onSelect={(emoji) => setDraft((d) => d + emoji)}
                  onClose={() => setShowEmoji(false)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {actionsMenu && (
        <MessageActionsMenu
          anchor={{ x: actionsMenu.x, y: actionsMenu.y }}
          mine={actionsMenu.message.user_id === myId || isAdmin}
          isText={decodePayload(actionsMenu.message.content).kind === 'text'}
          starred={starred.has(actionsMenu.message.id)}
          onAction={handleMessageAction}
          onClose={() => setActionsMenu(null)}
          onPickEmoji={handleReactionPick}
        />
      )}

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
    </Layout>
  );
}