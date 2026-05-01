import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getMediaUrl } from '@/lib/storage-helpers';
import { SharedPostPayload } from '@/lib/message-format';

interface Props {
  payload: SharedPostPayload;
  mine: boolean;
}

interface LivePost {
  id: string;
  content: string;
  image_key?: string | null;
  user_id: string;
}

export default function SharedPostMessage({ payload, mine }: Props) {
  const navigate = useNavigate();
  const [live, setLive] = useState<LivePost | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(
    payload.preview.image_url || null,
  );
  const [authorName, setAuthorName] = useState<string>(
    payload.preview.author_name || 'Publication',
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('id,content,image_key,user_id')
          .eq('id', payload.post_id)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          setNotFound(true);
          return;
        }
        const p = data as LivePost;
        setLive(p);
        if (p.image_key) {
          const url = await getMediaUrl(p.image_key);
          if (!cancelled && url) setImageUrl(url);
        }
        // Try resolve author name from profiles
        if (p.user_id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('display_name,username')
            .eq('user_id', p.user_id)
            .maybeSingle();
          if (!cancelled && prof) {
            const name =
              (prof as { display_name?: string; username?: string }).display_name ||
              (prof as { display_name?: string; username?: string }).username;
            if (name) setAuthorName(name);
          }
        }
      } catch {
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload.post_id]);

  const text = live?.content || payload.preview.text || '';
  const open = () => {
    if (notFound) return;
    navigate(`/post/${payload.post_id}`);
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={notFound}
      className={`block w-full text-left rounded-xl overflow-hidden border ${
        mine
          ? 'border-white/20 bg-white/10'
          : 'border-[var(--loboko-border)] bg-[var(--loboko-elevated)]'
      } ${notFound ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}
    >
      {imageUrl && !notFound && (
        <img
          src={imageUrl}
          alt=""
          className="w-full h-40 object-cover"
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="p-2.5">
        <div
          className={`text-[10px] uppercase tracking-wide mb-1 ${
            mine ? 'text-white/70' : 'text-[var(--loboko-text-muted)]'
          }`}
        >
          Publication partagée
        </div>
        {notFound ? (
          <div
            className={`text-xs italic ${
              mine ? 'text-white/80' : 'text-[var(--loboko-text-muted)]'
            }`}
          >
            Contenu indisponible
          </div>
        ) : (
          <>
            <div
              className={`text-xs font-semibold mb-0.5 ${
                mine ? 'text-white' : 'text-[var(--loboko-text)]'
              }`}
            >
              {authorName}
            </div>
            <div
              className={`text-xs line-clamp-3 ${
                mine ? 'text-white/90' : 'text-[var(--loboko-text)]'
              }`}
            >
              {text || 'Ouvrir la publication'}
            </div>
          </>
        )}
      </div>
    </button>
  );
}