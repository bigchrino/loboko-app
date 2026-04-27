import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send, X } from 'lucide-react';
import { uploadMediaEx } from '@/lib/storage-helpers';
import { formatDuration } from '@/lib/message-format';

interface Props {
  onSend: (objectKey: string, duration: number) => void | Promise<void>;
  onClose: () => void;
}

// Max recording duration (safety guard in addition to the 10 MB upload cap).
const MAX_SECONDS = 120;

/**
 * Pick the best MediaRecorder mimeType supported by the current browser.
 * Order: opus/webm (Chrome/Firefox/Android) -> plain webm -> mp4/aac (Safari iOS)
 * -> ogg -> browser default.
 */
function pickMimeType(): { mime: string; ext: string } {
  const candidates: Array<{ mime: string; ext: string }> = [
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' },
    { mime: 'audio/mp4', ext: 'm4a' },
    { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
  ];
  if (typeof MediaRecorder !== 'undefined') {
    for (const c of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(c.mime)) return c;
      } catch {
        // ignore
      }
    }
  }
  return { mime: '', ext: 'webm' };
}

export default function VoiceRecorder({ onSend, onClose }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const mimeRef = useRef<{ mime: string; ext: string }>({ mime: '', ext: 'webm' });

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch (e) {
        console.warn('[voice] stop failed', e);
      }
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  };

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const picked = pickMimeType();
      mimeRef.current = picked;
      const rec = picked.mime
        ? new MediaRecorder(stream, { mimeType: picked.mime })
        : new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onerror = (e) => {
        console.error('[voice] recorder error', e);
        setError("Erreur pendant l'enregistrement");
      };
      rec.onstop = () => {
        const type = picked.mime || 'audio/webm';
        const b = new Blob(chunksRef.current, { type });
        if (b.size === 0) {
          setError('Aucun son capté. Vérifiez le micro.');
          stopStream();
          return;
        }
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        stopStream();
      };

      startedAtRef.current = Date.now();
      setElapsed(0);
      rec.start();
      setRecording(true);

      timerRef.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(sec);
        if (sec >= MAX_SECONDS) stop();
      }, 250);
    } catch (e) {
      console.error('[voice] getUserMedia failed', e);
      setError("Impossible d'accéder au micro. Autorisez le microphone.");
    }
  };

  const discard = () => {
    if (recording) stop();
    setBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setElapsed(0);
    onClose();
  };

  const send = async () => {
    if (!blob) return;
    setUploading(true);
    setError(null);
    try {
      const ext = mimeRef.current.ext || 'webm';
      const type = blob.type || mimeRef.current.mime || 'audio/webm';
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type });

      const { key, error: uploadErr } = await uploadMediaEx(file, 'voice-notes');
      if (!key) {
        setError(uploadErr || "Échec de l'envoi du fichier audio.");
        setUploading(false);
        return;
      }

      // Prefer the recorder's own elapsed counter — it's reliable even when
      // the Blob's audio container doesn't advertise a duration header.
      const durationSec = Math.max(1, Math.floor(elapsed));

      await onSend(key, durationSec);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onClose();
    } catch (e) {
      console.error('[voice] send failed', e);
      setError(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-1 bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] rounded-full pl-3 pr-1 py-1">
      <button
        type="button"
        onClick={discard}
        className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--loboko-text-muted)] hover:bg-[var(--loboko-surface-hover)]"
        aria-label="Annuler"
      >
        <X size={16} />
      </button>

      {error ? (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="flex-1 text-xs text-red-400 truncate" title={error}>
            {error}
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setBlob(null);
              if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }
              setElapsed(0);
            }}
            className="text-xs px-2 py-1 rounded-md bg-[var(--loboko-surface-hover)] text-[var(--loboko-text)]"
          >
            Réessayer
          </button>
        </div>
      ) : !blob ? (
        <>
          <div className="flex-1 flex items-center gap-2 text-sm">
            {recording ? (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono">{formatDuration(elapsed)}</span>
                <span className="text-[var(--loboko-text-muted)] text-xs truncate">
                  Enregistrement... (max {MAX_SECONDS}s)
                </span>
              </>
            ) : (
              <span className="text-[var(--loboko-text-muted)] text-xs">
                Appuyez pour enregistrer
              </span>
            )}
          </div>
          {!recording ? (
            <button
              type="button"
              onClick={start}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white flex items-center justify-center"
              aria-label="Démarrer"
            >
              <Mic size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center"
              aria-label="Arrêter"
            >
              <Square size={14} />
            </button>
          )}
        </>
      ) : (
        <>
          <audio src={previewUrl || undefined} controls className="flex-1 h-8" />
          <span className="text-xs font-mono text-[var(--loboko-text-muted)]">
            {formatDuration(elapsed)}
          </span>
          <button
            type="button"
            onClick={send}
            disabled={uploading}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white flex items-center justify-center disabled:opacity-50"
            aria-label="Envoyer"
          >
            <Send size={14} />
          </button>
        </>
      )}
    </div>
  );
}