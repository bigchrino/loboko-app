import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send, X } from 'lucide-react';
import { uploadMedia } from '@/lib/storage-helpers';
import { formatDuration } from '@/lib/message-format';

interface Props {
  onSend: (objectKey: string, duration: number) => void | Promise<void>;
  onClose: () => void;
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

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mime });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        stopStream();
      };
      startedAtRef.current = Date.now();
      setElapsed(0);
      rec.start();
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (e) {
      console.error(e);
      setError("Impossible d'accéder au micro. Autorisez le microphone.");
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
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
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
      const key = await uploadMedia(file, 'voice');
      if (!key) {
        setError('Échec du téléchargement');
        setUploading(false);
        return;
      }
      await onSend(key, elapsed);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onClose();
    } catch (e) {
      console.error(e);
      setError("Échec de l'envoi");
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
        <div className="flex-1 text-xs text-red-400 truncate">{error}</div>
      ) : !blob ? (
        <>
          <div className="flex-1 flex items-center gap-2 text-sm">
            {recording ? (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono">{formatDuration(elapsed)}</span>
                <span className="text-[var(--loboko-text-muted)] text-xs truncate">
                  Enregistrement...
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