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
import { supabase } from '@/lib/supabase';
import { decodePayload } from '@/lib/message-format';

interface MessagesContextValue {
  /** Number of unread incoming messages (text/audio only, excluding signalling). */
  unreadCount: number;
  /** Monotonically-increasing counter that ticks on every relevant realtime event;
   *  subscribers can use it as a trigger to re-fetch. */
  changeTick: number;
  refresh: () => Promise<void>;
}

const MessagesContext = createContext<MessagesContextValue>({
  unreadCount: 0,
  changeTick: 0,
  refresh: async () => {},
});

const FALLBACK_POLL_MS = 60_000;

interface MessageRow {
  id: string;
  user_id: string;
  receiver_id: string;
  content: string;
  read?: boolean;
}

function isUserFacing(content: string): boolean {
  const p = decodePayload(content);
  return p.kind === 'text' || p.kind === 'audio' || p.kind === 'call_event';
}

export function MessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [changeTick, setChangeTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, user_id, receiver_id, content, read')
        .eq('receiver_id', user.id)
        .eq('read', false)
        .limit(500);
      if (error) throw error;
      const rows = (data as MessageRow[]) || [];
      const count = rows.filter((m) => isUserFacing(m.content)).length;
      setUnreadCount(count);
    } catch (e) {
      console.error('[messages] refresh unread failed', e);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();

    if (timerRef.current) clearInterval(timerRef.current);
    if (!user?.id) return;

    timerRef.current = setInterval(refresh, FALLBACK_POLL_MS);

    const channel = supabase
      .channel(`messages-user-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as MessageRow | null;
          if (!row) return;
          if (!isUserFacing(row.content)) {
            // still bump tick so Messages page can pick up signalling promptly
            setChangeTick((t) => t + 1);
            return;
          }
          if (row.read === false) setUnreadCount((c) => c + 1);
          setChangeTick((t) => t + 1);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const oldRow = payload.old as MessageRow | null;
          const newRow = payload.new as MessageRow | null;
          if (
            newRow &&
            isUserFacing(newRow.content) &&
            oldRow?.read === false &&
            newRow?.read === true
          ) {
            setUnreadCount((c) => Math.max(0, c - 1));
          }
          setChangeTick((t) => t + 1);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // my own outgoing messages — just trigger conversation refresh on the page
          setChangeTick((t) => t + 1);
        },
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [user?.id, refresh]);

  return (
    <MessagesContext.Provider value={{ unreadCount, changeTick, refresh }}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages(): MessagesContextValue {
  return useContext(MessagesContext);
}