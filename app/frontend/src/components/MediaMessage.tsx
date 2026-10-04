import { useEffect, useState } from 'react';
import { Image as ImageIcon, Video as VideoIcon, LoaderCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppPreferences } from '@/lib/use-app-preferences';
import { useAuth } from '@/contexts/AuthContext';
import { getSignedStorageUrl } from '@/lib/storage-helpers';
import { formatDuration } from '@/lib/message-format';
import LazyMedia from '@/components/LazyMedia';
import VideoWithPoster from '@/components/VideoWithPoster';

interface Props {
  kind: 'image' | 'video';
  objectKey: string;
  duration?: number;
  caption?: string;
  poster?: string;
}

// Memory only, scoped to the current account and shorter than the signed TTL.
const mediaLinks = new Map<string, { url: string; expires: number }>();
let cacheAccount: string | null = null;
supabase.auth.onAuthStateChange((event, session) => {
  const account = session?.user.id ?? null;
  if (event === 'SIGNED_OUT' || account !== cacheAccount) mediaLinks.clear();
  cacheAccount = account;
});

function Placeholder({ kind = 'image' }: { kind?: 'image' | 'video' }) {
  const Icon = kind === 'image' ? ImageIcon : VideoIcon;
  return (
    <div className="absolute inset-0 z-10 rounded-2xl bg-[#151b25] text-white/65 flex flex-col items-center justify-center gap-2 pointer-events-none" role="status" aria-label="Chargement du média">
      <Icon size={32} className="text-white/35" aria-hidden="true" />
      <span className="flex items-center gap-2 text-xs"><LoaderCircle size={14} className="motion-safe:animate-spin" aria-hidden="true" />{kind === 'image' ? 'Chargement de la photo…' : 'Chargement de la vidéo…'}</span>
    </div>
  );
}

function MediaInner({ kind, objectKey, duration, poster }: Props) {
  const { user } = useAuth();
  const { saveData } = useAppPreferences();
  const cacheKey = `${user?.id ?? ''}:${objectKey}`;
  const cached = mediaLinks.get(cacheKey);
  const [url, setUrl] = useState<string | null>(() => cached && cached.expires > Date.now() ? cached.url : null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    const existing = mediaLinks.get(cacheKey);
    if (existing && existing.expires > Date.now() && attempt === 0) {
      setUrl(existing.url);
      return;
    }
    setReady(false);
    setUrl(null);
    void getSignedStorageUrl(objectKey, 3600).then(({ url: next }) => {
      if (cancelled) return;
      if (!next) { setError(true); return; }
      mediaLinks.set(cacheKey, { url: next, expires: Date.now() + 3540_000 });
      if (mediaLinks.size > 200) mediaLinks.delete(mediaLinks.keys().next().value!);
      setUrl(next);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [objectKey, cacheKey, attempt]);

  // A stalled download must offer a retry instead of an endless blank bubble.
  useEffect(() => {
    if (ready || error || (kind === 'video' && saveData && url)) return;
    const timer = window.setTimeout(() => setError(true), 30000);
    return () => window.clearTimeout(timer);
  }, [url, ready, error, attempt, kind, saveData]);

  // A deferred video is ready for manual playback, not a stalled download.
  const displayReady = ready || (kind === 'video' && saveData && !!url);
  return (
    <div className="relative w-full h-full" aria-busy={!displayReady && !error}>
      {!displayReady && !error && <Placeholder kind={kind} />}
      {error ? (
        <button type="button" onClick={() => { mediaLinks.delete(cacheKey); setAttempt((value) => value + 1); }}
          className="w-full h-full rounded-2xl bg-[#151b25] text-white/80 text-xs p-3">
          Chargement impossible · Réessayer
        </button>
      ) : url && (kind === 'image' ? (
        <a href={url} target="_blank" rel="noreferrer" className="block w-full h-full">
          <img src={url} alt="photo" onLoad={() => { setError(false); setReady(true); }} onError={() => setError(true)}
            ref={(element) => {
              // Safari may finish a cached image before React receives load.
              if (element?.complete && element.naturalWidth > 0) setReady(true);
            }}
            className="rounded-2xl w-full h-full object-contain block bg-[#151b25]"
            decoding="async" />
        </a>
      ) : (
        <>
          <VideoWithPoster src={url} cacheId={objectKey} poster={poster} onPosterReady={() => setReady(true)} className="rounded-2xl w-full h-full object-contain block bg-black"
            controls playsInline preload="metadata" onLoadedMetadata={() => setReady(true)} onError={() => setError(true)} />
          {duration != null && displayReady && <span className="absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-black/70 text-white">{formatDuration(duration)}</span>}
        </>
      ))}
    </div>
  );
}

export default function MediaMessage(props: Props) {
  // Identical geometry before/after download: tall screenshots cannot move
  // the messages being read. The original remains accessible on image tap.
  return (
    <div className="w-56 max-w-full">
      <LazyMedia className="relative w-full h-60" rootMargin="600px" scrollRootSelector="[data-chat-scroll]" placeholder={<Placeholder kind={props.kind} />}>
        <MediaInner key={`${props.kind}:${props.objectKey}`} {...props} />
      </LazyMedia>
      {props.caption && <p className="px-2 py-1.5 text-sm whitespace-pre-wrap break-words">{props.caption}</p>}
    </div>
  );
}
