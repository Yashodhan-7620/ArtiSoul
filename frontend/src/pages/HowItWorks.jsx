import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import RankBadge from '../components/RankBadge';
import Stars from '../components/Stars';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { Container } from '../components/AppShell';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

// "How ArtiSoul works", in plain words. Starts with the artisan ranks.

function Section({ icon, title, children }) {
  return (
    <section className="rounded-3xl border border-cream-300 bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-[19px] font-semibold text-ink-900">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-clay-50 text-clay-600">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Steps({ prefix, count, t }) {
  return (
    <ol className="space-y-2.5">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-clay-500 text-[12px] font-bold text-white">{i + 1}</span>
          <span className="pt-0.5 text-[14.5px] leading-relaxed text-ink-700">{t(`${prefix}.${i + 1}`)}</span>
        </li>
      ))}
    </ol>
  );
}

// "₹1,00,000+ sold · 50+ orders · 4.5★ (5+ reviews)"
function ruleText(rule, t) {
  if (rule.key === 'none') return t('rank.none.rule');
  const parts = [];
  if (rule.min_revenue > 0) parts.push(t('help.rank.revenue', { amount: formatPrice(rule.min_revenue) }));
  parts.push(t('help.rank.orders', { count: rule.min_orders }));
  if (rule.min_rating) parts.push(t('help.rank.rating', { rating: rule.min_rating, reviews: rule.min_reviews }));
  return parts.join(' · ');
}

export default function HowItWorks() {
  const { user, token } = useAuth();
  const { t } = useT();
  const [ranks, setRanks] = useState(null);
  const [mine, setMine] = useState(null);

  useEffect(() => {
    api.ranks.list().then(({ data }) => setRanks(data)).catch(() => setRanks({ rules: [], artisans: [] }));
  }, []);
  useEffect(() => {
    if (user?.role !== 'artisan') return;
    api.ranks.mine(token).then(({ data }) => setMine(data)).catch(() => {});
  }, [user, token]);

  const ranked = ranks?.artisans.filter((a) => a.rank !== 'none') ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={t('help.title')} subtitle={t('help.subtitle')} action={<LanguageSwitcher compact />} />
      <div className="min-h-0 flex-1 overflow-y-auto scroll-clean px-5 pb-10 pt-5 md:px-8 md:pt-7">
        <Container size="form" className="space-y-5">
          {/* 1. Ranks first */}
          <Section icon="trophy" title={t('help.rank.title')}>
            <p className="text-[14.5px] leading-relaxed text-ink-700">{t('help.rank.intro')}</p>

            {mine && (
              <div className="mt-4 rounded-2xl border border-clay-200 bg-clay-50 p-4">
                <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-clay-600">{t('help.rank.yours')}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RankBadge rank={mine.rank} size="lg" />
                  <span className="text-[13px] text-ink-600">{t('help.rank.your_numbers', { orders: mine.orders, amount: formatPrice(mine.revenue) })}</span>
                </div>
                {mine.next && (
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-700">
                    {t('help.rank.next', { rank: t(`rank.${mine.next.key}.name`) })}{' '}
                    {[
                      mine.next.revenue_needed > 0 && t('help.rank.more_sales', { amount: formatPrice(mine.next.revenue_needed) }),
                      mine.next.orders_needed > 0 && t('help.rank.more_orders', { count: mine.next.orders_needed }),
                      mine.next.reviews_needed > 0 && t('help.rank.more_reviews', { count: mine.next.reviews_needed }),
                      mine.next.rating_needed && t('help.rank.rating_to', { rating: mine.next.rating_needed }),
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 overflow-hidden rounded-2xl border border-cream-300">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-cream-100 text-[11px] uppercase tracking-wide text-ink-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">{t('help.rank.col_rank')}</th>
                    <th className="px-3 py-2 font-semibold">{t('help.rank.col_needs')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(ranks?.rules ?? []).map((r) => (
                    <tr key={r.key} className="border-t border-cream-200 align-top">
                      <td className="px-3 py-2.5 font-semibold text-ink-500">{r.level}</td>
                      <td className="px-3 py-2.5">
                        <RankBadge rank={r.key} />
                      </td>
                      <td className="px-3 py-2.5 text-ink-600">{ruleText(r, t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-400">{t('help.rank.fine_print')}</p>

            <h3 className="mt-5 font-display text-[16px] font-semibold text-ink-800">{t('help.rank.board')}</h3>
            {!ranks ? (
              <div className="skeleton mt-2 h-20 w-full rounded-2xl" />
            ) : ranked.length === 0 ? (
              <p className="mt-1.5 text-[13px] text-ink-400">{t('help.rank.board_empty')}</p>
            ) : (
              <ol className="mt-2 space-y-1.5">
                {ranked.slice(0, 20).map((a, i) => (
                  <li key={`${a.shops}-${i}`} className="flex items-center gap-3 rounded-2xl bg-cream-100 px-3 py-2">
                    <span className="w-5 text-right text-[12px] font-bold text-ink-400">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-800">{a.shops}</span>
                    {a.rating && <Stars value={a.rating} size="h-3 w-3" />}
                    <RankBadge rank={a.rank} />
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section icon="compass" title={t('help.what.title')}>
            <p className="text-[14.5px] leading-relaxed text-ink-700">{t('help.what.body')}</p>
          </Section>

          <Section icon="cart" title={t('help.buy.title')}>
            <Steps prefix="help.buy" count={6} t={t} />
          </Section>

          <Section icon="store" title={t('help.sell.title')}>
            <Steps prefix="help.sell" count={6} t={t} />
          </Section>

          <Section icon="check" title={t('help.pay.title')}>
            <Steps prefix="help.pay" count={3} t={t} />
          </Section>

          <Section icon="video" title={t('help.live.title')}>
            <p className="text-[14.5px] leading-relaxed text-ink-700">{t('help.live.body')}</p>
          </Section>

          <Section icon="calendar" title={t('help.events.title')}>
            <Steps prefix="help.events" count={4} t={t} />
            <Link to="/events" className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-semibold text-clay-600 hover:underline">
              {t('help.events.link')}
              <Icon name="chevron" className="h-3.5 w-3.5" />
            </Link>
          </Section>

          <Section icon="shield" title={t('help.safe.title')}>
            <Steps prefix="help.safe" count={4} t={t} />
          </Section>

          <Section icon="globe" title={t('help.lang.title')}>
            <p className="text-[14.5px] leading-relaxed text-ink-700">{t('help.lang.body')}</p>
            <LanguageSwitcher className="mt-3" />
          </Section>
        </Container>
      </div>
    </div>
  );
}
