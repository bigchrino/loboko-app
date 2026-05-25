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
import {
  countUnreadNotifications,
  markAllNotificationsRead,
} from '@/lib/notifications';

interface NotificationsContextValue {
  unreadCount: number;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  refresh: async () => {},
  markAllRead: async () => {},
});

// Safety-net polling in case a realtime event is missed. The realtime
// subscription does most of the work; this just reconciles periodically.
const FALLBACK_POLL_MS = 60_000;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    const count = await countUnreadNotifications(user.id);
    setUnreadCount(count);
  }, [user?.id]);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    await markAllNotificationsRead(user.id);
    setUnreadCount(0);
  }, [user?.id]);

  // Initial load + realtime subscription + fallback polling
  useEffect(() => {
    refresh();

    if (timerRef.current) clearInterval(timerRef.current);
    if (!user?.id) return;

    timerRef.current = setInterval(refresh, FALLBACK_POLL_MS);

    const channel = supabase
      .channel(`notifications-user-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { read?: boolean } | null;
          if (row && !row.read) {
            refresh();
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldRow = payload.old as { read?: boolean } | null;
          const newRow = payload.new as { read?: boolean } | null;
          refresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldRow = payload.old as { read?: boolean } | null;
          refresh();
        },
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [user?.id, refresh]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refresh, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
