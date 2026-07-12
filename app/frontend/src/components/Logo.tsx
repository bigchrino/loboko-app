import logoMain from '@/assets/logo-main.png';
import logoLogin from '@/assets/logo-login.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /**
   * 'default' — logo horizontal (icône + texte côte à côte), utilisé
   * partout dans l'app (en-tête, menu latéral...).
   * 'login'   — logo empilé (icône au-dessus du texte), réservé à l'écran
   * de connexion/inscription.
   */
  variant?: 'default' | 'login';
}

// Hauteurs de rendu par taille — la largeur suit automatiquement pour
// préserver les proportions de chaque image (elles n'ont pas le même
// ratio : le logo par défaut est très large, celui de connexion est
// plus carré).
const sizeMap = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-11',
  xl: 'h-16',
  '2xl': 'h-28',
};

export default function Logo({ className = '', size = 'md', variant = 'default' }: LogoProps) {
  const src = variant === 'login' ? logoLogin : logoMain;
  return (
    <img
      src={src}
      alt="LOBOKO"
      className={`w-auto select-none ${sizeMap[size]} ${className}`}
    />
  );
}
