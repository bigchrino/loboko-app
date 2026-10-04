import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getSignedStorageUrl } from '@/lib/storage-helpers';
import { formatDuration } from '@/lib/message-format';
import LazyMedia from '@/components/LazyMedia';

interface Props {
  kind: 'image' | 'video';
  objectKey: string;
  duration?: number;
}

// Memory only, scoped to the current account and shorter than the signed TTL.
const mediaLinks = new Map<string, { url: string; expires: number }>();
let cacheAccount: string | null = null;
supabase.auth.onAuthStateChange((event, session) => {
  const account = session?.user.id ?? null;
  if (event === 'SIGNED_OUT' || account !== cacheAccount) mediaLinks.clear();
  cacheAccount = account;
});

function Placeholder() {
  return <div className="absolute inset-0 rounded-lg bg-black/20 motion-safe:animate-pulse" aria-label="Chargement du média" />;
}

function MediaInner({ kind, objectKey, duration }: Props) {
  const { user } = useAuth();
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

  return (
    <div className="relative w-full h-full" aria-busy={!ready && !error}>
      {!ready && !error && <Placeholder />}
      {error ? (
        <button type="button" onClick={() => { mediaLinks.delete(cacheKey); setAttempt((value) => value + 1); }}
          className="w-full h-full rounded-lg bg-black/20 text-xs p-3">
          Média indisponible · Réessayer
        </button>
      ) : url && (kind === 'image' ? (
        <a href={url} target="_blank" rel="noreferrer" className="block w-full h-full">
          <img src={url} alt="photo" onLoad={() => setReady(true)} onError={() => setError(true)}
            className={`rounded-lg w-full h-full object-contain block ${ready ? '' : 'opacity-0'}`}
            decoding="async" />
        </a>
      ) : (
        <>
          <video src={url} className="rounded-lg w-full h-full object-contain block bg-black"
            controls playsInline preload="metadata" onLoadedMetadata={() => setReady(true)} onError={() => setError(true)} />
          {duration != null && ready && <span className="absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-black/70 text-white">{formatDuration(duration)}</span>}
        </>
      ))}
    </div>
  );
}

export default function MediaMessage(props: Props) {
  // Identical geometry before/after download: tall screenshots cannot move
  // the messages being read. The original remains accessible on image tap.
  return (
    <LazyMedia className="relative w-56 max-w-full h-60" placeholder={<Placeholder />}>
      <MediaInner key={`${props.kind}:${props.objectKey}`} {...props} />
    </LazyMedia>
  );
}
