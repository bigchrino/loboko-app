import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon, Users, MessageCircle, Briefcase, Loader2, ArrowRight } from 'lucide-react';
import SplashScreen from '@/components/SplashScreen';
import PasswordField from '@/components/PasswordField';
import ServiceCategorySelect from '@/components/ServiceCategorySelect';
import { authErrorMessage, validateAuthForm } from '@/lib/auth-form';
import logoLogin from '@/assets/logo-login.png';

type Mode = 'login' | 'register';
const inputClass = 'min-h-12 w-full rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-elevated)] px-4 py-3 text-base text-[var(--loboko-text)] placeholder:text-[var(--loboko-text-secondary)] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 disabled:opacity-60';
const features = [
  { icon: Users, label: 'Une communauté près de vous', detail: 'Partagez votre quotidien et découvrez les talents locaux.' },
  { icon: Briefcase, label: 'Des services pour vos projets', detail: 'Trouvez un prestataire ou faites connaître votre métier.' },
  { icon: MessageCircle, label: 'Des échanges simples', detail: 'Discutez directement avec vos contacts et vos groupes.' },
];

export default function Index() {
  const { user, profile, loading, loginLoboko, registerLoboko, signInWithGoogle } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'client' | 'prestataire'>('client');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [serviceCategoryName, setServiceCategoryName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const busy = submitting || googleBusy;

  useEffect(() => {
    if (loading) return;
    if (user && profile) navigate('/home', { replace: true });
    else if (user) navigate('/onboarding', { replace: true });
  }, [user, profile, loading, navigate]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const changeMode = (next: Mode) => {
    if (request.current || next === mode) return;
    setMode(next); setPassword(''); setConfirmation(''); setError(''); setNotice('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (request.current) return;
    setNotice('');
    const validation = validateAuthForm({ mode, email, password, confirmation, displayName, role, serviceId });
    if (validation) { setError(validation); return; }
    request.current = true; setSubmitting(true); setError('');
    try {
      if (mode === 'login') {
        await loginLoboko({ email: email.trim().toLowerCase(), password });
      } else {
        await registerLoboko({
          email: email.trim().toLowerCase(), password, role, display_name: displayName.trim(),
          service_id: role === 'prestataire' ? serviceId : null,
          metier: role === 'prestataire' ? serviceCategoryName : undefined,
        });
        setMode('login'); setPassword(''); setConfirmation('');
        setNotice('Inscription reçue. Si votre adresse doit être confirmée, ouvrez le lien envoyé par e-mail, puis connectez-vous. Pensez à vérifier les courriers indésirables.');
      }
    } catch (failure) { setError(authErrorMessage(failure)); }
    finally { request.current = false; setSubmitting(false); }
  };

  const google = async () => {
    if (request.current) return;
    request.current = true; setGoogleBusy(true); setError(''); setNotice('');
    try { await signInWithGoogle(); }
    catch (failure) { setError(authErrorMessage(failure)); }
    finally { request.current = false; setGoogleBusy(false); }
  };

  if (loading) return <SplashScreen />;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[var(--loboko-bg)] text-[var(--loboko-text)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 -right-48 h-[32rem] w-[32rem] rounded-full bg-[#2563eb]/15 blur-[120px]" />
        <div className="absolute bottom-0 -left-40 h-80 w-80 rounded-full bg-[#22c55e]/10 blur-[100px]" />
      </div>
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8 sm:py-6">
        <img src={logoLogin} alt="LOBOKO" className="h-11 w-auto sm:h-14" />
        <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre'}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--loboko-border)] bg-[var(--loboko-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb]">
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
      </header>
      <main className="relative mx-auto grid max-w-6xl items-start gap-10 px-5 pb-10 pt-2 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-12">
        <section aria-labelledby="auth-title" className="order-first w-full max-w-md justify-self-center rounded-3xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] p-5 shadow-xl sm:p-8 lg:order-last">
          <div className="mb-6 flex rounded-xl bg-[var(--loboko-bg)] p-1" role="group" aria-label="Choisir connexion ou inscription">
            {(['login', 'register'] as const).map(value => (
              <button key={value} type="button" aria-pressed={mode === value} disabled={busy} onClick={() => changeMode(value)}
                className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] ${mode === value ? 'bg-[#2563eb] text-white shadow-sm' : '!bg-transparent text-[var(--loboko-text-secondary)]'}`}>
                {value === 'login' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>
          <h1 id="auth-title" className="text-2xl font-bold tracking-tight">{mode === 'login' ? 'Heureux de vous retrouver' : 'Bienvenue dans la communauté'}</h1>
          <p className="mb-6 mt-2 text-sm leading-relaxed text-[var(--loboko-text-secondary)]">{mode === 'login' ? 'Connectez-vous pour retrouver votre fil, vos contacts et vos projets.' : 'Créez votre compte pour trouver un service ou proposer votre savoir-faire.'}</p>
          {error && <p ref={errorRef} tabIndex={-1} id="auth-error" role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm leading-relaxed focus:outline-none">{error}</p>}
          {notice && <p role="status" className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm leading-relaxed">{notice}</p>}
          <form onSubmit={handleSubmit} aria-busy={submitting} aria-describedby={error ? 'auth-error' : undefined}>
            <fieldset disabled={busy} className="min-w-0 space-y-4">
              <legend className="sr-only">{mode === 'login' ? 'Vos identifiants de connexion' : 'Informations de votre nouveau compte'}</legend>
              {mode === 'register' && <div>
                <label htmlFor="auth-name" className="mb-2 block text-sm font-medium">Nom complet</label>
                <input id="auth-name" name="name" autoComplete="name" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Votre nom" required maxLength={100} className={inputClass} />
              </div>}
              <div>
                <label htmlFor="auth-email" className="mb-2 block text-sm font-medium">Adresse e-mail</label>
                <input id="auth-email" name="email" type="email" inputMode="email" autoComplete={mode === 'login' ? 'username' : 'email'} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  value={email} onChange={event => setEmail(event.target.value)} placeholder="vous@exemple.com" required maxLength={254} className={inputClass} />
              </div>
              <PasswordField key={mode} id="auth-password" name="password" label="Mot de passe" value={password} onChange={event => setPassword(event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Votre mot de passe' : 'Créez votre mot de passe'}
                required minLength={mode === 'register' ? 8 : undefined} disabled={busy} className={inputClass}
                hint={mode === 'register' ? '8 caractères minimum. Utilisez un mot de passe unique et difficile à deviner.' : undefined} />
              {mode === 'register' && <>
                <PasswordField id="auth-confirmation" name="password-confirmation" label="Confirmer le mot de passe" value={confirmation} onChange={event => setConfirmation(event.target.value)}
                  autoComplete="new-password" placeholder="Saisissez-le une seconde fois" required minLength={8} disabled={busy} className={inputClass} />
                <fieldset className="min-w-0">
                  <legend className="mb-2 text-sm font-medium">Comment souhaitez-vous utiliser LOBOKO ?</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(['client', 'prestataire'] as const).map(value => <button key={value} type="button" aria-pressed={role === value} onClick={() => setRole(value)}
                      className={`min-h-12 rounded-xl border px-3 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] ${role === value ? 'border-[#2563eb] bg-[#2563eb]/10 text-[var(--loboko-text)]' : 'border-[var(--loboko-border)] !bg-transparent text-[var(--loboko-text-secondary)]'}`}>
                      {value === 'client' ? 'Je cherche un service' : 'Je propose un service'}
                    </button>)}
                  </div>
                </fieldset>
                {role === 'prestataire' && <div>
                  <p id="auth-service-label" className="mb-2 text-sm font-medium">Votre service</p>
                  <div role="group" aria-labelledby="auth-service-label"><ServiceCategorySelect value={serviceId} required placeholder="Choisissez votre service…" onChange={(id, category) => {setServiceId(id); setServiceCategoryName(category?.name || '');}} /></div>
                  <p className="mt-2 text-xs text-[var(--loboko-text-secondary)]">Sélectionnez un service dans le catalogue officiel LOBOKO.</p>
                </div>}
              </>}
              <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-3.5 text-base font-semibold text-white hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-60">
                {submitting ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />{mode === 'login' ? 'Connexion…' : 'Création du compte…'}</> : <>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'}<ArrowRight size={18} aria-hidden="true" /></>}
              </button>
            </fieldset>
          </form>
          {mode === 'login' && <p className="mt-4 text-center text-sm"><Link to="/contact" className="inline-flex min-h-11 items-center text-[var(--loboko-text-secondary)] underline underline-offset-4">Mot de passe oublié ? Contactez l’assistance</Link></p>}
          <div className="my-5 flex items-center gap-3 text-xs text-[var(--loboko-text-secondary)]"><span className="h-px flex-1 bg-[var(--loboko-border)]" />ou<span className="h-px flex-1 bg-[var(--loboko-border)]" /></div>
          <button type="button" disabled={busy} onClick={google} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[var(--loboko-border)] bg-white px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] disabled:opacity-60">
            {googleBusy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <span aria-hidden="true" className="text-lg font-bold text-[#2563eb]">G</span>}
            {googleBusy ? 'Ouverture de Google…' : 'Continuer avec Google'}
          </button>
          <p className="mt-5 text-center text-xs leading-relaxed text-[var(--loboko-text-secondary)]">{mode === 'login' ? 'Vous découvrez LOBOKO ?' : 'Vous avez déjà un compte ?'}{' '}<button type="button" disabled={busy} onClick={() => changeMode(mode === 'login' ? 'register' : 'login')} className="min-h-11 font-semibold text-[#2563eb] underline underline-offset-4">{mode === 'login' ? 'Créer un compte' : 'Se connecter'}</button></p>
        </section>
        <section aria-label="Découvrez LOBOKO" className="max-w-lg justify-self-center text-center lg:text-left">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#2563eb]">Les talents du Congo, à portée de main</p>
          <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">Des liens, des talents.<br /><span className="text-[#2563eb]">Des possibilités.</span></h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--loboko-text-secondary)]">Votre quartier, votre communauté, vos projets. Retrouvez-les sur LOBOKO.</p>
          <div className="mt-7 space-y-4 text-left">{features.map(({icon:Icon,label,detail}) => <div key={label} className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563eb]/10 text-[#2563eb]"><Icon size={20} aria-hidden="true" /></span>
            <div><h3 className="text-sm font-semibold">{label}</h3><p className="mt-1 text-sm leading-relaxed text-[var(--loboko-text-secondary)]">{detail}</p></div>
          </div>)}</div>
        </section>
      </main>
      <footer className="relative px-5 pb-6 text-center text-xs text-[var(--loboko-text-secondary)]">© {new Date().getFullYear()} LOBOKO · <Link to="/contact" className="underline underline-offset-4">Nous contacter</Link></footer>
    </div>
  );
}
