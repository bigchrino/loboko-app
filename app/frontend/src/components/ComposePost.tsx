import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadMediaEx } from '@/lib/storage-helpers';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import MediaPicker, { MediaSelection } from './MediaPicker';
import MediaPreview from './MediaPreview';

interface Props {
  onPosted: () => void;
}

const MAX_POST_VIDEO_SECONDS = 90;

export default function ComposePost({ onPosted }: Props) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<MediaSelection | null>(null);

  const resetMedia = () => {
    setMedia((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  };

  useEffect(() => {
    return () => {
      if (media) URL.revokeObjectURL(media.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }
    if (!content.trim() && !media) {
      toast.error('Ajoutez du texte, une photo ou une vidéo');
      return;
    }
    setLoading(true);
    try {
      let image_key: string | null = null;
      let video_key: string | null = null;
      if (media) {
        const { key, error } = await uploadMediaEx(media.file, 'posts');
        if (error || !key) {
          toast.error(error || "Échec de l'upload");
          setLoading(false);
          return;
        }
        if (media.kind === 'image') image_key = key;
        else video_key = key;
      }

      // Try insert with both image_key + video_key; fall back to image_key only
      // if the DB schema does not have video_key yet.
      const basePayload: Record<string, unknown> = {
        user_id: user.id,
        content: content.trim(),
        image_key,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
      };
      const fullPayload = { ...basePayload, video_key };

      let res = await supabase.from('posts').insert(fullPayload);
      if (res.error && /video_key/i.test(res.error.message)) {
        if (video_key) {
          toast.error(
            "La colonne 'video_key' n'existe pas encore. Exécutez MEDIA_SETUP.md avant de publier une vidéo.",
          );
          setLoading(false);
          return;
        }
        res = await supabase.from('posts').insert(basePayload);
      }
      if (res.error) throw res.error;

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
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Quoi de neuf, LOBOKO ?"
        rows={3}
        className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-[var(--loboko-text-muted)]"
      />
      {media && (
        <div className="mt-2">
          <MediaPreview media={media} onRemove={resetMedia} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[var(--loboko-border)]">
        <MediaPicker
          maxVideoSeconds={MAX_POST_VIDEO_SECONDS}
          onSelect={(m) => {
            // replace any existing media
            if (media) URL.revokeObjectURL(media.previewUrl);
            setMedia(m);
          }}
          disabled={loading}
        />
        <button
          onClick={submit}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition shrink-0"
        >
          <Send size={16} />
          {loading ? 'Envoi...' : 'Publier'}
        </button>
      </div>
      <p className="text-[10px] text-[var(--loboko-text-muted)] mt-2">
        Vidéo : 90 secondes max · Formats : jpg, png, webp, mp4, webm, mov
      </p>
    </div>
  );
}