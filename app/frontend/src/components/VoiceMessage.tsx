import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { getMediaUrl } from '@/lib/storage-helpers';
import { formatDuration } from '@/lib/message-format';
import { VOICE_PLAYBACK_SPEEDS } from '@/lib/voice-config';

interface Props {
  objectKey: string;
  duration: number;
  mine: boolean;
}

// Number of bars in the faux waveform.
const BAR_COUNT = 28;

/**
 * Build a deterministic pseudo-waveform from the object key so each voice
 * note gets a unique — but stable — visual pattern without having to decode
 * the audio buffer (which would require downloading the full file).
 */
function buildWaveform(seed: string): number[] {
  const bars: number[] = [];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  for (let i = 0; i < BAR_COUNT; i++) {
    // Simple LCG step.
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const base = (h % 70) + 25; // 25..95
    // Smooth the middle so it looks more like a real waveform.
    const shape = Math.sin((i / BAR_COUNT) * Math.PI) * 0.4 + 0.6;
    bars.push(Math.max(18, Math.min(100, Math.round(base * shape))));
  }
  return bars;
}

export default function VoiceMessage({ objectKey, duration, mine }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
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

  const bars = useMemo(() => buildWaveform(objectKey), [objectKey]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play().catch(() => undefined);
    }
  };

  const cycleSpeed = () => {
    const idx = VOICE_PLAYBACK_SPEEDS.indexOf(speed);
    const next =
      VOICE_PLAYBACK_SPEEDS[(idx + 1) % VOICE_PLAYBACK_SPEEDS.length] || 1;
    setSpeed(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = speed;
  }, [speed, url]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      const d = el.duration || duration || 1;
      setCurrentTime(el.currentTime);
      setProgress(Math.min(100, (el.currentTime / d) * 100));
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnd);
    };
  }, [duration]);

  // Seek when user clicks on the waveform.
  const onBarClick = (index: number) => {
    const el = audioRef.current;
    const d = el?.duration || duration || 0;
    if (!el || !d) return;
    const ratio = (index + 0.5) / BAR_COUNT;
    el.currentTime = ratio * d;
    if (!playing) {
      el.play().catch(() => undefined);
    }
  };

  const iconBtnColor = mine
    ? 'bg-white/20 hover:bg-white/30 text-white'
    : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white';
  const activeBar = mine ? 'bg-white' : 'bg-[#2563eb]';
  const inactiveBar = mine ? 'bg-white/30' : 'bg-[var(--loboko-border)]';
  const speedChipColor = mine
    ? 'bg-white/15 hover:bg-white/25 text-white'
    : 'bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)]';

  // Visual progress threshold: any bar whose center is <= progress% is "active".
  const activeIndex = Math.floor((progress / 100) * BAR_COUNT);

  return (
    <div className="flex items-center gap-2.5 min-w-[200px]">
      <button
        type="button"
        onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBtnColor}`}
        aria-label={playing ? 'Pause' : 'Lire'}
        title={playing ? 'Pause' : 'Lire'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1 min-w-[120px]">
        <div
          className="h-6 flex items-center gap-[2px] cursor-pointer select-none"
          aria-label="Forme d'onde"
        >
          {bars.map((h, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onBarClick(i);
              }}
              className={`flex-1 min-w-[2px] rounded-full transition-colors ${
                i < activeIndex ? activeBar : inactiveBar
              }`}
              style={{ height: `${h}%` }}
              aria-hidden="true"
            />
          ))}
        </div>
        <div
          className={`flex items-center justify-between text-[10px] font-mono ${
            mine ? 'text-white/80' : 'text-[var(--loboko-text-muted)]'
          }`}
        >
          <span>{formatDuration(playing || currentTime > 0 ? currentTime : duration)}</span>
          <span className="opacity-70">{formatDuration(duration)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={cycleSpeed}
        className={`text-[10px] font-semibold h-7 px-2 rounded-full shrink-0 ${speedChipColor}`}
        aria-label={`Vitesse ${speed}x`}
        title="Changer la vitesse de lecture"
      >
        {speed}x
      </button>
      {url && <audio ref={audioRef} src={url} preload="metadata" />}
    </div>
  );
}