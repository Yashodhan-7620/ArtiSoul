import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import TopBar from '../components/TopBar';
import Button from '../components/Button';
import { Container } from '../components/AppShell';
import { Field, Input, TextArea } from '../components/Field';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useBadges } from '../context/BadgesContext';
import { useT } from '../i18n';

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// /checkout/:id buys one product; /checkout/cart buys everything in the cart
// (one order per item, paid with a single payment).
export default function Checkout() {
  const { id } = useParams();
  const isCart = id === 'cart';
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { refreshCart } = useBadges();
  const { t } = useT();
  const [lines, setLines] = useState(null); // [{ product_id, name, shop_name, image_url, price, quantity, stock_quantity }]
  const [loadError, setLoadError] = useState('');
  const [method, setMethod] = useState('COD');
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', address: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const METHODS = [
    { id: 'COD', label: t('checkout.cod'), hint: t('checkout.cod_hint') },
    { id: 'UPI', label: t('checkout.upi'), hint: t('checkout.upi_hint') },
  ];

  useEffect(() => {
    if (!user) navigate('/login', { state: { from: `/checkout/${id}` }, replace: true });
  }, [user, id, navigate]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    const load = isCart
      ? api.cart.get(token).then(({ data }) => data.items)
      : api.products.byId(id).then(({ data }) =>
          data.stock_status === 'out_of_stock' ? Promise.reject(new Error(t('product.out_of_stock'))) : [{ ...data, quantity: 1 }]
        );
    load
      .then((l) => !cancelled && setLines(l))
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, isCart, token, t]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loadError || (lines && lines.length === 0)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title={t('checkout.title')} back />
        <EmptyState icon="alert" title={t('checkout.unavailable')} message={loadError || t('cart.empty_title')} />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title={t('checkout.placed')} />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-sage-100 text-5xl">✅</div>
          <div>
            <h1 className="font-display text-[22px] font-semibold text-ink-900">
              {done === 'UPI' ? t('checkout.paid_title') : t('checkout.confirmed_title')}
            </h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-500">
              {done === 'UPI' ? t('checkout.paid_body') : t('checkout.cod_body')}
            </p>
          </div>
          <div className="flex w-full max-w-[16rem] flex-col gap-2.5">
            <Button onClick={() => navigate('/purchases')} className="w-full">{t('checkout.track')}</Button>
            <Button variant="secondary" onClick={() => navigate('/feed')} className="w-full">{t('checkout.back_to_feed')}</Button>
          </div>
        </div>
      </div>
    );
  }

  const total = lines ? lines.reduce((sum, l) => sum + l.price * l.quantity, 0) : 0;

  const setQty = (q) => setLines((l) => [{ ...l[0], quantity: q }]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.address.trim() || !/^[0-9+\-\s]{10,15}$/.test(form.phone)) {
      setError(t('checkout.fill_details'));
      return;
    }
    setBusy(true);
    try {
      const body = { payment_method: method, ...form };
      const { data } = isCart
        ? await api.orders.checkoutCart(body, token)
        : await api.orders.checkout({ ...body, product_id: lines[0].product_id, quantity: lines[0].quantity }, token);
      if (method === 'COD') {
        refreshCart();
        setDone('COD');
        return;
      }
      if (!(await loadRazorpay())) throw new Error(t('checkout.gateway_error'));
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          order_id: data.razorpay_order_id,
          name: 'ArtiSoul',
          description: data.description || lines[0].name,
          prefill: { name: form.name, contact: form.phone },
          theme: { color: '#b4572f' },
          handler: async (resp) => {
            try {
              await api.orders.verifyPayment({ order_id: data.order_id, ...resp }, token);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: { ondismiss: () => reject(new Error(t('checkout.cancelled'))) },
        });
        rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || t('checkout.failed'))));
        rzp.open();
      });
      refreshCart();
      setDone('UPI');
    } catch (err) {
      setError(err.message || t('common.something_wrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={t('checkout.title')} subtitle={isCart && lines ? t('cart.items', { count: lines.reduce((n, l) => n + l.quantity, 0) }) : undefined} back />
      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean p-5 pb-10 md:px-8">
        <Container>
          {!lines ? (
            <div className="skeleton h-24 w-full rounded-3xl" />
          ) : (
            <form onSubmit={submit} className="mx-auto max-w-xl space-y-5">
              <div className="space-y-3 rounded-3xl border border-cream-300 bg-white p-4">
                {lines.map((l) => (
                  <div key={l.product_id} className="flex gap-3">
                    {l.image_url && <img src={l.image_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[16px] font-semibold text-ink-900">{l.name}</p>
                      <p className="text-[12.5px] text-ink-500">{l.shop_name}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="font-semibold text-clay-600">
                          {formatPrice(l.price)}
                          {isCart && <span className="font-normal text-ink-400"> × {l.quantity}</span>}
                        </span>
                        {!isCart && (
                          <div className="flex items-center gap-3 text-ink-800">
                            <button type="button" aria-label={t('common.decrease')} disabled={l.quantity <= 1} onClick={() => setQty(l.quantity - 1)} className="h-8 w-8 rounded-full bg-cream-200 disabled:opacity-40">−</button>
                            <span className="w-4 text-center font-semibold">{l.quantity}</span>
                            <button type="button" aria-label={t('common.increase')} disabled={l.quantity >= Math.min(20, l.stock_quantity ?? 20)} onClick={() => setQty(l.quantity + 1)} className="h-8 w-8 rounded-full bg-cream-200 disabled:opacity-40">+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 rounded-3xl border border-cream-300 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">{t('checkout.delivery')}</p>
                <Field label={t('checkout.full_name')} id="co-name">
                  <Input id="co-name" value={form.name} onChange={set('name')} autoComplete="name" required />
                </Field>
                <Field label={t('checkout.phone')} id="co-phone">
                  <Input id="co-phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" required />
                </Field>
                <Field label={t('checkout.address')} id="co-address">
                  <TextArea id="co-address" rows={3} value={form.address} onChange={set('address')} required />
                </Field>
              </div>

              <div className="space-y-2.5 rounded-3xl border border-cream-300 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">{t('checkout.payment')}</p>
                {METHODS.map((m) => (
                  <label key={m.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                      method === m.id ? 'border-clay-500 bg-clay-50' : 'border-cream-300'
                    }`}>
                    <input type="radio" name="payment" value={m.id} checked={method === m.id}
                      onChange={() => setMethod(m.id)} className="mt-1" />
                    <span>
                      <span className="block text-[14.5px] font-semibold text-ink-800">{m.label}</span>
                      <span className="block text-[12.5px] text-ink-500">{m.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between px-1 font-display text-[18px] font-semibold text-ink-900">
                <span>{t('checkout.total')}</span>
                <span>{formatPrice(total)}</span>
              </div>

              {error && <p className="text-center text-[13px] text-clay-600">{error}</p>}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? t('checkout.processing') : method === 'UPI' ? t('checkout.pay', { amount: formatPrice(total) }) : t('checkout.place')}
              </Button>
            </form>
          )}
        </Container>
      </div>
    </div>
  );
}
