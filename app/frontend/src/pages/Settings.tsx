import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut, User, Shield, HelpCircle } from 'lucide-react';

export default function Settings() {
  const { logout, profile, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <Layout title="Paramètres">
      <h1 className="text-2xl font-bold mb-4 hidden lg:block">Paramètres</h1>

      <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center text-white font-bold">
            {(profile?.display_name || profile?.username || 'L').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">
              {profile?.display_name || profile?.username || 'Utilisateur'}
            </div>
            <div className="text-xs text-[var(--loboko-text-muted)] truncate">
              {(user?.email as string) || (profile ? `@${profile.username}` : '')}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--loboko-surface)] border border-[var(--loboko-border)] rounded-2xl overflow-hidden mb-4">
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[var(--loboko-surface-hover)] transition border-b border-[var(--loboko-border)]"
        >
          <User size={18} className="text-[#2563eb]" />
          <span className="flex-1 text-left text-sm font-medium">Modifier le profil</span>
          <span className="text-[var(--loboko-text-muted)]">›</span>
        </button>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[var(--loboko-surface-hover)] transition border-b border-[var(--loboko-border)]"
        >
          {theme === 'dark' ? (
            <Sun size={18} className="text-[#2563eb]" />
          ) : (
            <Moon size={18} className="text-[#2563eb]" />
          )}
          <span className="flex-1 text-left text-sm font-medium">
            {theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          </span>
        </button>
        <div className="w-full flex items-center gap-3 px-4 py-4 border-b border-[var(--loboko-border)]">
          <Shield size={18} className="text-[#2563eb]" />
          <span className="flex-1 text-left text-sm font-medium">Confidentialité</span>
          <span className="text-xs text-[var(--loboko-text-muted)]">Bientôt</span>
        </div>
        <div className="w-full flex items-center gap-3 px-4 py-4">
          <HelpCircle size={18} className="text-[#2563eb]" />
          <span className="flex-1 text-left text-sm font-medium">Aide & support</span>
          <span className="text-xs text-[var(--loboko-text-muted)]">Bientôt</span>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[rgba(239,68,68,0.1)] text-[#ef4444] font-semibold border border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.2)] transition"
      >
        <LogOut size={18} />
        Se déconnecter
      </button>

      <div className="text-center mt-6 text-xs text-[var(--loboko-text-muted)]">
        LOBOKO v1.0 — © {new Date().getFullYear()}
      </div>
    </Layout>
  );
}