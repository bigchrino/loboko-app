import { Heart } from 'lucide-react';
import { FavoriteType } from '@/lib/marketplace';
import { useFavoriteToggle } from '@/lib/favorite-hooks';

interface Props {
  type: FavoriteType;
  targetId: string | null;
  className?: string;
  size?: number;
  /** When true, shows only the icon (no background). */
  ghost?: boolean;
  ariaLabel?: string;
}

/**
 * Reusable heart-shaped favorite toggle.
 *
 * - Optimistic UI via `useFavoriteToggle`.
 * - Stops event propagation so it can be placed on top of clickable cards.
 */
export default function FavoriteButton({
  type,
  targetId,
  className = '',
  size = 18,
  ghost = false,
  ariaLabel,
}: Props) {
  const { favorited, toggling, toggle } = useFavoriteToggle(type, targetId);
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={toggling || !targetId}
      aria-label={ariaLabel || (favorited ? 'Retirer des favoris' : 'Ajouter aux favoris')}
      className={`inline-flex items-center justify-center transition-colors ${
        ghost
          ? 'text-[var(--loboko-text-muted)] hover:text-red-500'
          : 'w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm'
      } ${className}`}
    >
      <Heart
        size={size}
        fill={favorited ? '#ef4444' : 'none'}
        stroke={favorited ? '#ef4444' : 'currentColor'}
        strokeWidth={2}
      />
    </button>
  );
}