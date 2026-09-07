// Shared by BottomNav (mobile) and SideNav (desktop) so the two can never
// drift apart. `desktopLabel` is used where the sidebar has room for more words.
export const NAV_ITEMS = [
  { to: '/feed', icon: 'compass', label: 'Discover', desktopLabel: 'Discover' },
  { to: '/artisan', icon: 'store', label: 'My Shop', desktopLabel: 'My shop', artisanOnly: true },
  { to: '/artisan/add', icon: 'plus', label: 'Sell', desktopLabel: 'List a piece', artisanOnly: true },
  { to: '/account', icon: 'user', label: 'Account', desktopLabel: 'Account' },
];
