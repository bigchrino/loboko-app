import {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Play, Pause, RotateCcw, AlertCircle } from 'lucide-react';
import { getMediaUrl } from '@/lib/storage-helpers';
import { formatDuration } from '@/lib/message-format';
import { VOICE_PLAYBACK_SPEEDS } from '@/lib/voice-config';

interface Props {
  objectKey: string;
  /** Duration in seconds as stored in the message payload. */
  duration: number;
  mine: boolean;
}

/** Number of bars in the faux waveform. */
const BAR_COUNT = 32;

/**
 * Lifecycle states of the voice-note player.
 *
 * - `loading`  : the signed URL has not been resolved yet.
 * - `ready`    : metadata loaded, ready to play, not started (or not yet seeked after end).
 * - `playing`  : audio element is currently playing.
 * - `paused`   : audio started but is paused.
 * - `ended`    : playback finished; pressing Play restarts from 0.
 * - `error`    : audio failed to load or play.
 */
type PlayerState = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

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
    bars.push(Math.max(22, Math.min(100, Math.round(base * shape))));
  }
  return bars;
}

/**
 * Robust voice-note player inspired by WhatsApp / Telegram.
 *
 * Key design points:
 * 1. Single audio element, controlled by the React state machine (`PlayerState`).
 * 2. Progress is computed from `timeupdate` + `requestAnimationFrame` so the
 *    waveform moves smoothly even between native `timeupdate` events (which
 *    fire at very low frequency on iOS Safari).
 * 3. Seeking uses pointer events on the waveform surface for unified
 *    mouse + touch behavior. iOS Safari does not always allow setting
 *    `currentTime` before metadata is loaded, so we guard all seeks on
 *    the known `durationSec`.
 * 4. When playback ends, pressing Play restarts from 0; a dedicated replay
 *    affordance is also shown for clarity.
 */
