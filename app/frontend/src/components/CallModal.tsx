import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDuration } from '@/lib/message-format';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Direction = 'outgoing' | 'incoming';
type Status = 'calling' | 'ringing' | 'connected' | 'ended';

interface Props {
  myId: string;
  peerId: string;
  peerName: string;
  mode: 'voice' | 'video';
  direction: Direction;
  callId: string;
  /** Offer SDP received via the messages table when this is an incoming call. */
  initialOffer?: { sdp: string } | null;
  onClose: (result: {
    status: 'accepted' | 'rejected' | 'missed' | 'ended';
    duration: number;
  }) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Realtime event types exchanged over the per-call broadcast channel.
// Keeping them in one union makes the flow very explicit.
type CallEvent =
  | { type: 'ringing'; from: string }
  | { type: 'accepted'; from: string }
  | { type: 'rejected'; from: string }
  | { type: 'hangup'; from: string }
  | { type: 'offer'; from: string; sdp: string }
  | { type: 'answer'; from: string; sdp: string }
  | { type: 'ice'; from: string; candidate: RTCIceCandidateInit };

const channelName = (callId: string) => `call:${callId}`;

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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelReadyRef = useRef(false);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const closedRef = useRef(false);
  const acceptedRef = useRef(false);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteDescRef = useRef(false);
  // Buffer for ICE candidates generated before the channel is subscribed.
  const outboundIceBufferRef = useRef<RTCIceCandidateInit[]>([]);
  // Callee has pressed "accept" but is still waiting for the real SDP offer.
  const answerPendingRef = useRef(false);
  // Caller keeps the local SDP offer so it can be (re)sent when the callee
  // signals "ringing" — i.e. once we know they have subscribed to the
  // per-call channel. Supabase broadcasts are not buffered, so the first
  // offer sent on SUBSCRIBED can be missed if the callee joined later.
  const localOfferSdpRef = useRef<string>('');
  // Callee stores the SDP offer received over the per-call channel while
  // the user is still deciding whether to accept. Using this avoids opening
  // micro/caméra before consent.
  const bufferedOfferSdpRef = useRef<string>('');

  const constraints = useMemo(
    () => ({ audio: true, video: mode === 'video' }),
    [mode],
  );

  const sendEvent = useCallback(
    (event: CallEvent) => {
      const ch = channelRef.current;
      if (!ch) return;
      ch.send({ type: 'broadcast', event: 'call', payload: event }).catch(
        (e) => console.warn('[call] send failed', e),
      );
    },
    [],
  );

  const flushOutboundIce = useCallback(() => {
    if (!channelReadyRef.current) return;
    const pending = outboundIceBufferRef.current;
    outboundIceBufferRef.current = [];
    for (const c of pending) {
      sendEvent({ type: 'ice', from: myId, candidate: c });
    }
  }, [sendEvent, myId]);

  const cleanup = useCallback(
    (result: {
      status: 'accepted' | 'rejected' | 'missed' | 'ended';
      duration: number;
    }) => {
      if (closedRef.current) return;
      closedRef.current = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
      try {
        pcRef.current?.getSenders().forEach((s) => s.track?.stop());
        pcRef.current?.close();
      } catch {
        // ignore
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {
          // ignore
        }
        channelRef.current = null;
      }
      onClose(result);
    },
    [onClose],
  );

  const endCall = useCallback(
    async (kind: 'hangup' | 'reject') => {
      if (kind === 'reject') {
        sendEvent({ type: 'rejected', from: myId });
        cleanup({ status: 'rejected', duration: 0 });
      } else {
        sendEvent({ type: 'hangup', from: myId });
        const duration = acceptedRef.current
          ? Math.floor((Date.now() - startedAtRef.current) / 1000)
          : 0;
        cleanup({
          status: acceptedRef.current ? 'ended' : 'missed',
          duration,
        });
      }
    },
    [sendEvent, myId, cleanup],
  );

