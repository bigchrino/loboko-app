import { useEffect, useRef, useState, type VideoHTMLAttributes } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppPreferences } from '@/lib/use-app-preferences';
import { supabase } from '@/lib/supabase';
import { captureVideoPoster, validVideoPoster } from '@/lib/video-poster';

type Props = VideoHTMLAttributes<HTMLVideoElement> & { src: string; cacheId?: string; onPosterReady?: () => void };
const posters = new Map<string, { image: string; expires: number }>();
let posterAccount: string | null = null;
supabase.auth.onAuthStateChange((event, session) => {
  const account = session?.user.id ?? null;
  if (event === 'SIGNED_OUT' || account !== posterAccount) posters.clear();
  posterAccount = account;
});

function Player({ src, poster: provided, cacheId, onPosterReady, onLoadedMetadata, onLoadedData, onSeeked, onPlay, onError, autoPlay, preload = 'metadata', ...props }: Props) {
  const { user } = useAuth();
  const { saveData } = useAppPreferences();
  const key = `${user?.id ?? ''}:${cacheId ?? src}`;
  const cached = posters.get(key);
  const supplied = validVideoPoster(provided);
  const [poster, setPoster] = useState(() => supplied ?? (cached && cached.expires > Date.now() ? cached.image : undefined));
  const needsFrame = useRef(!poster && !autoPlay && !saveData);
  const [visible, setVisible] = useState(!!autoPlay);
  const [corsFallback, setCorsFallback] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const started = useRef(false);
  const target = useRef(.1);
  const attempted = useRef(false);

  useEffect(() => {
    if (poster) onPosterReady?.();
  }, [poster, onPosterReady]);
  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const root = element.closest('[data-chat-scroll]');
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { root, rootMargin: root ? '600px' : '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);
  const capture = (video: HTMLVideoElement) => {
    if (poster || started.current || attempted.current || video.seeking || video.currentTime < target.current - .01) return;
    const image = captureVideoPoster(video);
    if (!image) return;
    attempted.current = true;
    posters.set(key, { image, expires: Date.now() + 1800000 });
    if (posters.size > 100) posters.delete(posters.keys().next().value!);
    setPoster(image);
  };
  // The short time fragment prompts Safari to fetch a frame, not just the
  // metadata, for legacy videos with no saved poster. It never auto-plays.
  const source = needsFrame.current && !src.includes('#') ? `${src}#t=0.1` : src;
  return <video {...props} key={corsFallback ? 'plain' : 'cors'} ref={ref} src={source} poster={poster} autoPlay={autoPlay}
    crossOrigin={corsFallback ? undefined : 'anonymous'}
    preload={visible && (!saveData || autoPlay || started.current) ? preload : 'none'}
    onLoadedMetadata={event => {
      const video = event.currentTarget;
      if (!poster && !started.current && !autoPlay && !corsFallback && !saveData) {
        target.current = Math.min(.1, Number.isFinite(video.duration) ? video.duration / 2 : .1);
        try { video.currentTime = target.current; } catch { /* Playback remains available. */ }
      }
      onLoadedMetadata?.(event);
    }}
    onLoadedData={event => { capture(event.currentTarget); onLoadedData?.(event); }}
    onSeeked={event => { capture(event.currentTarget); onSeeked?.(event); }}
    onPlay={event => { started.current = true; onPlay?.(event); }}
    onError={event => {
      // A legacy host may not allow CORS. Retry ordinary playback once.
      if (!corsFallback) { setCorsFallback(true); return; }
      onError?.(event);
    }} />;
}

export default function VideoWithPoster(props: Props) {
  const { user } = useAuth();
  return <Player key={`${user?.id ?? ''}:${props.src}`} {...props} />;
}
