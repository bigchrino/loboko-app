import { useState, useEffect, useCallback } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

/* ============================================
   THEME MANAGEMENT
   ============================================ */
function getInitialTheme(): 'dark' | 'light' {
  const saved = localStorage.getItem('loboko-theme')
  return (saved === 'light' ? 'light' : 'dark')
}

export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('loboko-theme', theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}

/* ============================================
   THEME TOGGLE BUTTON
   ============================================ */
export function ThemeToggle({ theme, toggle }: { theme: string; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      className="relative w-[52px] h-7 rounded-full border cursor-pointer flex items-center px-1 flex-shrink-0 transition-all duration-300
        bg-[var(--toggle-bg)] border-[var(--border-color)] hover:border-[var(--accent)]"
      title="Changer de thème"
    >
      <span className="text-xs absolute right-[7px]" style={{ opacity: theme === 'light' ? 1 : 0.4 }}>☀️</span>
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm transition-transform duration-300 bg-white"
        style={{ transform: theme === 'light' ? 'translateX(24px)' : 'translateX(0)' }}
      >
        <span className="text-[0.7rem] leading-none">{theme === 'dark' ? '🌙' : '☀️'}</span>
      </div>
    </button>
  )
}

/* ============================================
   NAV TABS CONFIG
   ============================================ */
const navTabs = [
  { href: '/accueil', label: 'Accueil', icon: '🏠' },
  { href: '/decouverte', label: 'Découverte', icon: '🔍' },
  { href: '/messages', label: 'Messages', icon: '💬' },
  { href: '/suggestion', label: 'Suggestion', icon: '💡' },
  { href: '/entreprise', label: 'Entreprise', icon: '🏢' },
  { href: '/notifications', label: 'Notifications', icon: '🔔', badge: 3 },
  { href: '/panier', label: 'Panier', icon: '🛒' },
  { href: '/urgences', label: 'Urgences', icon: '🚨' },
  { href: '/menu', label: 'Menu', icon: '☰' },
]

/* ============================================
   HEADER
   ============================================ */
function AppHeader({ theme, toggle }: { theme: string; toggle: () => void }) {
  return (
    <header className="flex items-center justify-between px-5 py-3 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] sticky top-0 z-[100] backdrop-blur-[20px]">
      <img src="/logo.jpg" alt="LOBOKO" className="h-8 w-auto rounded-lg" />
      <div className="flex items-center gap-3">
        <ThemeToggle theme={theme} toggle={toggle} />
        <Link to="/profil" className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all">
          👤
        </Link>
      </div>
    </header>
  )
}

/* ============================================
   BOTTOM NAVBAR
   ============================================ */
function BottomNavbar() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg-elevated)] border-t border-[var(--border-color)] z-[100] pb-[env(safe-area-inset-bottom,8px)] pt-1.5 backdrop-blur-[20px]
      lg:top-0 lg:bottom-auto lg:right-auto lg:w-60 lg:h-screen lg:border-t-0 lg:border-r lg:pt-5">
      <div className="hidden lg:block px-5 pb-5 text-xl font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] mb-3">
        LOBOKO
      </div>
      <div className="flex justify-start items-center max-w-[600px] mx-auto px-3 gap-2 overflow-x-auto scrollbar-hide
        lg:flex-col lg:items-stretch lg:px-3 lg:overflow-x-visible lg:gap-0.5 lg:max-w-none">
        {navTabs.map(tab => {
          const isActive = location.pathname === tab.href || location.pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={`relative flex flex-col items-center justify-center py-2 px-3 rounded-xl text-[0.65rem] font-medium whitespace-nowrap min-w-[60px] flex-shrink-0 text-center gap-1 transition-all active:scale-[0.92]
                lg:flex-row lg:justify-start lg:text-[0.9rem] lg:py-3 lg:px-4 lg:rounded-xl lg:min-w-0 lg:gap-3
                ${isActive
                  ? 'text-[var(--accent)] bg-[var(--accent-light)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)]'
                }`}
            >
              <span className="text-xl lg:text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="absolute top-0.5 right-1 min-w-[18px] h-[18px] px-[5px] bg-red-500 text-white text-[0.65rem] font-bold rounded-full flex items-center justify-center leading-none shadow-[0_2px_6px_rgba(239,68,68,0.4)] animate-pulse z-[2]">
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[var(--accent)] rounded-full lg:hidden" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/* ============================================
   LAYOUT
   ============================================ */
export default function Layout() {
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-inter">
      <AppHeader theme={theme} toggle={toggle} />
      <BottomNavbar />
      <main className="px-5 py-6 pb-[100px] max-w-[600px] mx-auto lg:ml-60 lg:max-w-[800px] lg:px-10 lg:pb-10 animate-fadeSlideIn">
        <Outlet />
      </main>
    </div>
  )
}