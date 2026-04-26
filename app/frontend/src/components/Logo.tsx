interface LogoProps {
  variant?: 'full' | 'icon';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
  xl: 'w-24 h-24',
};

export default function Logo({ className = '', size = 'md' }: LogoProps) {
  return (
    <div
      className={`${sizeMap[size]} rounded-2xl bg-black flex items-center justify-center overflow-hidden shadow-lg shadow-black/40 ${className}`}
    >
      <img
        src="/assets/logo.jpg"
        alt="LOBOKO"
        className="w-full h-full object-cover"
      />
    </div>
  );
}