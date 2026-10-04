import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMediaUrl, uploadMediaEx } from '@/lib/storage-helpers';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import MediaPicker, { MediaSelection } from './MediaPicker';
import MediaPreview from './MediaPreview';
import MediaEditor from './MediaEditor';
import MentionSuggestions from './MentionSuggestions';
import {
  applyMention,
  extractMentionQuery,
  resolveMentionedUserIds,
  type MentionSuggestion,
} from '@/lib/mentions';
import { createNotification } from '@/lib/notifications';
import { triggerMentionPush } from '@/lib/push-trigger';
import { containsDangerousContent } from '@/lib/moderation';

interface Props {
  onPosted: () => void;
}

const MAX_POST_VIDEO_SECONDS = 90;

export default function ComposePost({ onPosted }: Props) {
  const { user, profile } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setAvatarUrl(null);
    if (profile?.avatar_key) void getMediaUrl(profile.avatar_key).then(url => { if (!cancelled) setAvatarUrl(url || null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [profile?.avatar_key]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<MediaSelection[]>([]);
  const [editingMedia, setEditingMedia] = useState<{ selection: MediaSelection; index?: number } | null>(null);
  const mediaRef = useRef(media);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionState, setMentionState] = useState<{
    open: boolean;
    query: string;
    start: number;
    end: number;
  }>({ open: false, query: '', start: 0, end: 0 });

  const resetMedia = () => {
    setMedia((current) => {
      current.forEach((m) => URL.revokeObjectURL(m.previewUrl));
      return [];
    });
  };

  useEffect(() => { mediaRef.current = media; }, [media]);
  useEffect(() => () => { mediaRef.current.forEach(item => URL.revokeObjectURL(item.previewUrl)); }, []);
  useEffect(() => () => { if (editingMedia) URL.revokeObjectURL(editingMedia.selection.previewUrl); }, [editingMedia]);

  const handleContentChange = (value: string, caret: number) => {
    setContent(value);
    const range = extractMentionQuery(value, caret);
    if (range) {
      setMentionState({ open: true, query: range.query, start: range.start, end: range.end });
    } else {
      setMentionState((prev) => (prev.open ? { ...prev, open: false } : prev));
    }
  };

  const handlePickMention = (s: MentionSuggestion) => {
    if (!s.username) return;
    const { text, caret } = applyMention(
      content,
      { start: mentionState.start, end: mentionState.end },
      s.username,
    );
    setContent(text);
    setMentionState((prev) => ({ ...prev, open: false }));
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  const submit = async () => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }
    if (!content.trim() && media.length === 0) {
      toast.error('Ajoutez du texte, une photo ou une vidéo');
      return;
    }
    setLoading(true);
    try {
      const media_keys: {
        key: string;
        type: 'image' | 'video';
        poster?: string;
      }[] = [];
      for (const item of media) {
        const { key, error, poster } = await uploadMediaEx(item.file, 'posts', { skipImageCompression: item.prepared });
      
        if (error || !key) {
          toast.error(error || "Échec de l'upload");
          setLoading(false);
          return;
        }
      
        media_keys.push({
          key,
          type: item.kind,
          ...(poster ? { poster } : {}),
        });
      }

      // Try insert with both image_key + video_key; fall back to image_key only
      // if the DB schema does not have video_key yet.
      const finalText = content.trim();
      const shouldHide = containsDangerousContent(finalText);
      
      const basePayload: Record<string, unknown> = {
        user_id: user.id,
        content: finalText,
        media_keys,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        hidden_by_moderation: shouldHide,
        moderation_reason: shouldHide
          ? 'Contenu détecté automatiquement'
          : null,
      };

      const res = await supabase
        .from('posts')
        .insert(basePayload)
        .select('id')
        .single();
      if (res.error) throw res.error;

      // Notify mentioned users (non-blocking) + fire push.
      try {
        const insertedId =
          (res.data as { id?: string | number } | null)?.id ?? undefined;
        const mentionMap = await resolveMentionedUserIds(finalText);
        // Look up actor display name from profiles (fallback: email-local-part).
        let actorName = user.email?.split('@')[0] ?? 'Quelqu’un';
        try {
          const { data: p } = await supabase
            .from('profiles')
            .select('username, display_name')
            .eq('user_id', user.id)
            .maybeSingle();
          if (p?.display_name) actorName = p.display_name;
          else if (p?.username) actorName = p.username;
        } catch {
          /* ignore; fall back to email local part */
        }
        await Promise.all(
          Object.entries(mentionMap).map(([, uid]) => {
            if (uid === user.id) return Promise.resolve();
            // In-app notification
            const p = createNotification({
              recipientId: uid,
              fromUserId: user.id,
              type: 'comment', // reuse existing allowed type to avoid schema changes
              postId: insertedId,
              message: 'vous a mentionné dans une publication',
            });
            // Push notification (fire-and-forget)
            triggerMentionPush({
              recipientId: uid,
              actorName,
              mentionType: 'post',
              postId: insertedId,
              body: finalText,
            });
            return p;
          }),
        );
      } catch (nErr) {
        console.error('[compose-post] mention notifications failed', nErr);
      }

      setContent('');
      resetMedia();
      toast.success('Publication partagée !');
      onPosted();
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de la publication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2563eb]/15 text-sm font-bold text-[#2563eb]">{avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (profile?.display_name || profile?.username || 'U').slice(0, 2).toUpperCase()}</span>
        <div className="relative min-w-0 flex-1">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          onKeyUp={(e) => {
            const el = e.currentTarget;
            handleContentChange(el.value, el.selectionStart ?? el.value.length);
          }}
          onClick={(e) => {
            const el = e.currentTarget;
            handleContentChange(el.value, el.selectionStart ?? el.value.length);
          }}
          placeholder="Quoi de neuf, LOBOKO ?"
          aria-label="Texte de votre publication"
          disabled={loading}
          onFocus={() => setExpanded(true)}
          onBlur={() => { if (!content.trim()) setExpanded(false); }}
          rows={expanded || content ? 3 : 1}
          className="block w-full min-h-11 max-h-[260px] rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-elevated)] px-3 py-2.5 text-base resize-y focus:outline-none focus:border-[#2563eb] placeholder:text-[var(--loboko-text-muted)]"
        />
        <MentionSuggestions
          open={mentionState.open}
          query={mentionState.query}
          position="below"
          onSelect={handlePickMention}
          onClose={() => setMentionState((p) => ({ ...p, open: false }))}
        />
        </div>
      </div>
      {media.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {media.map((m, index) => (
            <div key={index}>
            <MediaPreview
              media={m}
              onRemove={() => {
                setMedia((current) => {
                  const copy = [...current];
                  URL.revokeObjectURL(copy[index].previewUrl);
                  copy.splice(index, 1);
                  return copy;
                });
              }}
            />
            <button type="button" disabled={loading} className="text-sm text-blue-500 py-2" onClick={() => setEditingMedia({ selection: { ...m, previewUrl: URL.createObjectURL(m.file) }, index })}>Modifier</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 pb-1 border-t border-[var(--loboko-border)] bg-[var(--loboko-surface)]">
        <MediaPicker
          maxVideoSeconds={MAX_POST_VIDEO_SECONDS}
          prepareForEditing
          onSelect={(m) => {
            const hasVideo = media.some((x) => x.kind === 'video');
            const hasImage = media.some((x) => x.kind === 'image');
          
            if (m.kind === 'video' && media.length > 0) {
              URL.revokeObjectURL(m.previewUrl);
              toast.error('Publiez la vidéo seule pour éviter les bugs.');
              return;
            }
          
            if (m.kind === 'image' && hasVideo) {
              URL.revokeObjectURL(m.previewUrl);
              toast.error('Impossible d’ajouter une photo avec une vidéo.');
              return;
            }
          
            if (hasImage && m.kind === 'image' && media.length >= 6) {
              URL.revokeObjectURL(m.previewUrl);
              toast.error('Maximum 6 photos');
              return;
            }
          
            setEditingMedia({ selection: m });
          }}
          
          disabled={loading}
        />
        <button
          onClick={submit}
          disabled={loading}
          className="flex items-center gap-2 min-h-11 px-4 py-2 rounded-full bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition shrink-0"
        >
          <Send size={16} />
          {loading ? 'Envoi...' : 'Publier'}
        </button>
      </div>
      {editingMedia && <MediaEditor
        key={editingMedia.selection.previewUrl}
        media={editingMedia.selection}
        initialCaption={content}
        confirmLabel="Ajouter à la publication"
        destination="Fil d’actualité"
        onClose={() => setEditingMedia(null)}
        onConfirm={async (file, caption, duration) => {
          const item = { ...editingMedia.selection, file, duration, prepared: true, previewUrl: URL.createObjectURL(file) };
          setMedia(current => {
            if (editingMedia.index === undefined) return [...current, item];
            const copy = [...current]; URL.revokeObjectURL(copy[editingMedia.index].previewUrl); copy[editingMedia.index] = item; return copy;
          });
          setContent(caption); setEditingMedia(null);
        }}
      />}
      <p className="text-[10px] text-[var(--loboko-text-muted)] mt-2">
        Vidéo : 90 secondes max · Formats : jpg, png, webp, mp4, webm, mov · @ pour mentionner
      </p>
    </div>
  );
}
