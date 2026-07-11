import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  user_id: string;
  email?: string | null;
  username: string;
  display_name?: string;
  bio?: string;
  metier?: string;
  avatar_key?: string;
  role: 'client' | 'prestataire';
  theme?: 'light' | 'dark';
  service_category_id?: string | null;
  service_id?: string | null;
  last_seen_at?: string | null;

  city?: string | null;
  province?: string | null;
  commune?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  availability_status?: 'available' | 'busy' | 'unavailable';
  completed_jobs_count?: number;

  is_verified?: boolean;
  verification_status?: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  verified_at?: string | null;

  is_admin?: boolean;
  subscription_type?: 'free' | 'premium';
  subscription_expires_at?: string | null;
  suspended?: boolean;
  suspended_reason?: string | null;
  suspended_until?: string | null;
  banned?: boolean;
  banned_reason?: string | null;
  deactivated_at?: string | null;
  deleted_at?: string | null;
}

export interface LobokoAccount {
  id: string;
  email: string;
  role: 'client' | 'prestataire';
  display_name: string;
  metier?: string;
}

interface AuthContextValue {
  user: LobokoAccount | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  setProfile: (p: Profile | null) => void;
  registerLoboko: (params: {
    email: string;
    password: string;
    role: 'client' | 'prestataire';
    display_name: string;
    metier?: string;
    service_id?: string | null;
  }) => Promise<LobokoAccount>;
  loginLoboko: (params: { email: string; password: string }) => Promise<LobokoAccount>;
  createLobokoProfile: (params: {
    username: string;
    display_name?: string;
    bio?: string;
    metier?: string;
    role: 'client' | 'prestataire';
    service_category_id?: string | null;
    service_id?: string | null;
  }) => Promise<Profile>;
  updateLobokoProfile: (params: Partial<Omit<Profile, 'id' | 'user_id'>>) => Promise<Profile>;
 signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function accountFromUser(u: User | null): LobokoAccount | null {
  if (!u) return null;

  const meta = (u.user_metadata || {}) as Record<string, unknown>;

  return {
    id: u.id,
    email: u.email || '',
    role: (meta.role as 'client' | 'prestataire') || 'client',
    display_name: (meta.display_name as string) || (u.email?.split('@')[0] ?? 'Utilisateur'),
    metier: (meta.metier as string) || undefined,
  };
}
function isSuspensionActive(profile: Profile) {
  if (!profile.suspended) return false;

  if (!profile.suspended_until) return true;

  return new Date(profile.suspended_until).getTime() > Date.now();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<LobokoAccount | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileFor = useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', u.id)
        .maybeSingle();

      if (error) {
        console.error('loadProfile error', error);
        setProfile(null);
        return;
      }

      let loadedProfile = (data as Profile) || null;

      if (loadedProfile?.banned) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        throw new Error(
          loadedProfile.banned_reason || 'Votre compte a été banni.',
        );
      }

      // Compte supprimé définitivement : on ne peut pas effacer l'identifiant
      // de connexion lui-même depuis le client (ça demanderait une clé
      // serveur qu'on n'expose jamais côté app), mais on bloque
      // systématiquement l'accès dès qu'on détecte ce champ — dans les
      // faits, le compte est donc inutilisable pour toujours.
      if (loadedProfile?.deleted_at) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        throw new Error('Ce compte a été supprimé définitivement.');
      }

      if (loadedProfile && isSuspensionActive(loadedProfile)) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        throw new Error(
          loadedProfile.suspended_reason || 'Votre compte est suspendu.',
        );
      }

      // Compte désactivé temporairement : le fait de se reconnecter suffit
      // à le réactiver automatiquement, comme sur Instagram — pas besoin
      // d'une action séparée.
      if (loadedProfile?.deactivated_at) {
        const { data: reactivated, error: reactivateError } = await supabase
          .from('profiles')
          .update({ deactivated_at: null })
          .eq('user_id', u.id)
          .select()
          .single();

        if (!reactivateError && reactivated) {
          loadedProfile = reactivated as Profile;
        }
      }

      setProfile(loadedProfile);
    } catch (e) {
      console.error('loadProfile exception', e);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    await loadProfileFor(data.user || null);
  }, [loadProfileFor]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(data.session);
      setUser(accountFromUser(data.session?.user || null));
      await loadProfileFor(data.session?.user || null);
      setLoading(false);

      const uid = data.session?.user?.id;
      if (uid) {
        void import('@/lib/push-notifications').then((m) =>
          m.syncPushSubscriptionOnStartup(uid),
        );
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(accountFromUser(newSession?.user || null));
      loadProfileFor(newSession?.user || null);

      const uid = newSession?.user?.id;
      if (uid) {
        void import('@/lib/push-notifications').then((m) =>
          m.syncPushSubscriptionOnStartup(uid),
        );
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfileFor]);

  const registerLoboko: AuthContextValue['registerLoboko'] = useCallback(async (params) => {
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          role: params.role,
          display_name: params.display_name,
          service_id: params.service_id || null,
          metier: params.metier || null,
        },
      },
    });

    if (error) throw new Error(error.message);

    const u = data.user;
    if (!u) throw new Error("Échec de l'inscription");

    const account = accountFromUser(u)!;

    if (data.session) {
      setSession(data.session);
      setUser(account);
      await loadProfileFor(u);
    } else {
      setSession(null);
      setUser(null);
      setProfile(null);
    }
    
    return account;
  }, []);

  const loginLoboko: AuthContextValue['loginLoboko'] = useCallback(
    async (params) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: params.email,
        password: params.password,
      });

      if (error) throw new Error(error.message);

      const u = data.user;
      if (!u) throw new Error('Identifiants invalides');

      const account = accountFromUser(u)!;
      try {
        setUser(account);
        await loadProfileFor(u);
        return account;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Compte bloqué';
        throw new Error(message);
      }
    },
    [loadProfileFor],
  );

  const signInWithGoogle: AuthContextValue['signInWithGoogle'] = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  
    if (error) throw new Error(error.message);
  }, []);

  const signInWithFacebook: AuthContextValue['signInWithFacebook'] = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  
    if (error) throw new Error(error.message);
  }, []);

  const createLobokoProfile: AuthContextValue['createLobokoProfile'] = useCallback(
    async (params) => {
      const { data: userData } = await supabase.auth.getUser();
      const u = userData.user;

      if (!u) throw new Error('Aucun compte LOBOKO connecté');

      const payload = {
        user_id: u.id,
        email: u.email || null,
        username: params.username,
        display_name: params.display_name || null,
        bio: params.bio || null,
        metier: params.metier || null,
        role: params.role,
        theme: 'dark',
        service_category_id: null,
        service_id: params.service_id || null,
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert(payload)
        .select()
        .single();

      if (error) throw new Error(error.message);

      const created = data as Profile;
      setProfile(created);

      return created;
    },
    [],
  );

  const updateLobokoProfile: AuthContextValue['updateLobokoProfile'] = useCallback(
    async (params) => {
      const { data: userData } = await supabase.auth.getUser();
      const u = userData.user;

      if (!u) throw new Error('Aucun compte LOBOKO connecté');

      const { data, error } = await supabase
        .from('profiles')
        .update(params)
        .eq('user_id', u.id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      const updated = data as Profile;
      setProfile(updated);

      return updated;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    }

    setUser(null);
    setProfile(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        refreshProfile,
        setProfile,
        registerLoboko,
        loginLoboko,
        signInWithGoogle,
        signInWithFacebook,
        createLobokoProfile,
        updateLobokoProfile,
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
