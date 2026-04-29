import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Global presence channel: every authenticated user joins the same channel
 * and tracks their own user_id. Other clients read the presence state
 * to know who's online. Also used to broadcast "typing" / "recording"
 * indicators scoped by peer.
 */
const CHANNEL_NAME = 'loboko-presence';

let channel: RealtimeChannel | null = null;
let currentUserId: string | null = null;
const onlineListeners = new Set<(ids: Set<string>) => void>();
const typingListeners = new Set<(e: TypingEvent) => void>();
let onlineIds = new Set<string>();

export interface TypingEvent {
  from: string;
  to: string;
  kind: 'typing' | 'recording' | 'stop';
}

function emitOnline() {
  onlineListeners.forEach((cb) => cb(new Set(onlineIds)));
}

export function ensurePresence(userId: string): RealtimeChannel {
  if (channel && currentUserId === userId) return channel;
  if (channel) {
    try {
      supabase.removeChannel(channel);
    } catch {
      /* ignore */
    }
    channel = null;
  }
  currentUserId = userId;

  const ch = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: userId } },
  });

  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState();
    const ids = new Set<string>(Object.keys(state));
    onlineIds = ids;
    emitOnline();
  });

  ch.on('broadcast', { event: 'typing' }, (payload) => {
    const data = payload.payload as TypingEvent | undefined;
    if (!data) return;
    typingListeners.forEach((cb) => cb(data));
  });

  ch.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      try {
        await ch.track({ user_id: userId, online_at: new Date().toISOString() });
      } catch (e) {
        console.error('[presence] track failed', e);
      }
    }
  });

  channel = ch;
  return ch;
}

export function subscribeOnline(cb: (ids: Set<string>) => void): () => void {
  onlineListeners.add(cb);
  // emit current state immediately
  cb(new Set(onlineIds));
  return () => {
    onlineListeners.delete(cb);
  };
}

export function subscribeTyping(cb: (e: TypingEvent) => void): () => void {
  typingListeners.add(cb);
  return () => {
    typingListeners.delete(cb);
  };
}

export async function sendTyping(
  to: string,
  kind: 'typing' | 'recording' | 'stop',
): Promise<void> {
  if (!channel || !currentUserId) return;
  try {
    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { from: currentUserId, to, kind } as TypingEvent,
    });
  } catch (e) {
    console.error('[presence] sendTyping failed', e);
  }
}

export function isOnline(userId: string): boolean {
  return onlineIds.has(userId);
}

export async function teardownPresence(): Promise<void> {
  if (channel) {
    try {
      await supabase.removeChannel(channel);
    } catch {
      /* ignore */
    }
    channel = null;
    currentUserId = null;
    onlineIds = new Set();
    emitOnline();
  }
}