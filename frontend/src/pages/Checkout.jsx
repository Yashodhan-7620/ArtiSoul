import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import { Container } from '../components/AppShell';
import { api, API_BASE } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useAuth } from '../context/AuthContext';

export default function Checkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [product, setProduct] = useState(null);
  const [shopQrUrl, setShopQrUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Receiver Address & Delivery Instructions States
  const [receiverName, setReceiverName] = useState(user?.name || '');
  const [receiverPhone, setReceiverPhone] = useState(user?.phone || '');
  const [addressLine, setAddressLine] = useState('');
  const [cityPincode, setCityPincode] = useState('Pune, Maharashtra - 411037');
  const [showInstructions, setShowInstructions] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  // Payment Method ('COD' | 'UPI') & Verification States
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [upiUtr, setUpiUtr] = useState('');
  const [upiConfirmed, setUpiConfirmed] = useState(false);

  // Order Submission States
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);

  const deliveryFee = 40;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.products
      .byId(id)
      .then(async ({ data }) => {
        if (cancelled) return;
        setProduct(data);
        if (data?.upi_qr_url) {
          setShopQrUrl(data.upi_qr_url);
        } else if (data?.shop_id) {
          try {
            const qrRes = await api.shops.getQr(data.shop_id);
            if (!cancelled && qrRes?.data?.upi_qr_url) {
              setShopQrUrl(qrRes.data.upi_qr_url);
            }
          } catch {
            /* fallback if QR route isn't set or shop has no QR */
          }
        }
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title="Checkout" back />
        <div className="p-8 text-center text-ink-400">Loading checkout details…</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title="Checkout" back />
        <EmptyState icon="alert" title="Product unavailable" message={error || 'Could not load product.'} />
      </div>
    );
  }

  const itemPrice = Number(product.price) || 0;
  const orderTotal = itemPrice + deliveryFee;
  const resolvedQrSrc = shopQrUrl
    ? shopQrUrl.startsWith('http')
      ? shopQrUrl
      : `${API_BASE}${shopQrUrl}`
    : '';

  async function handlePlaceOrder(e) {
    e.preventDefault();
    setSubmitError('');

    if (!receiverName.trim() || !receiverPhone.trim() || !addressLine.trim()) {
      setSubmitError('Please fill in the receiver name, phone number, and full delivery address.');
      return;
    }

    if (paymentMethod === 'UPI') {
      if (!/^[0-9]{12}$/.test(upiUtr.trim())) {
        setSubmitError('Please enter a valid 12-digit UPI UTR / Reference number to verify payment.');
        return;
      }
      if (!upiConfirmed) {
        setSubmitError('Please confirm that you have completed the UPI payment.');
        return;
      }
    }

    const fullAddress = `${receiverName.trim()} (${receiverPhone.trim()}), ${addressLine.trim()}, ${cityPincode.trim()}`;

    setSubmitting(true);
    try {
      await api.orders.create(
        {
          product_id: product.product_id || id,
          quantity: 1,
          receiver_address: fullAddress,
          delivery_instructions: showInstructions ? deliveryInstructions.trim() : null,
          payment_method: paymentMethod,
          upi_utr: paymentMethod === 'UPI' ? upiUtr.trim() : null,
          delivery_fee: deliveryFee,
        },
        token
      );
      setOrderPlaced(true);
    } catch (err) {
      setSubmitError(err.message || 'Could not place order — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

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
              {paymentMethod === 'UPI' ? 'Payment Submitted & Order Placed!' : 'Order Placed Successfully!'}
            </h1>
            <p className="mt-2 max-w-md text-[14.5px] leading-relaxed text-ink-500">
              {paymentMethod === 'UPI'
                ? `Your UPI Reference (UTR: ${upiUtr}) has been sent to ${product.shop_name} for verification.`
                : `Your Cash on Delivery order of ${formatPrice(orderTotal)} is on its way to ${product.shop_name}.`}
            </p>
          </div>
          <div className="flex w-full max-w-[16rem] flex-col gap-2.5">
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
      <TopBar title="Checkout" back />

      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-12 pt-5 md:px-8 md:pt-6">
        <Container>
          <form
            onSubmit={handlePlaceOrder}
            className="flex flex-col gap-6 lg:flex-row lg:items-start"
          >
            {/* LEFT 75% COLUMN: Address, Instructions & Payment Method */}
            <div className="w-full space-y-5 lg:w-3/4">
              {/* 1. Receiver's Address */}
              <div className="rounded-3xl border border-cream-300 bg-white p-5 md:p-6">
                <h2 className="font-display text-[19px] font-semibold text-ink-900">
                  1. Receiver's Address (Buyer)
                </h2>
                <p className="mt-1 text-[13px] text-ink-400">
                  Delivering from <span className="font-semibold text-ink-700">{product.shop_name}</span>
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[13px] font-semibold text-ink-700">
                      Receiver's Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="Rahul Patil"
                      className="mt-1.5 w-full rounded-2xl border border-cream-300 bg-cream-50/50 px-3.5 py-2.5 text-[14px] text-ink-800 focus:border-clay-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-ink-700">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={receiverPhone}
                      onChange={(e) => setReceiverPhone(e.target.value)}
                      placeholder="9876543210"
                      className="mt-1.5 w-full rounded-2xl border border-cream-300 bg-cream-50/50 px-3.5 py-2.5 text-[14px] text-ink-800 focus:border-clay-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[13px] font-semibold text-ink-700">
                      Flat, House no., Building, Street, Area
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder="Flat 204, Green Valley Residency, Upper Indiranagar, Bibwewadi"
                      className="mt-1.5 w-full rounded-2xl border border-cream-300 bg-cream-50/50 px-3.5 py-2.5 text-[14px] text-ink-800 focus:border-clay-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[13px] font-semibold text-ink-700">
                      City, State & Pincode
                    </label>
                    <input
                      type="text"
                      required
                      value={cityPincode}
                      onChange={(e) => setCityPincode(e.target.value)}
                      className="mt-1.5 w-full rounded-2xl border border-cream-300 bg-cream-50/50 px-3.5 py-2.5 text-[14px] text-ink-800 focus:border-clay-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Add Delivery Instructions Toggle Button */}
                <div className="mt-4 border-t border-cream-200 pt-3.5">
                  <button
                    type="button"
                    onClick={() => setShowInstructions((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cream-200/70 px-3 py-1.5 text-[13px] font-semibold text-clay-600 transition hover:bg-cream-200"
                  >
                    <span>
                      {showInstructions ? '− Remove delivery instructions' : '+ Add delivery instructions'}
                    </span>
                  </button>

                  {showInstructions && (
                    <div className="mt-3">
                      <textarea
                        rows={2}
                        value={deliveryInstructions}
                        onChange={(e) => setDeliveryInstructions(e.target.value)}
                        placeholder="Add gate code, landmark, preferred delivery time, or special handling notes..."
                        className="w-full rounded-2xl border border-cream-300 bg-cream-50 px-3.5 py-2.5 text-[13.5px] text-ink-800 focus:border-clay-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Payment Method */}
              <div className="rounded-3xl border border-cream-300 bg-white p-5 md:p-6">
                <h2 className="font-display text-[19px] font-semibold text-ink-900">
                  2. Payment Method
                </h2>
                <p className="mt-1 text-[13px] text-ink-400">
                  Choose Cash on Delivery or scan the artisan's direct UPI QR code.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Cash on Delivery */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                      paymentMethod === 'COD'
                        ? 'border-clay-400 bg-clay-50 ring-4 ring-clay-500/10'
                        : 'border-cream-300 bg-white hover:border-clay-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value="COD"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                      className="mt-1 accent-clay-600"
                    />
                    <div>
                      <p className="text-[14.5px] font-semibold text-ink-800">
                        Cash on Delivery (COD)
                      </p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-400">
                        Pay cash at your doorstep when you receive the craft.
                      </p>
                    </div>
                  </label>

                  {/* UPI QR Payment */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                      paymentMethod === 'UPI'
                        ? 'border-clay-400 bg-clay-50 ring-4 ring-clay-500/10'
                        : 'border-cream-300 bg-white hover:border-clay-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value="UPI"
                      checked={paymentMethod === 'UPI'}
                      onChange={() => setPaymentMethod('UPI')}
                      className="mt-1 accent-clay-600"
                    />
                    <div>
                      <p className="text-[14.5px] font-semibold text-ink-800">
                        UPI (Artisan QR Code)
                      </p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-400">
                        Scan & pay directly using GPay, PhonePe, Paytm, or BHIM.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Artisan QR Display & UTR Verification Box */}
                {paymentMethod === 'UPI' && (
                  <div className="mt-5 rounded-2xl border border-cream-300 bg-cream-100/70 p-4 md:p-5">
                    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                      <div className="flex shrink-0 flex-col items-center rounded-2xl border border-cream-300 bg-white p-3">
                        {resolvedQrSrc ? (
                          <img
                            src={resolvedQrSrc}
                            alt="Artisan UPI QR"
                            className="h-44 w-44 rounded-lg object-contain"
                          />
                        ) : (
                          <div className="grid h-44 w-44 place-items-center p-3 text-center text-[12px] text-ink-400">
                            {product.shop_name} hasn't uploaded a UPI QR image yet. Please use Cash on Delivery or message the shop.
                          </div>
                        )}
                        <span className="mt-2 text-[12px] font-bold text-clay-700">
                          Scan to Pay {formatPrice(orderTotal)}
                        </span>
                      </div>

                      <div className="flex-1 space-y-3">
                        <p className="text-[14.5px] font-semibold text-ink-800">
                          Verify UPI Payment to Place Order
                        </p>
                        <ol className="list-decimal space-y-1 pl-4 text-[12.5px] text-ink-600">
                          <li>Scan the QR code with any UPI app (GPay, PhonePe, Paytm).</li>
                          <li>
                            Complete the payment of{' '}
                            <strong className="text-ink-900">{formatPrice(orderTotal)}</strong>.
                          </li>
                          <li>
                            Enter the <strong>12-digit UTR / UPI Reference No.</strong> from your payment receipt below.
                          </li>
                        </ol>

                        <div>
                          <label className="block text-[12.5px] font-semibold text-ink-800">
                            12-Digit UPI Reference / UTR Number *
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={12}
                            value={upiUtr}
                            onChange={(e) => setUpiUtr(e.target.value.replace(/\D/g, ''))}
                            placeholder="e.g. 412389012345"
                            className="mt-1 w-full rounded-xl border border-cream-300 bg-white px-3.5 py-2 font-mono text-[14px] tracking-wider text-ink-900 focus:border-clay-500 focus:outline-none"
                          />
                          <p className="mt-1 text-[11.5px] text-ink-400">
                            {upiUtr.length}/12 digits entered
                          </p>
                        </div>

                        <label className="flex cursor-pointer items-center gap-2 pt-1 text-[13px] font-medium text-ink-800">
                          <input
                            type="checkbox"
                            checked={upiConfirmed}
                            onChange={(e) => setUpiConfirmed(e.target.checked)}
                            className="h-4 w-4 accent-clay-600"
                          />
                          <span>
                            I have paid {formatPrice(orderTotal)} and verified the transaction ID.
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-2xl bg-clay-50 px-4 py-3 text-[13.5px] font-medium text-clay-700">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>{submitError}</span>
                </div>
              )}
            </div>

            {/* RIGHT 25% BOX: Order Summary */}
            <div className="w-full lg:w-1/4 lg:sticky lg:top-4">
              <div className="rounded-3xl border border-cream-300 bg-white p-5">
                <h2 className="font-display text-[18px] font-semibold text-ink-900">
                  Order Summary
                </h2>

                <div className="mt-4 flex items-center gap-3 border-b border-cream-200 pb-4">
                  {product.image_url && (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink-800">
                      {product.name}
                    </p>
                    <p className="truncate text-[12px] text-ink-400">{product.shop_name}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5 text-[13.5px] text-ink-600">
                  <div className="flex justify-between">
                    <span>Items (1):</span>
                    <span className="font-medium text-ink-800">{formatPrice(itemPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery:</span>
                    <span className="font-medium text-ink-800">{formatPrice(deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between border-t border-cream-200 pt-2">
                    <span>Total:</span>
                    <span className="font-medium text-ink-800">{formatPrice(orderTotal)}</span>
                  </div>
                  <div className="flex justify-between border-t border-cream-300 pt-3 font-display text-[17px] font-semibold text-clay-600">
                    <span>Order Total:</span>
                    <span>{formatPrice(orderTotal)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  loading={submitting}
                  disabled={
                    paymentMethod === 'UPI' && (!upiConfirmed || upiUtr.trim().length !== 12)
                  }
                  className="mt-5 w-full"
                >
                  {paymentMethod === 'UPI' ? 'Verify & Place Order' : 'Place Order'}
                </Button>
              </div>
            </div>
          </form>
        </Container>
      </div>
    </div>
  );
}