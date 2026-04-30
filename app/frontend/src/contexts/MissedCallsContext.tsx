import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  countUnseenMissedCalls,
  markAllMissedSeen,
} from '@/lib/missed-calls';
import { supabase } from '@/lib/supabase';
import { decodePayload } from '@/lib/message-format';

interface MissedCallsContextValue {
  /** Number of missed calls the user hasn't seen yet. */
  unseenMissed: number;
  /** Mark all missed calls as seen (called when /calls is opened). */
  markSeen: () => void;
  /** Force a refresh of the counter. */
  refresh: () => Promise<void>;
}

const MissedCallsContext = createContext<MissedCallsContextValue | undefined>(
  undefined,
);

export function MissedCallsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const myId = user?.id || '';
  const [unseenMissed, setUnseenMissed] = useState(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!myId) {
      setUnseenMissed(0);
      return;
    }
    try {
      const n = await countUnseenMissedCalls(myId);
      if (mountedRef.current) setUnseenMissed(n);
    } catch (e) {
      console.warn('[missed-calls] refresh failed', e);
    }
  }, [myId]);

  const markSeen = useCallback(() => {
    if (!myId) return;
    markAllMissedSeen(myId);
    setUnseenMissed(0);
  }, [myId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initial load + whenever the user changes.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for new messages rows that look like missed-call events so the
  // badge updates in real-time without needing a page reload. We piggy-back
  // on the existing `messages` realtime channel used across the app.
  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`missed-calls:${myId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${myId}`,
        },
        (payload) => {
          const row = payload.new as { content?: string } | undefined;
          if (!row?.content) return;
          const decoded = decodePayload(row.content);
          if (decoded.kind === 'call_event' && decoded.event === 'missed') {
            // Refresh so dedup/time-window logic stays consistent.
            refresh();
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${myId}`,
        },
        (payload) => {
          // If the current user authored a missed-event (they are the callee),
          // we should also refresh.
          const row = payload.new as { content?: string } | undefined;
          if (!row?.content) return;
          const decoded = decodePayload(row.content);
          if (decoded.kind === 'call_event' && decoded.event === 'missed') {
            refresh();
          }
        },
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [myId, refresh]);

  return (
    <MissedCallsContext.Provider value={{ unseenMissed, markSeen, refresh }}>
      {children}
    </MissedCallsContext.Provider>
  );
}

export function useMissedCalls() {
  const ctx = useContext(MissedCallsContext);
  if (!ctx) {
    // Return a safe default so components can be rendered outside the provider
    // (e.g. public routes) without crashing.
    return {
      unseenMissed: 0,
      markSeen: () => undefined,
      refresh: async () => undefined,
    } as MissedCallsContextValue;
  }
  return ctx;
}