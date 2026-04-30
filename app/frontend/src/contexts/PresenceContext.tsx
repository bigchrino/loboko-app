import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ensurePresence,
  subscribeOnline,
  teardownPresence,
} from '@/lib/presence';
import { startLastSeenHeartbeat } from '@/lib/last-seen';

interface PresenceContextValue {
  onlineIds: Set<string>;
  isOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineIds: new Set(),
  isOnline: () => false,
});

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) {
      teardownPresence();
      setOnlineIds(new Set());
      return;
    }
    ensurePresence(user.id);
    const unsubOnline = subscribeOnline((ids) => setOnlineIds(ids));
    const stopHeartbeat = startLastSeenHeartbeat(user.id);
    return () => {
      unsubOnline();
      stopHeartbeat();
    };
  }, [user?.id]);

  return (
    <PresenceContext.Provider
      value={{ onlineIds, isOnline: (id: string) => onlineIds.has(id) }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence(): PresenceContextValue {
  return useContext(PresenceContext);
}