  const startTimer = useCallback(() => {
    if (acceptedRef.current) return;
    acceptedRef.current = true;
    startedAtRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
  }, []);

  const setupPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      const cand = ev.candidate.toJSON();
      if (channelReadyRef.current) {
        sendEvent({ type: 'ice', from: myId, candidate: cand });
      } else {
        outboundIceBufferRef.current.push(cand);
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
      if (st === 'failed' || st === 'disconnected' || st === 'closed') {
        if (!closedRef.current && acceptedRef.current) {
          cleanup({
            status: 'ended',
            duration: Math.floor((Date.now() - startedAtRef.current) / 1000),
          });
        }
      }
    };

    return pc;
  }, [sendEvent, myId, mode, cleanup]);

  const getMedia = useCallback(async () => {
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
      console.error('[call] getUserMedia failed', e);
      setError("Impossible d'accéder au micro/caméra");
      return null;
    }
  }, [constraints, mode]);

  const applyPendingIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !hasRemoteDescRef.current) return;
    const pending = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const c of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.warn('[call] addIceCandidate (buffered) failed', e);
      }
    }
  }, []);

  // Handle an incoming realtime event from the peer.
  const handleEvent = useCallback(
    async (ev: CallEvent) => {
      if (ev.from === myId) return; // ignore self
      const pc = pcRef.current;
      if (ev.type === 'ringing') {
        // Peer is on the channel and ringing. Resend the offer to guarantee
        // delivery (broadcasts are not buffered by Supabase).
        if (direction === 'outgoing' && localOfferSdpRef.current) {
          sendEvent({ type: 'offer', from: myId, sdp: localOfferSdpRef.current });
        }
        setStatus('calling');
      } else if (ev.type === 'accepted') {
        // Peer pressed accept. Actual media connection will be driven by answer+ice.
        // This marks the call as accepted even if SDP answer takes a bit.
        if (!acceptedRef.current) startTimer();
        setStatus('connected');
      } else if (ev.type === 'rejected') {
        cleanup({ status: 'rejected', duration: 0 });
      } else if (ev.type === 'hangup') {
        const duration = acceptedRef.current
          ? Math.floor((Date.now() - startedAtRef.current) / 1000)
          : 0;
        cleanup({
          status: acceptedRef.current ? 'ended' : 'missed',
          duration,
        });
      } else if (ev.type === 'offer') {
        // Only meaningful if we're the callee. Buffer the SDP until the user
        // presses "accept" (we don't want to getUserMedia before consent).
        if (direction !== 'incoming') return;
        bufferedOfferSdpRef.current = ev.sdp;
        if (answerPendingRef.current && pc) {
          try {
            await pc.setRemoteDescription({ type: 'offer', sdp: ev.sdp });
            hasRemoteDescRef.current = true;
            await applyPendingIce();
            answerPendingRef.current = false;
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendEvent({ type: 'answer', from: myId, sdp: answer.sdp || '' });
            flushOutboundIce();
          } catch (e) {
            console.error('[call] setRemoteDescription offer failed', e);
            setError('Échec de la connexion');
          }
        }
      } else if (ev.type === 'answer') {
        if (!pc) return;
        try {
          await pc.setRemoteDescription({ type: 'answer', sdp: ev.sdp });
          hasRemoteDescRef.current = true;
          await applyPendingIce();
          if (!acceptedRef.current) startTimer();
          setStatus('connected');
        } catch (e) {
          console.error('[call] setRemoteDescription answer failed', e);
        }
      } else if (ev.type === 'ice') {
        if (!pc) return;
        if (!hasRemoteDescRef.current) {
          pendingIceRef.current.push(ev.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(ev.candidate));
        } catch (e) {
          console.warn('[call] addIceCandidate failed', e);
        }
      }
    },
    [myId, direction, cleanup, startTimer, applyPendingIce, sendEvent],
  );

  // Outgoing caller: create & send offer once channel is ready. The offer is
  // also cached so we can resend it on the first `ringing` event from the
  // callee, guaranteeing delivery even if the callee subscribed late.
  const startOutgoing = useCallback(async () => {
    setupPeer();
    const stream = await getMedia();
    if (!stream) return;
    const pc = pcRef.current!;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      localOfferSdpRef.current = offer.sdp || '';
      sendEvent({ type: 'offer', from: myId, sdp: offer.sdp || '' });
      flushOutboundIce();
    } catch (e) {
      console.error('[call] createOffer failed', e);
      setError('Échec de la création de l\'appel');
    }
  }, [setupPeer, getMedia, sendEvent, myId, flushOutboundIce]);

  // Incoming callee: on user "accept". Pick up the SDP offer from whichever
  // source already has it (initialOffer, or a buffered offer received over
  // the per-call channel while the phone was ringing). If none yet, flag
  // answerPendingRef so the next 'offer' event finishes the handshake.
  const acceptIncoming = useCallback(async () => {
    console.info('[call] acceptIncoming pressed', { callId, peerId });
    setupPeer();
    const stream = await getMedia();
    if (!stream) {
      console.error('[call] acceptIncoming aborted: no media stream');
      return;
    }
    // Signal "accepted" immediately so the caller's UI can flip to connected.
    sendEvent({ type: 'accepted', from: myId });
    flushOutboundIce();
    startTimer();
    setStatus('connected');

    const pc = pcRef.current!;
    const sdp =
      (initialOffer && initialOffer.sdp) || bufferedOfferSdpRef.current || '';

    if (sdp) {
      try {
        await pc.setRemoteDescription({ type: 'offer', sdp });
        hasRemoteDescRef.current = true;
        await applyPendingIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendEvent({ type: 'answer', from: myId, sdp: answer.sdp || '' });
        flushOutboundIce();
        console.info('[call] answer sent');
      } catch (e) {
        console.error('[call] answer creation failed', e);
        setError('Échec de la connexion');
      }
    } else {
      // SDP will come through the realtime 'offer' event.
      console.info('[call] waiting for offer SDP after accept');
      answerPendingRef.current = true;
      // Nudge the caller in case they were waiting for a second 'ringing'
      // roundtrip. The caller resends its offer on any 'ringing' event.
      sendEvent({ type: 'ringing', from: myId });
    }
  }, [
    callId,
    peerId,
    initialOffer,
    setupPeer,
    getMedia,
    sendEvent,
    myId,
    applyPendingIce,
    flushOutboundIce,
    startTimer,
  ]);

  const reject = useCallback(() => {
    endCall('reject');
  }, [endCall]);

  // Subscribe to the per-call Realtime channel, then either initiate (outgoing)
  // or announce "ringing" (incoming).
  useEffect(() => {
    const ch = supabase.channel(channelName(callId), {
      config: { broadcast: { self: false, ack: false } },
    });
    channelRef.current = ch;

    ch.on('broadcast', { event: 'call' }, (msg) => {
      const payload = msg.payload as CallEvent | undefined;
      if (payload) {
        void handleEvent(payload);
      }
    });

    ch.subscribe((state) => {
      if (state === 'SUBSCRIBED') {
        channelReadyRef.current = true;
        if (direction === 'outgoing') {
          void startOutgoing();
        } else {
          // Tell the caller we're alerting the user.
          sendEvent({ type: 'ringing', from: myId });
        }
      }
    });

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
            <div className="text-sm text-white/70 mb-6 text-center">
              {status === 'calling' &&
                `Appel ${mode === 'video' ? 'vidéo' : 'vocal'} en cours...`}
              {status === 'ringing' &&
                `Appel ${mode === 'video' ? 'vidéo' : 'vocal'} entrant`}
              {status === 'connected' &&
                (mode === 'voice' ? formatDuration(elapsed) : '')}
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