import { useState, type ReactNode } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Palette, LogOut, User, Shield, HelpCircle, Sparkles, RotateCcw, Wifi, Accessibility, MessageSquare, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import LogoutConfirm from '@/components/LogoutConfirm';
import ConfirmDialog from '@/components/ConfirmDialog';
import PushNotificationSettings from '@/components/PushNotificationSettings';
import PasswordSettings from '@/components/PasswordSettings';
import { useAppPreferences } from '@/lib/use-app-preferences';
import { saveAppPreferences, type AppPreferences } from '@/lib/app-preferences';
import { resetServiceInterests } from '@/lib/service-recommendations';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mb-5">
    <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--loboko-text-secondary)]">{title}</h2>
    <div className="overflow-hidden rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] divide-y divide-[var(--loboko-border)]">{children}</div>
  </section>;
}
function SettingRow({ icon, label, description, onClick, disabled, children }: {
  icon: ReactNode; label: string; description?: string; onClick?: () => void; disabled?: boolean; children?: ReactNode;
}) {
  const content = <>{icon}<div className="min-w-0 flex-1 text-left"><div className="text-sm font-medium">{label}</div>
    {description && <div className="mt-1 text-xs text-[var(--loboko-text-secondary)] leading-relaxed">{description}</div>}</div>{children ?? <ChevronRight size={16} className="shrink-0 text-[var(--loboko-text-secondary)]" />}</>;
  const className = 'w-full flex items-center gap-3 px-4 py-4';
  return onClick ? <button type="button" disabled={disabled} onClick={onClick} className={`${className} text-left hover:bg-[var(--loboko-surface-hover)] disabled:opacity-50`}>{content}</button>
    : <div className={className}>{content}</div>;
}
function ToggleSetting({ icon, label, description, value, onChange }: { icon: ReactNode; label: string; description: string; value: boolean; onChange: () => void }) {
  return <button type="button" role="switch" aria-checked={value} aria-label={label} onClick={onChange}
    className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-[var(--loboko-surface-hover)]">
    {icon}<div className="min-w-0 flex-1"><div className="text-sm font-medium">{label}</div><div className="mt-1 text-xs leading-relaxed text-[var(--loboko-text-secondary)]">{description}</div></div>
    <span aria-hidden="true" className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${value ? 'bg-[#2563eb]' : 'bg-[var(--loboko-border)]'}`}>
      <span className={`h-5 w-5 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </span>
  </button>;
}
const iconClass = 'shrink-0 text-[#2563eb]';

