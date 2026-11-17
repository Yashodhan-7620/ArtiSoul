import { useCallback, useEffect, useState } from 'react';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import Stars from '../components/Stars';
import TopBar from '../components/TopBar';
import { Container } from '../components/AppShell';
import { api } from '../lib/api';
import { formatDate, formatDateTime, formatPrice } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useT } from '../i18n';

const TABS = ['overview', 'activity', 'users', 'orders', 'reviews'];

function useLoader(fn, deps) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [load]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload, setData };
}

function Stat({ label, value, tone = '' }) {
  return (
    <div className="rounded-2xl border border-cream-300 bg-white px-4 py-3">
      <p className="text-[12px] text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-[22px] font-semibold leading-none ${tone || 'text-ink-900'}`}>{value}</p>
    </div>
  );
}

function Overview({ token, t }) {
  const { data, error } = useLoader(() => api.admin.overview(token).then((r) => r.data), [token]);
  if (error) return <EmptyState icon="alert" title={t('common.load_error')} message={error} />;
  if (!data) return <div className="skeleton h-40 w-full rounded-3xl" />;
  const sec = data.security;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Stat label={t('admin.users')} value={data.users.total} />
        <Stat label={t('admin.artisans')} value={data.users.artisans || 0} />
        <Stat label={t('admin.customers')} value={data.users.customers || 0} />
        <Stat label={t('admin.new_7d')} value={data.users.new_7d || 0} />
        <Stat label={t('admin.shops')} value={data.catalog.shops} />
        <Stat label={t('admin.products')} value={data.catalog.products} />
        <Stat label={t('admin.reviews')} value={data.catalog.reviews} />
        <Stat label={t('admin.order_value')} value={formatPrice(data.order_value)} />
      </div>
      <section className="rounded-3xl border border-cream-300 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 font-display text-[17px] font-semibold text-ink-800">
          <Icon name="shield" className="h-4 w-4 text-clay-500" />
          {t('admin.security_24h')}
        </h3>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Stat label={t('admin.logins')} value={sec.logins_24h} />
          <Stat label={t('admin.failed_logins')} value={sec.failed_logins_24h} tone={sec.failed_logins_24h > 10 ? 'text-clay-600' : ''} />
          <Stat label={t('admin.blocked_logins')} value={sec.blocked_logins_24h} tone={sec.blocked_logins_24h > 0 ? 'text-clay-600' : ''} />
          <Stat label={t('admin.suspended')} value={data.users.suspended || 0} />
        </div>
      </section>
      <section className="rounded-3xl border border-cream-300 bg-white p-4">
        <h3 className="mb-2 font-display text-[17px] font-semibold text-ink-800">{t('admin.orders_by_status')}</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.orders).map(([s, n]) => (
            <span key={s} className="rounded-full bg-cream-200 px-3 py-1 text-[12.5px] font-semibold text-ink-700">
              {t(`status.${s}`)}: {n}
            </span>
          ))}
        </div>
      </section>
      <div className="rounded-2xl bg-cream-200/60 px-4 py-3 text-[12.5px] leading-relaxed text-ink-500">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink-700">
          <Icon name="shield" className="h-3.5 w-3.5" />
          {t('admin.privacy_title')}
        </p>
        {t('admin.privacy_body')}
      </div>
    </div>
  );
}