export default function VoiceMessage({ objectKey, duration, mine }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<PlayerState>('loading');
  const [currentTime, setCurrentTime] = useState(0);
  /** Duration resolved from the audio element once metadata is loaded. */
  const [loadedDuration, setLoadedDuration] = useState<number>(0);
  const [speed, setSpeed] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  /**
   * Pointer id currently driving a drag-seek. We track it so a single
   * continuous gesture keeps updating `currentTime` and releases cleanly,
   * even if the user drags outside the waveform surface.
   */
  const draggingPointerRef = useRef<number | null>(null);

  // Effective duration used for display + seek math.
  const durationSec = loadedDuration > 0 ? loadedDuration : duration || 0;

  const bars = useMemo(() => buildWaveform(objectKey), [objectKey]);

  // Resolve the signed/public URL for the object key.
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setUrl(null);
    setCurrentTime(0);
    setLoadedDuration(0);
    getMediaUrl(objectKey)
      .then((u) => {
        if (cancelled) return;
        if (!u) {
          setState('error');
          return;
        }
        setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [objectKey]);

  // Keep the native element's playbackRate in sync with the speed chip.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = speed;
  }, [speed, url]);

  // Drive smooth progress updates while playing, independent of the
  // browser's `timeupdate` cadence (especially important on iOS Safari).
  useEffect(() => {
    if (state !== 'playing') {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    const tick = () => {
      const el = audioRef.current;
      if (el) {
        setCurrentTime(el.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [state]);

  // Wire up native audio events. The element is recreated when `url` changes,
  // so we must rebind the listeners each time.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !url) return;

    const onLoadedMeta = () => {
      // Some browsers (iOS Safari) expose Infinity for streamed blobs; guard it.
      const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duration || 0;
      setLoadedDuration(d);
      setState((prev) => (prev === 'loading' ? 'ready' : prev));
    };
    const onPlay = () => setState('playing');
    const onPause = () => {
      // `pause` also fires right before `ended` — don't clobber the ended state.
      setState((prev) => (prev === 'ended' ? prev : 'paused'));
    };
    const onEnded = () => {
      setState('ended');
      setCurrentTime(durationSec);
    };
    const onTime = () => {
      setCurrentTime(el.currentTime);
    };
    const onError = () => setState('error');
    const onWaiting = () => {
      // Keep the current state but surface a subtle loading hint if needed.
      // We don't change the state machine here to avoid flicker on iOS.
    };

    el.addEventListener('loadedmetadata', onLoadedMeta);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('error', onError);
    el.addEventListener('waiting', onWaiting);

    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMeta);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('error', onError);
      el.removeEventListener('waiting', onWaiting);
    };
    // durationSec intentionally omitted to avoid rebinding on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, duration]);

  const play = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    // Restart from the beginning if we just finished.
    if (state === 'ended') {
      try {
        el.currentTime = 0;
      } catch {
        /* ignore: iOS Safari may throw if not fully loaded */
      }
      setCurrentTime(0);
    }
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => setState('error'));
    }
  }, [state]);

  const pause = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
  }, []);

  const toggle = useCallback(() => {
    if (state === 'playing') pause();
    else play();
  }, [state, play, pause]);

  const replay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    setCurrentTime(0);
    play();
  }, [play]);

  const cycleSpeed = useCallback(() => {
    const idx = VOICE_PLAYBACK_SPEEDS.indexOf(speed);
    const next =
      VOICE_PLAYBACK_SPEEDS[(idx + 1) % VOICE_PLAYBACK_SPEEDS.length] || 1;
    setSpeed(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  }, [speed]);

  /**
   * Seek based on a pointer position over the waveform container.
   * Works for both taps and drags, on mouse and touch.
   */
  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = audioRef.current;
      const container = waveformRef.current;
      if (!el || !container || durationSec <= 0) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const next = ratio * durationSec;
      try {
        el.currentTime = next;
      } catch {
        // iOS Safari can throw if metadata isn't ready; ignore.
        return;
      }
      setCurrentTime(next);
      if (state === 'ended') {
        // After a manual seek past the end, transition back to paused so the
        // user can press Play to resume from the new position.
        setState('paused');
      }
    },
    [durationSec, state],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (durationSec <= 0) return;
      // Only start a drag on primary button / touch / pen.
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      draggingPointerRef.current = e.pointerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      seekFromClientX(e.clientX);
    },
    [durationSec, seekFromClientX],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingPointerRef.current !== e.pointerId) return;
      seekFromClientX(e.clientX);
    },
    [seekFromClientX],
  );

  const handlePointerEnd = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingPointerRef.current !== e.pointerId) return;
    draggingPointerRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * Fallback click handler for environments where PointerEvent is not
   * available (older browsers). Kept minimal and idempotent with the
   * pointerdown path.
   */
  const handleClickFallback = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (typeof window !== 'undefined' && 'PointerEvent' in window) return;
      seekFromClientX(e.clientX);
    },
    [seekFromClientX],
  );

  // Derived UI values.
  const progressRatio =
    durationSec > 0 ? Math.min(1, Math.max(0, currentTime / durationSec)) : 0;
  const progressPct = progressRatio * 100;
  const activeBars = Math.round(progressRatio * BAR_COUNT);

  const displayCurrent =
    state === 'ended' ? durationSec : currentTime > 0 ? currentTime : 0;
  const displayTotal = durationSec;

  const iconBtnColor = mine
    ? 'bg-white/20 hover:bg-white/30 text-white'
    : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white';
  const activeBarColor = mine ? 'bg-white' : 'bg-[#2563eb]';
  const inactiveBarColor = mine ? 'bg-white/30' : 'bg-[var(--loboko-border)]';
  const speedChipColor = mine
    ? 'bg-white/15 hover:bg-white/25 text-white'
    : 'bg-[var(--loboko-elevated)] hover:bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)]';
  const mutedText = mine ? 'text-white/80' : 'text-[var(--loboko-text-muted)]';

  const isPlaying = state === 'playing';
  const showReplay = state === 'ended';
  const disabled = state === 'loading' || state === 'error' || !url;

  const mainAriaLabel = isPlaying ? 'Pause' : showReplay ? 'Rejouer' : 'Lire';

  return (
    <div className="flex items-center gap-2.5 min-w-[220px] select-none">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-opacity ${iconBtnColor} ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
        aria-label={mainAriaLabel}
        title={mainAriaLabel}
      >
        {state === 'error' ? (
          <AlertCircle size={14} />
        ) : isPlaying ? (
          <Pause size={14} />
        ) : showReplay ? (
          <RotateCcw size={14} />
        ) : (
          <Play size={14} className="ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1 min-w-[120px]">
        <div
          ref={waveformRef}
          role="slider"
          aria-label="Progression de la note vocale"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, Math.round(displayTotal))}
          aria-valuenow={Math.round(displayCurrent)}
          tabIndex={disabled ? -1 : 0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onClick={handleClickFallback}
          className={`relative h-7 flex items-center gap-[2px] touch-none ${
            disabled ? 'cursor-default' : 'cursor-pointer'
          }`}
          style={{ WebkitUserSelect: 'none' }}
        >
          {bars.map((h, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`flex-1 min-w-[2px] rounded-full transition-colors duration-75 ${
                i < activeBars ? activeBarColor : inactiveBarColor
              }`}
              style={{ height: `${h}%` }}
            />
          ))}
          {/* Thin progress line under the bars for extra clarity. */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute left-0 bottom-0 h-[2px] rounded-full ${activeBarColor}`}
            style={{ width: `${progressPct}%`, opacity: 0.5 }}
          />
        </div>
        <div className={`flex items-center justify-between text-[10px] font-mono ${mutedText}`}>
          <span>{formatDuration(displayCurrent)}</span>
          <span className="opacity-70">{formatDuration(displayTotal)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={cycleSpeed}
        disabled={disabled}
        className={`text-[10px] font-semibold h-7 px-2 rounded-full shrink-0 ${speedChipColor} ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
        aria-label={`Vitesse ${speed}x`}
        title="Changer la vitesse de lecture"
      >
        {speed}x
      </button>

      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          // `playsInline` is ignored on <audio> but harmless; kept for safety
          // in case the element is ever upgraded to <video>.
          playsInline
        />
      )}
    </div>
  );
}