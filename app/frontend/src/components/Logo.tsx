interface LogoProps {
  variant?: 'full' | 'icon';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-5xl',
};

export default function Logo({ className = '', size = 'md' }: LogoProps) {
  return (
    <span
      className={`font-extrabold tracking-tight leading-none bg-gradient-to-r from-[#2563eb] via-[#22c55e] to-[#f59e0b] bg-clip-text text-transparent select-none ${sizeMap[size]} ${className}`}
    >
      LOBOKO
    </span>
  );
}