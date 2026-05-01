import { Crown } from 'lucide-react';

/**
 * Small inline badge to mark a profile as premium.
 *
 * Variants:
 *  - `compact` — tiny crown chip for list cards.
 *  - `full`    — pill with "Premium" label for profile headers.
 */

interface Props {
  variant?: 'compact' | 'full';
  className?: string;
}

export default function PremiumBadge({ variant = 'compact', className = '' }: Props) {
  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white text-[10px] font-bold leading-none shrink-0 ${className}`}
        title="Compte premium"
      >
        <Crown size={10} />
        PRO
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white text-xs font-bold shadow-sm ${className}`}
    >
      <Crown size={12} />
      Premium
    </span>
  );
}