function Activity({ token, t }) {
  const [filters, setFilters] = useState({ action: '', role: '' });
  const [items, setItems] = useState(null);
  const [next, setNext] = useState(null);
  const [error, setError] = useState('');

  const fetchPage = useCallback(
    async (before) => {
      const params = {};
      if (filters.action) params.action = filters.action;
      if (filters.role) params.role = filters.role;
      if (before) params.before = before;
      const { data } = await api.admin.activity(params, token);
      return data;
    },
    [filters, token]
  );

  useEffect(() => {
    let cancelled = false;
    fetchPage()
      .then((d) => {
        if (cancelled) return;
        setItems(d.items);
        setNext(d.next);
        setError('');
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const more = async () => {
    const d = await fetchPage(next);
    setItems((list) => [...list, ...d.items]);
    setNext(d.next);
  };

  const ACTIONS = ['', 'auth.', 'order.', 'payment.', 'product.', 'shop.', 'review.', 'stream.', 'cart.', 'wishlist.', 'ai.', 'admin.'];
  const tone = (a) =>
    a.includes('failed') || a.includes('blocked') || a.includes('suspend') || a.includes('remove')
      ? 'bg-clay-50 text-clay-700'
      : a.startsWith('admin.')
        ? 'bg-violet-100 text-violet-700'
        : 'bg-cream-200 text-ink-600';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} className="field-input !w-auto !py-2 !text-[13px]">
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a ? a.replace('.', '') : t('admin.all_actions')}
            </option>
          ))}
        </select>
        <select value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))} className="field-input !w-auto !py-2 !text-[13px]">
          <option value="">{t('admin.all_roles')}</option>
          {['customer', 'artisan', 'admin'].map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}`)}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <EmptyState icon="alert" title={t('common.load_error')} message={error} />
      ) : !items ? (
        <div className="skeleton h-40 w-full rounded-3xl" />
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-400">{t('admin.no_activity')}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-cream-300 bg-white">
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead className="bg-cream-100 text-[11px] uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-3 py-2 font-semibold">{t('admin.when')}</th>
                <th className="px-3 py-2 font-semibold">{t('admin.who')}</th>
                <th className="px-3 py-2 font-semibold">{t('admin.action')}</th>
                <th className="px-3 py-2 font-semibold">{t('admin.target')}</th>
                <th className="px-3 py-2 font-semibold" title={t('admin.ip_hint')}>{t('admin.network')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.log_id} className="border-t border-cream-200 align-top text-ink-700">
                  <td className="whitespace-nowrap px-3 py-2 text-ink-500">{formatDateTime(l.created_at)}</td>
                  <td className="px-3 py-2">
                    {l.actor_id ? (
                      <>
                        <span className="font-semibold">{l.actor_name || `#${l.actor_id}`}</span>
                        <span className="block text-[11px] text-ink-400">{t(`role.${l.actor_role}`)} · #{l.actor_id}</span>
                      </>
                    ) : (
                      <span className="text-ink-400">{l.subject_hash ? t('admin.anon_with', { id: l.subject_hash.slice(0, 6) }) : t('admin.system')}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[11.5px] ${tone(l.action)}`}>{l.action}</span>
                    {l.details && (
                      <span className="mt-1 block max-w-[220px] truncate font-mono text-[11px] text-ink-400" title={JSON.stringify(l.details)}>
                        {JSON.stringify(l.details)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-500">{l.entity ? `${l.entity} #${l.entity_id}` : '—'}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-ink-400">{l.ip_hash ? l.ip_hash.slice(0, 8) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {next && (
        <Button variant="secondary" size="sm" onClick={more}>
          {t('admin.load_more')}
        </Button>
      )}
    </div>
  );
}

