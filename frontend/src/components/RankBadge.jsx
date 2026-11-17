import Icon from './Icon';
import { useT } from '../i18n';

// Artisan rank chip: master, gold, silver, rising, newcomer, or none.
const STYLE = {
  master: 'bg-violet-100 text-violet-800 ring-1 ring-violet-300',
  gold: 'bg-saffron-100 text-saffron-600 ring-1 ring-saffron-400',
  silver: 'bg-cream-200 text-ink-600 ring-1 ring-ink-400/40',
  rising: 'bg-sage-100 text-sage-600 ring-1 ring-sage-400',
  newcomer: 'bg-sky-100 text-sky-700 ring-1 ring-sky-300',
  none: 'bg-cream-100 text-ink-400 ring-1 ring-cream-300',
};

export default function RankBadge({ rank = 'none', size = 'sm', className = '' }) {
  const { t } = useT();
  const big = size === 'lg';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ${STYLE[rank] || STYLE.none} ${
        big ? 'px-3 py-1.5 text-[13px]' : 'px-2 py-0.5 text-[11px]'
      } ${className}`}
      title={t(`rank.${rank}.rule`)}
    >
      <Icon name={rank === 'none' ? 'user' : 'trophy'} className={big ? 'h-4 w-4' : 'h-3 w-3'} strokeWidth={2} />
      {t(`rank.${rank}.name`)}
    </span>
  );
}
