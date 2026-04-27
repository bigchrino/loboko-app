import logo from '@/assets/logo.png';

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
      src={logo}
      alt="LOBOKO"
      className={`${sizeMap[size]} w-auto object-contain ${className}`}
    />
  );
}