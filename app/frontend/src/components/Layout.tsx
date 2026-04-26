import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import LogoutConfirm from '@/components/LogoutConfirm';
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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
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
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
          {desktopNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[rgba(37,99,235,0.15)] text-[#2563eb]'
                    : 'text-[var(--loboko-text-secondary)] hover:bg-[var(--loboko-surface-hover)] hover:text-[var(--loboko-text)]'
                }`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
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
          <img
            src="/assets/logo.jpg"
            alt="LOBOKO"
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-contain bg-black p-0.5 shrink-0"
          />
          {title && title !== 'LOBOKO' && (
            <>
              <span className="h-5 w-px bg-[var(--loboko-border)] shrink-0" />
              <span className="text-sm font-semibold text-[var(--loboko-text)] truncate">
                {title}
              </span>
            </>
          )}
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full bg-[var(--loboko-surface)] text-[var(--loboko-text-secondary)] hover:text-[var(--loboko-text)]"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Main content */}
      <main className="lg:ml-60 min-h-screen pb-24 lg:pb-8">
        <div className="max-w-2xl mx-auto px-4 lg:px-8 py-4 lg:py-8">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--loboko-elevated)] border-t border-[var(--loboko-border)] backdrop-blur">
        <div className="flex justify-around items-center px-2 py-2 pb-[env(safe-area-inset-bottom,8px)]">
          {mobileNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl min-w-[56px] transition-all ${
                  isActive ? 'text-[#2563eb] bg-[rgba(37,99,235,0.15)]' : 'text-[var(--loboko-text-muted)]'
                }`
              }
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
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