function Users({ token, t, toast }) {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, error, reload } = useLoader(() => api.admin.users(search ? { q: search } : {}, token).then((r) => r.data), [search, token]);

  const toggle = async (u) => {
    let reason = '';
    if (u.is_active) {
      reason = window.prompt(t('admin.suspend_reason', { name: u.name })) || '';
      if (!reason.trim()) return;
    } else if (!window.confirm(t('admin.restore_confirm', { name: u.name }))) return;
    try {
      await api.admin.setUserStatus(u.user_id, !u.is_active, reason, token);
      toast.success(u.is_active ? t('admin.suspended_ok') : t('admin.restored_ok'));
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
        className="flex gap-2"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.search_users')} className="field-input" />
        <Button type="submit" variant="secondary">{t('common.search')}</Button>
      </form>
      {error ? (
        <EmptyState icon="alert" title={t('common.load_error')} message={error} />
      ) : !data ? (
        <div className="skeleton h-40 w-full rounded-3xl" />
      ) : (
        <div className="space-y-2">
          {data.map((u) => (
            <div key={u.user_id} className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-white p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink-800">
                  {u.name} <span className="text-[11.5px] font-normal text-ink-400">#{u.user_id}</span>
                </p>
                <p className="text-[12px] text-ink-400">
                  {t(`role.${u.role}`)} · <span className="font-mono">{u.phone}</span> · {t('admin.joined', { date: formatDate(u.created_at) })}
                </p>
                <p className="text-[11.5px] text-ink-400">{t('admin.user_counts', { orders: u.orders, shops: u.shops })}</p>
              </div>
              {!u.is_active && <span className="rounded-full bg-clay-50 px-2.5 py-1 text-[11px] font-semibold text-clay-700">{t('admin.suspended_badge')}</span>}
              {u.role !== 'admin' && (
                <Button size="sm" variant={u.is_active ? 'secondary' : 'primary'} onClick={() => toggle(u)}>
                  {u.is_active ? t('admin.suspend') : t('admin.restore')}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Orders({ token, t }) {
  const [status, setStatus] = useState('');
  const { data, error } = useLoader(() => api.admin.orders(status ? { status } : {}, token).then((r) => r.data), [status, token]);
  return (
    <div className="space-y-3">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="field-input !w-auto !py-2 !text-[13px]">
        <option value="">{t('admin.all_statuses')}</option>
        {['Pending', 'Accepted', 'Shipped', 'Delivered', 'Cancelled'].map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>
      <p className="text-[12px] text-ink-400">{t('admin.orders_privacy')}</p>
      {error ? (
        <EmptyState icon="alert" title={t('common.load_error')} message={error} />
      ) : !data ? (
        <div className="skeleton h-40 w-full rounded-3xl" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-cream-300 bg-white">
          <table className="w-full min-w-[560px] text-left text-[12.5px]">
            <thead className="bg-cream-100 text-[11px] uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">{t('admin.product')}</th>
                <th className="px-3 py-2">{t('admin.status')}</th>
                <th className="px-3 py-2">{t('admin.payment')}</th>
                <th className="px-3 py-2 text-right">{t('admin.amount')}</th>
                <th className="px-3 py-2">{t('admin.when')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.order_id} className="border-t border-cream-200 text-ink-700">
                  <td className="px-3 py-2 text-ink-400">{o.order_id}</td>
                  <td className="px-3 py-2">
                    <span className="font-semibold">{o.product_name}</span>
                    <span className="block text-[11px] text-ink-400">{o.shop_name} · {t('admin.buyer_id', { id: o.customer_id })}</span>
                  </td>
                  <td className="px-3 py-2">{t(`status.${o.status}`)}</td>
                  <td className="px-3 py-2">{o.payment_method} · {o.payment_status}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatPrice(o.price_at_purchase * o.quantity)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-500">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Reviews({ token, t, toast }) {
  const { data, error, reload } = useLoader(() => api.admin.reviews(token).then((r) => r.data), [token]);
  const remove = async (r) => {
    const reason = window.prompt(t('admin.remove_reason')) || '';
    if (!reason.trim()) return;
    try {
      await api.admin.removeReview(r.review_id, reason, token);
      toast.success(t('admin.review_removed'));
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };
  if (error) return <EmptyState icon="alert" title={t('common.load_error')} message={error} />;
  if (!data) return <div className="skeleton h-40 w-full rounded-3xl" />;
  if (!data.length) return <p className="py-8 text-center text-[13px] text-ink-400">{t('admin.no_reviews')}</p>;
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-ink-400">{t('admin.reviews_hint')}</p>
      {data.map((r) => (
        <div key={r.review_id} className="rounded-2xl border border-cream-300 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <Stars value={r.rating} size="h-4 w-4" />
            <span className="text-[11.5px] text-ink-400">{formatDate(r.created_at)}</span>
          </div>
          <p className="mt-1 text-[13px] font-semibold text-ink-700">{r.product_name}</p>
          {r.comment && <p className="mt-0.5 text-[13px] text-ink-600">{r.comment}</p>}
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11.5px] text-ink-400">{r.reviewer} · #{r.customer_id}</span>
            <button onClick={() => remove(r)} className="text-[12px] font-semibold text-clay-600 hover:underline">
              {t('admin.remove')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const { token } = useAuth();
  const { t } = useT();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const props = { token, t, toast };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={t('admin.title')} subtitle={t('admin.subtitle')} />
      <div className="shrink-0 border-b border-cream-300/70 bg-cream-100 px-5 md:px-8">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto scroll-clean py-2">
          {TABS.map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                tab === k ? 'bg-ink-800 text-cream-100' : 'text-ink-500 hover:bg-cream-200'
              }`}
            >
              {t(`admin.tab.${k}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-8 pt-5 md:px-8">
        <Container>
          {tab === 'overview' && <Overview {...props} />}
          {tab === 'activity' && <Activity {...props} />}
          {tab === 'users' && <Users {...props} />}
          {tab === 'orders' && <Orders {...props} />}
          {tab === 'reviews' && <Reviews {...props} />}
        </Container>
      </div>
    </div>
  );
}
