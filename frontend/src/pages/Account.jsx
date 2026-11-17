import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { api, API_BASE } from '../lib/api';
import { initials } from '../lib/format';
import { Container } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

function LinkRow({ to, icon, label }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-white px-4 py-3.5
                 transition hover:border-clay-200 active:scale-[0.99]"
    >
      <Icon name={icon} className="h-5 w-5 text-clay-500" />
      <span className="flex-1 text-[14.5px] font-semibold text-ink-700">{label}</span>
      <Icon name="chevron" className="h-4 w-4 text-ink-400" />
    </Link>
  );
}

export default function Account() {
  const { user, logout, isArtisan, isCustomer, isAdmin } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [apiUp, setApiUp] = useState(null);

  // A visible backend status light saves a lot of "why is nothing loading?"
  useEffect(() => {
    api
      .health()
      .then(() => setApiUp(true))
      .catch(() => setApiUp(false));
  }, []);

  if (!user) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar title={t('nav.account')} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-cream-200 text-clay-400">
            <Icon name="user" className="h-7 w-7" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-display text-[19px] font-semibold text-ink-800">{t('account.guest_title')}</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-400">{t('account.guest_body')}</p>
          </div>
          <div className="flex w-full max-w-[16rem] flex-col gap-2.5">
            <Link to="/signup">
              <Button className="w-full">{t('auth.create_account')}</Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" className="w-full">
                {t('auth.login')}
              </Button>
            </Link>
          </div>
          <LanguageSwitcher className="mt-4 w-full max-w-xs text-left" />
          <div className="flex gap-4 text-[13.5px] font-semibold text-clay-600">
            <Link to="/events" className="hover:underline">{t('nav.events')}</Link>
            <Link to="/how-it-works" className="hover:underline">{t('nav.help')}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title={t('nav.account')} />

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
                  ${isArtisan ? 'bg-clay-50 text-clay-700' : isAdmin ? 'bg-violet-100 text-violet-700' : 'bg-sage-100 text-sage-600'}`}
              >
                {t(`role.${user.role}`)}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {isCustomer && (
              <>
                <LinkRow to="/purchases" icon="receipt" label={t('account.purchases')} />
                <LinkRow to="/wishlist" icon="heart" label={t('wish.title')} />
                <LinkRow to="/cart" icon="cart" label={t('cart.title')} />
              </>
            )}
            {isArtisan && (
              <>
                <LinkRow to="/artisan" icon="store" label={t('nav.shop')} />
                <LinkRow to="/artisan/sales" icon="chart" label={t('sales.title')} />
                <LinkRow to="/artisan/shop" icon="plus" label={t('account.another_shop')} />
              </>
            )}
            {isAdmin && <LinkRow to="/admin" icon="shield" label={t('admin.title')} />}
            <LinkRow to="/notifications" icon="bell" label={t('notif.title')} />
            <LinkRow to="/events" icon="calendar" label={t('nav.events')} />
            <LinkRow to="/how-it-works" icon="info" label={t('nav.help')} />
          </div>

          <div className="mt-5 rounded-2xl border border-cream-300 bg-white p-4">
            <LanguageSwitcher />
          </div>

          <div className="mt-4 rounded-2xl border border-cream-300 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  apiUp === null ? 'bg-ink-400' : apiUp ? 'bg-sage-500' : 'bg-clay-500'
                }`}
              />
              <span className="text-[13.5px] font-semibold text-ink-700">
                {apiUp === null ? t('account.api_checking') : apiUp ? t('account.api_ok') : t('account.api_down')}
              </span>
            </div>
            <p className="mt-1.5 break-all pl-[18px] text-[12px] text-ink-400">{API_BASE || window.location.origin}</p>
          </div>

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
            {t('auth.logout')}
          </Button>

          <p className="mt-8 text-center text-[12px] text-ink-400">ArtiSoul</p>
        </Container>
      </div>
    </div>
  );
}
