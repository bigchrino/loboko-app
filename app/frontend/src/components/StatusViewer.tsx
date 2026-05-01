import {
  PointerEvent as ReactPointerEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { X, Eye, Trash2, Send, Smile } from 'lucide-react';
import { toast } from 'sonner';
import { getMediaUrl } from '@/lib/storage-helpers';
import {
  deleteStatus,
  markStatusViewed,
  StatusGroup,
} from '@/lib/status-helpers';
import { supabase } from '@/lib/supabase';
import { encodePayload } from '@/lib/message-format';
import { insertAtCursor } from '@/components/EmojiPicker';

// Lazy-loaded so the picker is not pulled into the initial bundle.
const EmojiPicker = lazy(() => import('@/components/EmojiPicker'));

// Quick reactions available via the 🙂+ button long-press / hover row.
const QUICK_REACTIONS = ['❤️', '😂', '😮', '🔥', '👍', '👏'];

interface Props {
  /** Groups to play through, in order. */
  groups: StatusGroup[];
  /** Index of the group that was clicked. */
  startGroupIndex: number;
  /** Currently authenticated user id, for "my status" handling. */
  currentUserId: string | null;
  onClose: () => void;
  /** Called when a status was viewed (so the list can mark it as seen). */
  onViewed: (statusId: string) => void;
  /** Called to open the viewers modal for the current status. */
  onShowViewers: (statusId: string) => void;
  /** Called after a status has been deleted so the list can refresh. */
  onDeleted?: (statusId: string) => void;
}

/** Fixed display duration for image / text statuses (ms). */
const IMAGE_DURATION_MS = 5000;

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Fullscreen WhatsApp/Instagram-like story viewer. Handles:
 *  - Auto-advance with top progress bars
 *  - Tap left / tap right navigation
 *  - Hold to pause
 *  - Reply-to-status (sends a private message with a quoted preview)
 *  - Viewer list + delete for the owner
 */
export default function StatusViewer({
  groups,
  startGroupIndex,
  currentUserId,
  onClose,
  onViewed,
  onShowViewers,
  onDeleted,
}: Props) {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [statusIndex, setStatusIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);

  const handleReplyEmoji = (emoji: string) => {
    setReply((prev) => insertAtCursor(replyInputRef.current, prev, emoji, 500));
  };
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);

  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<number>(0);
  const pressXRef = useRef<number>(0);
  const viewedRef = useRef<Set<string>>(new Set());

  const currentGroup = groups[groupIndex];
  const currentStatus = currentGroup?.statuses[statusIndex];

  const isMine = currentStatus?.user_id === currentUserId;

  const totalMs = useMemo(() => {
    if (!currentStatus) return IMAGE_DURATION_MS;
    if (currentStatus.kind === 'video') {
      if (videoDurationMs && videoDurationMs > 0) return videoDurationMs;
      if (currentStatus.duration) return currentStatus.duration * 1000;
      return IMAGE_DURATION_MS;
    }
    return IMAGE_DURATION_MS;
  }, [currentStatus, videoDurationMs]);

  // Resolve media URL for image/video statuses.
  useEffect(() => {
    setMediaUrl(null);
    setVideoDurationMs(null);
    if (!currentStatus?.object_key) return;
    let cancelled = false;
    getMediaUrl(currentStatus.object_key)
      .then((u) => {
        if (!cancelled) setMediaUrl(u || null);
      })
      .catch(() => {
        if (!cancelled) setMediaUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentStatus?.object_key]);

  // Reset the timer whenever the current status changes.
  useEffect(() => {
    setElapsed(0);
    lastTickRef.current = 0;
    setReply('');
  }, [groupIndex, statusIndex]);

  // Mark the currently visible status as viewed (once).
  useEffect(() => {
    if (!currentStatus || isMine) return;
    if (viewedRef.current.has(currentStatus.id)) return;
    viewedRef.current.add(currentStatus.id);
    markStatusViewed(currentStatus.id).catch(() => undefined);
    onViewed(currentStatus.id);
  }, [currentStatus, isMine, onViewed]);

  const goNext = useCallback(() => {
    setGroupIndex((gi) => {
      setStatusIndex((si) => {
        const group = groups[gi];
        if (!group) return si;
        if (si + 1 < group.statuses.length) {
          return si + 1;
        }
        // Advance to next group.
        if (gi + 1 < groups.length) {
          return 0;
        }
        // End of all groups → close.
        queueMicrotask(() => onClose());
        return si;
      });
      const group = groups[gi];
      if (!group) return gi;
      if (statusIndex + 1 >= group.statuses.length && gi + 1 < groups.length) {
        return gi + 1;
      }
      return gi;
    });
  }, [groups, statusIndex, onClose]);

  const goPrev = useCallback(() => {
    setGroupIndex((gi) => {
      setStatusIndex((si) => {
        if (si > 0) return si - 1;
        // Go to previous group's last status.
        if (gi > 0) {
          const prev = groups[gi - 1];
          return prev ? prev.statuses.length - 1 : 0;
        }
        return 0;
      });
      if (statusIndex === 0 && gi > 0) return gi - 1;
      return gi;
    });
  }, [groups, statusIndex]);

  // Animation loop for the progress bar + auto-advance.
  useEffect(() => {
    if (!currentStatus) return;
    if (paused) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const step = (t: number) => {
      if (lastTickRef.current === 0) lastTickRef.current = t;
      const dt = t - lastTickRef.current;
      lastTickRef.current = t;

      // For videos, sync the elapsed value to the element's currentTime.
      if (currentStatus.kind === 'video' && videoRef.current) {
        const ct = videoRef.current.currentTime * 1000;
        setElapsed(ct);
        if (totalMs > 0 && ct >= totalMs - 16) {
          goNext();
          return;
        }
      } else {
        setElapsed((e) => {
          const next = e + dt;
          if (next >= totalMs) {
            queueMicrotask(goNext);
            return totalMs;
          }
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = 0;
    };
  }, [currentStatus, paused, totalMs, goNext]);

  // Control the video element's playback vs the paused flag.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => undefined);
  }, [paused, mediaUrl]);

  const onVideoLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    if (Number.isFinite(v.duration) && v.duration > 0) {
      setVideoDurationMs(v.duration * 1000);
    }
  };

  /**
   * Pointer-based tap / hold / navigation. On press-down we schedule a short
   * timeout to enter "pause" mode; on quick release we advance or rewind
   * based on the horizontal position.
   */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pressStartRef.current = Date.now();
    pressXRef.current = e.clientX;
    if (holdTimerRef.current != null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      setPaused(true);
    }, 200);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const wasPaused = paused;
    setPaused(false);
    const dt = Date.now() - pressStartRef.current;
    if (dt < 200 && !wasPaused) {
      const target = e.currentTarget as HTMLDivElement;
      const rect = target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 2) goPrev();
      else goNext();
    }
  };

  const onPointerCancel = () => {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setPaused(false);
  };

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  const sendReply = async () => {
    if (!currentStatus || !reply.trim() || isMine) return;
    setSendingReply(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const sender = auth.user?.id;
      if (!sender) throw new Error('Non connecté.');
      const previewBits: string[] = ['↩ Réponse à un statut'];
      if (currentStatus.kind === 'text' && currentStatus.text) {
        previewBits.push(`« ${currentStatus.text.slice(0, 80)} »`);
      } else if (currentStatus.kind === 'image') {
        previewBits.push('[Photo]');
      } else if (currentStatus.kind === 'video') {
        previewBits.push('[Vidéo]');
      }
      const body = `${previewBits.join('\n')}\n\n${reply.trim()}`;
      // Use the same shape as the private-messages insert in Messages.tsx:
      // `user_id` is the sender, `receiver_id` is the recipient. A retry
      // without the optional `status` column keeps us compatible with older
      // schemas where that column may not exist yet.
      const row: Record<string, unknown> = {
        user_id: sender,
        receiver_id: currentStatus.user_id,
        content: encodePayload({ kind: 'text', text: body }),
        read: false,
        status: 'sent',
      };
      const res = await supabase.from('messages').insert(row);
      if (res.error) {
        const fallback: Record<string, unknown> = {
          user_id: sender,
          receiver_id: currentStatus.user_id,
          content: encodePayload({ kind: 'text', text: body }),
          read: false,
        };
        const { error: err2 } = await supabase.from('messages').insert(fallback);
        if (err2) throw err2;
      }
      toast.success('Réponse envoyée');
      setReply('');
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || "Envoi impossible.");
    } finally {
      setSendingReply(false);
    }
  };

  const handleDelete = async () => {
    if (!currentStatus) return;
    if (!window.confirm('Supprimer ce statut ?')) return;
    try {
      await deleteStatus(currentStatus.id);
      toast.success('Statut supprimé');
      onDeleted?.(currentStatus.id);
      // Move forward (or close if this was the last one).
      if (currentGroup && statusIndex < currentGroup.statuses.length - 1) {
        goNext();
      } else {
        onClose();
      }
    } catch (err) {
      toast.error((err as Error).message || 'Suppression impossible.');
    }
  };

  if (!currentGroup || !currentStatus) return null;

  const authorLabel =
    currentGroup.author.display_name ||
    currentGroup.author.username ||
    'utilisateur';

  return (
    <div className="fixed inset-0 z-[80] bg-black text-white flex flex-col">
      {/* Top progress bars */}
      <div className="px-2 pt-2 flex items-center gap-1">
        {currentGroup.statuses.map((s, i) => {
          const filled =
            i < statusIndex ? 100 : i > statusIndex ? 0 : (elapsed / totalMs) * 100;
          return (
            <div
              key={s.id}
              className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden"
            >
              <div
                className="h-full bg-white"
                style={{ width: `${Math.min(100, Math.max(0, filled))}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2">
        <AuthorAvatar
          avatarKey={currentGroup.author.avatar_key}
          label={authorLabel}
        />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{authorLabel}</div>
          <div className="text-xs opacity-70 truncate">
            {formatRelativeTime(currentStatus.created_at)}
          </div>
        </div>
        {isMine && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            aria-label="Supprimer"
          >
            <Trash2 size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ touchAction: 'none' }}
      >
        {currentStatus.kind === 'text' && (
          <div
            className="w-full h-full flex items-center justify-center p-6 text-center text-2xl font-semibold"
            style={{ backgroundColor: currentStatus.bg_color || '#2563eb' }}
          >
            <span className="max-w-md break-words">
              {currentStatus.text || ''}
            </span>
          </div>
        )}
        {currentStatus.kind === 'image' && mediaUrl && (
          <img
            src={mediaUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        )}
        {currentStatus.kind === 'video' && mediaUrl && (
          <video
            ref={videoRef}
            src={mediaUrl}
            playsInline
            autoPlay
            onLoadedMetadata={onVideoLoaded}
            className="max-w-full max-h-full object-contain"
          />
        )}

        {/* Caption overlay for media */}
        {currentStatus.kind !== 'text' && currentStatus.text && (
          <div className="absolute left-0 right-0 bottom-24 px-6 text-center text-base font-medium drop-shadow-md pointer-events-none">
            {currentStatus.text}
          </div>
        )}
      </div>

      {/* Footer: reply input (or viewers for owner) */}
      <div className="p-3 pb-[max(env(safe-area-inset-bottom,0px),12px)] bg-black/80 border-t border-white/10">
        {isMine ? (
          <button
            type="button"
            onClick={() => onShowViewers(currentStatus.id)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-full bg-white/10 hover:bg-white/20"
          >
            <Eye size={18} />
            <span className="text-sm font-semibold">Voir les vues</span>
          </button>
        ) : (
          <div className="space-y-2">
            {/* Quick reaction row — taps send the emoji immediately. */}
            <div className="flex items-center gap-2 justify-center">
              {QUICK_REACTIONS.map((emo) => (
                <button
                  key={emo}
                  type="button"
                  onClick={() => {
                    setReply((prev) =>
                      insertAtCursor(
                        replyInputRef.current,
                        prev,
                        emo,
                        500,
                      ),
                    );
                    // Focus input so the user can keep typing after the emoji.
                    replyInputRef.current?.focus();
                    setPaused(true);
                  }}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-lg"
                  aria-label={`Réagir avec ${emo}`}
                >
                  {emo}
                </button>
              ))}
            </div>

            {emojiOpen && (
              <Suspense
                fallback={
                  <div className="h-[220px] rounded-2xl bg-white/5 flex items-center justify-center text-xs text-white/60">
                    Chargement des emojis…
                  </div>
                }
              >
                <EmojiPicker
                  onSelect={handleReplyEmoji}
                  onClose={() => setEmojiOpen(false)}
                />
              </Suspense>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendReply();
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setEmojiOpen((v) => !v)}
                className="w-11 h-11 shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                aria-label="Ouvrir les emojis"
              >
                <Smile size={18} />
              </button>
              <input
                ref={replyInputRef}
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value.slice(0, 500))}
                placeholder="Répondre…"
                className="flex-1 h-11 px-4 rounded-full bg-white/10 border border-white/20 text-white placeholder-white/60 outline-none focus:border-white/60"
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
              />
              <button
                type="submit"
                disabled={!reply.trim() || sendingReply}
                className="w-11 h-11 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] flex items-center justify-center disabled:opacity-50"
                aria-label="Envoyer"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function AuthorAvatar({
  avatarKey,
  label,
}: {
  avatarKey: string | null;
  label: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!avatarKey) {
      setUrl(null);
      return;
    }
    getMediaUrl(avatarKey).then((u) => {
      if (!cancelled) setUrl(u || null);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarKey]);
  const initials = label.slice(0, 2).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-white/20 overflow-hidden flex items-center justify-center text-xs font-bold shrink-0">
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}