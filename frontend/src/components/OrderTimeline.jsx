import { useEffect, useState } from 'react';
import Icon from './Icon';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

// Vertical order timeline: Placed -> (Paid) -> Accepted -> (Live) -> Shipped
// -> Delivered, with the date of every step that has happened. Shared by the
// buyer's purchase history and the artisan's order list.
export default function OrderTimeline({ orderId, refreshKey = 0 }) {
  const { token } = useAuth();
  const { t } = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.orders
      .timeline(orderId, token)
      .then(({ data: d }) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [orderId, token, refreshKey]);

  if (error) return <p className="mt-2 text-[12px] text-clay-600">{error}</p>;
  if (!data) return <div className="skeleton mt-3 h-24 w-full rounded-2xl" />;

  const last = (name) => [...data.events].reverse().find((e) => e.event === name);
  const steps = [];
  const push = (key, event, extra = {}) => steps.push({ key, at: event?.created_at, done: Boolean(event), ...extra });

  push('Placed', last('Placed'));
  if (data.payment_method === 'UPI') {
    const failed = last('PaymentFailed');
    push(failed ? 'PaymentFailed' : 'Paid', failed || last('Paid'), { bad: Boolean(failed) });
  }
  const cancelled = last('Cancelled');
  if (cancelled && !last('Accepted')) {
    push('Cancelled', cancelled, { bad: true });
  } else {
    push('Accepted', last('Accepted'));
    const started = last('LiveStarted');
    if (started || data.scheduled_live_at || last('LiveScheduled')) {
      push('Live', started, { planned: !started ? data.scheduled_live_at : null });
    }
    if (cancelled) push('Cancelled', cancelled, { bad: true });
    else {
      push('Shipped', last('Shipped'));
      push('Delivered', last('Delivered'));
      if (data.payment_method === 'COD') push('CodPaid', last('Paid'));
    }
  }
  const currentIndex = steps.findLastIndex((s) => s.done);

  return (
    <ol className="mt-3 space-y-0" aria-label={t('timeline.title')}>
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const tone = s.bad
          ? 'bg-clay-600 text-white'
          : s.done
            ? 'bg-sage-500 text-white'
            : i === currentIndex + 1
              ? 'border-2 border-clay-400 bg-white text-clay-500'
              : 'border-2 border-cream-300 bg-white text-ink-400';
        return (
          <li key={s.key} className="relative flex gap-3 pb-3 last:pb-0">
            {!isLast && (
              <span
                className={`absolute left-[11px] top-6 h-[calc(100%-18px)] w-0.5 ${s.done ? 'bg-sage-400' : 'bg-cream-300'}`}
                aria-hidden="true"
              />
            )}
            <span className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full ${tone}`}>
              {s.done ? (
                <Icon name={s.bad ? 'x' : 'check'} className="h-3.5 w-3.5" strokeWidth={2.5} />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-[13px] font-semibold ${s.done ? (s.bad ? 'text-clay-700' : 'text-ink-800') : 'text-ink-400'}`}>
                {t(`timeline.${s.key}`)}
              </p>
              {s.at && <p className="text-[11.5px] text-ink-400">{formatDateTime(s.at)}</p>}
              {s.planned && (
                <p className="flex items-center gap-1 text-[11.5px] font-medium text-clay-600">
                  <Icon name="clock" className="h-3 w-3" />
                  {t('timeline.live_planned', { when: formatDateTime(s.planned) })}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
