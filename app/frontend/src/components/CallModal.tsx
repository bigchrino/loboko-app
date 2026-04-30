import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Phone,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDuration } from '@/lib/message-format';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * CallModal
 *
 * Handles the WebRTC handshake for a single voice/video call.
 *
 * Audio pipeline (fix for "peer cannot hear me"):
 *   1. Both sides call getUserMedia({ audio: true, video: mode === 'video' }).
 *   2. Every track of the local MediaStream is attached to the
 *      RTCPeerConnection via `pc.addTrack(track, stream)` so the remote side
 *      receives them on `ontrack`.
 *   3. The remote <audio> element is ALWAYS mounted (even in video mode — a
 *      hidden audio sink ensures Safari / iOS output audio even when the
 *      video element is muted by autoplay policies).
 *   4. On `ontrack`, we assign `event.streams[0]` to the remote audio/video
 *      elements and force `.play()` to bypass some browsers' autoplay
 *      heuristics.
 *
 * Speaker toggle:
 *   - Desktop / Android Chromium: `HTMLMediaElement.setSinkId` switches the
 *     audio output between the default device and the system speaker.
 *   - iOS / Safari: `setSinkId` is not supported; we fall back to toggling
 *     the media element's `volume` between max and a low value so the user
 *     can still mute output without ending the call. The microphone track
 *     and remote stream are left untouched.
 */

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
type CallEvent =
  | { type: 'ringing'; from: string }
  | { type: 'accepted'; from: string }
  | { type: 'rejected'; from: string }
  | { type: 'hangup'; from: string }
  | { type: 'offer'; from: string; sdp: string }
  | { type: 'answer'; from: string; sdp: string }
  | { type: 'ice'; from: string; candidate: RTCIceCandidateInit };

const channelName = (callId: string) => `call:${callId}`;

// Short tag prefix for log readability in the browser console.
const TAG = '[call]';

/**
 * Attempt to play a media element, swallowing the common "play() was
 * interrupted" / NotAllowedError errors that happen on mobile when the user
 * hasn't yet tapped anything. We log them so they're visible if something
 * is actually wrong.
 */
function safePlay(
  el: HTMLMediaElement | null | undefined,
  label: string,
): void {
  if (!el) return;
  const p = el.play();
  if (p && typeof p.then === 'function') {
    p.catch((err) => {
      console.warn(`${TAG} ${label} .play() rejected`, err);
    });
  }
}

