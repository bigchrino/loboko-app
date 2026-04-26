import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme, ThemeToggle } from '../components/Layout'

/* ============================================
   SHARED COMPONENTS
   ============================================ */
function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-[var(--border-color)]">
      <span className="text-2xl">{icon}</span>
      <h1 className="text-xl font-bold">{title}</h1>
    </div>
  )
}

function BackButton({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full text-[var(--text-secondary)] text-[0.9rem] font-medium mb-5 hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all">
      ← Retour
    </Link>
  )
}

/* ============================================
   TOGGLE SWITCH
   ============================================ */
function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-12 h-7 rounded-full transition-all duration-300 flex-shrink-0 ${
        enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border-color)]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-300 ${
          enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

/* ============================================
   SETTING ITEM
   ============================================ */
function SettingItem({
  icon,
  title,
  desc,
  rightElement,
  onClick,
}: {
  icon: string
  title: string
  desc?: string
  rightElement?: React.ReactNode
  onClick?: () => void
}) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      className={`flex items-center gap-4 w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl py-4 px-5 mb-2.5 transition-all text-left ${
        onClick ? 'cursor-pointer hover:bg-[var(--bg-surface-hover)] hover:border-[var(--accent)] active:scale-[0.98]' : ''
      }`}
    >
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[0.95rem] font-semibold text-[var(--text-primary)]">{title}</div>
        {desc && <div className="text-sm text-[var(--text-muted)] mt-0.5">{desc}</div>}
      </div>
      {rightElement || (onClick && <span className="text-lg text-[var(--text-muted)]">→</span>)}
    </Wrapper>
  )
}

/* ============================================
   SECTION GROUP
   ============================================ */
function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 px-1">{title}</h2>
      {children}
    </div>
  )
}

/* ============================================
   SELECT MODAL
   ============================================ */
