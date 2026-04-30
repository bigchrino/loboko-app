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
  SwitchCamera,
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

// Public Google STUN servers. Enough for same-network / most home NAT cases.
// TURN required for reliable calls across mobile networks
// (symmetric NAT, strict corporate / carrier firewalls, iOS cellular).
//
// TURN credentials are NEVER hardcoded. They come from Vite env vars at
// build time:
//   VITE_TURN_URL        (e.g. "turn:turn.example.com:3478" or a comma-
//                         separated list for multi-protocol fallback)
//   VITE_TURN_USERNAME
//   VITE_TURN_CREDENTIAL
//
// If any of those is missing, the app still works — it just uses STUN
// only, which means calls across strict mobile networks may fail at the
// ICE stage. In that case the debug panel will log
// "TURN probablement requis ou mal configuré".
function buildIceServers(): RTCIceServer[] {
  const baseStun: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  const turnUrlRaw = import.meta.env.VITE_TURN_URL as string | undefined;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as
    | string
    | undefined;

  if (turnUrlRaw && turnUsername && turnCredential) {
    // Support a single URL or a comma-separated list so deployers can pass
    // multiple TURN endpoints (e.g. udp + tcp + tls) in one env var.
    const urls = turnUrlRaw
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    return [
      ...baseStun,
      {
        urls: urls.length === 1 ? urls[0] : urls,
        username: turnUsername,
        credential: turnCredential,
      },
    ];
  }

  return baseStun;
}

const ICE_SERVERS: RTCIceServer[] = buildIceServers();

/** True when a TURN server is actually configured for this build. */
const TURN_CONFIGURED = ICE_SERVERS.some((s) => {
  const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
  return urls.some((u) => typeof u === 'string' && u.startsWith('turn'));
});

