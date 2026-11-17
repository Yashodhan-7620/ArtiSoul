import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
import { useT } from '../i18n';

// Small app-wide counters: unread notifications (everyone logged in) and the
// number of items in the cart (buyers). Polled every 20 s, and refreshed
// right away by screens that change them.
const BadgesContext = createContext(null);
const POLL_MS = 20000;

export function BadgesProvider({ children }) {
  const { user, token } = useAuth();
  const { t } = useT();
  const [unread, setUnread] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const latestSeen = useRef(null);
  const isCustomer = user?.role === 'customer';

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.notifications.unreadCount(token);
      setUnread(data.unread);
      // A browser/phone notification for something new, if the user allowed it.
      if (
        latestSeen.current !== null &&
        data.latest &&
        data.latest > latestSeen.current &&
        document.hidden &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification('ArtiSoul', { body: t('notif.browser_new', { count: data.unread }), icon: '/artisoul.svg' });
      }
      latestSeen.current = data.latest || latestSeen.current || 0;
    } catch {
      /* offline or logged out: keep the last value */
    }
  }, [token, t]);

  const refreshCart = useCallback(async () => {
    if (!token || !isCustomer) return setCartCount(0);
    try {
      const { data } = await api.cart.get(token);
      setCartCount(data.count);
    } catch {
      /* ignore */
    }
  }, [token, isCustomer]);

  useEffect(() => {
    latestSeen.current = null;
    if (!token) {
      setUnread(0);
      setCartCount(0);
      return undefined;
    }
    refresh();
    refreshCart();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [token, refresh, refreshCart]);

  const value = useMemo(
    () => ({ unread, setUnread, refresh, cartCount, setCartCount, refreshCart }),
    [unread, refresh, cartCount, refreshCart]
  );
  return <BadgesContext.Provider value={value}>{children}</BadgesContext.Provider>;
}

export function useBadges() {
  const ctx = useContext(BadgesContext);
  if (!ctx) throw new Error('useBadges must be used inside <BadgesProvider>');
  return ctx;
}
