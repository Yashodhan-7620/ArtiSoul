import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import { api, API_BASE } from '../lib/api';
import { initials, formatPrice } from '../lib/format';
import { Container } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';

export default function Account() {
  const { user, logout, isArtisan, token } = useAuth();
  const navigate = useNavigate();
  const [apiUp, setApiUp] = useState(null);
  const [orders, setOrders] = useState([]);

  // A visible backend status light saves a lot of "why is nothing loading?"
  useEffect(() => {
    api
      .health()
      .then(() => setApiUp(true))
      .catch(() => setApiUp(false));
  }, []);

  // Customer purchase history — only fetch if logged in and a customer
  useEffect(() => {
    if (!user || isArtisan) return;
    api.orders.mine(token)
      .then(({ data }) => setOrders(data))
      .catch(() => {});
  }, [user, isArtisan, token]);

  if (!user) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title="Account" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-cream-200 text-clay-400">
            <Icon name="user" className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-display text-[19px] font-semibold text-ink-800">You're browsing as a guest</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-400">
              Sign in to open a shop and list your own work.
            </p>
          </div>
          <div className="flex w-full max-w-[16rem] flex-col gap-2.5">
            <Link to="/signup">
              <Button className="w-full">Create an account</Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" className="w-full">
                Log in
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title="Account" />

      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-8 pt-5 md:px-8 md:pt-7">
        <Container size="form">
        <div className="flex items-center gap-4 rounded-3xl border border-cream-300 bg-white p-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-clay-500 font-display text-[19px] font-semibold text-white">
            {initials(user.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-[19px] font-semibold text-ink-900">{user.name}</p>
            <p className="mt-0.5 text-[13.5px] text-ink-400">{user.phone}</p>
            <span
              className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide
                ${isArtisan ? 'bg-clay-50 text-clay-700' : 'bg-sage-100 text-sage-600'}`}
            >
              {isArtisan ? 'Artisan' : 'Customer'}
            </span>
          </div>
        </div>

        {isArtisan && (
          <div className="mt-4 space-y-2.5">
            <Link
              to="/artisan"
              className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-white px-4 py-3.5
                         transition hover:border-clay-200 active:scale-[0.99]"
            >
              <Icon name="store" className="h-5 w-5 text-clay-500" />
              <span className="flex-1 text-[14.5px] font-semibold text-ink-700">My shop</span>
              <Icon name="chevron" className="h-4 w-4 text-ink-400" />
            </Link>
            <Link
              to="/artisan/shop"
              className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-white px-4 py-3.5
                         transition hover:border-clay-200 active:scale-[0.99]"
            >
              <Icon name="plus" className="h-5 w-5 text-clay-500" />
              <span className="flex-1 text-[14.5px] font-semibold text-ink-700">Open another shop</span>
              <Icon name="chevron" className="h-4 w-4 text-ink-400" />
            </Link>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-cream-300 bg-white px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                apiUp === null ? 'bg-ink-400' : apiUp ? 'bg-sage-500' : 'bg-clay-500'
              }`}
            />
            <span className="text-[13.5px] font-semibold text-ink-700">
              {apiUp === null ? 'Checking API…' : apiUp ? 'API connected' : 'API unreachable'}
            </span>
          </div>
          <p className="mt-1.5 break-all pl-[18px] text-[12px] text-ink-400">{API_BASE}</p>
        </div>

        {/* My Orders — customer purchase history */}
        {!isArtisan && orders.length > 0 && (
          <div className="mt-4">
            <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-400">
              My orders
            </p>
            <div className="space-y-2">
              {orders.map((o) => {
                const pillStyle = {
                  Pending:   'bg-amber-100 text-amber-700',
                  Delivered: 'bg-sage-100 text-sage-700',
                  Cancelled: 'bg-clay-50 text-clay-600',
                }[o.status] ?? 'bg-cream-200 text-ink-500';

                return (
                  <div
                    key={o.order_id}
                    className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-white px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink-800">
                        {o.product_name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-400">
                        {o.shop_name} · {formatPrice(o.price_at_purchase)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${pillStyle}`}>
                      {o.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button
          variant="secondary"
          size="lg"
          className="mt-4 w-full !text-clay-700"
          onClick={() => {
            logout();
            navigate('/', { replace: true });
          }}
        >
          <Icon name="logout" className="h-4 w-4" />
          Log out
        </Button>

        <p className="mt-8 text-center text-[12px] text-ink-400">ArtiSoul · Phase 3 · MVP</p>
        </Container>
      </div>
    </div>
  );
}