function SelectModal({
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  title: string
  options: { value: string; label: string; desc?: string }[]
  selected: string
  onSelect: (v: string) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[8px] flex items-end sm:items-center justify-center z-[1000] p-0 sm:p-5 animate-[fadeIn_0.2s_ease]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-[400px] shadow-[0_20px_60px_rgba(0,0,0,0.4)] animate-[bubbleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">✕</button>
        </div>
        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onSelect(opt.value); onClose() }}
              className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all ${
                selected === opt.value
                  ? 'bg-[var(--accent-light)] border-2 border-[var(--accent)]'
                  : 'bg-[var(--bg-surface-hover)] border-2 border-transparent hover:border-[var(--border-color)]'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selected === opt.value ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--text-muted)]'
              }`}>
                {selected === opt.value && <span className="text-white text-xs">✓</span>}
              </div>
              <div>
                <div className="text-[0.95rem] font-medium text-[var(--text-primary)]">{opt.label}</div>
                {opt.desc && <div className="text-xs text-[var(--text-muted)] mt-0.5">{opt.desc}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============================================
   CONFIRM MODAL
   ============================================ */
function ConfirmModal({
  icon,
  title,
  message,
  confirmText,
  confirmColor,
  onConfirm,
  onClose,
}: {
  icon: string
  title: string
  message: string
  confirmText: string
  confirmColor?: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[8px] flex items-center justify-center z-[1000] p-5 animate-[fadeIn_0.2s_ease]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-8 max-w-[380px] w-full text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)] animate-[bubbleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="text-4xl mb-4">{icon}</div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">{title}</h2>
        <p className="text-[0.9rem] text-[var(--text-secondary)] leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-5 bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-xl text-[0.9rem] font-semibold cursor-pointer hover:bg-[var(--border-color)] transition-all"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 px-5 text-white border-none rounded-xl text-[0.9rem] font-semibold cursor-pointer hover:-translate-y-0.5 transition-all ${
              confirmColor || 'bg-red-500 hover:bg-red-600 hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================
   EDIT PROFILE MODAL
   ============================================ */
function EditProfileModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('Utilisateur LOBOKO')
  const [bio, setBio] = useState('Bienvenue sur LOBOKO !')
  const [phone, setPhone] = useState('+243 XXX XXX XXX')
  const [email, setEmail] = useState('utilisateur@loboko.com')

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[8px] flex items-end sm:items-center justify-center z-[1000] p-0 sm:p-5 animate-[fadeIn_0.2s_ease]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-[440px] max-h-[85vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.4)] animate-[bubbleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Modifier le profil</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">✕</button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-[var(--bg-surface-hover)] border-[3px] border-[var(--accent)] flex items-center justify-center text-3xl mb-3">👤</div>
          <button className="text-sm text-[var(--accent)] font-medium hover:underline">Changer la photo</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Nom complet</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 bg-[var(--bg-surface-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-[0.95rem] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)] transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full px-4 py-3 bg-[var(--bg-surface-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-[0.95rem] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)] transition-all resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Téléphone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3 bg-[var(--bg-surface-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-[0.95rem] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)] transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full px-4 py-3 bg-[var(--bg-surface-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-[0.95rem] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)] transition-all" />
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3.5 bg-[var(--accent)] text-white rounded-xl text-[0.95rem] font-semibold hover:bg-[var(--accent-hover)] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_var(--accent-light)] transition-all"
        >
          Enregistrer
        </button>
      </div>
    </div>
  )
}

/* ============================================
   CHANGE PASSWORD MODAL
   ============================================ */
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[8px] flex items-end sm:items-center justify-center z-[1000] p-0 sm:p-5 animate-[fadeIn_0.2s_ease]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-[400px] shadow-[0_20px_60px_rgba(0,0,0,0.4)] animate-[bubbleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Changer le mot de passe</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Mot de passe actuel</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)} className="w-full px-4 py-3 pr-12 bg-[var(--bg-surface-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-[0.95rem] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)] transition-all" />
              <button onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">{showCurrent ? '🙈' : '👁️'}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Nouveau mot de passe</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full px-4 py-3 pr-12 bg-[var(--bg-surface-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-[0.95rem] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)] transition-all" />
              <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">{showNew ? '🙈' : '👁️'}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Confirmer le mot de passe</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full px-4 py-3 bg-[var(--bg-surface-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] text-[0.95rem] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-light)] transition-all" />
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3.5 bg-[var(--accent)] text-white rounded-xl text-[0.95rem] font-semibold hover:bg-[var(--accent-hover)] hover:-translate-y-0.5 hover:shadow-[0_4px_16px_var(--accent-light)] transition-all"
        >
          Mettre à jour
        </button>
      </div>
    </div>
  )
}

/* ============================================
   MAIN PARAMETRES PAGE
   ============================================ */
export default function Parametres() {
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  // Toggles state
  const [notifications, setNotifications] = useState(true)
  const [notifMessages, setNotifMessages] = useState(true)
  const [notifLikes, setNotifLikes] = useState(true)
  const [notifComments, setNotifComments] = useState(true)
  const [notifFollows, setNotifFollows] = useState(true)
  const [notifSound, setNotifSound] = useState(true)
  const [notifVibration, setNotifVibration] = useState(true)
  const [privateAccount, setPrivateAccount] = useState(false)
  const [showOnline, setShowOnline] = useState(true)
  const [showLastSeen, setShowLastSeen] = useState(true)
  const [showReadReceipts, setShowReadReceipts] = useState(true)
  const [twoFactor, setTwoFactor] = useState(false)
  const [biometric, setBiometric] = useState(false)
  const [autoDownload, setAutoDownload] = useState(true)
  const [dataSaver, setDataSaver] = useState(false)
  const [autoPlay, setAutoPlay] = useState(true)
  const [locationAccess, setLocationAccess] = useState(true)
  const [cameraAccess, setCameraAccess] = useState(true)
  const [micAccess, setMicAccess] = useState(true)
  const [contactSync, setContactSync] = useState(false)

  // Modals
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showLanguageModal, setShowLanguageModal] = useState(false)
  const [showFontSizeModal, setShowFontSizeModal] = useState(false)
  const [showCacheModal, setShowCacheModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [showBlockedModal, setShowBlockedModal] = useState(false)

  // Settings values
  const [language, setLanguage] = useState('fr')
  const [fontSize, setFontSize] = useState('normal')

  // Apply font size
  useEffect(() => {
    const sizes: Record<string, string> = { small: '14px', normal: '16px', large: '18px', xlarge: '20px' }
    document.documentElement.style.fontSize = sizes[fontSize] || '16px'
    return () => { document.documentElement.style.fontSize = '16px' }
  }, [fontSize])

  return (
    <>
      <BackButton to="/menu" />
      <SectionTitle icon="⚙️" title="Paramètres" />

      {/* ========== COMPTE ========== */}
      <SettingSection title="Compte">
        <SettingItem icon="👤" title="Modifier le profil" desc="Nom, photo, bio, téléphone" onClick={() => setShowEditProfile(true)} />
        <SettingItem icon="🔑" title="Changer le mot de passe" desc="Mettre à jour votre mot de passe" onClick={() => setShowChangePassword(true)} />
        <SettingItem icon="📧" title="Adresse email" desc="utilisateur@loboko.com" onClick={() => setShowEditProfile(true)} />
        <SettingItem icon="📱" title="Numéro de téléphone" desc="+243 XXX XXX XXX" onClick={() => setShowEditProfile(true)} />
      </SettingSection>

      {/* ========== CONFIDENTIALITÉ ========== */}
      <SettingSection title="Confidentialité">
        <SettingItem icon="🔒" title="Compte privé" desc="Seuls vos abonnés peuvent voir vos publications" rightElement={<ToggleSwitch enabled={privateAccount} onToggle={() => setPrivateAccount(!privateAccount)} />} />
        <SettingItem icon="🟢" title="Statut en ligne" desc="Montrer quand vous êtes en ligne" rightElement={<ToggleSwitch enabled={showOnline} onToggle={() => setShowOnline(!showOnline)} />} />
        <SettingItem icon="🕐" title="Dernière connexion" desc="Afficher votre dernière activité" rightElement={<ToggleSwitch enabled={showLastSeen} onToggle={() => setShowLastSeen(!showLastSeen)} />} />
        <SettingItem icon="✅" title="Confirmations de lecture" desc="Montrer quand vous avez lu un message" rightElement={<ToggleSwitch enabled={showReadReceipts} onToggle={() => setShowReadReceipts(!showReadReceipts)} />} />
        <SettingItem icon="🚫" title="Comptes bloqués" desc="Gérer les utilisateurs bloqués" onClick={() => setShowBlockedModal(true)} />
      </SettingSection>

      {/* ========== SÉCURITÉ ========== */}
      <SettingSection title="Sécurité">
        <SettingItem icon="🛡️" title="Authentification à deux facteurs" desc="Ajouter une couche de sécurité supplémentaire" rightElement={<ToggleSwitch enabled={twoFactor} onToggle={() => setTwoFactor(!twoFactor)} />} />
        <SettingItem icon="🔐" title="Verrouillage biométrique" desc="Empreinte digitale ou Face ID" rightElement={<ToggleSwitch enabled={biometric} onToggle={() => setBiometric(!biometric)} />} />
        <SettingItem icon="📋" title="Sessions actives" desc="Voir les appareils connectés" onClick={() => {}} />
        <SettingItem icon="🔄" title="Historique de connexion" desc="Consulter l'historique des connexions" onClick={() => {}} />
      </SettingSection>

      {/* ========== NOTIFICATIONS ========== */}
      <SettingSection title="Notifications">
        <SettingItem icon="🔔" title="Notifications push" desc="Activer ou désactiver les notifications" rightElement={<ToggleSwitch enabled={notifications} onToggle={() => setNotifications(!notifications)} />} />
        <SettingItem icon="💬" title="Messages" desc="Notifications de nouveaux messages" rightElement={<ToggleSwitch enabled={notifMessages} onToggle={() => setNotifMessages(!notifMessages)} />} />
        <SettingItem icon="❤️" title="J'aime" desc="Quand quelqu'un aime votre publication" rightElement={<ToggleSwitch enabled={notifLikes} onToggle={() => setNotifLikes(!notifLikes)} />} />
        <SettingItem icon="💭" title="Commentaires" desc="Quand quelqu'un commente votre publication" rightElement={<ToggleSwitch enabled={notifComments} onToggle={() => setNotifComments(!notifComments)} />} />
        <SettingItem icon="👥" title="Nouveaux abonnés" desc="Quand quelqu'un vous suit" rightElement={<ToggleSwitch enabled={notifFollows} onToggle={() => setNotifFollows(!notifFollows)} />} />
        <SettingItem icon="🔊" title="Son des notifications" desc="Jouer un son pour les notifications" rightElement={<ToggleSwitch enabled={notifSound} onToggle={() => setNotifSound(!notifSound)} />} />
        <SettingItem icon="📳" title="Vibration" desc="Vibrer pour les notifications" rightElement={<ToggleSwitch enabled={notifVibration} onToggle={() => setNotifVibration(!notifVibration)} />} />
      </SettingSection>

      {/* ========== APPARENCE ========== */}
      <SettingSection title="Apparence">
        <SettingItem
          icon={theme === 'dark' ? '🌙' : '☀️'}
          title="Thème"
          desc={theme === 'dark' ? 'Mode sombre activé' : 'Mode clair activé'}
          rightElement={<ThemeToggle theme={theme} toggle={toggle} />}
        />
        <SettingItem icon="🌐" title="Langue" desc={language === 'fr' ? 'Français' : language === 'en' ? 'English' : language === 'ln' ? 'Lingala' : 'Swahili'} onClick={() => setShowLanguageModal(true)} />
        <SettingItem icon="🔤" title="Taille du texte" desc={fontSize === 'small' ? 'Petit' : fontSize === 'normal' ? 'Normal' : fontSize === 'large' ? 'Grand' : 'Très grand'} onClick={() => setShowFontSizeModal(true)} />
      </SettingSection>

      {/* ========== STOCKAGE & DONNÉES ========== */}
      <SettingSection title="Stockage & Données">
        <SettingItem icon="📥" title="Téléchargement automatique" desc="Télécharger les médias automatiquement" rightElement={<ToggleSwitch enabled={autoDownload} onToggle={() => setAutoDownload(!autoDownload)} />} />
        <SettingItem icon="📊" title="Économiseur de données" desc="Réduire la consommation de données" rightElement={<ToggleSwitch enabled={dataSaver} onToggle={() => setDataSaver(!dataSaver)} />} />
        <SettingItem icon="▶️" title="Lecture auto des vidéos" desc="Lire les vidéos automatiquement" rightElement={<ToggleSwitch enabled={autoPlay} onToggle={() => setAutoPlay(!autoPlay)} />} />
        <SettingItem icon="🗑️" title="Vider le cache" desc="Libérer de l'espace de stockage" onClick={() => setShowCacheModal(true)} />
      </SettingSection>

      {/* ========== AUTORISATIONS ========== */}
      <SettingSection title="Autorisations">
        <SettingItem icon="📍" title="Localisation" desc="Accès à votre position" rightElement={<ToggleSwitch enabled={locationAccess} onToggle={() => setLocationAccess(!locationAccess)} />} />
        <SettingItem icon="📷" title="Caméra" desc="Accès à votre caméra" rightElement={<ToggleSwitch enabled={cameraAccess} onToggle={() => setCameraAccess(!cameraAccess)} />} />
        <SettingItem icon="🎤" title="Microphone" desc="Accès à votre microphone" rightElement={<ToggleSwitch enabled={micAccess} onToggle={() => setMicAccess(!micAccess)} />} />
        <SettingItem icon="📇" title="Synchronisation des contacts" desc="Trouver vos amis sur LOBOKO" rightElement={<ToggleSwitch enabled={contactSync} onToggle={() => setContactSync(!contactSync)} />} />
      </SettingSection>

      {/* ========== AIDE & SUPPORT ========== */}
      <SettingSection title="Aide & Support">
        <SettingItem icon="❓" title="Centre d'aide" desc="Questions fréquentes et guides" onClick={() => {}} />
        <SettingItem icon="📩" title="Nous contacter" desc="Envoyer un message au support" onClick={() => {}} />
        <SettingItem icon="🐛" title="Signaler un bug" desc="Aidez-nous à améliorer LOBOKO" onClick={() => {}} />
        <SettingItem icon="⭐" title="Évaluer l'application" desc="Donnez votre avis sur LOBOKO" onClick={() => {}} />
        <SettingItem icon="📜" title="Conditions d'utilisation" desc="Lire nos conditions générales" onClick={() => {}} />
        <SettingItem icon="🔏" title="Politique de confidentialité" desc="Comment nous protégeons vos données" onClick={() => {}} />
      </SettingSection>

      {/* ========== À PROPOS ========== */}
      <SettingSection title="À propos">
        <SettingItem icon="ℹ️" title="Version de l'application" desc="LOBOKO v1.0.0" />
        <SettingItem icon="📄" title="Licences open source" desc="Bibliothèques utilisées" onClick={() => {}} />
      </SettingSection>

      {/* ========== ZONE DANGER ========== */}
      <SettingSection title="Zone de danger">
        <SettingItem icon="⏸️" title="Désactiver le compte" desc="Suspendre temporairement votre compte" onClick={() => setShowDeactivateModal(true)} />
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-4 w-full bg-red-500/10 border border-red-500/30 rounded-2xl py-4 px-5 mb-2.5 transition-all cursor-pointer hover:bg-red-500/20 hover:border-red-500/50 active:scale-[0.98] text-left"
        >
          <span className="text-2xl flex-shrink-0">🗑️</span>
          <div className="flex-1 min-w-0">
            <div className="text-[0.95rem] font-semibold text-red-500">Supprimer le compte</div>
            <div className="text-sm text-red-400/70 mt-0.5">Cette action est irréversible</div>
          </div>
          <span className="text-lg text-red-400/50">→</span>
        </button>
      </SettingSection>

      {/* ========== MODALS ========== */}
      {showEditProfile && <EditProfileModal onClose={() => setShowEditProfile(false)} />}
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      {showLanguageModal && (
        <SelectModal
          title="Choisir la langue"
          options={[
            { value: 'fr', label: '🇫🇷 Français', desc: 'Langue par défaut' },
            { value: 'en', label: '🇬🇧 English', desc: 'English language' },
            { value: 'ln', label: '🇨🇩 Lingala', desc: 'Lokota ya Lingala' },
            { value: 'sw', label: '🇨🇩 Swahili', desc: 'Lugha ya Kiswahili' },
          ]}
          selected={language}
          onSelect={setLanguage}
          onClose={() => setShowLanguageModal(false)}
        />
      )}

      {showFontSizeModal && (
        <SelectModal
          title="Taille du texte"
          options={[
            { value: 'small', label: 'Petit', desc: 'Texte plus compact' },
            { value: 'normal', label: 'Normal', desc: 'Taille par défaut' },
            { value: 'large', label: 'Grand', desc: 'Texte plus lisible' },
            { value: 'xlarge', label: 'Très grand', desc: 'Accessibilité maximale' },
          ]}
          selected={fontSize}
          onSelect={setFontSize}
          onClose={() => setShowFontSizeModal(false)}
        />
      )}

      {showCacheModal && (
        <ConfirmModal
          icon="🗑️"
          title="Vider le cache"
          message="Cela supprimera les fichiers temporaires et libérera de l'espace. Vos données personnelles ne seront pas affectées."
          confirmText="Vider"
          confirmColor="bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
          onConfirm={() => setShowCacheModal(false)}
          onClose={() => setShowCacheModal(false)}
        />
      )}

      {showDeactivateModal && (
        <ConfirmModal
          icon="⏸️"
          title="Désactiver le compte"
          message="Votre compte sera temporairement suspendu. Vous pourrez le réactiver en vous reconnectant."
          confirmText="Désactiver"
          confirmColor="bg-orange-500 hover:bg-orange-600 hover:shadow-[0_4px_16px_rgba(249,115,22,0.3)]"
          onConfirm={() => { setShowDeactivateModal(false); navigate('/') }}
          onClose={() => setShowDeactivateModal(false)}
        />
      )}

      {showDeleteModal && (
        <ConfirmModal
          icon="🗑️"
          title="Supprimer le compte"
          message="Cette action est irréversible. Toutes vos données, publications, messages et contacts seront définitivement supprimés."
          confirmText="Supprimer"
          onConfirm={() => { setShowDeleteModal(false); navigate('/') }}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {showBlockedModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[8px] flex items-end sm:items-center justify-center z-[1000] p-0 sm:p-5 animate-[fadeIn_0.2s_ease]"
          onClick={(e) => { if (e.target === e.currentTarget) setShowBlockedModal(false) }}
        >
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-[400px] shadow-[0_20px_60px_rgba(0,0,0,0.4)] animate-[bubbleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Comptes bloqués</h3>
              <button onClick={() => setShowBlockedModal(false)} className="w-8 h-8 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">✕</button>
            </div>
            <div className="text-center py-10">
              <div className="text-4xl mb-3 opacity-50">🚫</div>
              <p className="text-[var(--text-muted)] text-[0.95rem]">Aucun compte bloqué</p>
              <p className="text-[var(--text-muted)] text-sm mt-1">Les comptes que vous bloquez apparaîtront ici.</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}