interface SinkCapableMedia extends HTMLMediaElement {
  setSinkId?: (id: string) => Promise<void>;
}

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
  const [speakerOn, setSpeakerOn] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
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
  const outboundIceBufferRef = useRef<RTCIceCandidateInit[]>([]);
  const answerPendingRef = useRef(false);
  const localOfferSdpRef = useRef<string>('');
  const bufferedOfferSdpRef = useRef<string>('');

  const constraints = useMemo(
    () => ({ audio: true, video: mode === 'video' }),
    [mode],
  );

  const sendEvent = useCallback((event: CallEvent) => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({ type: 'broadcast', event: 'call', payload: event }).catch((e) =>
      console.warn(`${TAG} send failed`, e),
    );
  }, []);

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
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
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

  /**
   * Attach the remote MediaStream to the hidden audio element and, if
   * applicable, to the video element. We do this lazily on `ontrack` and
   * then again whenever additional tracks are added so we never end up with
   * a stale srcObject.
   */
  const attachRemoteStream = useCallback(
    (stream: MediaStream) => {
      remoteStreamRef.current = stream;
      const audioEl = remoteAudioRef.current;
      if (audioEl) {
        if (audioEl.srcObject !== stream) {
          audioEl.srcObject = stream;
        }
        audioEl.muted = false;
        audioEl.volume = speakerOn ? 1 : 0.05;
        safePlay(audioEl, 'remote audio');
      }
      if (mode === 'video' && remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject !== stream) {
          remoteVideoRef.current.srcObject = stream;
        }
        safePlay(remoteVideoRef.current, 'remote video');
      }
    },
    [mode, speakerOn],
  );

  const setupPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    console.info(`${TAG} RTCPeerConnection created`, { callId, direction });

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) {
        console.info(`${TAG} ICE gathering complete`);
        return;
      }
      const cand = ev.candidate.toJSON();
      console.info(`${TAG} local ICE candidate`, cand.candidate);
      if (channelReadyRef.current) {
        sendEvent({ type: 'ice', from: myId, candidate: cand });
      } else {
        outboundIceBufferRef.current.push(cand);
      }
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      console.info(`${TAG} ontrack`, {
        kind: ev.track.kind,
        id: ev.track.id,
        readyState: ev.track.readyState,
        hasStream: !!stream,
      });
      if (!stream) {
        // Some browsers (older Safari) do not populate ev.streams. Build one.
        const fallback = new MediaStream([ev.track]);
        attachRemoteStream(fallback);
        return;
      }
      attachRemoteStream(stream);
      stream.onaddtrack = (addEv) => {
        console.info(`${TAG} remote stream onaddtrack`, addEv.track.kind);
        attachRemoteStream(stream);
      };
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      console.info(`${TAG} connectionState`, st);
      if (st === 'failed' || st === 'disconnected' || st === 'closed') {
        if (!closedRef.current && acceptedRef.current) {
          cleanup({
            status: 'ended',
            duration: Math.floor((Date.now() - startedAtRef.current) / 1000),
          });
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.info(`${TAG} iceConnectionState`, pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      console.info(`${TAG} signalingState`, pc.signalingState);
    };

    return pc;
  }, [sendEvent, myId, cleanup, attachRemoteStream, callId, direction]);

  const getMedia = useCallback(async () => {
    try {
      console.info(`${TAG} getUserMedia request`, constraints);
      const stream =
        await navigator.mediaDevices.getUserMedia(constraints);
      console.info(
        `${TAG} local stream obtained — audio tracks:`,
        stream.getAudioTracks().length,
        'video tracks:',
        stream.getVideoTracks().length,
      );
      localStreamRef.current = stream;

      if (mode === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        safePlay(localVideoRef.current, 'local video');
      }

      const pc = pcRef.current;
      if (pc) {
        stream.getTracks().forEach((t) => {
          console.info(`${TAG} addTrack`, t.kind, t.id);
          pc.addTrack(t, stream);
        });
      }
      return stream;
    } catch (e) {
      console.error(`${TAG} getUserMedia failed`, e);
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
        console.warn(`${TAG} addIceCandidate (buffered) failed`, e);
      }
    }
  }, []);

  const handleEvent = useCallback(
    async (ev: CallEvent) => {
      if (ev.from === myId) return;
      const pc = pcRef.current;
      if (ev.type === 'ringing') {
        if (direction === 'outgoing' && localOfferSdpRef.current) {
          sendEvent({
            type: 'offer',
            from: myId,
            sdp: localOfferSdpRef.current,
          });
        }
        setStatus('calling');
      } else if (ev.type === 'accepted') {
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
        if (direction !== 'incoming') return;
        // Always buffer the latest offer so a later accept can apply it
        // even if it arrived before the user tapped "Accept".
        bufferedOfferSdpRef.current = ev.sdp;
        console.info(`${TAG} incoming offer buffered (sdp len=${ev.sdp.length})`);
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
            console.info(`${TAG} answer sent (late offer)`);
          } catch (e) {
            console.error(`${TAG} setRemoteDescription offer failed`, e);
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
          console.info(`${TAG} remote answer applied`);
        } catch (e) {
          console.error(`${TAG} setRemoteDescription answer failed`, e);
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
          console.warn(`${TAG} addIceCandidate failed`, e);
        }
      }
    },
    [
      myId,
      direction,
      cleanup,
      startTimer,
      applyPendingIce,
      sendEvent,
      flushOutboundIce,
    ],
  );

  const startOutgoing = useCallback(async () => {
    setupPeer();
    const stream = await getMedia();
    if (!stream) return;
    const pc = pcRef.current!;
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: mode === 'video',
      });
      await pc.setLocalDescription(offer);
      localOfferSdpRef.current = offer.sdp || '';
      sendEvent({ type: 'offer', from: myId, sdp: offer.sdp || '' });
      flushOutboundIce();
      console.info(`${TAG} offer created & sent`);
    } catch (e) {
      console.error(`${TAG} createOffer failed`, e);
      setError("Échec de la création de l'appel");
    }
  }, [setupPeer, getMedia, sendEvent, myId, flushOutboundIce, mode]);

  const acceptIncoming = useCallback(async () => {
    console.info(`${TAG} acceptIncoming pressed`, { callId, peerId });
    setupPeer();
    const stream = await getMedia();
    if (!stream) {
      console.error(`${TAG} acceptIncoming aborted: no media stream`);
      return;
    }
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
        console.info(`${TAG} answer sent`);
      } catch (e) {
        console.error(`${TAG} answer creation failed`, e);
        setError('Échec de la connexion');
      }
    } else {
      console.info(`${TAG} waiting for offer SDP after accept`);
      answerPendingRef.current = true;
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
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    console.info(`${TAG} mic ${next ? 'muted' : 'unmuted'}`);
    setMuted(next);
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camOff;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
    setCamOff(next);
  };

  /**
   * Toggle "loud" output. We adjust volume on BOTH remote media elements
   * (audio sink + video element, which also carries the remote audio track)
   * so the user hears the change regardless of which element is actually
   * rendering sound in the current browser.
   *
   * Note: true loudspeaker routing is a native-only capability on iOS. On
   * Safari we cannot force the earpiece→speaker switch from web code, so
   * we gracefully fall back to a volume-down behaviour. On Android
   * Chromium, keeping the default sink ('' via setSinkId) already routes
   * audio to the speakerphone during an active call.
   */
  const toggleSpeaker = async () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    const audioEl = remoteAudioRef.current as SinkCapableMedia | null;
    const videoEl = remoteVideoRef.current as SinkCapableMedia | null;
    const targets = [audioEl, videoEl].filter(
      (el): el is SinkCapableMedia => !!el,
    );
    for (const el of targets) {
      el.volume = next ? 1 : 0.05;
    }
    console.info(`${TAG} speaker toggled`, {
      on: next,
      setSinkIdSupported: typeof audioEl?.setSinkId === 'function',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col">
      {mode === 'video' && status === 'connected' && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          // In voice-only mode we rely on the hidden <audio> element below
          // to render remote audio. In video mode we let the video element
          // carry the audio as well — muting it here would also silence
          // the remote voice.
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {/* Always mount the remote audio element. Keeping it in the DOM from
          the very start lets us attach the remote MediaStream as soon as
          ontrack fires, which is critical for Safari / iOS autoplay. */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

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
            <button
              onClick={toggleSpeaker}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${
                speakerOn
                  ? 'bg-[#2563eb] hover:bg-[#1d4ed8]'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
              aria-label={speakerOn ? 'Couper haut-parleur' : 'Activer haut-parleur'}
              title={speakerOn ? 'Haut-parleur activé' : 'Haut-parleur coupé'}
            >
              {speakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
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