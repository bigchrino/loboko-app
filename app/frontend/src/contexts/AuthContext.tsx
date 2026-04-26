import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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

export interface LobokoAccount {
  id: number;
  email: string;
  role: 'client' | 'prestataire';
  display_name: string;
}

interface AtomsUser {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

interface AuthContextValue {
  user: LobokoAccount | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  setProfile: (p: Profile | null) => void;
  registerLoboko: (params: {
    email: string;
    password: string;
    role: 'client' | 'prestataire';
    display_name: string;
  }) => Promise<LobokoAccount>;
  loginLoboko: (params: { email: string; password: string }) => Promise<LobokoAccount>;
  createLobokoProfile: (params: {
    username: string;
    display_name?: string;
    bio?: string;
    metier?: string;
    role: 'client' | 'prestataire';
  }) => Promise<Profile>;
  updateLobokoProfile: (params: Partial<Omit<Profile, 'id' | 'user_id'>>) => Promise<Profile>;
  ensureAtomsSession: () => Promise<AtomsUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const LOBOKO_STORAGE_KEY = 'loboko_account_v1';

function loadStoredAccount(): LobokoAccount | null {
  try {
    const raw = localStorage.getItem(LOBOKO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'number' && parsed.email) {
      return parsed as LobokoAccount;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function persistAccount(account: LobokoAccount | null) {
  try {
    if (account) {
      localStorage.setItem(LOBOKO_STORAGE_KEY, JSON.stringify(account));
    } else {
      localStorage.removeItem(LOBOKO_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LobokoAccount | null>(() => loadStoredAccount());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileFor = useCallback(async (account: LobokoAccount | null) => {
    if (!account) {
      setProfile(null);
      return;
    }
    try {
      const res = await client.apiCall.invoke({
        url: `/api/v1/loboko_auth/profile?account_id=${account.id}`,
        method: 'GET',
      });
      const items = (res?.data?.items as Profile[]) || [];
      setProfile(items.length > 0 ? items[0] : null);
    } catch (e) {
      console.error('loadProfile error', e);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfileFor(user);
  }, [user, loadProfileFor]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const stored = loadStoredAccount();
      if (stored) {
        await loadProfileFor(stored);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureAtomsSession = useCallback(async (): Promise<AtomsUser | null> => {
    try {
      const me = await client.auth.me();
      const atomsUser = (me?.data as AtomsUser) || null;
      if (atomsUser && (atomsUser.id || atomsUser.sub)) {
        return atomsUser;
      }
    } catch {
      /* not logged in */
    }
    await client.auth.toLogin();
    return null;
  }, []);

  const registerLoboko: AuthContextValue['registerLoboko'] = useCallback(
    async (params) => {
      const atomsUser = await ensureAtomsSession();
      if (!atomsUser) {
        throw new Error('Session requise, redirection en cours.');
      }
      const res = await client.apiCall.invoke({
        url: '/api/v1/loboko_auth/register',
        method: 'POST',
        data: {
          email: params.email,
          password: params.password,
          role: params.role,
          display_name: params.display_name,
        },
      });
      const account = res?.data as LobokoAccount;
      if (!account || typeof account.id !== 'number') {
        throw new Error("Échec de l'inscription");
      }
      persistAccount(account);
      setUser(account);
      await loadProfileFor(account);
      return account;
    },
    [ensureAtomsSession, loadProfileFor],
  );

  const loginLoboko: AuthContextValue['loginLoboko'] = useCallback(
    async (params) => {
      const atomsUser = await ensureAtomsSession();
      if (!atomsUser) {
        throw new Error('Session requise, redirection en cours.');
      }
      const res = await client.apiCall.invoke({
        url: '/api/v1/loboko_auth/login',
        method: 'POST',
        data: { email: params.email, password: params.password },
      });
      const account = res?.data as LobokoAccount;
      if (!account || typeof account.id !== 'number') {
        throw new Error('Identifiants invalides');
      }
      persistAccount(account);
      setUser(account);
      await loadProfileFor(account);
      return account;
    },
    [ensureAtomsSession, loadProfileFor],
  );

  const createLobokoProfile: AuthContextValue['createLobokoProfile'] = useCallback(
    async (params) => {
      if (!user) {
        throw new Error('Aucun compte LOBOKO connecté');
      }
      const res = await client.apiCall.invoke({
        url: '/api/v1/loboko_auth/profile',
        method: 'POST',
        data: {
          account_id: user.id,
          username: params.username,
          display_name: params.display_name,
          bio: params.bio,
          metier: params.metier,
          role: params.role,
          theme: 'dark',
        },
      });
      const created = res?.data as Profile;
      if (!created || typeof created.id !== 'number') {
        throw new Error('Échec de la création du profil');
      }
      setProfile(created);
      return created;
    },
    [user],
  );

  const updateLobokoProfile: AuthContextValue['updateLobokoProfile'] = useCallback(
    async (params) => {
      if (!user) {
        throw new Error('Aucun compte LOBOKO connecté');
      }
      const res = await client.apiCall.invoke({
        url: '/api/v1/loboko_auth/profile',
        method: 'PUT',
        data: { account_id: user.id, ...params },
      });
      const updated = res?.data as Profile;
      if (!updated || typeof updated.id !== 'number') {
        throw new Error('Échec de la mise à jour du profil');
      }
      setProfile(updated);
      return updated;
    },
    [user],
  );

  const logout = useCallback(async () => {
    persistAccount(null);
    setUser(null);
    setProfile(null);
    try {
      await client.auth.logout();
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        refreshProfile,
        setProfile,
        registerLoboko,
        loginLoboko,
        createLobokoProfile,
        updateLobokoProfile,
        ensureAtomsSession,
        logout,
      }}
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