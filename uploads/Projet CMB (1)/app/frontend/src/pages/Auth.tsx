import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme, ThemeToggle } from '../components/Layout'

/* ============================================
   LOGIN PAGE
   ============================================ */
export function Login() {
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    navigate('/accueil')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg-primary)] font-inter">
      <div className="absolute top-5 right-5 z-[2]">
        <ThemeToggle theme={theme} toggle={toggle} />
      </div>
      <div className="w-full max-w-[400px] text-center">
        <img src="/logo.jpg" alt="LOBOKO" className="w-[120px] h-auto rounded-2xl mx-auto mb-6 object-contain" />
        <h1 className="text-[1.75rem] font-bold text-[var(--text-primary)] mb-2 tracking-tight">Bienvenue sur LOBOKO</h1>
        <p className="text-[0.95rem] text-[var(--text-secondary)] mb-8">
          Veuillez entrer vos informations pour vous connecter.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="text-left">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Nom d&apos;utilisateur ou numéro de téléphone
            </label>
            <input
              type="text"
              placeholder="Entrez votre identifiant"
              required
              className="w-full py-3.5 px-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-base outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)]"
            />
          </div>
          <div className="text-left">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              placeholder="Entrez votre mot de passe"
              required
              className="w-full py-3.5 px-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-base outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)]"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3.5 px-6 bg-[var(--accent)] text-white border-none rounded-xl text-base font-semibold cursor-pointer mt-2 hover:bg-[var(--accent-hover)] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(139,92,246,0.3)] active:translate-y-0 transition-all"
          >
            Se connecter
          </button>
        </form>
        <p className="mt-6 text-sm text-[var(--text-muted)]">
          Pas encore de compte ?{' '}
          <Link to="/inscription" className="text-[var(--accent)] font-medium hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}

/* ============================================
   REGISTER PAGE
   ============================================ */
export function Register() {
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [accountType, setAccountType] = useState<'client' | 'prestataire' | ''>('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    const confirmPassword = (form.elements.namedItem('confirm-password') as HTMLInputElement).value

    if (password !== confirmPassword) {
      alert('Les mots de passe ne correspondent pas.')
      return
    }
    if (!accountType) {
      alert('Veuillez choisir votre type de compte (Client ou Prestataire).')
      return
    }
    navigate('/accueil')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg-primary)] font-inter">
      <div className="absolute top-5 right-5 z-[2]">
        <ThemeToggle theme={theme} toggle={toggle} />
      </div>
      <div className="w-full max-w-[400px] text-center">
        <img src="/logo.jpg" alt="LOBOKO" className="w-[120px] h-auto rounded-2xl mx-auto mb-6 object-contain" />
        <h1 className="text-[1.75rem] font-bold text-[var(--text-primary)] mb-2 tracking-tight">Créer un compte</h1>
        <p className="text-[0.95rem] text-[var(--text-secondary)] mb-8">
          Rejoignez LOBOKO — trouvez des professionnels qualifiés ou proposez vos services.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Full name */}
          <div className="text-left">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Nom complet <span className="text-red-500">*</span>
            </label>
            <input type="text" placeholder="Entrez votre nom complet" required
              className="w-full py-3.5 px-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-base outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)]" />
          </div>

          {/* Account type */}
          <div className="text-left">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Type de compte <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col gap-2.5 mt-2">
              <label
                className={`flex items-center gap-3 py-3.5 px-4 bg-[var(--bg-surface)] border rounded-xl cursor-pointer transition-all hover:bg-[var(--bg-surface-hover)] hover:border-[var(--accent)]
                  ${accountType === 'client' ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border-color)]'}`}
                onClick={() => setAccountType('client')}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 relative transition-all
                  ${accountType === 'client' ? 'border-[var(--accent)]' : 'border-[var(--border-color)]'}`}>
                  {accountType === 'client' && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[var(--accent)] rounded-full" />
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <strong className="text-[0.9rem] text-[var(--text-primary)]">Client</strong>
                  <small className="text-xs text-[var(--text-muted)]">Je recherche des prestataires de services</small>
                </div>
              </label>
              <label
                className={`flex items-center gap-3 py-3.5 px-4 bg-[var(--bg-surface)] border rounded-xl cursor-pointer transition-all hover:bg-[var(--bg-surface-hover)] hover:border-[var(--accent)]
                  ${accountType === 'prestataire' ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border-color)]'}`}
                onClick={() => setAccountType('prestataire')}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 relative transition-all
                  ${accountType === 'prestataire' ? 'border-[var(--accent)]' : 'border-[var(--border-color)]'}`}>
                  {accountType === 'prestataire' && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[var(--accent)] rounded-full" />
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <strong className="text-[0.9rem] text-[var(--text-primary)]">Prestataire de service</strong>
                  <small className="text-xs text-[var(--text-muted)]">Je propose mes services professionnels</small>
                </div>
              </label>
            </div>
          </div>

          {/* Service field (prestataire only) */}
          {accountType === 'prestataire' && (
            <div className="text-left animate-fadeSlideIn">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Quel service proposez-vous ? <span className="text-red-500">*</span>
              </label>
              <input type="text" placeholder="Ex: Coiffeur, Plombier, Électricien, Menuisier..." required
                className="w-full py-3.5 px-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-base outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)]" />
              <small className="block text-xs text-[var(--text-muted)] mt-1.5">Décrivez le service que vous offrez à vos clients</small>
            </div>
          )}

          {/* Phone */}
          <div className="text-left">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Numéro de téléphone <span className="text-red-500">*</span>
            </label>
            <input type="tel" placeholder="Ex: +243 812 345 678" required
              className="w-full py-3.5 px-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-base outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)]" />
          </div>

          {/* Email */}
          <div className="text-left">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Adresse e-mail (optionnel)
            </label>
            <input type="email" placeholder="Entrez votre adresse e-mail"
              className="w-full py-3.5 px-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-base outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)]" />
          </div>

          {/* Password */}
          <div className="text-left">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Mot de passe <span className="text-red-500">*</span>
            </label>
            <input type="password" name="password" placeholder="Créez un mot de passe" required
              className="w-full py-3.5 px-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-base outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)]" />
          </div>

          {/* Confirm Password */}
          <div className="text-left">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Confirmer le mot de passe <span className="text-red-500">*</span>
            </label>
            <input type="password" name="confirm-password" placeholder="Confirmez votre mot de passe" required
              className="w-full py-3.5 px-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-base outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)]" />
          </div>

          <button type="submit"
            className="w-full py-3.5 px-6 bg-[var(--accent)] text-white border-none rounded-xl text-base font-semibold cursor-pointer mt-2 hover:bg-[var(--accent-hover)] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(139,92,246,0.3)] active:translate-y-0 transition-all">
            Créer mon compte
          </button>
        </form>
        <p className="mt-6 text-sm text-[var(--text-muted)]">
          Déjà un compte ?{' '}
          <Link to="/" className="text-[var(--accent)] font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}