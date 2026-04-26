interface LogoProps {
  variant?: 'full' | 'icon';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: { full: 'h-6', icon: 'w-8 h-8' },
  md: { full: 'h-8', icon: 'w-10 h-10' },
  lg: { full: 'h-10', icon: 'w-12 h-12' },
  xl: { full: 'h-14', icon: 'w-16 h-16' },
};

export default function Logo({ variant = 'full', className = '', size = 'md' }: LogoProps) {
  if (variant === 'icon') {
    return (
      <div
        className={`${sizeMap[size].icon} rounded-xl bg-black flex items-center justify-center overflow-hidden ${className}`}
      >
        <img src="/assets/logo.jpg" alt="LOBOKO" className="w-full h-full object-contain" />
      </div>
    );
  }
  return (
    <img
      src="https://mgx-backend-cdn.metadl.com/generate/images/1045026/2026-04-26/nlykkciaafmq/logo_variant_1.png"
      alt="LOBOKO"
      className={`${sizeMap[size].full} w-auto object-contain ${className}`}
    />
  );
}