// Helpers to encode/decode structured message payloads.
// Messages table has a single `content: string` column. We store JSON for
// non-text messages (voice notes, call events, WebRTC signaling) and plain
// text for regular chat messages.

export type TextPayload = { kind: 'text'; text: string };

export type AudioPayload = {
  kind: 'audio';
  object_key: string;
  duration: number; // seconds
};

export type ImagePayload = {
  kind: 'image';
  object_key: string;
  caption?: string;
};

export type VideoPayload = {
  kind: 'video';
  object_key: string;
  duration?: number; // seconds
  caption?: string;
};

export type CallEventPayload = {
  kind: 'call_event';
  mode: 'voice' | 'video';
  event: 'started' | 'accepted' | 'ended' | 'missed' | 'rejected';
  callId: string;
  duration?: number; // seconds, for 'ended'
};

export type SignalPayload = {
  kind: 'signal';
  callId: string;
  mode: 'voice' | 'video';
  signal:
    | { type: 'offer'; sdp: string }
    | { type: 'answer'; sdp: string }
    | { type: 'ice'; candidate: RTCIceCandidateInit }
    | { type: 'ringing' }
    | { type: 'reject' }
    | { type: 'hangup' };
};

export type MessagePayload =
  | TextPayload
  | AudioPayload
  | ImagePayload
  | VideoPayload
  | CallEventPayload
  | SignalPayload;

const PREFIX = '@@loboko:';

export function encodePayload(payload: MessagePayload): string {
  if (payload.kind === 'text') return payload.text;
  return PREFIX + JSON.stringify(payload);
}

export function decodePayload(raw: string | undefined | null): MessagePayload {
  if (!raw) return { kind: 'text', text: '' };
  if (raw.startsWith(PREFIX)) {
    try {
      const obj = JSON.parse(raw.slice(PREFIX.length));
      if (obj && typeof obj === 'object' && 'kind' in obj) {
        return obj as MessagePayload;
      }
    } catch {
      // fall through to text
    }
  }
  return { kind: 'text', text: raw };
}

export function isSignalRaw(raw: string | undefined | null): boolean {
  if (!raw || !raw.startsWith(PREFIX)) return false;
  try {
    const obj = JSON.parse(raw.slice(PREFIX.length));
    return obj && (obj.kind === 'signal' || obj.kind === 'call_event');
  } catch {
    return false;
  }
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}