import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { getMediaUrl } from '@/lib/storage-helpers';
import { formatDuration } from '@/lib/message-format';

interface Props {
  objectKey: string;
  duration: number;
  mine: boolean;
}

export default function VoiceMessage({ objectKey, duration, mine }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let cancelled = false;
    getMediaUrl(objectKey).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [objectKey]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play().catch(() => undefined);
    }
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      const d = el.duration || duration || 1;
      setCurrentTime(el.currentTime);
      setProgress(Math.min(100, (el.currentTime / d) * 100));
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', () => setPlaying(true));
    el.addEventListener('pause', () => setPlaying(false));
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnd);
    };
  }, [duration]);

  const barColor = mine ? 'bg-white/70' : 'bg-[#2563eb]';
  const trackColor = mine ? 'bg-white/20' : 'bg-[var(--loboko-border)]';
  const iconBtnColor = mine
    ? 'bg-white/20 hover:bg-white/30 text-white'
    : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white';

  return (
    <div className="flex items-center gap-3 min-w-[180px]">
      <button
        type="button"
        onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBtnColor}`}
        aria-label={playing ? 'Pause' : 'Lire'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1 min-w-[120px]">
        <div className={`h-1 rounded-full ${trackColor} overflow-hidden`}>
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className={`text-[10px] font-mono ${mine ? 'text-white/80' : 'text-[var(--loboko-text-muted)]'}`}>
          {formatDuration(playing ? currentTime : duration)}
        </div>
      </div>
      {url && <audio ref={audioRef} src={url} preload="metadata" />}
    </div>
  );
}