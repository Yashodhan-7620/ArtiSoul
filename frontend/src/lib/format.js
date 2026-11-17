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

// "17 November 2026": day, month and year spelled out on every purchase.
const fullDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
export const formatDate = (value) => fullDate.format(new Date(value));

// Month buckets for filtering, e.g. key "2026-11", label "November 2026".
const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
export function monthKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export const formatMonth = (value) => monthLabel.format(new Date(value));
