import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import { Container } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';

// Status pill colours
function StatusPill({ status }) {
  const styles = {
    Pending:   'bg-amber-100 text-amber-700',
    Delivered: 'bg-sage-100 text-sage-700',
    Cancelled: 'bg-clay-50 text-clay-600',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status] ?? 'bg-cream-200 text-ink-500'}`}>
      {status}
    </span>
  );
}

function OrderRow({ order, onMarkDelivered }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-cream-300 bg-white p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink-800">{order.product_name}</p>
        <p className="mt-0.5 text-[12px] text-ink-400">
          {order.customer_name} · {order.customer_phone}
        </p>
        <p className="mt-0.5 text-[12px] text-ink-500">
          {formatPrice(order.price_at_purchase)} × {order.quantity}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <StatusPill status={order.status} />
        {order.status === 'Pending' && (
          <button
            onClick={() => onMarkDelivered(order.order_id)}
            className="text-[11.5px] font-semibold text-sage-600 hover:underline"
          >
            Mark Delivered
          </button>
        )}
      </div>
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

function ProductRow({ product }) {
  const soldOut = product.stock_status === 'out_of_stock';
  return (
    <Link
      to={`/product/${product.product_id}`}
      className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-white p-2.5
                 transition hover:border-clay-200 active:scale-[0.99]"
    >
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
          {product.category ? ` · ${product.category}` : ''}
        </p>
      </div>

      {soldOut && (
        <span className="shrink-0 rounded-full bg-cream-200 px-2.5 py-1 text-[11px] font-semibold text-ink-500">
          Sold out
        </span>
      )}
      <Icon name="chevron" className="h-4 w-4 shrink-0 text-ink-400" />
    </Link>
  );
}

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: myShops } = await api.shops.mine(token);
      setShops(myShops);

      // One artisan may run more than one shop, so pull each shop's
      // listings and flatten them into a single inventory view.
      const lists = await Promise.all(
        myShops.map((s) => api.products.byShop(s.shop_id).then((r) => r.data))
      );
      setProducts(lists.flat());

      // Fetch incoming orders for all shops
      const { data: shopOrders } = await api.orders.shop(token);
      setOrders(shopOrders);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleMarkDelivered = async (orderId) => {
    try {
      await api.orders.updateStatus(orderId, 'Delivered', token);
      setOrders((prev) =>
        prev.map((o) => (o.order_id === orderId ? { ...o, status: 'Delivered' } : o))
      );
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const inStock = products.filter((p) => p.stock_status !== 'out_of_stock').length;
  const topPrice = products.length ? Math.max(...products.map((p) => Number(p.price) || 0)) : 0;
  const pendingOrders = orders.filter((o) => o.status === 'Pending').length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="z-20 shrink-0 border-b border-cream-300/70 bg-cream-100/95 px-5 pb-3 pt-5 backdrop-blur-md md:px-8 md:pb-4 md:pt-7">
        <Container>
          <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-clay-500">
            Artisan dashboard
          </p>
          <h1 className="mt-0.5 font-display text-[25px] font-semibold leading-tight text-ink-800 md:text-[30px]">
            {shops[0]?.shop_name || user?.name || 'Your workshop'}
          </h1>
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
            title="Couldn't load your shop"
            message={error}
            action={
              <Button variant="secondary" onClick={load}>
                <Icon name="refresh" className="h-4 w-4" />
                Try again
              </Button>
            }
          />
        ) : shops.length === 0 ? (
          <EmptyState
            icon="store"
            title="No shop yet"
            message="Open a shop to put yourself on the map. It takes one form and a location pin."
            action={<Button onClick={() => navigate('/artisan/shop')}>Open my shop</Button>}
          />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-4 gap-2.5 md:gap-4">
              <Stat label="Listings" value={products.length} />
              <Stat label="In stock" value={inStock} />
              <Stat label="Top price" value={topPrice ? formatPrice(topPrice) : '—'} />
              <Stat label="Orders" value={pendingOrders > 0 ? `${pendingOrders} new` : orders.length} />
            </div>

            {/* Primary action — the whole point of the dashboard */}
            <button
              onClick={() => navigate('/artisan/add')}
              className="relative w-full overflow-hidden rounded-3xl bg-ink-800 p-5 text-left
                         text-cream-100 shadow-card transition active:scale-[0.99]"
            >
              <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
                style={{
                  background:
                    'radial-gradient(20rem 14rem at 88% 0%, rgba(194,96,58,0.6), transparent 65%)',
                }}
              />
              <div className="relative flex items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cream-100/12">
                  <Icon name="camera" className="h-5 w-5 text-clay-300" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[18px] font-semibold">List a new piece</span>
                  <span className="mt-0.5 block text-[12.5px] text-cream-200/70">
                    Photo, name, price. That's it.
                  </span>
                </span>
                <Icon name="chevron" className="h-5 w-5 shrink-0 text-cream-200/60" />
              </div>
            </button>

            {shops.map((shop) => (
              <div key={shop.shop_id} className="rounded-3xl border border-cream-300 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-clay-50 text-clay-600">
                    <Icon name="store" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[17px] font-semibold text-ink-800">
                      {shop.shop_name}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-400">
                      {shop.address || 'No address added'}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-400">
                      <Icon name="pin" className="h-3 w-3 text-clay-400" strokeWidth={2} />
                      {Number(shop.latitude).toFixed(4)}, {Number(shop.longitude).toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-[18px] font-semibold text-ink-800">Your listings</h2>
                <span className="text-[12.5px] text-ink-400">{products.length} total</span>
              </div>

              {products.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-cream-300 bg-white px-6 py-10 text-center">
                  <p className="text-[14px] font-semibold text-ink-600">Nothing listed yet</p>
                  <p className="mx-auto mt-1 max-w-[28ch] text-[13px] leading-relaxed text-ink-400">
                    Your first photo is what turns a shop pin into a sale.
                  </p>
                  <Button className="mt-4" onClick={() => navigate('/artisan/add')}>
                    <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
                    Add a product
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(clamp(240px,100%,340px),1fr))]">
                  {products.map((p) => (
                    <ProductRow key={p.product_id} product={p} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Incoming orders ─────────────────────────────────────── */}
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-[18px] font-semibold text-ink-800">Incoming orders</h2>
                <span className="text-[12.5px] text-ink-400">{orders.length} total</span>
              </div>
              {orders.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-cream-300 bg-white px-6 py-8 text-center">
                  <p className="text-[14px] font-semibold text-ink-600">No orders yet</p>
                  <p className="mx-auto mt-1 max-w-[28ch] text-[13px] leading-relaxed text-ink-400">
                    Orders will appear here once customers buy your products.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {orders.map((o) => (
                    <OrderRow key={o.order_id} order={o} onMarkDelivered={handleMarkDelivered} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
        </Container>
      </main>
    </div>
  );
}