export default function Settings() {
  const { logout, profile, user } = useAuth();
  const { preference, setTheme } = useTheme();
  const device = useAppPreferences();
  const account = useAppPreferences(user?.id ?? 'guest');
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const update = (patch: Partial<AppPreferences>, owner = 'device') => {
    try { saveAppPreferences(patch, owner); }
    catch { toast.error('Impossible de sauvegarder ce réglage sur cet appareil.'); }
  };
  const reset = async () => {
    if (!user || resetting) return;
    setResetting(true);
    try {
      await resetServiceInterests(user.id);
      toast.success('Vos intérêts de services ont été réinitialisés');
      setShowReset(false);
    } catch { toast.error('Impossible de réinitialiser les suggestions. Réessayez.'); }
    finally { setResetting(false); }
  };
  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); navigate('/'); }
    catch { toast.error('Impossible de vous déconnecter. Réessayez.'); }
    finally { setLoggingOut(false); setShowLogoutConfirm(false); }
  };
  return <Layout title="Paramètres">
    <div className="mx-auto w-full max-w-2xl pb-4">
      <h1 className="mb-4 hidden text-2xl font-bold lg:block">Paramètres</h1>
      <button type="button" onClick={() => navigate('/profile')} className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-[var(--loboko-border)] bg-[var(--loboko-surface)] p-4 text-left">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] font-bold text-white">{(profile?.display_name || profile?.username || 'L').slice(0, 2).toUpperCase()}</span>
        <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{profile?.display_name || profile?.username || 'Utilisateur'}</span><span className="block truncate text-xs text-[var(--loboko-text-secondary)]">{user?.email || (profile ? `@${profile.username}` : '')}</span></span>
        <ChevronRight size={18} />
      </button>
      <Section title="Compte et sécurité">
        <SettingRow icon={<User size={18} className={iconClass} />} label="Modifier le profil" description="Nom, photo et informations personnelles" onClick={() => navigate('/profile')} />
        <SettingRow icon={<Shield size={18} className={iconClass} />} label="Changement de compte" description="Demander à devenir client ou prestataire" onClick={() => navigate('/settings/role-change')} />
        {user && <PasswordSettings key={user.id} userId={user.id} />}
      </Section>
      <Section title="Apparence et accessibilité">
        <div className="p-4">
          <label htmlFor="theme-preference" className="mb-3 flex items-center gap-3 text-sm font-medium"><Palette size={18} className={iconClass} />Thème de l’application</label>
          <select id="theme-preference" value={preference} onChange={e => setTheme(e.target.value as ThemePreference)} className="w-full rounded-xl border border-[var(--loboko-border)] bg-[var(--loboko-bg)] px-3 py-3 text-base">
            <option value="system">Automatique · suivre l’appareil</option><option value="light">Clair</option><option value="dark">Sombre</option>
          </select>
        </div>
        <ToggleSetting icon={<Accessibility size={18} className={iconClass} />} label="Réduire les animations" description="Limite les mouvements et transitions. Le réglage d’accessibilité de votre appareil est également respecté." value={device.reduceMotion} onChange={() => update({ reduceMotion: !device.reduceMotion })} />
      </Section>
      <Section title="Médias et connexion">
        <ToggleSetting icon={<Wifi size={18} className={iconClass} />} label="Économiser les données vidéo" description="Charge les vidéos à la lecture, plutôt qu’à l’affichage. Les aperçus déjà disponibles restent visibles. Les photos et les envois ne changent pas." value={device.saveData} onChange={() => update({ saveData: !device.saveData })} />
        <p className="px-4 py-3 text-xs text-[var(--loboko-text-secondary)]">Les réglages d’affichage et de données sont conservés sur cet appareil.</p>
      </Section>
      <Section title="Confidentialité et personnalisation">
        <SettingRow icon={<Shield size={18} className={iconClass} />} label="Contacts bloqués" description="Consulter et gérer les personnes que vous avez bloquées" onClick={() => navigate('/settings/privacy')} />
        <ToggleSetting icon={<Sparkles size={18} className={iconClass} />} label="Suggestions personnalisées de services" description="Affiche des services selon vos recherches et vos choix. Désactiver masque ces suggestions et arrête la collecte de nouveaux intérêts sur cet appareil, pour ce compte." value={account.personalizedServices} onChange={() => { if (user) update({ personalizedServices: !account.personalizedServices }, user.id); }} />
        <SettingRow icon={<RotateCcw size={18} className={iconClass} />} label="Réinitialiser mes intérêts" description="Efface les intérêts enregistrés pour les suggestions de services de votre compte" disabled={resetting} onClick={() => setShowReset(true)} />
      </Section>
      <section className="mb-5"><h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--loboko-text-secondary)]">Notifications</h2><PushNotificationSettings /></section>
      <Section title="Aide et informations">
        <SettingRow icon={<HelpCircle size={18} className={iconClass} />} label="Aide et support" description="Questions fréquentes et contact CMB Corporation" onClick={() => navigate('/settings/help')} />
        <SettingRow icon={<MessageSquare size={18} className={iconClass} />} label="Faire une suggestion" description="Partagez une idée pour améliorer LOBOKO" onClick={() => navigate('/suggestion')} />
      </Section>
      <button type="button" onClick={() => setShowLogoutConfirm(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-3.5 font-semibold text-red-500"><LogOut size={18} />Se déconnecter</button>
      <p className="mt-6 text-center text-xs text-[var(--loboko-text-secondary)]">LOBOKO · CMB Corporation · © {new Date().getFullYear()}</p>
    </div>
    <ConfirmDialog open={showReset} title="Réinitialiser vos intérêts ?" description="Les intérêts utilisés pour les suggestions de services seront effacés pour votre compte, sur tous vos appareils. Vos publications, messages et commandes sont conservés." confirmLabel="Réinitialiser" onConfirm={reset} onCancel={() => { if (!resetting) setShowReset(false); }} loading={resetting} />
    <LogoutConfirm open={showLogoutConfirm} onCancel={() => { if (!loggingOut) setShowLogoutConfirm(false); }} onConfirm={handleLogout} loading={loggingOut} />
  </Layout>;
}
