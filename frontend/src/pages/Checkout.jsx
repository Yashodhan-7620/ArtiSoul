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

const METHODS = [
  { id: 'COD', label: 'Collect for Delivery (COD)', hint: 'Pay in cash when your order arrives.' },
  { id: 'UPI', label: 'UPI / Online', hint: 'Pay securely with UPI, card or netbanking via Razorpay.' },
];

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

export default function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [product, setProduct] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState('COD');
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', address: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!user) navigate('/login', { state: { redirectTo: `/checkout/${id}` }, replace: true });
  }, [user, id, navigate]);

  useEffect(() => {
    let cancelled = false;
    api.products
      .byId(id)
      .then(({ data }) => !cancelled && setProduct(data))
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loadError || (product && product.stock_status === 'out_of_stock')) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title="Checkout" back />
        <EmptyState icon="alert" title="Unavailable" message={loadError || 'This product is out of stock.'} />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title="Order placed" />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-sage-100 text-5xl">✅</div>
          <div>
            <h1 className="font-display text-[22px] font-semibold text-ink-900">
              {done === 'UPI' ? 'Payment Successful!' : 'Order Confirmed!'}
            </h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-500">
              {done === 'UPI'
                ? 'Your order is on its way to the artisan.'
                : 'Please keep the cash ready for delivery.'}
            </p>
          </div>
          <div className="flex w-full max-w-[16rem] flex-col gap-2.5">
            <Button onClick={() => navigate('/feed')} className="w-full">Back to Feed</Button>
            <Button variant="secondary" onClick={() => navigate('/account')} className="w-full">
              View my orders
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const total = product ? product.price * quantity : 0;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.address.trim() || !/^[0-9+\-\s]{10,15}$/.test(form.phone)) {
      setError('Please enter your name, a valid phone number and delivery address.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.orders.checkout(
        { product_id: product.product_id, quantity, payment_method: method, ...form },
        token
      );
      if (method === 'COD') {
        setDone('COD');
        return;
      }
      if (!(await loadRazorpay())) throw new Error('Could not load the payment gateway.');
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          order_id: data.razorpay_order_id,
          name: 'ArtiSoul',
          description: product.name,
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
          modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
        });
        rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'Payment failed.')));
        rzp.open();
      });
      setDone('UPI');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title="Checkout" back />
      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean p-5 pb-10 md:px-8">
        <Container>
          {!product ? (
            <div className="skeleton h-24 w-full rounded-3xl" />
          ) : (
            <form onSubmit={submit} className="mx-auto max-w-xl space-y-5">
              <div className="flex gap-3 rounded-3xl border border-cream-300 bg-white p-4">
                {product.image_url && (
                  <img src={product.image_url} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[17px] font-semibold text-ink-900">{product.name}</p>
                  <p className="text-[13px] text-ink-500">{product.shop_name}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-semibold text-clay-600">{formatPrice(product.price)}</span>
                    <div className="flex items-center gap-3 text-ink-800">
                      <button type="button" aria-label="Decrease" disabled={quantity <= 1}
                        onClick={() => setQuantity((q) => q - 1)}
                        className="h-8 w-8 rounded-full bg-cream-200 disabled:opacity-40">−</button>
                      <span className="w-4 text-center font-semibold">{quantity}</span>
                      <button type="button" aria-label="Increase" disabled={quantity >= 20}
                        onClick={() => setQuantity((q) => q + 1)}
                        className="h-8 w-8 rounded-full bg-cream-200 disabled:opacity-40">+</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-cream-300 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Delivery details</p>
                <Field label="Full name" id="co-name">
                  <Input id="co-name" value={form.name} onChange={set('name')} autoComplete="name" required />
                </Field>
                <Field label="Phone" id="co-phone">
                  <Input id="co-phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" required />
                </Field>
                <Field label="Address" id="co-address">
                  <TextArea id="co-address" rows={3} value={form.address} onChange={set('address')} required />
                </Field>
              </div>

              <div className="space-y-2.5 rounded-3xl border border-cream-300 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Payment method</p>
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
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>

              {error && <p className="text-center text-[13px] text-clay-600">{error}</p>}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Processing…' : method === 'UPI' ? `Pay ${formatPrice(total)}` : 'Place order'}
              </Button>
            </form>
          )}
        </Container>
      </div>
    </div>
  );
}
