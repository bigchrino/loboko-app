import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CallModal from '@/components/CallModal';
import { encodePayload } from '@/lib/message-format';

type CallResultStatus = 'accepted' | 'rejected' | 'missed' | 'ended';

/**
 * Global incoming-call listener + outgoing-call starter.
 *
 * - Every authenticated user subscribes to a personal realtime channel
 *   `user:<myId>` and listens for `call-invite` broadcasts. This makes
 *   incoming calls detectable from ANY page (Home, Notifications, Menu, ...).
 * - Calling `startCall(peerId, peerName, mode)` sends a `call-invite` to the
 *   target user's personal channel and opens the CallModal locally as the
 *   caller ("outgoing").
 * - The CallModal itself handles the full WebRTC signalling over a
 *   per-callId channel (`call:<callId>`). This context just bootstraps the
 *   modal into the right "direction" with the right `initialOffer`.
 */

type Mode = 'voice' | 'video';

interface ActiveCall {
  peerId: string;
  peerName: string;
  mode: Mode;
  direction: 'outgoing' | 'incoming';
  callId: string;
  initialOffer?: { sdp: string } | null;
}

interface InviteEvent {
  type: 'invite';
  callId: string;
  fromId: string;
  fromName: string;
  mode: Mode;
  sdp: string;
}

interface InviteCancelEvent {
  type: 'cancel';
  callId: string;
  fromId: string;
}

type InboxEvent = InviteEvent | InviteCancelEvent;

interface CallContextValue {
  /** Start an outgoing call. Caller provides the callee's id, display name and mode. */
  startCall: (
    peerId: string,
    peerName: string,
    mode: Mode,
  ) => Promise<void>;
  /** Whether a call modal is currently active. */
  inCall: boolean;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

const personalChannelName = (userId: string) => `user:${userId}`;
const randomCallId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function CallProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const myId = user?.id || '';
  const myName =
    profile?.display_name || profile?.username || user?.display_name || 'Moi';

  const [active, setActive] = useState<ActiveCall | null>(null);
  const [pendingInvite, setPendingInvite] = useState<InviteEvent | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const seenInvitesRef = useRef<Set<string>>(new Set());

  // Keep a ref of the active call id so the realtime listener can decide
  // whether to ignore a cancel event.
  useEffect(() => {
    activeCallIdRef.current = active?.callId ?? null;
  }, [active]);

  // Subscribe to the personal realtime channel so incoming call invites
  // arrive on any page.
  useEffect(() => {
    if (!myId) return;
    const ch = supabase.channel(personalChannelName(myId), {
      config: { broadcast: { self: false, ack: false } },
    });
    ch.on('broadcast', { event: 'call-invite' }, (msg) => {
      const payload = msg.payload as InboxEvent | undefined;
      if (!payload) return;
      if (payload.type === 'invite') {
        if (seenInvitesRef.current.has(payload.callId)) return;
        seenInvitesRef.current.add(payload.callId);
        // Ignore if we're already in a call.
        if (activeCallIdRef.current) {
          console.warn('[call] already in call, ignoring invite', payload.callId);
          return;
        }
        setPendingInvite(payload);
      } else if (payload.type === 'cancel') {
        if (
          pendingInvite &&
          pendingInvite.callId === payload.callId &&
          !activeCallIdRef.current
        ) {
          setPendingInvite(null);
        }
      }
    });
    ch.subscribe();
    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  // When a pending invite arrives, automatically open the CallModal in
  // "incoming" direction with the offer SDP. The user will see the
  // Accept/Reject UI on top of whichever page they are on.
  useEffect(() => {
    if (!pendingInvite) return;
    if (active) return;
    const peerName = pendingInvite.fromName || 'Utilisateur';
    const modeLabel = pendingInvite.mode === 'video' ? 'vidéo' : 'vocal';

    // Best-effort browser notification for incoming calls. Shown only when
    // the tab is hidden/backgrounded — otherwise the CallModal itself is
    // already visible on top of the current page.
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden' &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      try {
        const n = new Notification(`Appel ${modeLabel} entrant`, {
          body: `${peerName} vous appelle…`,
          tag: `call-${pendingInvite.callId}`,
          requireInteraction: true,
        });
        n.onclick = () => {
          try {
            window.focus();
          } catch {
            // ignore
          }
          n.close();
        };
      } catch (e) {
        console.warn('[call] notification failed', e);
      }
    }

    setActive({
      peerId: pendingInvite.fromId,
      peerName,
      mode: pendingInvite.mode,
      direction: 'incoming',
      callId: pendingInvite.callId,
      initialOffer: { sdp: pendingInvite.sdp },
    });
    setPendingInvite(null);
  }, [pendingInvite, active]);

