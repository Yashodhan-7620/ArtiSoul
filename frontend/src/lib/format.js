const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const formatPrice = (value) => inr.format(Number(value) || 0);

// "800 m" reads better than "0.8 km" on a card.
export function formatDistance(km) {
  const n = Number(km);
  if (!Number.isFinite(n)) return '';
  if (n < 1) return `${Math.round(n * 1000)} m`;
  return `${n.toFixed(1)} km`;
}

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

// Category is free text in the schema, so the feed offers these as
// suggestions rather than enforcing them.
export const CATEGORIES = [
  'Textiles',
  'Pottery',
  'Jewellery',
  'Woodwork',
  'Painting',
  'Leather',
  'Metalwork',
  'Home Decor',
];
