import Logo from './Logo';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Écran affiché pendant les courts instants où l'app vérifie la session
 * (au premier chargement, ou en attendant le profil) — remplace l'ancien
 * spinner bleu nu par le logo LOBOKO, sur fond noir ou blanc selon le
 * thème choisi par la personne (noir par défaut, comme le thème sombre
 * est déjà celui par défaut de l'app). Inspiré de l'écran "from Meta" de
 * WhatsApp au démarrage.
 */
export default function SplashScreen() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  return (
    <div
      className={`fixed inset-0 z-[999] flex flex-col ${
        isDark ? 'bg-black' : 'bg-white'
      }`}
    >
      <div className="flex-1 flex items-center justify-center">
        <Logo variant="login" size="2xl" />
      </div>

      <div className="pb-12 flex flex-col items-center gap-1">
        <span className={`text-xs ${isDark ? 'text-white/40' : 'text-black/40'}`}>
          from
        </span>
        <span
          className={`text-sm font-semibold ${
            isDark ? 'text-white/70' : 'text-black/70'
          }`}
        >
          CMB Corporation
        </span>
      </div>
    </div>
  );
}
