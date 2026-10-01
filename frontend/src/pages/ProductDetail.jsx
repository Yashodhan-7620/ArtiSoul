import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import Button from '../components/Button';
import { Container } from '../components/AppShell';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import ChatWindow from '../components/ChatWindow';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Checkout state
  const [buying, setBuying] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [buyError, setBuyError] = useState('');

  const handleBuyNow = async () => {
    if (!user) {
      navigate('/login', { state: { redirectTo: `/product/${id}` } });
      return;
    }
    setBuying(true);
    setBuyError('');
    try {
      await api.orders.create(product.product_id, token, 1);
      setOrderPlaced(true);
    } catch (err) {
      setBuyError(err.message || 'Could not place order — please try again.');
    } finally {
      setBuying(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.products
      .byId(id)
      .then(({ data }) => !cancelled && setProduct(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title="Loading…" back />
        <div className="min-h-0 flex-1 overflow-y-auto scroll-clean p-5 md:px-8">
          <Container className="space-y-4 md:grid md:grid-cols-2 md:gap-8 md:space-y-0">
            <div className="skeleton aspect-square w-full rounded-3xl" />
            <div className="space-y-4">
              <div className="skeleton h-5 w-2/3 rounded-full" />
              <div className="skeleton h-4 w-1/3 rounded-full" />
            </div>
          </Container>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title="Product" back />
        <EmptyState icon="alert" title="Not found" message={error || 'This product no longer exists.'} />
      </div>
    );
  }

  const soldOut = product.stock_status === 'out_of_stock';
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${product.latitude},${product.longitude}`;

  // ── Order success screen ──────────────────────────────────────────────────
  if (orderPlaced) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title="Order placed" back />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-sage-100 text-sage-600 text-5xl">
            ✅
          </div>
          <div>
            <h1 className="font-display text-[22px] font-semibold text-ink-900">
              Payment Successful!
            </h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-500">
              Your order is on its way to the artisan.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 w-full max-w-[16rem]">
            <Button onClick={() => navigate('/feed')} className="w-full">
              Back to Feed
            </Button>
            <Button variant="secondary" onClick={() => navigate('/account')} className="w-full">
              View my orders
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={product.name} back />

      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean pb-10 md:px-8 md:pt-6">
        {/* Full-bleed image on a phone; side-by-side with the details on desktop */}
        <Container className="md:grid md:grid-cols-2 md:items-start md:gap-10">
          <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-clay-100 to-cream-300 md:sticky md:top-4 md:rounded-3xl">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-clay-400/60">
                <Icon name="box" className="h-14 w-14" strokeWidth={1.2} />
              </div>
            )}
            {soldOut && (
              <div className="absolute inset-0 grid place-items-center bg-ink-900/45">
                <span className="rounded-full bg-cream-100 px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-ink-800">
                  Sold out
                </span>
              </div>
            )}
          </div>

          <div className="space-y-5 px-5 pt-5 md:px-0 md:pt-0">
            <div>
              {product.category && (
                <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-clay-500">
                  {product.category}
                </span>
              )}
              <h2 className="mt-1 font-display text-[26px] font-semibold leading-tight text-ink-900 md:text-[34px]">
                {product.name}
              </h2>
              <p className="mt-2 font-display text-[24px] font-semibold text-clay-600 md:text-[28px]">
                {formatPrice(product.price)}
              </p>
            </div>

            {product.description && (
              <p className="text-[14.5px] leading-relaxed text-ink-600 md:text-[15.5px]">
                {product.description}
              </p>
            )}

            <div className="rounded-3xl border border-cream-300 bg-white p-4 md:p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Made by</p>
              <p className="mt-1.5 font-display text-[18px] font-semibold text-ink-800 md:text-[20px]">
                {product.shop_name}
              </p>
              {product.address && (
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-500">{product.address}</p>
              )}

              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-cream-200 px-3.5 py-2
                           text-[13px] font-semibold text-ink-700 transition hover:bg-cream-300 active:scale-95"
              >
                <Icon name="pin" className="h-3.5 w-3.5 text-clay-500" strokeWidth={2} />
                Open in Maps
                <Icon name="chevron" className="h-3 w-3 text-ink-400" strokeWidth={2.2} />
              </a>
            </div>

            {/* ── Buy Now ──────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Button
                id="buy-now-btn"
                onClick={handleBuyNow}
                disabled={buying || soldOut}
                className="w-full"
              >
                {buying ? 'Placing order…' : soldOut ? 'Out of Stock' : 'Buy Now'}
              </Button>
              {buyError && (
                <p className="text-center text-[12.5px] text-clay-600">{buyError}</p>
              )}
              {!user && (
                <p className="px-1 text-center text-[12px] text-ink-400">
                  You'll be asked to log in first.
                </p>
              )}
            </div>
          </div>
        </Container>
      </div>
      {user?.role !== 'artisan' && (
        <ChatWindow shopId={product.shop_id} recipientName={product.shop_name} />
      )}
    </div>
  );
}
