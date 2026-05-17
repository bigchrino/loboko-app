import { ReactNode, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import LogoutConfirm from '@/components/LogoutConfirm';
import { getMediaUrl } from '@/lib/storage-helpers';
import {
  Home,
  Compass,
  MessageCircle,
  Bell,
  User,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu as MenuIcon,
  Lightbulb,
  Building2,
  ShoppingCart,
  Siren,
  Search,
  Phone,
  Circle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useMessages } from '@/contexts/MessagesContext';
import { useMissedCalls } from '@/contexts/MissedCallsContext';
import Logo from '@/components/Logo';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

const mobileNavItems = [
  { to: '/home', label: 'Accueil', icon: Home },
  { to: '/discover', label: 'Découverte', icon: Compass },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/notifications', label: 'Notifs', icon: Bell },
  { to: '/menu', label: 'Menu', icon: MenuIcon },
];

const desktopNavItems = [
  { to: '/home', label: 'Accueil', icon: Home },
  { to: '/discover', label: 'Découverte', icon: Compass },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/statuses', label: 'Statuts', icon: Circle },
  { to: '/calls', label: 'Appels', icon: Phone },
  { to: '/suggestion', label: 'Suggestion', icon: Lightbulb },
  { to: '/entreprise', label: 'Entreprise', icon: Building2 },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/panier', label: 'Panier', icon: ShoppingCart },
  { to: '/urgences', label: 'Urgences', icon: Siren },
  { to: '/recherches', label: 'Recherches', icon: Search },
  { to: '/profile', label: 'Profil', icon: User },
];

export default function Layout({ children, title }: LayoutProps) {
  const { logout, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const { unreadCount: unreadMessagesCount } = useMessages();
  const { unseenMissed } = useMissedCalls();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Resolve avatar_key -> signed/public URL whenever the profile's avatar changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile?.avatar_key) {
        if (!cancelled) setAvatarUrl(null);
        return;
      }
      try {
        const url = await getMediaUrl(profile.avatar_key);
        if (!cancelled) setAvatarUrl(url || null);
      } catch {
        if (!cancelled) setAvatarUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.avatar_key]);

  const avatarInitials = (
    profile?.display_name ||
    profile?.username ||
    'U'
  )
    .slice(0, 2)
    .toUpperCase();

  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const unreadMessagesLabel =
    unreadMessagesCount > 99 ? '99+' : String(unreadMessagesCount);

  const unseenMissedLabel = unseenMissed > 99 ? '99+' : String(unseenMissed);

  const badgeFor = (to: string): { count: number; label: string } | null => {
    if (to === '/notifications' && unreadCount > 0)
      return { count: unreadCount, label: unreadLabel };
    if (to === '/messages' && unreadMessagesCount > 0)
      return { count: unreadMessagesCount, label: unreadMessagesLabel };
    // Show the missed-calls badge on the desktop "Appels" link and on the
    // mobile "Menu" entry (since /calls lives inside the mobile menu page).
    if (to === '/calls' && unseenMissed > 0)
      return { count: unseenMissed, label: unseenMissedLabel };
    if (to === '/menu' && unseenMissed > 0)
      return { count: unseenMissed, label: unseenMissedLabel };
    return null;
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/');
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--loboko-bg)] text-[var(--loboko-text)]">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-60 flex-col border-r border-[var(--loboko-border)] bg-[var(--loboko-elevated)] z-40">
        <div className="px-6 py-6 border-b border-[var(--loboko-border)]">
          <div className="flex items-center">
            <Logo size="lg" />
          </div>
          {profile?.role && (
            <span className="inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold bg-[rgba(37,99,235,0.15)] text-[#2563eb] capitalize">
              {profile.role}
            </span>
          )}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {desktopNavItems.map(({ to, label, icon: Icon }) => {
            const badge = badgeFor(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[rgba(37,99,235,0.15)] text-[#2563eb]'
                      : 'text-[var(--loboko-text-secondary)] hover:bg-[var(--loboko-surface-hover)] hover:text-[var(--loboko-text)]'
                  }`
                }
              >
                <div className="relative">
                  <Icon size={20} />
                  {badge && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {badge.label}
                    </span>
                  )}
                </div>
                <span>{label}</span>
              </NavLink>
            );
          })}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[rgba(37,99,235,0.15)] text-[#2563eb]'
                  : 'text-[var(--loboko-text-secondary)] hover:bg-[var(--loboko-surface-hover)] hover:text-[var(--loboko-text)]'
              }`
            }
          >
            <Settings size={20} />
            <span>Paramètres</span>
          </NavLink>
        </nav>
        <div className="px-3 py-3 border-t border-[var(--loboko-border)] space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--loboko-text-secondary)] hover:bg-[var(--loboko-surface-hover)] hover:text-[var(--loboko-text)] transition-all"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            <span>{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--loboko-text-secondary)] hover:bg-[var(--loboko-surface-hover)] hover:text-[var(--loboko-text)] transition-all"
          >
            <LogOut size={20} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile top header */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-[var(--loboko-elevated)] border-b border-[var(--loboko-border)] backdrop-blur">
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo size="md" />
          {title && title !== 'LOBOKO' && (
            <>
              <span className="h-5 w-px bg-[var(--loboko-border)] shrink-0" />
              <span className="text-sm font-semibold text-[var(--loboko-text)] truncate">
                {title}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="w-9 h-9 rounded-full bg-[var(--loboko-surface)] border border-[var(--loboko-border)] overflow-hidden flex items-center justify-center text-[11px] font-bold text-[var(--loboko-text)] hover:opacity-80 hover:scale-105 transition shrink-0"
            aria-label="Mon profil"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Mon profil"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{avatarInitials}</span>
            )}
          </button>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full bg-[var(--loboko-surface)] text-[var(--loboko-text-secondary)] hover:text-[var(--loboko-text)] flex items-center justify-center shrink-0"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main
        className="lg:ml-60 min-h-screen pb-24 lg:pb-8"
        style={{ overflowAnchor: 'none' }}
      >
        <div className="max-w-2xl mx-auto px-4 lg:px-8 py-4 lg:py-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--loboko-elevated)] border-t border-[var(--loboko-border)] backdrop-blur">
        <div className="flex justify-around items-center px-2 py-2 pb-[env(safe-area-inset-bottom,8px)]">
          {mobileNavItems.map(({ to, label, icon: Icon }) => {
            const badge = badgeFor(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl min-w-[56px] transition-all ${
                    isActive ? 'text-[#2563eb] bg-[rgba(37,99,235,0.15)]' : 'text-[var(--loboko-text-muted)]'
                  }`
                }
              >
                <div className="relative">
                  <Icon size={20} />
                  {badge && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {badge.label}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <LogoutConfirm
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        loading={loggingOut}
      />
    </div>
  );
}
