import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { client } from '@/lib/atoms-client';

export interface Profile {
  id: number;
  user_id: string;
  username: string;
  display_name?: string;
  bio?: string;
  metier?: string;
  avatar_key?: string;
  role: 'client' | 'prestataire';
  theme?: 'light' | 'dark';
}

interface AuthUser {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  setProfile: (p: Profile | null) => void;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const getUserId = (u: AuthUser | null): string | undefined => {
    if (!u) return undefined;
    return (u.id as string) || (u.sub as string) || (u.user_id as string);
  };

  const refreshProfile = async () => {
    try {
      const me = await client.auth.me();
      const userData = (me?.data as AuthUser) || null;
      setUser(userData);
      const uid = getUserId(userData);
      if (!uid) {
        setProfile(null);
        return;
      }
      // Try find existing profile by user_id
      const res = await client.entities.profiles.query({
        query: { user_id: uid },
        limit: 1,
      });
      const items = (res?.data?.items as Profile[]) || [];
      if (items.length > 0) {
        setProfile(items[0]);
      } else {
        setProfile(null);
      }
    } catch (e) {
      console.error('refreshProfile error', e);
      setUser(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshProfile();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = () => {
    client.auth.toLogin();
  };

  const logout = async () => {
    try {
      await client.auth.logout();
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, refreshProfile, setProfile, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}