import Icon from './Icon';

// Star rating. Read-only by default; pass `onChange` to make it a picker.
// Read-only values may be fractional (an average): 4.5 fills 5 stars, 4.4 fills 4.
export default function Stars({ value, onChange, size = 'h-5 w-5' }) {
  const filled = Math.round(Number(value) || 0);
  return (
    <div
      className="flex gap-0.5"
      role={onChange ? 'radiogroup' : 'img'}
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const star = (
          <Icon
            name="star"
            className={`${size} ${n <= filled ? 'text-saffron-500' : 'text-cream-300'}`}
            fill={n <= filled ? 'currentColor' : 'none'}
            strokeWidth={1.5}
          />
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            className="rounded-md p-0.5 transition hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}
