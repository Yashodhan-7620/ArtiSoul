import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import Stars from './Stars';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

// A horizontal strip of suggested pieces with the reason for each
// ("Because you like Pottery"). Hidden when there's nothing to show.
export default function Recommendations({ coords, productId, title }) {
  const { token } = useAuth();
  const { t, tc } = useT();
  const [items, setItems] = useState([]);
  const lat = coords?.lat;
  const lng = coords?.lng;

  useEffect(() => {
    let cancelled = false;
    api.products
      .recommended({ lat, lng, productId, limit: 8 }, token)
      .then(({ data }) => !cancelled && setItems(data))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [lat, lng, productId, token]);

  if (!items.length) return null;

  const reasonText = (r) => {
    if (r.type === 'because_category') return t('reco.because', { category: tc(r.category) });
    if (r.type === 'similar') return t('reco.similar');
    if (r.type === 'top_rated') return t('reco.top_rated');
    if (r.type === 'new') return t('reco.new');
    return t('reco.popular');
  };

  return (
    <section aria-label={title || t('reco.title')}>
      <h2 className="mb-2.5 flex items-center gap-1.5 font-display text-[18px] font-semibold text-ink-800">
        <Icon name="sparkle" className="h-4 w-4 text-clay-500" />
        {title || t('reco.title')}
      </h2>
      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto scroll-clean px-5 pb-1 md:mx-0 md:px-0">
        {items.map((p) => (
          <Link
            key={p.product_id}
            to={`/product/${p.product_id}`}
            className="w-[160px] shrink-0 snap-start overflow-hidden rounded-2xl border border-cream-300 bg-white transition hover:border-clay-200 hover:shadow-card"
          >
            <div className="aspect-square bg-gradient-to-br from-clay-100 to-cream-300">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-clay-400/60">
                  <Icon name="box" className="h-8 w-8" strokeWidth={1.2} />
                </div>
              )}
            </div>
            <div className="space-y-0.5 p-2.5">
              <p className="truncate text-[13px] font-semibold text-ink-800">{p.name}</p>
              <p className="text-[13px] font-semibold text-clay-600">{formatPrice(p.price)}</p>
              {p.review_count > 0 && <Stars value={p.avg_rating} size="h-3 w-3" />}
              <p className="truncate text-[11px] text-ink-400">{reasonText(p.reason)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
