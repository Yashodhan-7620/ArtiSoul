import { Link } from 'react-router-dom';
import Icon from './Icon';
import { formatDistance, formatPrice } from '../lib/format';

// Deterministic warm placeholder so a product without a photo still looks
// intentional, and the same product always gets the same tint.
const TINTS = [
  'from-clay-100 to-clay-200',
  'from-sage-100 to-sage-100',
  'from-saffron-100 to-clay-100',
  'from-cream-200 to-cream-300',
];

export default function ProductCard({ product }) {
  const {
    product_id,
    name,
    price,
    category,
    image_url,
    shop_name,
    distance_km,
    stock_status,
  } = product;

  const tint = TINTS[Number(product_id ?? 0) % TINTS.length];
  const soldOut = stock_status === 'out_of_stock';

  return (
    <Link
      to={`/product/${product_id}`}
      className="group block overflow-hidden rounded-3xl bg-white shadow-card transition
                 active:scale-[0.985] hover:shadow-lift"
    >
      <div className={`relative aspect-[3/2] w-full bg-gradient-to-br ${tint}`}>
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          // No photo yet. The category and shop already appear below the
          // image, so the placeholder stays a plain mark rather than repeating them.
          <div className="grid h-full w-full place-items-center text-clay-500/45">
            <Icon name="box" className="h-10 w-10" strokeWidth={1.1} />
          </div>
        )}

        {Number.isFinite(Number(distance_km)) && (
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink-900/70
                       px-2.5 py-1 text-[11px] font-semibold text-cream-100 backdrop-blur-sm"
          >
            <Icon name="pin" className="h-3 w-3" strokeWidth={2} />
            {formatDistance(distance_km)}
          </span>
        )}

        {soldOut && (
          <span className="absolute right-3 top-3 rounded-full bg-ink-900/70 px-2.5 py-1 text-[11px] font-semibold text-cream-100">
            Sold out
          </span>
        )}
      </div>

      <div className="space-y-1.5 p-4">
        {category && (
          <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-clay-500">
            {category}
          </span>
        )}
        <h3 className="line-clamp-2 font-display text-[17px] font-semibold leading-snug text-ink-800">
          {name}
        </h3>
        {/* Price and shop stack rather than compete — in a 4-up grid the
            shop name has no room to sit beside the price without truncating. */}
        <div className="pt-0.5">
          <span className="block font-display text-[19px] font-semibold text-ink-900">
            {formatPrice(price)}
          </span>
          {shop_name && (
            <span className="mt-0.5 block truncate text-[12.5px] text-ink-400">{shop_name}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-card">
      <div className="skeleton aspect-[4/3] w-full" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton h-2.5 w-16 rounded-full" />
        <div className="skeleton h-4 w-4/5 rounded-full" />
        <div className="skeleton h-4 w-1/3 rounded-full" />
      </div>
    </div>
  );
}
