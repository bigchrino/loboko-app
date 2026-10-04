import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAppPreferences } from '@/lib/use-app-preferences';

type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';
interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (t: ThemePreference) => void;
}
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
function savedTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem('loboko-theme');
    return saved === 'light' || saved === 'system' ? saved : 'dark';
  } catch { return 'dark'; }
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(savedTheme);
  const [systemDark, setSystemDark] = useState(() => typeof window !== 'undefined'
    && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const { reduceMotion } = useAppPreferences();
  const theme: Theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    const storage = (event: StorageEvent) => {
      if (event.key === 'loboko-theme' || event.key === null) setPreference(savedTheme());
    };
    window.addEventListener('storage', storage);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('storage', storage);
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.setAttribute('data-reduce-motion', String(reduceMotion));
  }, [reduceMotion]);
  const setTheme = (value: ThemePreference) => {
    setPreference(value);
    try { localStorage.setItem('loboko-theme', value); } catch { /* Applies for this session. */ }
  };
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  return <ThemeContext.Provider value={{ theme, preference, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
