import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  size?: number;
  max?: number;
  onChange?: (v: number) => void;
  interactive?: boolean;
}

export default function StarRating({
  value,
  size = 16,
  max = 5,
  onChange,
  interactive = false,
}: StarRatingProps) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <div className="flex items-center gap-0.5">
      {stars.map((n) => {
        const filled = value >= n;
        const half = !filled && value >= n - 0.5;
        const color = filled || half ? '#f59e0b' : 'rgba(148,163,184,0.4)';
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(n)}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition' : 'cursor-default'} p-0 !bg-transparent !hover:bg-transparent`}
            aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          >
            <Star
              size={size}
              color={color}
              fill={filled ? '#f59e0b' : half ? 'url(#halfGrad)' : 'none'}
            />
          </button>
        );
      })}
    </div>
  );
}