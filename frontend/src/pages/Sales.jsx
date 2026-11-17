import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import Stars from '../components/Stars';
import TopBar from '../components/TopBar';
import { Container } from '../components/AppShell';
import { api } from '../lib/api';
import { formatMonth, formatPrice, formatShortMonth } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

// One series, one hue (clay-500, validated >= 3:1 on the white card).
const BAR = '#C2603A';
const STATUS_ORDER = ['Pending', 'Accepted', 'Shipped', 'Delivered', 'Cancelled'];
const STATUS_PILL = {
  Pending: 'bg-amber-100 text-amber-700',
  Accepted: 'bg-sky-100 text-sky-700',
  Shipped: 'bg-violet-100 text-violet-700',
  Delivered: 'bg-sage-100 text-sage-600',
  Cancelled: 'bg-clay-50 text-clay-600',
};

// Last 12 calendar months, oldest first, with zero-filled gaps.
function lastTwelveMonths(rows) {
  const byKey = Object.fromEntries(rows.map((r) => [r.month, r]));
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const r = byKey[key];
    return { key, date: d, revenue: Number(r?.revenue) || 0, orders: Number(r?.orders) || 0 };
  });
}

// "Nice" axis maximum: 1, 2, 2.5 or 5 x 10^n just above the data.
function niceMax(v) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
}

const compactInr = (v) =>
  v >= 1e5 ? `₹${(v / 1e5).toFixed(v % 1e5 ? 1 : 0)}L` : v >= 1e3 ? `₹${(v / 1e3).toFixed(v % 1e3 ? 1 : 0)}k` : `₹${v}`;

function Tile({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-cream-300 bg-white px-4 py-3.5">
      <p className="text-[12px] font-medium text-ink-400">{label}</p>
      <p className="mt-1 font-display text-[24px] font-semibold leading-none text-ink-900">{value}</p>
      {sub && <p className="mt-1.5 text-[11.5px] text-ink-400">{sub}</p>}
    </div>
  );
}

function RevenueChart({ months, t }) {
  const [hover, setHover] = useState(null);
  const W = 640;
  const H = 230;
  const pad = { top: 12, right: 8, bottom: 26, left: 46 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...months.map((m) => m.revenue)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const slot = innerW / months.length;
  const barW = Math.min(30, slot - 6); // >= 2px gap between bars at any width
  const y = (v) => pad.top + innerH - (v / max) * innerH;
  const r = 4;

  // Bar with 4px rounded data-end, square at the baseline.
  const barPath = (x, top, w) => {
    const h = pad.top + innerH - top;
    if (h <= 0) return '';
    const rr = Math.min(r, h, w / 2);
    return `M${x},${pad.top + innerH} V${top + rr} Q${x},${top} ${x + rr},${top} H${x + w - rr} Q${x + w},${top} ${x + w},${top + rr} V${pad.top + innerH} Z`;
  };

  const active = hover != null ? months[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('sales.chart_label')} onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke="#E8DCCB" strokeWidth="1" strokeDasharray={v === 0 ? '' : '3 4'} />
            <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#8A7A70">
              {compactInr(v)}
            </text>
          </g>
        ))}
        {months.map((m, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          return (
            <g key={m.key}>
              <path d={barPath(x, y(m.revenue), barW)} fill={BAR} opacity={hover == null || hover === i ? 1 : 0.55} />
              {(i % 2 === 1 || months.length <= 6) && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#8A7A70">
                  {formatShortMonth(m.date)}
                </text>
              )}
              {/* hit target: the whole column, bigger than the bar */}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onClick={() => setHover(hover === i ? null : i)}
              />
            </g>
          );
        })}
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-ink-800 px-3 py-2 text-[12px] text-cream-100 shadow-lift"
          style={{ left: `${((pad.left + hover * slot + slot / 2) / W) * 100}%` }}
        >
          <p className="font-semibold">{formatMonth(active.date)}</p>
          <p>{formatPrice(active.revenue)}</p>
          <p className="text-cream-200/70">{t('sales.orders_n', { count: active.orders })}</p>
        </div>
      )}
    </div>
  );
}

