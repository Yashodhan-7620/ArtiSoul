import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import { Container } from '../components/AppShell';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useBadges } from '../context/BadgesContext';
import { useToast } from '../components/Toast';
import { useT } from '../i18n';

export default function Cart() {
  const { token } = useAuth();
  const { t } = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const { setCartCount } = useBadges();
  const [cart, setCart] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const apply = useCallback(
    (data) => {
      setCart(data);
      setCartCount(data.count);
    },
    [setCartCount]
  );

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.cart.get(token);
      apply(data);
    } catch (err) {
      setError(err.message);
    }
  }, [token, apply]);

  useEffect(() => {
    load();
  }, [load]);

  const change = async (item, quantity) => {
    setBusyId(item.product_id);
    try {
      const { data } = await api.cart.update(item.product_id, quantity, token);
      apply(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const unavailable = cart?.items.filter((i) => i.stock_quantity < i.quantity) ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={t('cart.title')} subtitle={cart ? t('cart.items', { count: cart.count }) : undefined} />
      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-8 pt-5 md:px-8 md:pt-7">
        <Container size="form">
          {error ? (
            <EmptyState icon="alert" title={t('common.load_error')} message={error} action={<Button variant="secondary" onClick={load}>{t('common.retry')}</Button>} />
          ) : !cart ? (
            <div className="space-y-3">
              <div className="skeleton h-24 w-full rounded-2xl" />
              <div className="skeleton h-24 w-full rounded-2xl" />
            </div>
          ) : cart.items.length === 0 ? (
            <EmptyState
              icon="cart"
              title={t('cart.empty_title')}
              message={t('cart.empty_body')}
              action={
                <Link to="/feed">
                  <Button>{t('common.discover')}</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2.5">
                {cart.items.map((item) => {
                  const max = Math.min(20, item.stock_quantity);
                  const short = item.stock_quantity < item.quantity;
                  return (
                    <article key={item.product_id} className="flex gap-3 rounded-2xl border border-cream-300 bg-white p-3">
                      <Link to={`/product/${item.product_id}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-clay-100 to-cream-300">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="grid h-full place-items-center text-clay-400/60">
                            <Icon name="box" className="h-6 w-6" strokeWidth={1.4} />
                          </span>
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to={`/product/${item.product_id}`} className="block truncate text-[14.5px] font-semibold text-ink-800 hover:text-clay-600">
                          {item.name}
                        </Link>
                        <p className="truncate text-[12.5px] text-ink-400">{item.shop_name}</p>
                        <p className="mt-0.5 text-[13.5px] font-semibold text-clay-600">{formatPrice(item.price * item.quantity)}</p>
                        {short && (
                          <p className="text-[12px] font-medium text-clay-700">
                            {item.stock_quantity > 0 ? t('cart.only_left', { count: item.stock_quantity }) : t('product.sold_out')}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-3">
                          <div className="flex items-center gap-2.5 text-ink-800">
                            <button
                              type="button"
                              aria-label={t('common.decrease')}
                              disabled={busyId === item.product_id || item.quantity <= 1}
                              onClick={() => change(item, item.quantity - 1)}
                              className="h-7 w-7 rounded-full bg-cream-200 disabled:opacity-40"
                            >
                              −
                            </button>
                            <span className="w-4 text-center text-[14px] font-semibold">{item.quantity}</span>
                            <button
                              type="button"
                              aria-label={t('common.increase')}
                              disabled={busyId === item.product_id || item.quantity >= max}
                              onClick={() => change(item, item.quantity + 1)}
                              className="h-7 w-7 rounded-full bg-cream-200 disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => change(item, 0)}
                            disabled={busyId === item.product_id}
                            className="text-[12.5px] font-semibold text-clay-600 hover:underline"
                          >
                            {t('common.remove')}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-cream-300 bg-white p-4">
                <div className="flex items-center justify-between font-display text-[18px] font-semibold text-ink-900">
                  <span>{t('checkout.total')}</span>
                  <span>{formatPrice(cart.total)}</span>
                </div>
                <p className="mt-1 text-[12px] text-ink-400">{t('cart.one_payment')}</p>
              </div>

              {unavailable.length > 0 && (
                <p className="rounded-2xl bg-clay-50 px-4 py-3 text-[13px] font-medium text-clay-700">{t('cart.fix_stock')}</p>
              )}

              <Button size="lg" className="w-full" disabled={unavailable.length > 0} onClick={() => navigate('/checkout/cart')}>
                {t('cart.checkout')}
              </Button>
            </div>
          )}
        </Container>
      </div>
    </div>
  );
}
