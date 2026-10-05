import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  useEffect(() => {
    if (!loading) navigate(user ? (profile ? '/home' : '/onboarding') : '/', { replace: true });
  }, [loading, user, profile, navigate]);
  return (
    <main role="status" className="min-h-[100dvh] flex items-center justify-center bg-[var(--loboko-bg)] p-6 text-[var(--loboko-text)]">
      <div className="text-center">
        <div aria-hidden="true" className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--loboko-border)] border-t-[#2563eb] mx-auto mb-4" />
        <p className="text-[var(--loboko-text-secondary)]">Vérification de votre connexion…</p>
      </div>
    </main>
  );
}