  // Request Notification permission once for the authenticated session so
  // future incoming-call invites can surface a system notification when the
  // tab is in the background. Silently no-ops when the API is unavailable
  // or the user has already chosen.
  useEffect(() => {
    if (!myId) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    try {
      Notification.requestPermission().catch(() => undefined);
    } catch {
      // ignore — Safari older versions throw on callback-less API.
    }
  }, [myId]);

  const startCall = useCallback(
    async (peerId: string, peerName: string, mode: Mode) => {
      if (!myId) {
        console.warn('[call] startCall aborted: no authenticated user');
        return;
      }
      if (active) {
        console.warn('[call] startCall aborted: already in a call');
        return;
      }
      const callId = randomCallId();

      // NOTE: the real SDP is generated inside the CallModal and transmitted
      // over the per-call realtime channel. The invite only needs to tell
      // the callee "a call for you is starting, with this id and mode" so
      // they can open their CallModal, which will then join the per-call
      // channel and complete the WebRTC handshake.
      const sdp = '';

      // Broadcast the invite to the peer's personal channel.
      const peerChannel = supabase.channel(personalChannelName(peerId), {
        config: { broadcast: { self: false, ack: false } },
      });
      await new Promise<void>((resolve) => {
        peerChannel.subscribe((state) => {
          if (state === 'SUBSCRIBED') resolve();
        });
      });
      try {
        await peerChannel.send({
          type: 'broadcast',
          event: 'call-invite',
          payload: {
            type: 'invite',
            callId,
            fromId: myId,
            fromName: myName,
            mode,
            sdp,
          } satisfies InviteEvent,
        });
      } catch (e) {
        console.error('[call] send invite failed', e);
      } finally {
        try {
          supabase.removeChannel(peerChannel);
        } catch {
          // ignore
        }
      }

      // Also persist a lightweight "offer" row in messages so the callee can
      // detect a missed call later from the conversation history (kept for
      // backwards compatibility with the existing call log).
      try {
        await supabase.from('messages').insert({
          user_id: myId,
          receiver_id: peerId,
          content: encodePayload({
            kind: 'signal',
            callId,
            mode,
            signal: { type: 'offer', sdp: '' },
          }),
          read: false,
        });
      } catch (e) {
        // Non-fatal: the realtime invite is the primary mechanism.
        console.warn('[call] offer log insert failed', e);
      }

      setActive({
        peerId,
        peerName,
        mode,
        direction: 'outgoing',
        callId,
      });
    },
    [myId, myName, active],
  );

  const handleClose = useCallback(
    async (result: { status: CallResultStatus; duration: number }) => {
      const current = active;
      setActive(null);
      if (!current || !myId) return;
      // Persist a `call_event` in the messages table so the conversation
      // history shows "Appel manqué / refusé / durée". We log from whichever
      // side closed the modal; the sender is the current user.
      const event =
        result.status === 'rejected'
          ? 'rejected'
          : result.status === 'missed'
            ? 'missed'
            : 'ended';
      try {
        await supabase.from('messages').insert({
          user_id: myId,
          receiver_id: current.peerId,
          content: encodePayload({
            kind: 'call_event',
            mode: current.mode,
            event,
            callId: current.callId,
            duration: result.duration,
          }),
          read: false,
        });
      } catch (e) {
        console.warn('[call] log call_event failed', e);
      }
    },
    [active, myId],
  );

  return (
    <CallContext.Provider value={{ startCall, inCall: !!active }}>
      {children}
      {active && myId && (
        <CallModal
          key={active.callId}
          myId={myId}
          peerId={active.peerId}
          peerName={active.peerName}
          mode={active.mode}
          direction={active.direction}
          callId={active.callId}
          initialOffer={active.initialOffer}
          onClose={handleClose}
        />
      )}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}