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

const POLL_INTERVAL_MS = 15_000;

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

  useEffect(() => {
    refresh();
    if (timerRef.current) clearInterval(timerRef.current);
    if (user?.id) {
      timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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