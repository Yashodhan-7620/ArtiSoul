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

// Dates follow the app language (English / Hindi / Marathi). The language
// provider calls setFormatLocale() whenever the language changes.
const LOCALES = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
let locale = 'en-IN';
let fullDate, monthLabel, dateTime, shortDate, timeOnly;
export function setFormatLocale(lang) {
  const next = LOCALES[lang] || 'en-IN';
  if (next === locale && fullDate) return;
  locale = next;
  fullDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  shortDate = new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' });
  timeOnly = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  dateTime = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
setFormatLocale('en');

// "17 November 2026": day, month and year spelled out on every purchase.
export const formatDate = (value) => fullDate.format(new Date(value));
// "17 Nov 2026, 5:30 pm"
export const formatDateTime = (value) => dateTime.format(new Date(value));
// "5:30 pm"
export const formatTime = (value) => timeOnly.format(new Date(value));
// "Nov 26" (chart axis)
export const formatShortMonth = (value) => shortDate.format(new Date(value));

// Month buckets for filtering, e.g. key "2026-11", label "November 2026".
export function monthKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export const formatMonth = (value) => monthLabel.format(new Date(value));

// "5m ago"-style relative time for notifications.
export function timeAgo(value, t) {
  const s = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (s < 60) return t('time.now');
  if (s < 3600) return t('time.minutes', { n: Math.floor(s / 60) });
  if (s < 86400) return t('time.hours', { n: Math.floor(s / 3600) });
  if (s < 7 * 86400) return t('time.days', { n: Math.floor(s / 86400) });
  return formatDate(value);
}
