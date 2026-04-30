import { ChangeEvent, lazy, Suspense, useRef, useState } from 'react';
import {
  X,
  Type,
  ImageIcon,
  Video as VideoIcon,
  Loader2,
  Smile,
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadMediaEx, getVideoDuration } from '@/lib/storage-helpers';
import {
  createMediaStatus,
  createTextStatus,
  MAX_STATUS_VIDEO_SECONDS,
  STATUS_TEXT_BG_COLORS,
} from '@/lib/status-helpers';
import { insertAtCursor } from '@/components/EmojiPicker';

// Lazy-load the emoji picker so it is NOT part of the initial JS bundle.
const EmojiPicker = lazy(() => import('@/components/EmojiPicker'));

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type Mode = 'chooser' | 'text' | 'media-preview';

/**
 * Modal used to publish a new status. Three modes:
 *   - chooser: pick between text / photo / video
 *   - text: type + choose a background color
 *   - media-preview: preview the selected image/video before uploading
 */
export default function CreateStatusModal({ open, onClose, onCreated }: Props) {
  const [mode, setMode] = useState<Mode>('chooser');
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(STATUS_TEXT_BG_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingKind, setPendingKind] = useState<'image' | 'video'>('image');
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [pendingDuration, setPendingDuration] = useState<number | null>(null);
  const [caption, setCaption] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const captionInputRef = useRef<HTMLInputElement>(null);
  // Which field currently owns the emoji picker: the text status textarea
  // or the media caption input. `null` means the picker is closed.
  const [emojiTarget, setEmojiTarget] = useState<null | 'text' | 'caption'>(
    null,
  );

  const handleEmojiSelect = (emoji: string) => {
    if (emojiTarget === 'text') {
      setText((prev) => insertAtCursor(textAreaRef.current, prev, emoji, 500));
    } else if (emojiTarget === 'caption') {
      setCaption((prev) =>
        insertAtCursor(captionInputRef.current, prev, emoji, 200),
      );
    }
  };

  if (!open) return null;

  const reset = () => {
    setMode('chooser');
    setText('');
    setBgColor(STATUS_TEXT_BG_COLORS[0]);
    setSubmitting(false);
    setPendingFile(null);
    setPendingKind('image');
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
    setPendingDuration(null);
    setCaption('');
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handlePickImage = () => imageInputRef.current?.click();
  const handlePickVideo = () => videoInputRef.current?.click();

  const onImageSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('Veuillez choisir une image.');
      return;
    }
    setPendingFile(f);
    setPendingKind('image');
    setPendingPreview(URL.createObjectURL(f));
    setPendingDuration(null);
    setMode('media-preview');
  };

  const onVideoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      toast.error('Veuillez choisir une vidéo.');
      return;
    }
    const duration = await getVideoDuration(f);
    if (duration != null && duration > MAX_STATUS_VIDEO_SECONDS + 0.5) {
      toast.error(
        `La vidéo dépasse ${MAX_STATUS_VIDEO_SECONDS}s (actuelle : ${Math.round(
          duration,
        )}s). Merci d'en choisir une plus courte.`,
      );
      return;
    }
    setPendingFile(f);
    setPendingKind('video');
    setPendingPreview(URL.createObjectURL(f));
    setPendingDuration(duration);
    setMode('media-preview');
  };

  const submitText = async () => {
    if (!text.trim()) {
      toast.error('Votre statut est vide.');
      return;
    }
    setSubmitting(true);
    try {
      await createTextStatus({ text: text.trim(), bgColor });
      toast.success('Statut publié');
      reset();
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(
        (err as Error).message || "Impossible de publier le statut.",
      );
      setSubmitting(false);
    }
  };

  const submitMedia = async () => {
    if (!pendingFile) return;
    setSubmitting(true);
    try {
      const { key, error } = await uploadMediaEx(pendingFile, 'statuses');
      if (!key) {
        toast.error(error || 'Échec de l\'envoi.');
        setSubmitting(false);
        return;
      }
      // Normalize to the `statuses` bucket convention by using the actual key
      // returned by uploadMediaEx (it already encodes "bucket::path").
      await createMediaStatus({
        kind: pendingKind,
        objectKey: key,
        duration:
          pendingKind === 'video' && pendingDuration != null
            ? Math.min(MAX_STATUS_VIDEO_SECONDS, Math.round(pendingDuration))
            : undefined,
        caption: caption.trim() || undefined,
      });
      toast.success('Statut publié');
      reset();
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(
        (err as Error).message || "Impossible de publier le statut.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-[var(--loboko-elevated)] sm:rounded-2xl rounded-t-2xl border border-[var(--loboko-border)] shadow-xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--loboko-border)]">
          <h3 className="font-semibold text-[var(--loboko-text)]">
            {mode === 'chooser'
              ? 'Nouveau statut'
              : mode === 'text'
                ? 'Statut texte'
                : 'Aperçu'}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-[var(--loboko-surface-hover)] flex items-center justify-center"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {mode === 'chooser' && (
          <div className="p-4 space-y-3">
            <button
              type="button"
              onClick={() => setMode('text')}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--loboko-surface)] hover:bg-[var(--loboko-surface-hover)] border border-[var(--loboko-border)]"
            >
              <div className="w-10 h-10 rounded-xl bg-[rgba(37,99,235,0.15)] flex items-center justify-center">
                <Type size={20} className="text-[#2563eb]" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Texte</div>
                <div className="text-sm text-[var(--loboko-text-muted)]">
                  Un message court, coloré
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={handlePickImage}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--loboko-surface)] hover:bg-[var(--loboko-surface-hover)] border border-[var(--loboko-border)]"
            >
              <div className="w-10 h-10 rounded-xl bg-[rgba(16,185,129,0.15)] flex items-center justify-center">
                <ImageIcon size={20} className="text-[#10b981]" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Photo</div>
                <div className="text-sm text-[var(--loboko-text-muted)]">
                  Choisissez une image
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={handlePickVideo}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--loboko-surface)] hover:bg-[var(--loboko-surface-hover)] border border-[var(--loboko-border)]"
            >
              <div className="w-10 h-10 rounded-xl bg-[rgba(234,88,12,0.15)] flex items-center justify-center">
                <VideoIcon size={20} className="text-[#ea580c]" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Vidéo</div>
                <div className="text-sm text-[var(--loboko-text-muted)]">
                  Max {MAX_STATUS_VIDEO_SECONDS} secondes
                </div>
              </div>
            </button>
          </div>
        )}

        {mode === 'text' && (
          <div className="p-4 space-y-4">
            <div
              className="rounded-2xl p-6 min-h-[180px] flex items-center justify-center text-white"
              style={{ backgroundColor: bgColor }}
            >
              <textarea
                ref={textAreaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                placeholder="Écrivez votre statut…"
                className="w-full bg-transparent resize-none outline-none text-center text-lg font-semibold placeholder-white/70 text-white"
                rows={5}
                maxLength={500}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setEmojiTarget((t) => (t === 'text' ? null : 'text'))
                }
                className="h-9 px-3 rounded-full bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm flex items-center gap-2"
                aria-label="Ouvrir les emojis"
              >
                <Smile size={16} />
                <span>Emojis</span>
              </button>
              <div className="text-xs text-[var(--loboko-text-muted)]">
                {text.length}/500
              </div>
            </div>
            {emojiTarget === 'text' && (
              <Suspense
                fallback={
                  <div className="h-[280px] rounded-2xl bg-[var(--loboko-surface)] flex items-center justify-center text-xs text-[var(--loboko-text-muted)]">
                    Chargement des emojis…
                  </div>
                }
              >
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setEmojiTarget(null)}
                />
              </Suspense>
            )}
            <div className="flex items-center gap-2 overflow-x-auto">
              {STATUS_TEXT_BG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBgColor(c)}
                  className={`w-8 h-8 rounded-full shrink-0 border-2 transition-transform ${
                    bgColor === c
                      ? 'border-white scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label="Couleur de fond"
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--loboko-text-muted)]">
              <span>{text.length} / 500</span>
              <span>Disparaît après 24h</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('chooser')}
                disabled={submitting}
                className="flex-1 h-10 rounded-xl bg-[var(--loboko-surface)] hover:bg-[var(--loboko-surface-hover)] text-sm font-semibold"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={submitText}
                disabled={submitting || !text.trim()}
                className="flex-1 h-10 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Publier
              </button>
            </div>
          </div>
        )}

        {mode === 'media-preview' && pendingPreview && (
          <div className="p-4 space-y-4">
            <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[50vh]">
              {pendingKind === 'image' ? (
                <img
                  src={pendingPreview}
                  alt=""
                  className="w-full h-full object-contain max-h-[50vh]"
                />
              ) : (
                <video
                  src={pendingPreview}
                  controls
                  playsInline
                  className="w-full h-full max-h-[50vh]"
                />
              )}
            </div>
            {pendingKind === 'video' && pendingDuration != null && (
              <div className="text-xs text-[var(--loboko-text-muted)]">
                Durée : {Math.round(pendingDuration)}s / {MAX_STATUS_VIDEO_SECONDS}s max
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={captionInputRef}
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 200))}
                placeholder="Ajouter une légende (optionnel)"
                className="flex-1 h-10 px-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] text-sm outline-none focus:border-[#2563eb]"
                maxLength={200}
              />
              <button
                type="button"
                onClick={() =>
                  setEmojiTarget((t) => (t === 'caption' ? null : 'caption'))
                }
                className="h-10 w-10 shrink-0 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] flex items-center justify-center"
                aria-label="Ouvrir les emojis"
              >
                <Smile size={18} />
              </button>
            </div>
            {emojiTarget === 'caption' && (
              <Suspense
                fallback={
                  <div className="h-[280px] rounded-2xl bg-[var(--loboko-surface)] flex items-center justify-center text-xs text-[var(--loboko-text-muted)]">
                    Chargement des emojis…
                  </div>
                }
              >
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setEmojiTarget(null)}
                />
              </Suspense>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (pendingPreview) URL.revokeObjectURL(pendingPreview);
                  setPendingPreview(null);
                  setPendingFile(null);
                  setCaption('');
                  setMode('chooser');
                }}
                disabled={submitting}
                className="flex-1 h-10 rounded-xl bg-[var(--loboko-surface)] hover:bg-[var(--loboko-surface-hover)] text-sm font-semibold"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={submitMedia}
                disabled={submitting}
                className="flex-1 h-10 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Publier
              </button>
            </div>
          </div>
        )}

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onImageSelected}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={onVideoSelected}
        />
      </div>
    </div>
  );
}