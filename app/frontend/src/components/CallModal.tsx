import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { encodePayload, decodePayload, SignalPayload, formatDuration } from '@/lib/message-format';

type Direction = 'outgoing' | 'incoming';
type Status = 'calling' | 'ringing' | 'connected' | 'ended';

interface Props {
  myId: string;
  peerId: string;
  peerName: string;
  mode: 'voice' | 'video';
  direction: Direction;
  callId: string;
  initialOffer?: { sdp: string } | null;
  onClose: (result: { status: 'accepted' | 'rejected' | 'missed' | 'ended'; duration: number }) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function CallModal({
  myId,
  peerId,
  peerName,
  mode,
  direction,
  callId,
  initialOffer,
  onClose,
}: Props) {
  const [status, setStatus] = useState<Status>(
    direction === 'outgoing' ? 'calling' : 'ringing',
  );
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const lastSignalAtRef = useRef<string>('1970-01-01T00:00:00Z');
  const pollingRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const closedRef = useRef(false);
  const acceptedRef = useRef(false);

  const constraints = useMemo(
    () => ({ audio: true, video: mode === 'video' }),
    [mode],
  );

  const sendSignal = async (signal: SignalPayload['signal']) => {
    try {
      await supabase.from('messages').insert({
        user_id: myId,
        receiver_id: peerId,
        content: encodePayload({ kind: 'signal', callId, mode, signal }),
        read: false,
      });
    } catch (e) {
      console.error('sendSignal error', e);
    }
  };

  const cleanup = (result: { status: 'accepted' | 'rejected' | 'missed' | 'ended'; duration: number }) => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    if (timerRef.current) window.clearInterval(timerRef.current);
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {
      // ignore
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    onClose(result);
  };

  const endCall = async (kind: 'hangup' | 'reject') => {
    await sendSignal({ type: kind });
    if (kind === 'reject') {
      cleanup({ status: 'rejected', duration: 0 });
    } else {
      const duration = acceptedRef.current
        ? Math.floor((Date.now() - startedAtRef.current) / 1000)
        : 0;
      cleanup({ status: acceptedRef.current ? 'ended' : 'missed', duration });
    }
  };

  const setupPeer = () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendSignal({ type: 'ice', candidate: ev.candidate.toJSON() });
      }
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      if (!stream) return;
      if (mode === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') {
        if (!acceptedRef.current) {
          acceptedRef.current = true;
          startedAtRef.current = Date.now();
          timerRef.current = window.setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
          }, 500);
        }
        setStatus('connected');
      } else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
        if (!closedRef.current && acceptedRef.current) {
          cleanup({
            status: 'ended',
            duration: Math.floor((Date.now() - startedAtRef.current) / 1000),
          });
        }
      }
    };

    return pc;
  };

  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (mode === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      const pc = pcRef.current;
      if (pc) stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      return stream;
    } catch (e) {
      console.error(e);
      setError("Impossible d'accéder au micro/caméra");
      return null;
    }
  };

  const startOutgoing = async () => {
    setupPeer();
    const stream = await getMedia();
    if (!stream) return;
    const pc = pcRef.current!;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal({ type: 'offer', sdp: offer.sdp || '' });
  };

  const acceptIncoming = async () => {
    if (!initialOffer) return;
    setupPeer();
    const stream = await getMedia();
    if (!stream) return;
    const pc = pcRef.current!;
    await pc.setRemoteDescription({ type: 'offer', sdp: initialOffer.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendSignal({ type: 'answer', sdp: answer.sdp || '' });
    acceptedRef.current = true;
    startedAtRef.current = Date.now();
    setStatus('connected');
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
  };

  const pollSignals = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id,content,created_at')
        .eq('user_id', peerId)
        .eq('receiver_id', myId)
        .gt('created_at', lastSignalAtRef.current)
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      type Row = { id: string; content: string; created_at: string };
      const items = (data as Row[]) || [];
      for (const it of items) {
        if (it.created_at > lastSignalAtRef.current) {
          lastSignalAtRef.current = it.created_at;
        }
        const payload = decodePayload(it.content);
        if (payload.kind !== 'signal' || payload.callId !== callId) continue;
        const pc = pcRef.current;
        if (!pc) continue;
        const sig = payload.signal;
        if (sig.type === 'answer') {
          await pc.setRemoteDescription({ type: 'answer', sdp: sig.sdp });
        } else if (sig.type === 'ice') {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
          } catch (e) {
            console.error('ice err', e);
          }
        } else if (sig.type === 'hangup' || sig.type === 'reject') {
          const duration = acceptedRef.current
            ? Math.floor((Date.now() - startedAtRef.current) / 1000)
            : 0;
          cleanup({
            status: sig.type === 'reject' ? 'rejected' : acceptedRef.current ? 'ended' : 'missed',
            duration,
          });
          return;
        }
      }
    } catch (e) {
      console.error('poll err', e);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('messages')
          .select('created_at')
          .eq('user_id', peerId)
          .eq('receiver_id', myId)
          .order('created_at', { ascending: false })
          .limit(1);
        const rows = (data as { created_at: string }[]) || [];
        if (rows.length > 0) lastSignalAtRef.current = rows[0].created_at;
      } catch {
        // ignore
      }
      if (direction === 'outgoing') {
        await startOutgoing();
      }
      pollingRef.current = window.setInterval(pollSignals, 1500);
    })();
    return () => {
      if (!closedRef.current) {
        cleanup({ status: 'missed', duration: 0 });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camOff;
    stream.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCamOff(next);
  };

  const reject = () => {
    endCall('reject');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col">
      {mode === 'video' && status === 'connected' && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="relative flex-1 flex flex-col items-center justify-center text-white px-6">
        {(mode === 'voice' || status !== 'connected') && (
          <>
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-3xl font-bold mb-6 shadow-xl">
              {peerName.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-2xl font-semibold mb-2">{peerName}</div>
            <div className="text-sm text-white/70 mb-6">
              {status === 'calling' && `Appel ${mode === 'video' ? 'vidéo' : 'vocal'}...`}
              {status === 'ringing' && `Appel ${mode === 'video' ? 'vidéo' : 'vocal'} entrant`}
              {status === 'connected' && (mode === 'voice' ? formatDuration(elapsed) : '')}
              {error && <div className="text-red-400 mt-2">{error}</div>}
            </div>
          </>
        )}

        {mode === 'video' && status === 'connected' && (
          <div className="absolute top-6 left-6 text-white/90 text-sm font-mono bg-black/40 px-3 py-1 rounded-full">
            {formatDuration(elapsed)} · {peerName}
          </div>
        )}

        {mode === 'video' && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-28 right-4 w-28 h-40 rounded-xl object-cover border-2 border-white/20 bg-black"
          />
        )}
      </div>

      <div className="relative pb-8 pt-4 flex items-center justify-center gap-4">
        {status === 'ringing' && direction === 'incoming' ? (
          <>
            <button
              onClick={reject}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg"
              aria-label="Refuser"
            >
              <PhoneOff size={24} />
            </button>
            <button
              onClick={acceptIncoming}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-lg"
              aria-label="Accepter"
            >
              <Phone size={24} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={toggleMute}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              aria-label={muted ? 'Activer micro' : 'Couper micro'}
            >
              {muted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            {mode === 'video' && (
              <button
                onClick={toggleCam}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                aria-label={camOff ? 'Activer caméra' : 'Couper caméra'}
              >
                {camOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}
            <button
              onClick={() => endCall('hangup')}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg"
              aria-label="Raccrocher"
            >
              <PhoneOff size={22} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}