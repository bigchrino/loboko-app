import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Users, MessageCircle, Briefcase, Heart } from 'lucide-react';

export default function Index() {
  const { user, loading, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/home', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--loboko-bg)] text-[var(--loboko-text)]">
        <div className="w-10 h-10 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--loboko-bg)] text-[var(--loboko-text)] relative overflow-hidden">
      {/* Background decor */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#8b5cf6] rounded-full filter blur-[120px] opacity-20" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#7c3aed] rounded-full filter blur-[120px] opacity-20" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#7c3aed] flex items-center justify-center text-white font-bold text-lg">
            L
          </div>
          <span className="text-xl font-bold tracking-tight">LOBOKO</span>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-full bg-[var(--loboko-surface)] text-[var(--loboko-text-secondary)] hover:text-[var(--loboko-text)] transition"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center px-6 py-8 lg:py-16">
        <div className="max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[rgba(139,92,246,0.15)] text-[#8b5cf6] text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-[#8b5cf6] animate-pulse" />
            Connecter les talents du Congo
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-5 leading-tight">
            Bienvenue sur{' '}
            <span className="bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] bg-clip-text text-transparent">
              LOBOKO
            </span>
          </h1>
          <p className="text-base md:text-lg text-[var(--loboko-text-secondary)] mb-8 max-w-2xl mx-auto leading-relaxed">
            Le réseau social qui connecte clients et prestataires de services.
            Découvrez des talents, échangez, partagez vos réalisations.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-16">
            <button
              onClick={login}
              className="px-8 py-3.5 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] text-white font-semibold hover:opacity-90 transition shadow-lg shadow-[#8b5cf6]/30 w-full sm:w-auto"
            >
              Commencer maintenant
            </button>
            <button
              onClick={login}
              className="px-8 py-3.5 rounded-full !bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-[var(--loboko-text)] font-semibold hover:border-[#8b5cf6] transition w-full sm:w-auto"
            >
              Se connecter
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { icon: Users, label: 'Communauté', desc: 'Rencontrez des pros' },
              { icon: Briefcase, label: 'Services', desc: 'Trouvez des talents' },
              { icon: MessageCircle, label: 'Messagerie', desc: 'Échangez en direct' },
              { icon: Heart, label: 'Partage', desc: 'Likez, commentez' },
            ].map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="p-5 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] hover:border-[#8b5cf6] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-[rgba(139,92,246,0.15)] text-[#8b5cf6] flex items-center justify-center mx-auto mb-3">
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-sm mb-1">{label}</h3>
                <p className="text-xs text-[var(--loboko-text-muted)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center text-xs text-[var(--loboko-text-muted)] pb-6">
        © {new Date().getFullYear()} LOBOKO — Tous droits réservés
      </footer>
    </div>
  );
}