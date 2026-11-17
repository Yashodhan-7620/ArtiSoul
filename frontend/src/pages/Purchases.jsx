import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import Stars from '../components/Stars';
import TopBar from '../components/TopBar';
import OrderTimeline from '../components/OrderTimeline';
import LiveViewer from '../components/LiveViewer';
import CodPaymentBox from '../components/CodPaymentBox';
import { Container } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { formatDate, formatDateTime, formatMonth, formatPrice, monthKey } from '../lib/format';
import { useT } from '../i18n';

const PILL = {
  Pending: 'bg-amber-100 text-amber-700',
  Accepted: 'bg-sky-100 text-sky-700',
  Shipped: 'bg-violet-100 text-violet-700',
  Delivered: 'bg-sage-100 text-sage-600',
  Cancelled: 'bg-clay-50 text-clay-600',
};

// Reviews are write-once: after submitting, the review is shown read-only.
function ReviewBox({ order, onReviewed }) {
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (order.review_rating) {
    return (
      <div className="mt-3 rounded-2xl bg-cream-100 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <Stars value={order.review_rating} size="h-4 w-4" />
          <span className="text-[11px] text-ink-400">{t('review.reviewed_on', { date: formatDate(order.reviewed_at) })}</span>
        </div>
        {order.review_comment && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{order.review_comment}</p>
        )}
        <p className="mt-1.5 text-[11px] text-ink-400">{t('review.final')}</p>
      </div>
    );
  }

  if (order.status !== 'Delivered') {
    return (
      <p className="mt-3 text-[12px] text-ink-400">
        {order.status === 'Cancelled' ? t('review.cancelled') : t('review.after_delivery')}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-clay-600 hover:underline"
      >
        <Icon name="star" className="h-4 w-4" />
        {t('review.write')}
      </button>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setError(t('review.choose_rating'));
    if (!window.confirm(t('review.confirm'))) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.orders.review(order.order_id, { rating, comment: comment.trim() }, token);
      onReviewed(order.order_id, data);
      toast.success(t('review.thanks'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-2.5 rounded-2xl border border-cream-300 bg-cream-50 p-3">
      <Stars value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder={t('review.placeholder')}
        className="field-input !rounded-xl !px-3 !py-2 !text-[13px]"
      />
      <p className="text-[11.5px] text-ink-400">{t('review.cant_change')}</p>
      {error && <p className="text-[12px] font-medium text-clay-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy}>{t('review.submit')}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

function PurchaseCard({ order, onReviewed, onWatch, onPayment }) {
  const { t } = useT();
  const [tracking, setTracking] = useState(false);
  const live = order.status === 'Accepted' && order.stream_status === 'live';
  const planned =
    order.status === 'Accepted' && !live && order.scheduled_live_at && new Date(order.scheduled_live_at) > new Date(Date.now() - 3_600_000);

  return (
    <article className="rounded-2xl border border-cream-300 bg-white p-3">
      <div className="flex items-start gap-3">
        <Link
          to={`/product/${order.product_id}`}
          className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-clay-100 to-cream-300"
        >
          {order.image_url ? (
            <img src={order.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-clay-400/70">
              <Icon name="box" className="h-5 w-5" strokeWidth={1.5} />
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/product/${order.product_id}`}
              className="truncate text-[14.5px] font-semibold text-ink-800 hover:text-clay-600"
            >
              {order.product_name}
            </Link>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${PILL[order.status] ?? 'bg-cream-200 text-ink-500'}`}>
              {t(`status.${order.status}`)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-ink-400">{order.shop_name}</p>
          <p className="mt-1 text-[12.5px] text-ink-500">
            {formatPrice(order.price_at_purchase)} × {order.quantity} ={' '}
            <span className="font-semibold text-ink-700">
              {formatPrice(order.price_at_purchase * order.quantity)}
            </span>
          </p>
          <p className="mt-1 text-[12px] font-medium text-ink-500">
            {t('purchases.on', { date: formatDate(order.created_at) })}
            <span className="text-ink-400"> · {t('purchases.order_no', { id: order.order_id })}</span>
          </p>
        </div>
      </div>

      {live && (
        <button
          onClick={() => onWatch(order)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-2 text-[13px] font-semibold text-white hover:bg-red-700"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          {t('live.watch')}
        </button>
      )}
      {planned && (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-clay-50 px-3 py-2 text-[12.5px] font-medium text-clay-700">
          <Icon name="clock" className="h-4 w-4" />
          {t('live.planned_for', { when: formatDateTime(order.scheduled_live_at) })}
        </p>
      )}

      <CodPaymentBox order={order} side="buyer" onUpdated={onPayment} />

      <button
        onClick={() => setTracking((v) => !v)}
        aria-expanded={tracking}
        className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-600 hover:text-clay-600"
      >
        <Icon name="truck" className="h-4 w-4" />
        {tracking ? t('timeline.hide') : t('timeline.track')}
      </button>
      {tracking && <OrderTimeline orderId={order.order_id} />}

      <ReviewBox order={order} onReviewed={onReviewed} />
    </article>
  );
}

export default function Purchases() {
  const { token } = useAuth();
  const { t } = useT();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [month, setMonth] = useState('all');
  const [watching, setWatching] = useState(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const { data } = await api.orders.mine(token);
        setOrders(data);
        setError('');
      } catch (err) {
        if (!quiet) setError(err.message);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [token]
  );

  // Re-checked every 15 s so "Watch live" appears as soon as the artisan goes live.
  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 15000);
    return () => clearInterval(timer);
  }, [load]);

  // Orders arrive newest first, so months come out newest first too.
  const months = useMemo(() => {
    const groups = new Map();
    for (const o of orders) {
      const key = monthKey(o.created_at);
      if (!groups.has(key)) groups.set(key, { key, date: o.created_at, orders: [] });
      groups.get(key).orders.push(o);
    }
    return [...groups.values()];
  }, [orders]);

  const visible = month === 'all' ? months : months.filter((m) => m.key === month);

  const handleReviewed = (orderId, review) => {
    setOrders((list) =>
      list.map((o) =>
        o.order_id === orderId
          ? { ...o, review_rating: review.rating, review_comment: review.comment, reviewed_at: review.created_at }
          : o
      )
    );
  };

  const handlePayment = (orderId, payment) =>
    setOrders((list) => list.map((o) => (o.order_id === orderId ? { ...o, ...payment } : o)));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title={t('purchases.title')}
        subtitle={t('purchases.subtitle')}
        action={
          <Link to="/wishlist" className="inline-flex items-center gap-1.5 rounded-full bg-cream-200 px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 hover:bg-cream-300">
            <Icon name="heart" className="h-4 w-4 text-clay-500" />
            <span className="hidden sm:inline">{t('wish.title')}</span>
          </Link>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-8 pt-5 md:px-8 md:pt-7">
        <Container size="form">
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-11 w-full rounded-2xl" />
              <div className="skeleton h-28 w-full rounded-2xl" />
              <div className="skeleton h-28 w-full rounded-2xl" />
            </div>
          ) : error ? (
            <EmptyState
              icon="alert"
              title={t('common.load_error')}
              message={error}
              action={
                <Button variant="secondary" onClick={() => load()}>
                  <Icon name="refresh" className="h-4 w-4" />
                  {t('common.retry')}
                </Button>
              }
            />
          ) : orders.length === 0 ? (
            <EmptyState
              icon="receipt"
              title={t('purchases.empty_title')}
              message={t('purchases.empty_body')}
              action={
                <Link to="/feed">
                  <Button>{t('common.discover')}</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-6">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.1em] text-ink-400">
                  {t('purchases.filter')}
                </span>
                <select value={month} onChange={(e) => setMonth(e.target.value)} className="field-input">
                  <option value="all">{t('purchases.all_months', { count: orders.length })}</option>
                  {months.map((m) => (
                    <option key={m.key} value={m.key}>
                      {formatMonth(m.date)} ({m.orders.length})
                    </option>
                  ))}
                </select>
              </label>

              {visible.map((m) => (
                <section key={m.key}>
                  <div className="mb-2.5 flex items-baseline justify-between">
                    <h2 className="font-display text-[18px] font-semibold text-ink-800">{formatMonth(m.date)}</h2>
                    <span className="text-[12.5px] text-ink-400">{t('purchases.count', { count: m.orders.length })}</span>
                  </div>
                  <div className="space-y-2.5">
                    {m.orders.map((o) => (
                      <PurchaseCard key={o.order_id} order={o} onReviewed={handleReviewed} onWatch={setWatching} onPayment={handlePayment} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </Container>
      </div>
      {watching && (
        <LiveViewer
          order={watching}
          onClose={() => {
            setWatching(null);
            load(true);
          }}
        />
      )}
    </div>
  );
}
