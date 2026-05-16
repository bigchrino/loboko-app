import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Users, MessageCircle, Briefcase, Heart } from 'lucide-react';
import Logo from '@/components/Logo';
import { toast } from 'sonner';
import ServiceCategorySelect from '@/components/ServiceCategorySelect';

type Mode = 'login' | 'register';

export default function Index() {
  const {
    user,
    profile,
    loading,
    loginLoboko,
    registerLoboko,
    signInWithGoogle,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'client' | 'prestataire'>('client');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [serviceCategoryName, setServiceCategoryName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && profile) navigate('/home', { replace: true });
    else if (user && !profile) navigate('/onboarding', { replace: true });
  }, [user, profile, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password.trim()) {
      toast.error('Email et mot de passe requis');
      return;
    }
    if (mode === 'register') {
      if (password.length < 6) {
        toast.error('Mot de passe : 6 caractères minimum');
        return;
      }
      if (!displayName.trim()) {
        toast.error('Nom complet requis');
        return;
      }
      if (role === 'prestataire' && !serviceId) {
        toast.error('Veuillez choisir un service officiel dans la liste');
        return;
      }
    }
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginLoboko({ email: email.trim().toLowerCase(), password });
        toast.success('Connexion réussie');
      } else {
        await registerLoboko({
          email: email.trim().toLowerCase(),
          password,
          role,
          display_name: displayName.trim(),
          service_id: role === 'prestataire' ? serviceId : null,
          metier: role === 'prestataire' ? serviceCategoryName : undefined,
        });
        toast.success('Compte créé. Vérifiez votre email avant de vous connecter.');
        setMode('login');
        setPassword('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inattendue';
      const friendly = msg.includes('401') || msg.toLowerCase().includes('invalid')
        ? 'Email ou mot de passe incorrect'
        : msg.includes('409') || msg.toLowerCase().includes('already')
        ? 'Cet email est déjà utilisé'
        : msg;
      toast.error(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--loboko-bg)] text-[var(--loboko-text)]">
        <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--loboko-bg)] text-[var(--loboko-text)] relative overflow-hidden">
      {/* Background decor */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#2563eb] rounded-full filter blur-[120px] opacity-25" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-[#22c55e] rounded-full filter blur-[120px] opacity-20" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-[#f59e0b] rounded-full filter blur-[120px] opacity-15" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5">
        <Logo size="lg" />
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-full bg-[var(--loboko-surface)] text-[var(--loboko-text-secondary)] hover:text-[var(--loboko-text)] transition"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center px-6 py-6 lg:py-10">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-10 items-center">
          {/* Hero text */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[rgba(37,99,235,0.15)] text-[#2563eb] text-xs font-semibold mb-5">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              Connecter les talents du Congo
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 leading-tight">
              Bienvenue sur{' '}
              <span className="bg-gradient-to-r from-[#2563eb] via-[#22c55e] to-[#f59e0b] bg-clip-text text-transparent">
                Loboko
              </span>
            </h1>
            <p className="text-base md:text-lg text-[var(--loboko-text-secondary)] mb-6 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Le réseau social qui connecte clients et prestataires de services.
              Créez votre compte avec un simple email et mot de passe.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto lg:mx-0">
              {[
                { icon: Users, label: 'Communauté', color: '#2563eb' },
                { icon: Briefcase, label: 'Services', color: '#22c55e' },
                { icon: MessageCircle, label: 'Messagerie', color: '#f59e0b' },
                { icon: Heart, label: 'Partage', color: '#2563eb' },
              ].map(({ icon: Icon, label, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)]"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${color}26`, color }}
                  >
                    <Icon size={18} />
                  </div>
                  <span className="text-sm font-semibold">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auth card */}
          <div className="w-full max-w-md mx-auto lg:ml-auto p-6 rounded-2xl bg-[var(--loboko-surface)] border border-[var(--loboko-border)] shadow-xl">
            <div className="flex gap-2 p-1 rounded-xl bg-[var(--loboko-elevated)] mb-5">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                    mode === m
                      ? 'bg-[#2563eb] text-white shadow'
                      : '!bg-transparent !hover:bg-transparent text-[var(--loboko-text-secondary)]'
                  }`}
                >
                  {m === 'login' ? 'Connexion' : 'Inscription'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-[var(--loboko-text-secondary)]">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-[var(--loboko-text)] placeholder:text-[var(--loboko-text-muted)] focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-[var(--loboko-text-secondary)]">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Au moins 6 caractères"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-[var(--loboko-text)] placeholder:text-[var(--loboko-text-muted)] focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-[var(--loboko-text-secondary)]">
                      Nom complet
                    </label>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Votre nom"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-[var(--loboko-elevated)] border border-[var(--loboko-border)] text-[var(--loboko-text)] placeholder:text-[var(--loboko-text-muted)] focus:outline-none focus:border-[#2563eb]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-[var(--loboko-text-secondary)]">
                      Je suis *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['client', 'prestataire'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-semibold capitalize transition ${
                            role === r
                              ? 'bg-[#2563eb] text-white'
                              : '!bg-transparent !hover:bg-transparent border border-[var(--loboko-border)] text-[var(--loboko-text-secondary)]'
                          }`}
                        >
                          {r === 'client' ? 'Client' : 'Prestataire de service'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {role === 'prestataire' && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 text-[var(--loboko-text-secondary)]">
                        Service que vous livrez *
                      </label>
                      <ServiceCategorySelect
                        value={serviceId}
                        onChange={(id, cat) => {
                          setServiceId(id);
                          setServiceCategoryName(cat?.name || '');
                        }}
                        required
                        placeholder="Choisissez un service officiel…"
                      />
                      <p className="mt-1.5 text-[11px] text-[var(--loboko-text-muted)]">
                        Choisissez un service existant dans la liste LOBOKO.
                      </p>
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] text-white font-semibold hover:opacity-90 transition shadow-lg shadow-[#2563eb]/30 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {submitting
                  ? 'Patientez…'
                  : mode === 'login'
                  ? 'Se connecter'
                  : 'Créer mon compte'}
              </button>
            </form>

            <div className="mt-4">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (e) {
                    const err = e as Error;
                    toast.error(err.message);
                  }
                }}
                className="w-full py-3 rounded-xl border border-[var(--loboko-border)] bg-white text-black font-semibold hover:opacity-90 transition"
              >
                Continuer avec Google
              </button>
            </div>

            <p className="text-[11px] text-[var(--loboko-text-muted)] text-center mt-4">
              Un seul compte LOBOKO par email. Vous pourrez lier Google, Apple ou téléphone plus tard depuis les paramètres.
            </p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center text-xs text-[var(--loboko-text-muted)] pb-6">
        © {new Date().getFullYear()} LOBOKO — Tous droits réservés
      </footer>
    </div>
  );
}
