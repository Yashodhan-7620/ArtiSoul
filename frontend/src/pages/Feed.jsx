import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard';
import { Container } from '../components/AppShell';
import { api } from '../lib/api';
import { useGeolocation } from '../lib/useGeolocation';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';
import Recommendations from '../components/Recommendations';
import LanguageSwitcher from '../components/LanguageSwitcher';

const RADII = [1, 3, 5, 10, 25];

export default function Feed() {
  const { user } = useAuth();
  const { coords, status, locate } = useGeolocation();
  const { t, tc } = useT();

  const [radius, setRadius] = useState(5);
  const [category, setCategory] = useState(null);
  const [query, setQuery] = useState('');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Only location and radius hit the network. Category and search filter the
  // fetched set client-side so tapping a chip is instant — the backend also
  // supports ?category=, it just isn't worth a round trip at this scale.
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.products.nearby({
        lat: coords.lat,
        lng: coords.lng,
        radius,
      });
      setProducts(data);
    } catch (err) {
      setError(err.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [coords.lat, coords.lng, radius]);

  useEffect(() => {
    load();
  }, [load]);

  // Offer only categories that actually have something nearby, so no chip
  // can ever lead to an empty list.
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.shop_name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    });
  }, [products, category, query]);

  const filtering = Boolean(query.trim() || category);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ---------- Header ---------- */}
      <header className="z-20 shrink-0 border-b border-cream-300/70 bg-cream-100/95 px-5 pb-3 pt-5 backdrop-blur-md md:px-8 md:pb-4 md:pt-7">
        <Container size="wide">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-clay-500">
                {user ? t('feed.hello', { name: user.name.split(' ')[0] }) : t('nav.discover')}
              </p>
              <h1 className="mt-0.5 font-display text-[25px] font-semibold leading-tight text-ink-800 md:text-[30px]">
                {t('feed.title')}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <LanguageSwitcher compact className="lg:hidden" />
              {!user && (
                <Link to="/login" className="lg:hidden">
                  <Button size="sm" variant="secondary">
                    {t('auth.login')}
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Location + search sit side by side once there's room */}
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <button
              onClick={locate}
              className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-cream-200 px-3 py-2
                         text-[12.5px] font-semibold text-ink-600 transition hover:bg-cream-300 active:scale-95"
            >
              <Icon
                name="pin"
                className={`h-3.5 w-3.5 text-clay-500 ${status === 'locating' ? 'animate-pulse' : ''}`}
                strokeWidth={2}
              />
              {status === 'locating' ? t('feed.locating') : coords.label}
              <Icon name="refresh" className="h-3 w-3 text-ink-400" strokeWidth={2.2} />
            </button>

            <div className="relative md:max-w-md md:flex-1">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('feed.search')}
                aria-label={t('feed.search_label')}
                className="field-input !py-2.5 !pl-10 !text-[14px]"
              />
            </div>
          </div>

          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto scroll-clean px-5 pb-0.5 md:mx-0 md:flex-wrap md:px-0">
            {RADII.map((r) => (
              <button
                key={r}
                onClick={() => setRadius(r)}
                className={`chip ${
                  radius === r
                    ? 'border-clay-500 bg-clay-500 text-white'
                    : 'border-cream-300 bg-white text-ink-500 hover:border-clay-300'
                }`}
              >
                {r} km
              </button>
            ))}

            {categories.length > 0 && <span className="w-px shrink-0 self-stretch bg-cream-300" />}

            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(category === c ? null : c)}
                className={`chip ${
                  category === c
                    ? 'border-ink-800 bg-ink-800 text-cream-100'
                    : 'border-cream-300 bg-white text-ink-500 hover:border-clay-300'
                }`}
              >
                {tc(c)}
              </button>
            ))}
          </div>
        </Container>
      </header>

      {/* ---------- Results ---------- */}
      <main className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-6 pt-4 md:px-8 md:pt-6">
        <Container size="wide">
          {loading ? (
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(clamp(240px,100%,300px),1fr))]">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon="alert"
              title={t('feed.load_error')}
              message={error}
              action={
                <Button onClick={load} variant="secondary">
                  <Icon name="refresh" className="h-4 w-4" />
                  {t('common.retry')}
                </Button>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon="compass"
              title={filtering ? t('feed.no_match') : t('feed.none_in_range')}
              message={filtering ? t('feed.no_match_body') : t('feed.none_in_range_body', { radius })}
              action={
                filtering ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('');
                      setCategory(null);
                    }}
                  >
                    {t('feed.clear')}
                  </Button>
                ) : radius < 25 ? (
                  <Button onClick={() => setRadius(25)}>{t('feed.widen', { radius: 25 })}</Button>
                ) : null
              }
            />
          ) : (
            <>
              {!filtering && (
                <div className="mb-6">
                  <Recommendations coords={coords} />
                </div>
              )}
              <p className="mb-3 text-[12.5px] font-medium text-ink-400">
                {t('feed.count', { count: visible.length, radius })}
                {category ? ` · ${tc(category)}` : ''}
              </p>

              {/* One column on a phone, filling out to four on a wide monitor */}
              <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(clamp(240px,100%,300px),1fr))]">
                {visible.map((p, i) => (
                  <div
                    key={p.product_id}
                    className="animate-fade-up"
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  >
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>

              <p className="py-8 text-center text-[12.5px] text-ink-400">
                {t('feed.end', { radius })}
              </p>
            </>
          )}
        </Container>
      </main>
    </div>
  );
}