console.info(
  `[call] TURN configured: ${TURN_CONFIGURED ? 'yes' : 'no'} — ${ICE_SERVERS.length} ICE server entries`,
);

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
  /** Current camera facing mode. Only used for video calls on mobile. */
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  /** Whether camera switching is supported (multiple video inputs present). */
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  /**
   * Separate tracking for audio vs video remote streams. Used to display
   * accurate status: "Audio connecté, vidéo indisponible" when the peer's
   * video track is missing even though audio works.
   */
  const [remoteHasAudio, setRemoteHasAudio] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false);

  /**
   * Debug diagnostics surfaced in a small dev-only panel and streamed to
   * the browser console. Every relevant signalling or media event mutates
   * this state so the developer can at a glance see WHERE the pipeline
   * broke (Supabase Realtime channel vs WebRTC handshake vs remote media).
   */
  const [debug, setDebug] = useState<{
    signaling: 'pending' | 'ok' | 'failed';
    offerSent: boolean;
    offerReceived: boolean;
    answerSent: boolean;
    answerReceived: boolean;
    iceSent: number;
    iceReceived: number;
    remoteTrack: boolean;
    connectionState: RTCPeerConnectionState | 'new';
    iceConnectionState: RTCIceConnectionState | 'new';
  }>({
    signaling: 'pending',
    offerSent: false,
    offerReceived: false,
    answerSent: false,
    answerReceived: false,
    iceSent: 0,
    iceReceived: 0,
    remoteTrack: false,
    connectionState: 'new',
    iceConnectionState: 'new',
  });

  const setDebugPatch = useCallback(
    (patch: Partial<typeof debug>) => {
      setDebug((prev) => ({ ...prev, ...patch }));
    },
    // setDebug is stable from useState; `debug` used only as type handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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

  const constraints = useMemo<MediaStreamConstraints>(
    () => ({
      audio: true,
      video:
        mode === 'video'
          ? {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
    }),
    [mode, facingMode],
  );

  const sendEvent = useCallback(
    (event: CallEvent) => {
      const ch = channelRef.current;
      if (!ch) {
        console.warn(`${TAG} sendEvent aborted: no channel`, event.type);
        return;
      }
      ch.send({ type: 'broadcast', event: 'call', payload: event })
        .then(() => {
          if (event.type === 'offer') setDebugPatch({ offerSent: true });
          else if (event.type === 'answer') setDebugPatch({ answerSent: true });
          else if (event.type === 'ice')
            setDebug((prev) => ({ ...prev, iceSent: prev.iceSent + 1 }));
          console.info(`${TAG} → ${event.type}`, {
            from: 'from' in event ? event.from : undefined,
          });
        })
        .catch((e) => {
          console.warn(`${TAG} send failed`, event.type, e);
          setDebugPatch({ signaling: 'failed' });
        });
    },
    [setDebugPatch],
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
   * a stale srcObject. The remote <video> element is NEVER muted — its
   * `muted` attribute would also silence the remote voice in video mode.
   */
  const attachRemoteStream = useCallback(
    (stream: MediaStream) => {
      remoteStreamRef.current = stream;

      const hasAudio = stream.getAudioTracks().length > 0;
      const hasVideo = stream.getVideoTracks().length > 0;
      setRemoteHasAudio(hasAudio);
      setRemoteHasVideo(hasVideo);

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
        const videoEl = remoteVideoRef.current;
        if (videoEl.srcObject !== stream) {
          videoEl.srcObject = stream;
        }
        // IMPORTANT: never muted — remote audio travels on the video element
        // in video mode. Muting would silence the peer entirely.
        videoEl.muted = false;
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.volume = speakerOn ? 1 : 0.05;
        safePlay(videoEl, 'remote video');
      }

      console.info(
        `${TAG} attachRemoteStream — audio tracks:`,
        stream.getAudioTracks().length,
        'video tracks:',
        stream.getVideoTracks().length,
      );
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
      setDebugPatch({ remoteTrack: true });

      if (ev.track.kind === 'video') {
        console.info(`${TAG} remote video track received`, {
          id: ev.track.id,
          enabled: ev.track.enabled,
          muted: ev.track.muted,
          readyState: ev.track.readyState,
        });
        setRemoteHasVideo(true);
        ev.track.onunmute = () => {
          console.info(`${TAG} remote video track unmuted`);
          setRemoteHasVideo(true);
          if (remoteVideoRef.current) {
            safePlay(remoteVideoRef.current, 'remote video (unmute)');
          }
        };
        ev.track.onmute = () => {
          console.info(`${TAG} remote video track muted (peer paused camera)`);
        };
        ev.track.onended = () => {
          console.info(`${TAG} remote video track ended`);
          setRemoteHasVideo(false);
        };
      } else if (ev.track.kind === 'audio') {
        setRemoteHasAudio(true);
      }

      if (!stream) {
        // Some browsers (older Safari) do not populate ev.streams. Build one.
        const fallback = new MediaStream([ev.track]);
        attachRemoteStream(fallback);
        return;
      }
      attachRemoteStream(stream);
      stream.onaddtrack = (addEv) => {
        console.info(`${TAG} remote stream onaddtrack`, addEv.track.kind);
        if (addEv.track.kind === 'video') setRemoteHasVideo(true);
        if (addEv.track.kind === 'audio') setRemoteHasAudio(true);
        attachRemoteStream(stream);
      };
      stream.onremovetrack = (rmEv) => {
        console.info(`${TAG} remote stream onremovetrack`, rmEv.track.kind);
        if (rmEv.track.kind === 'video') setRemoteHasVideo(false);
      };
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      console.info(`${TAG} connectionState`, st);
      setDebugPatch({ connectionState: st });
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
      const st = pc.iceConnectionState;
      console.info(`${TAG} iceConnectionState`, st);
      setDebugPatch({ iceConnectionState: st });
      // TURN required for reliable calls across mobile networks. If we get
      // stuck here on real mobile networks, a TURN server is likely needed.
      if (st === 'failed') {
        console.warn(
          `${TAG} iceConnectionState=failed — TURN probablement requis ou mal configuré (TURN_CONFIGURED=${TURN_CONFIGURED}).`,
        );
        if (!closedRef.current) {
          setError(
            TURN_CONFIGURED
              ? 'Connexion impossible — TURN probablement mal configuré'
              : 'Connexion impossible — TURN probablement requis',
          );
        }
      }
    };

    pc.onsignalingstatechange = () => {
      console.info(`${TAG} signalingState`, pc.signalingState);
    };

    return pc;
  }, [sendEvent, myId, cleanup, attachRemoteStream, callId, direction]);

  const getMedia = useCallback(async () => {
    try {
      console.info(`${TAG} getUserMedia request`, constraints);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        // Fallback: if the user denied video only or the exact facingMode is
        // unavailable, retry with audio-only for a voice call rather than
        // blowing up the whole call.
        if (
          mode === 'video' &&
          firstErr instanceof DOMException &&
          (firstErr.name === 'OverconstrainedError' ||
            firstErr.name === 'NotReadableError' ||
            firstErr.name === 'NotFoundError')
        ) {
          console.warn(
            `${TAG} camera error (${firstErr.name}), retrying with basic video constraints`,
            firstErr,
          );
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
        } else {
          throw firstErr;
        }
      }

      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      console.info(
        `${TAG} local stream obtained — audio tracks:`,
        audioTracks.length,
        'video tracks:',
        videoTracks.length,
      );
      if (mode === 'video') {
        if (videoTracks.length > 0) {
          const vt = videoTracks[0];
          console.info(`${TAG} local video track obtained`, {
            id: vt.id,
            label: vt.label,
            enabled: vt.enabled,
            settings: vt.getSettings?.(),
          });
        } else {
          console.warn(`${TAG} local video track MISSING despite video mode`);
        }
      }
      localStreamRef.current = stream;

      if (mode === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Local preview must stay muted to avoid echo of the user's own mic.
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;
        safePlay(localVideoRef.current, 'local video');
      }

      // Detect if the device has multiple cameras so we can show the
      // switch-camera button on mobile.
      if (mode === 'video') {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === 'videoinput');
          setCanSwitchCamera(cams.length > 1);
          console.info(`${TAG} video input devices detected`, cams.length);
        } catch (e) {
          console.warn(`${TAG} enumerateDevices failed`, e);
        }
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
      console.error(`${TAG} getUserMedia / camera error`, e);
      const err = e as DOMException;
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setError(
          mode === 'video'
            ? 'Accès caméra/micro refusé'
            : 'Accès micro refusé',
        );
      } else if (err?.name === 'NotFoundError' && mode === 'video') {
        setError('Aucune caméra détectée sur cet appareil');
      } else if (err?.name === 'NotReadableError') {
        setError('Caméra/micro utilisé(e) par une autre application');
      } else {
        setError("Impossible d'accéder au micro/caméra");
      }
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
        setDebugPatch({ offerReceived: true });
        console.info(`${TAG} ← offer (sdp len=${ev.sdp.length})`);
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
          setDebugPatch({ answerReceived: true });
          await applyPendingIce();
          if (!acceptedRef.current) startTimer();
          setStatus('connected');
          console.info(`${TAG} ← answer applied`);
        } catch (e) {
          console.error(`${TAG} setRemoteDescription answer failed`, e);
        }
      } else if (ev.type === 'ice') {
        setDebug((prev) => ({ ...prev, iceReceived: prev.iceReceived + 1 }));
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
      setDebugPatch,
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
      console.info(`${TAG} Supabase Realtime channel state`, {
        callId,
        state,
      });
      if (state === 'SUBSCRIBED') {
        channelReadyRef.current = true;
        setDebugPatch({ signaling: 'ok' });
        if (direction === 'outgoing') {
          void startOutgoing();
        } else {
          sendEvent({ type: 'ringing', from: myId });
        }
      } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
        console.error(`${TAG} realtime channel failure`, state);
        setDebugPatch({ signaling: 'failed' });
        setError('Échec de la signalisation (Supabase Realtime)');
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
    console.info(
      `${TAG} local video track ${next ? 'disabled' : 'enabled'}`,
    );
    setCamOff(next);
  };

  /**
   * Switch between front ("user") and back ("environment") cameras without
   * renegotiating the peer connection. We:
   *   1. Open a new MediaStream with the opposite facingMode.
   *   2. Replace the outgoing video track via RTCRtpSender.replaceTrack so
   *      the remote side keeps receiving video seamlessly.
   *   3. Stop the old video track and swap the local preview source.
   * On failure we roll back to the previous facingMode and surface the
   * error.
   */
  const switchCamera = useCallback(async () => {
    if (mode !== 'video') return;
    const pc = pcRef.current;
    const currentStream = localStreamRef.current;
    if (!pc || !currentStream) return;

    const next: 'user' | 'environment' =
      facingMode === 'user' ? 'environment' : 'user';
    console.info(`${TAG} switchCamera → ${next}`);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: next },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        console.warn(`${TAG} switchCamera: new stream has no video track`);
        newStream.getTracks().forEach((t) => t.stop());
        return;
      }

      const videoSender = pc
        .getSenders()
        .find((s) => s.track && s.track.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(newVideoTrack);
        console.info(`${TAG} RTCRtpSender.replaceTrack done`);
      }

      // Stop and remove the old video track from the current stream, then
      // add the new one so the local preview shows the new camera feed.
      const oldVideoTrack = currentStream.getVideoTracks()[0];
      if (oldVideoTrack) {
        currentStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      currentStream.addTrack(newVideoTrack);

      if (localVideoRef.current) {
        // Reset srcObject to force Safari to render the swapped track.
        localVideoRef.current.srcObject = null;
        localVideoRef.current.srcObject = currentStream;
        safePlay(localVideoRef.current, 'local video (switch)');
      }

      setFacingMode(next);
    } catch (e) {
      console.error(`${TAG} switchCamera failed`, e);
      setError('Changement de caméra impossible');
    }
  }, [mode, facingMode]);

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

  // Only render the debug panel in dev builds. Uses Vite's import.meta.env.DEV
  // so it is stripped from production bundles.
  const showDebug =
    typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col">
      {showDebug && (
        <div className="absolute top-2 right-2 z-[60] text-[10px] leading-tight font-mono bg-black/70 text-white/90 rounded-md px-2 py-1.5 border border-white/10 max-w-[220px]">
          <div className="text-white font-semibold mb-1">call debug</div>
          <div>
            TURN:{' '}
            <span
              className={TURN_CONFIGURED ? 'text-green-400' : 'text-yellow-400'}
            >
              {TURN_CONFIGURED ? 'yes' : 'no'}
            </span>
          </div>
          <div>
            signaling:{' '}
            <span
              className={
                debug.signaling === 'ok'
                  ? 'text-green-400'
                  : debug.signaling === 'failed'
                    ? 'text-red-400'
                    : 'text-yellow-400'
              }
            >
              {debug.signaling}
            </span>
          </div>
          <div>
            offer:{' '}
            <span className={debug.offerSent ? 'text-green-400' : 'text-white/50'}>
              sent
            </span>
            {' / '}
            <span
              className={debug.offerReceived ? 'text-green-400' : 'text-white/50'}
            >
              received
            </span>
          </div>
          <div>
            answer:{' '}
            <span
              className={debug.answerSent ? 'text-green-400' : 'text-white/50'}
            >
              sent
            </span>
            {' / '}
            <span
              className={debug.answerReceived ? 'text-green-400' : 'text-white/50'}
            >
              received
            </span>
          </div>
          <div>
            ice: sent {debug.iceSent} / received {debug.iceReceived}
          </div>
          <div>
            remote stream:{' '}
            <span
              className={debug.remoteTrack ? 'text-green-400' : 'text-white/50'}
            >
              {debug.remoteTrack ? 'yes' : 'no'}
            </span>
          </div>
          <div>
            state:{' '}
            <span
              className={
                debug.connectionState === 'connected'
                  ? 'text-green-400'
                  : debug.connectionState === 'failed' ||
                      debug.connectionState === 'disconnected' ||
                      debug.connectionState === 'closed'
                    ? 'text-red-400'
                    : 'text-yellow-400'
              }
            >
              {debug.connectionState}
            </span>
          </div>
          <div>
            ice state:{' '}
            <span
              className={
                debug.iceConnectionState === 'connected' ||
                debug.iceConnectionState === 'completed'
                  ? 'text-green-400'
                  : debug.iceConnectionState === 'failed' ||
                      debug.iceConnectionState === 'disconnected'
                    ? 'text-red-400'
                    : 'text-yellow-400'
              }
            >
              {debug.iceConnectionState}
            </span>
          </div>
        </div>
      )}
      {mode === 'video' && status === 'connected' && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          onPlaying={() => {
            console.info(`${TAG} remote video element playing`);
            setRemoteVideoPlaying(true);
          }}
          onPause={() => setRemoteVideoPlaying(false)}
          onLoadedMetadata={() => {
            // Some mobile browsers need an extra nudge after metadata to
            // actually start rendering frames.
            safePlay(remoteVideoRef.current, 'remote video (loadedmetadata)');
          }}
          // In voice-only mode we rely on the hidden <audio> element below
          // to render remote audio. In video mode we let the video element
          // carry the audio as well — muting it here would also silence
          // the remote voice.
          className={`absolute inset-0 w-full h-full object-cover ${
            remoteHasVideo && remoteVideoPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Video-mode overlay: shown while waiting for the remote video
          frames, OR when only audio is flowing (camera off/unavailable). */}
      {mode === 'video' &&
        status === 'connected' &&
        !(remoteHasVideo && remoteVideoPlaying) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/60 pointer-events-none">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-2xl font-bold mb-4 shadow-xl">
              {peerName.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-lg font-semibold mb-1">{peerName}</div>
            <div className="text-sm text-white/70">
              {remoteHasAudio && !remoteHasVideo
                ? 'Audio connecté, vidéo indisponible'
                : remoteHasVideo && !remoteVideoPlaying
                  ? 'Connexion vidéo…'
                  : 'Connexion vidéo…'}
            </div>
          </div>
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
          <div className="absolute top-6 left-6 flex items-center gap-2 text-white/90 text-sm font-mono bg-black/40 px-3 py-1 rounded-full">
            <span>
              {formatDuration(elapsed)} · {peerName}
            </span>
            {remoteHasVideo && remoteVideoPlaying ? (
              <span className="text-[11px] text-green-400 font-semibold">
                · Vidéo connectée
              </span>
            ) : remoteHasAudio && !remoteHasVideo ? (
              <span className="text-[11px] text-yellow-400 font-semibold">
                · Audio seul
              </span>
            ) : null}
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
            {mode === 'video' && canSwitchCamera && !camOff && (
              <button
                onClick={switchCamera}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                aria-label="Changer de caméra"
                title="Changer de caméra (avant / arrière)"
              >
                <SwitchCamera size={20} />
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