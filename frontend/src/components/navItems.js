// Shared by BottomNav (mobile) and SideNav (desktop) so the two can never
// drift apart. `roles` lists who sees an item ('guest' = not logged in);
// `badge` names a live counter from BadgesContext.
export const NAV_ITEMS = [
  { to: '/feed', icon: 'compass', label: 'nav.discover', roles: ['guest', 'customer', 'artisan', 'admin'] },
  { to: '/cart', icon: 'cart', label: 'nav.cart', roles: ['customer'], badge: 'cart' },
  { to: '/purchases', icon: 'receipt', label: 'nav.orders', desktopLabel: 'nav.purchases', roles: ['customer'] },
  { to: '/artisan', icon: 'store', label: 'nav.shop', roles: ['artisan'] },
  { to: '/artisan/add', icon: 'plus', label: 'nav.sell', desktopLabel: 'nav.sell_long', roles: ['artisan'] },
  { to: '/admin', icon: 'shield', label: 'nav.admin', roles: ['admin'] },
  // Desktop sidebar only; on phones these are reached from Account and banners.
  { to: '/events', icon: 'calendar', label: 'nav.events', roles: ['guest', 'customer', 'artisan', 'admin'], mobile: false },
  { to: '/how-it-works', icon: 'info', label: 'nav.help', roles: ['guest', 'customer', 'artisan', 'admin'], mobile: false },
  { to: '/notifications', icon: 'bell', label: 'nav.alerts', roles: ['customer', 'artisan', 'admin'], badge: 'unread' },
  { to: '/account', icon: 'user', label: 'nav.account', roles: ['guest', 'customer', 'artisan', 'admin'] },
];

export function navItemsFor(user, { mobile = false } = {}) {
  const role = user?.role || 'guest';
  return NAV_ITEMS.filter((i) => i.roles.includes(role) && !(mobile && i.mobile === false));
}