export default function Sales() {
  const { token } = useAuth();
  const { t } = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [asTable, setAsTable] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.orders.sales(token);
      setData(d);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const months = useMemo(() => (data ? lastTwelveMonths(data.monthly) : []), [data]);
  const topMax = data ? Math.max(1, ...data.top_products.map((p) => Number(p.revenue))) : 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={t('sales.title')} subtitle={t('sales.subtitle')} back />
      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-8 pt-5 md:px-8 md:pt-7">
        <Container className="space-y-5">
          {error ? (
            <EmptyState icon="alert" title={t('common.load_error')} message={error} action={<Button variant="secondary" onClick={load}>{t('common.retry')}</Button>} />
          ) : !data ? (
            <div className="space-y-3">
              <div className="skeleton h-20 w-full rounded-2xl" />
              <div className="skeleton h-56 w-full rounded-3xl" />
            </div>
          ) : (
            <>
              {data.low_stock.length > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-amber-800">{t('sales.low_stock_title', { count: data.low_stock.length })}</p>
                    <ul className="mt-1 space-y-0.5">
                      {data.low_stock.map((p) => (
                        <li key={p.product_id} className="flex justify-between gap-2 text-[13px] text-amber-900">
                          <Link to={`/artisan/edit/${p.product_id}`} className="truncate underline-offset-2 hover:underline">{p.name}</Link>
                          <span className="shrink-0 font-semibold">
                            {p.stock_quantity > 0 ? t('cart.only_left', { count: p.stock_quantity }) : t('product.sold_out')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
                <Tile label={t('sales.revenue')} value={formatPrice(data.totals.revenue)} sub={t('sales.delivered_value', { amount: formatPrice(data.totals.delivered_revenue) })} />
                <Tile label={t('sales.orders')} value={data.totals.orders} sub={t('sales.units', { count: Number(data.totals.units) })} />
                <Tile label={t('sales.customers')} value={data.totals.customers} />
                <Tile
                  label={t('sales.rating')}
                  value={data.rating.count ? data.rating.avg.toFixed(1) : '—'}
                  sub={data.rating.count ? t('product.reviews', { count: data.rating.count }) : t('product.no_reviews_short')}
                />
              </div>

              <section className="rounded-3xl border border-cream-300 bg-white p-4 md:p-5">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-[18px] font-semibold text-ink-800">{t('sales.monthly')}</h2>
                  <button onClick={() => setAsTable((v) => !v)} className="text-[12.5px] font-semibold text-clay-600 hover:underline">
                    {asTable ? t('sales.show_chart') : t('sales.show_table')}
                  </button>
                </div>
                {asTable ? (
                  <table className="w-full text-left text-[13px]">
                    <thead className="text-[11.5px] uppercase tracking-wide text-ink-400">
                      <tr>
                        <th className="py-1.5 font-semibold">{t('sales.month')}</th>
                        <th className="py-1.5 text-right font-semibold">{t('sales.orders')}</th>
                        <th className="py-1.5 text-right font-semibold">{t('sales.revenue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...months].reverse().map((m) => (
                        <tr key={m.key} className="border-t border-cream-200 text-ink-700">
                          <td className="py-1.5">{formatMonth(m.date)}</td>
                          <td className="py-1.5 text-right">{m.orders}</td>
                          <td className="py-1.5 text-right font-semibold">{formatPrice(m.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <RevenueChart months={months} t={t} />
                )}
              </section>

              <div className="grid gap-5 md:grid-cols-2">
                <section className="rounded-3xl border border-cream-300 bg-white p-4 md:p-5">
                  <h2 className="mb-3 font-display text-[18px] font-semibold text-ink-800">{t('sales.top_products')}</h2>
                  {data.top_products.length === 0 ? (
                    <p className="text-[13px] text-ink-400">{t('sales.no_sales')}</p>
                  ) : (
                    <ol className="space-y-3">
                      {data.top_products.map((p, i) => (
                        <li key={p.product_id}>
                          <div className="flex items-baseline justify-between gap-2 text-[13px]">
                            <span className="truncate font-semibold text-ink-700">
                              {i + 1}. {p.name}
                            </span>
                            <span className="shrink-0 font-semibold text-ink-800">{formatPrice(p.revenue)}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-200">
                              <div className="h-full rounded-full" style={{ width: `${(Number(p.revenue) / topMax) * 100}%`, background: BAR }} />
                            </div>
                            <span className="w-14 shrink-0 text-right text-[11.5px] text-ink-400">{t('sales.units', { count: Number(p.units) })}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>

                <section className="rounded-3xl border border-cream-300 bg-white p-4 md:p-5">
                  <h2 className="mb-3 font-display text-[18px] font-semibold text-ink-800">{t('sales.by_status')}</h2>
                  <ul className="space-y-2">
                    {STATUS_ORDER.map((s) => (
                      <li key={s} className="flex items-center justify-between">
                        <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${STATUS_PILL[s]}`}>{t(`status.${s}`)}</span>
                        <span className="font-display text-[17px] font-semibold text-ink-800">{data.by_status[s] || 0}</span>
                      </li>
                    ))}
                  </ul>
                  {data.rating.count > 0 && (
                    <div className="mt-4 flex items-center gap-2 border-t border-cream-200 pt-3">
                      <Stars value={data.rating.avg} size="h-4 w-4" />
                      <span className="text-[13px] text-ink-500">{t('sales.rating_line', { avg: data.rating.avg.toFixed(1), count: data.rating.count })}</span>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </Container>
      </div>
    </div>
  );
}
