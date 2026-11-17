import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { api } from '../lib/api';
import { formatDateTime, formatPrice } from '../lib/format';
import { Container } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useT } from '../i18n';
import ChatWindow from '../components/ChatWindow';
import LiveBroadcast from '../components/LiveBroadcast';
import OrderTimeline from '../components/OrderTimeline';
import CodPaymentBox from '../components/CodPaymentBox';
import LanguageSwitcher from '../components/LanguageSwitcher';
import RankBadge from '../components/RankBadge';

const LOW_STOCK = 3;
const PILL = {
  Pending: 'bg-amber-100 text-amber-700',
  Accepted: 'bg-sky-100 text-sky-700',
  Shipped: 'bg-violet-100 text-violet-700',
  Delivered: 'bg-sage-100 text-sage-600',
  Cancelled: 'bg-clay-50 text-clay-600',
};

// "2026-11-18T17:30" for <input type="datetime-local">, in the device's time zone.
function toLocalInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function OrderRow({ order, onSetStatus, onGoLive, onSchedule, onPayment }) {
  const { t } = useT();
  const [tracking, setTracking] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState(() =>
    toLocalInput(order.scheduled_live_at || new Date(Date.now() + 86_400_000).setMinutes(0, 0, 0))
  );
  const [timelineKey, setTimelineKey] = useState(0);
  const link = 'text-[12px] font-semibold hover:underline';
  const unpaid = order.payment_method === 'UPI' && order.payment_status !== 'Paid';

  const act = async (fn) => {
    await fn();
    setTimelineKey((k) => k + 1);
  };

  return (
    <div className="rounded-2xl border border-cream-300 bg-white p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink-800">{order.product_name}</p>
          <p className="mt-0.5 text-[12px] text-ink-400">
            {order.customer_name} · {order.customer_phone}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-500">
            {formatPrice(order.price_at_purchase)} × {order.quantity} · {order.payment_method}
            {unpaid && <span className="font-semibold text-clay-600"> · {t('dash.unpaid')}</span>}
          </p>
          {order.status === 'Accepted' && order.scheduled_live_at && (
            <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-clay-600">
              <Icon name="clock" className="h-3.5 w-3.5" />
              {t('live.planned_for', { when: formatDateTime(order.scheduled_live_at) })}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${PILL[order.status] ?? 'bg-cream-200 text-ink-500'}`}>
          {t(`status.${order.status}`)}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {order.status === 'Pending' && (
          <>
            <button
              disabled={unpaid}
              title={unpaid ? t('dash.unpaid_hint') : undefined}
              onClick={() => act(() => onSetStatus(order.order_id, 'Accepted'))}
              className="rounded-full bg-sage-600 px-3 py-1 text-[12px] font-semibold text-white hover:bg-sage-500 disabled:opacity-40"
            >
              {t('dash.accept')}
            </button>
            <button onClick={() => act(() => onSetStatus(order.order_id, 'Cancelled'))} className={`${link} text-clay-600`}>
              {t('dash.decline')}
            </button>
          </>
        )}
        {order.status === 'Accepted' && (
          <>
            <button
              onClick={() => onGoLive(order)}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-[12px] font-semibold text-white hover:bg-red-700"
            >
              <Icon name="video" className="h-3.5 w-3.5" />
              {order.stream_status === 'live' ? t('live.resume') : t('live.start')}
            </button>
            <button onClick={() => setScheduling((v) => !v)} className={`${link} text-ink-600`}>
              {order.scheduled_live_at ? t('live.reschedule') : t('live.schedule')}
            </button>
            <button onClick={() => act(() => onSetStatus(order.order_id, 'Shipped'))} className={`${link} text-violet-700`}>
              {t('dash.mark_shipped')}
            </button>
            <button onClick={() => act(() => onSetStatus(order.order_id, 'Cancelled'))} className={`${link} text-clay-600`}>
              {t('common.cancel')}
            </button>
          </>
        )}
        {order.status === 'Shipped' && (
          <button onClick={() => act(() => onSetStatus(order.order_id, 'Delivered'))} className={`${link} text-sage-600`}>
            {t('dash.mark_delivered')}
          </button>
        )}
        <button onClick={() => setTracking((v) => !v)} className={`${link} ml-auto text-ink-500`}>
          {tracking ? t('timeline.hide') : t('timeline.show')}
        </button>
      </div>

      {scheduling && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await act(() => onSchedule(order.order_id, new Date(when).toISOString()));
            setScheduling(false);
          }}
          className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-cream-100 p-2.5"
        >
          <label className="text-[12px] font-semibold text-ink-600" htmlFor={`when-${order.order_id}`}>
            {t('live.when')}
          </label>
          <input
            id={`when-${order.order_id}`}
            type="datetime-local"
            value={when}
            min={toLocalInput(Date.now())}
            onChange={(e) => setWhen(e.target.value)}
            className="field-input !w-auto !py-1.5 !text-[13px]"
            required
          />
          <Button size="sm" type="submit">{t('live.notify_buyer')}</Button>
        </form>
      )}

      <CodPaymentBox
        order={order}
        side="artisan"
        onUpdated={(id, payment) => {
          onPayment(id, payment);
          setTimelineKey((k) => k + 1);
        }}
      />

      {tracking && <OrderTimeline orderId={order.order_id} refreshKey={timelineKey} />}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex-1 rounded-2xl border border-cream-300 bg-white px-3 py-3">
      <p className="font-display text-[21px] font-semibold leading-none text-ink-900">{value}</p>
      <p className="mt-1.5 text-[11.5px] font-medium text-ink-400">{label}</p>
    </div>
  );
}

function ProductRow({ product, onDelete }) {
  const { t, tc } = useT();
  const soldOut = product.stock_status === 'out_of_stock';
  const low = !soldOut && product.stock_quantity <= LOW_STOCK;
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-cream-300 bg-white p-2.5 transition hover:border-clay-200">
      <Link to={`/product/${product.product_id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-clay-100 to-cream-300">
          {product.image_url ? (
            <img src={product.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-clay-400/70">
              <Icon name="box" className="h-5 w-5" strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold text-ink-800">{product.name}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-400">
            {formatPrice(product.price)}
            {product.category ? ` · ${tc(product.category)}` : ''}
            {` · ${t('dash.in_stock_n', { count: product.stock_quantity ?? 0 })}`}
          </p>
        </div>

        {(soldOut || low) && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${soldOut ? 'bg-cream-200 text-ink-500' : 'bg-amber-100 text-amber-700'}`}>
            {soldOut ? t('product.sold_out') : t('dash.low_badge')}
          </span>
        )}
      </Link>
      <div className="flex shrink-0 flex-col gap-1">
        <Link
          to={`/artisan/edit/${product.product_id}`}
          className="rounded-full bg-cream-200 px-3 py-1 text-center text-[12px] font-semibold text-ink-700 hover:bg-cream-300"
        >
          {t('common.edit')}
        </Link>
        <button
          type="button"
          onClick={() => onDelete(product)}
          className="rounded-full bg-clay-50 px-3 py-1 text-[12px] font-semibold text-clay-700 hover:bg-clay-100"
        >
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
}

// Shop card; a shop without a picture can add one, once (details are final).
function ShopCard({ shop, onImage }) {
  const { t } = useT();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file) => {
    if (!file) return;
    if (!window.confirm(t('shop.picture_confirm'))) return;
    setBusy(true);
    try {
      await onImage(shop, file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-3xl border border-cream-300 bg-white p-4">
      {shop.image_url ? (
        <img src={shop.image_url} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-cream-300 bg-cream-100 text-clay-500 hover:border-clay-300"
          aria-label={t('shop.add_picture')}
        >
          <Icon name={busy ? 'refresh' : 'camera'} className={`h-5 w-5 ${busy ? 'animate-spin' : ''}`} />
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[17px] font-semibold text-ink-800">{shop.shop_name}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-400">{shop.address || t('shop.no_address')}</p>
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-400">
          <Icon name="pin" className="h-3 w-3 text-clay-400" strokeWidth={2} />
          {Number(shop.latitude).toFixed(4)}, {Number(shop.longitude).toFixed(4)}
        </p>
        {!shop.image_url && <p className="mt-1 text-[11.5px] text-clay-600">{t('shop.add_picture_hint')}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, token } = useAuth();
  const { t } = useT();
  const toast = useToast();
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [liveOrder, setLiveOrder] = useState(null);
  const [orderFilter, setOrderFilter] = useState('open');
  const [rank, setRank] = useState(null);
  const [openCalls, setOpenCalls] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleDelete = async (product) => {
    if (!window.confirm(t('dash.delete_confirm', { name: product.name }))) return;
    try {
      await api.products.remove(product.product_id, token);
      setProducts((list) => list.filter((p) => p.product_id !== product.product_id));
    } catch (err) {
      window.alert(err.message);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: myShops } = await api.shops.mine(token);
      setShops(myShops);

      // One artisan may run more than one shop, so pull each shop's
      // listings and flatten them into a single inventory view.
      const lists = await Promise.all(myShops.map((s) => api.products.byShop(s.shop_id).then((r) => r.data)));
      setProducts(lists.flat());

      const { data: shopOrders } = await api.orders.shop(token);
      setOrders(shopOrders);

      const { data: shopConversations } = await api.chat.conversations(token);
      setConversations(shopConversations);

      // Not essential: the dashboard still works if these fail.
      api.ranks.mine(token).then(({ data }) => setRank(data)).catch(() => {});
      api.events
        .list(token)
        .then(({ data }) => setOpenCalls(data.events.filter((e) => e.status !== 'approved' && !e.my_response).length))
        .catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const reloadOrders = useCallback(async () => {
    const { data } = await api.orders.shop(token);
    setOrders(data);
  }, [token]);

  const handleSetStatus = async (orderId, status) => {
    const confirmKey = { Cancelled: 'dash.cancel_confirm', Shipped: 'dash.ship_confirm', Delivered: 'dash.deliver_confirm' }[status];
    if (confirmKey && !window.confirm(t(confirmKey))) return;
    try {
      await api.orders.updateStatus(orderId, status, token);
      await reloadOrders();
      toast.success(t('dash.status_saved', { status: t(`status.${status}`) }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSchedule = async (orderId, iso) => {
    try {
      await api.orders.scheduleLive(orderId, iso, token);
      await reloadOrders();
      toast.success(t('live.scheduled_ok'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleShopImage = async (shop, file) => {
    try {
      const { data } = await api.uploads.image(file, token);
      await api.shops.setImage(shop.shop_id, data.image_url, token);
      setShops((list) => list.map((s) => (s.shop_id === shop.shop_id ? { ...s, image_url: data.image_url } : s)));
      toast.success(t('shop.picture_saved'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const closeLive = () => {
    setLiveOrder(null);
    reloadOrders().catch(() => {});
  };

  useEffect(() => {
    load();
  }, [load]);

  const inStock = products.filter((p) => p.stock_status !== 'out_of_stock').length;
  const lowStock = products.filter((p) => p.stock_quantity <= LOW_STOCK);
  const openStatuses = ['Pending', 'Accepted', 'Shipped'];
  const pendingOrders = orders.filter((o) => o.status === 'Pending').length;
  const awaitingCash = (o) => o.status === 'Delivered' && o.payment_method === 'COD' && o.payment_status !== 'Paid';
  const shownOrders = orderFilter === 'open' ? orders.filter((o) => openStatuses.includes(o.status) || awaitingCash(o)) : orders;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="z-20 shrink-0 border-b border-cream-300/70 bg-cream-100/95 px-5 pb-3 pt-5 backdrop-blur-md md:px-8 md:pb-4 md:pt-7">
        <Container>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-clay-500">{t('dash.eyebrow')}</p>
              <h1 className="mt-0.5 truncate font-display text-[25px] font-semibold leading-tight text-ink-800 md:text-[30px]">
                {shops[0]?.shop_name || user?.name || t('dash.workshop')}
              </h1>
            </div>
            <LanguageSwitcher compact className="lg:hidden" />
          </div>
        </Container>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-6 pt-4 md:px-8 md:pt-6">
        <Container>
          {loading ? (
            <div className="space-y-4">
              <div className="skeleton h-20 w-full rounded-2xl" />
              <div className="skeleton h-32 w-full rounded-3xl" />
              <div className="skeleton h-16 w-full rounded-2xl" />
            </div>
          ) : error ? (
            <EmptyState
              icon="alert"
              title={t('dash.load_error')}
              message={error}
              action={
                <Button variant="secondary" onClick={load}>
                  <Icon name="refresh" className="h-4 w-4" />
                  {t('common.retry')}
                </Button>
              }
            />
          ) : shops.length === 0 ? (
            <EmptyState
              icon="store"
              title={t('dash.no_shop_title')}
              message={t('dash.no_shop_body')}
              action={<Button onClick={() => navigate('/artisan/shop')}>{t('dash.open_shop')}</Button>}
            />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-2.5 md:gap-4">
                <Stat label={t('dash.listings')} value={products.length} />
                <Stat label={t('dash.in_stock')} value={inStock} />
                <Stat label={t('dash.low_stock')} value={lowStock.length} />
                <Stat label={t('dash.orders')} value={pendingOrders > 0 ? t('dash.new_n', { count: pendingOrders }) : orders.length} />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Link to="/how-it-works" className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-white px-4 py-3 transition hover:border-clay-200">
                  <Icon name="trophy" className="h-5 w-5 shrink-0 text-clay-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-ink-400">{t('help.rank.yours')}</span>
                    <span className="mt-0.5 block">{rank ? <RankBadge rank={rank.rank} /> : <span className="skeleton block h-5 w-24 rounded-full" />}</span>
                  </span>
                  <Icon name="chevron" className="h-4 w-4 shrink-0 text-ink-400" />
                </Link>
                <Link
                  to="/events"
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${openCalls ? 'border-clay-300 bg-clay-50 hover:border-clay-400' : 'border-cream-300 bg-white hover:border-clay-200'}`}
                >
                  <Icon name="calendar" className="h-5 w-5 shrink-0 text-clay-500" />
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink-700">
                    {openCalls ? t('events.calls_waiting', { count: openCalls }) : t('events.see_events')}
                  </span>
                  <Icon name="chevron" className="h-4 w-4 shrink-0 text-ink-400" />
                </Link>
              </div>

              {lowStock.length > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <p className="text-[13px] text-amber-900">
                    <span className="font-semibold">{t('sales.low_stock_title', { count: lowStock.length })}</span>{' '}
                    {lowStock.map((p) => `${p.name} (${p.stock_quantity})`).join(', ')}
                  </p>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  onClick={() => navigate('/artisan/add')}
                  className="relative w-full overflow-hidden rounded-3xl bg-ink-800 p-5 text-left text-cream-100 shadow-card transition active:scale-[0.99]"
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    aria-hidden="true"
                    style={{ background: 'radial-gradient(20rem 14rem at 88% 0%, rgba(194,96,58,0.6), transparent 65%)' }}
                  />
                  <div className="relative flex items-center gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cream-100/12">
                      <Icon name="camera" className="h-5 w-5 text-clay-300" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[18px] font-semibold">{t('dash.list_new')}</span>
                      <span className="mt-0.5 block text-[12.5px] text-cream-200/70">{t('dash.list_new_hint')}</span>
                    </span>
                    <Icon name="chevron" className="h-5 w-5 shrink-0 text-cream-200/60" />
                  </div>
                </button>
                <Link
                  to="/artisan/sales"
                  className="flex items-center gap-4 rounded-3xl border border-cream-300 bg-white p-5 transition hover:border-clay-200"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-clay-50 text-clay-600">
                    <Icon name="chart" className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[18px] font-semibold text-ink-800">{t('sales.title')}</span>
                    <span className="mt-0.5 block text-[12.5px] text-ink-400">{t('dash.sales_hint')}</span>
                  </span>
                  <Icon name="chevron" className="h-5 w-5 shrink-0 text-ink-400" />
                </Link>
              </div>

              {shops.map((shop) => (
                <ShopCard key={shop.shop_id} shop={shop} onImage={handleShopImage} />
              ))}

              {/* ── Orders ─────────────────────────────────────── */}
              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="font-display text-[18px] font-semibold text-ink-800">{t('dash.orders_title')}</h2>
                  <div className="flex rounded-full bg-cream-200 p-0.5 text-[12px] font-semibold">
                    {['open', 'all'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setOrderFilter(f)}
                        className={`rounded-full px-3 py-1 ${orderFilter === f ? 'bg-white text-ink-800 shadow-sm' : 'text-ink-500'}`}
                      >
                        {t(`dash.filter_${f}`)}
                      </button>
                    ))}
                  </div>
                </div>
                {shownOrders.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-cream-300 bg-white px-6 py-8 text-center">
                    <p className="text-[14px] font-semibold text-ink-600">{t('dash.no_orders')}</p>
                    <p className="mx-auto mt-1 max-w-[30ch] text-[13px] leading-relaxed text-ink-400">{t('dash.no_orders_body')}</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {shownOrders.map((o) => (
                      <OrderRow
                        key={o.order_id}
                        order={o}
                        onSetStatus={handleSetStatus}
                        onGoLive={setLiveOrder}
                        onSchedule={handleSchedule}
                        onPayment={(id, payment) =>
                          setOrders((list) => list.map((x) => (x.order_id === id ? { ...x, ...payment } : x)))
                        }
                      />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-display text-[18px] font-semibold text-ink-800">{t('dash.listings_title')}</h2>
                  <span className="text-[12.5px] text-ink-400">{t('dash.total_n', { count: products.length })}</span>
                </div>

                {products.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-cream-300 bg-white px-6 py-10 text-center">
                    <p className="text-[14px] font-semibold text-ink-600">{t('dash.no_listings')}</p>
                    <p className="mx-auto mt-1 max-w-[28ch] text-[13px] leading-relaxed text-ink-400">{t('dash.no_listings_body')}</p>
                    <Button className="mt-4" onClick={() => navigate('/artisan/add')}>
                      <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
                      {t('dash.add_product')}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(clamp(240px,100%,340px),1fr))] gap-2.5">
                    {products.map((p) => (
                      <ProductRow key={p.product_id} product={p} onDelete={handleDelete} />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-display text-[18px] font-semibold text-ink-800">{t('dash.chats')}</h2>
                  <span className="text-[12.5px] text-ink-400">{t('dash.total_n', { count: conversations.length })}</span>
                </div>
                {conversations.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-cream-300 bg-white px-6 py-7 text-center">
                    <p className="text-[14px] font-semibold text-ink-600">{t('dash.no_chats')}</p>
                    <p className="mx-auto mt-1 max-w-[30ch] text-[13px] leading-relaxed text-ink-400">{t('dash.no_chats_body')}</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {conversations.map((conversation) => (
                      <button
                        key={conversation.conversation_id}
                        onClick={() => setSelectedConversation(conversation)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-cream-300 bg-white p-3 text-left transition hover:border-clay-200"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-clay-50 text-clay-600">
                          <Icon name="chat" className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-ink-800">{conversation.customer_name}</span>
                          <span className="mt-0.5 block truncate text-[12px] text-ink-400">{conversation.last_message || t('dash.new_chat')}</span>
                        </span>
                        <Icon name="chevron" className="h-4 w-4 shrink-0 text-ink-400" />
                      </button>
                    ))}
                  </div>
                )}
                {selectedConversation && (
                  <ChatWindow
                    key={selectedConversation.conversation_id}
                    shopId={selectedConversation.shop_id}
                    recipientName={selectedConversation.customer_name}
                    existingConversation={selectedConversation}
                    customerId={selectedConversation.customer_id}
                  />
                )}
              </section>

              {liveOrder && <LiveBroadcast order={liveOrder} onClose={closeLive} />}
            </div>
          )}
        </Container>
      </main>
    </div>
  );
}
