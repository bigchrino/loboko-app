import logoUrl from '@/assets/logo.jpg';

interface LogoProps {
  variant?: 'full' | 'icon';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'h-10',
  md: 'h-14',
  lg: 'h-20',
  xl: 'h-32',
};

export default function Logo({ className = '', size = 'md' }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt="LOBOKO"
      className={`${sizeMap[size]} w-auto object-contain ${className}`}
    />
  );
}