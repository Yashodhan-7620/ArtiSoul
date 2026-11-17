import { NavLink } from 'react-router-dom';
import Icon from './Icon';
import { navItemsFor } from './navItems';
import { useAuth } from '../context/AuthContext';
import { useBadges } from '../context/BadgesContext';
import { useT } from '../i18n';

export function Badge({ count, className = '' }) {
  if (!count) return null;
  return (
    <span
      className={`grid h-[18px] min-w-[18px] place-items-center rounded-full bg-clay-500 px-1 text-[10.5px] font-bold leading-none text-white ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// Phone and tablet navigation. Hidden from lg up, where SideNav takes over.
export default function BottomNav() {
  const { user } = useAuth();
  const { unread, cartCount } = useBadges();
  const { t } = useT();
  const counts = { unread, cart: cartCount };
  const items = navItemsFor(user, { mobile: true });

  return (
    <nav className="z-20 shrink-0 border-t border-cream-300/70 bg-cream-100/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <ul className="flex items-stretch justify-around">
        {items.map(({ to, icon, label, badge }) => (
          <li key={to} className="min-w-0 flex-1">
            <NavLink
              to={to}
              end={to === '/artisan'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-semibold transition
                 ${isActive ? 'text-clay-600' : 'text-ink-400 hover:text-ink-600'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`relative grid h-8 w-12 place-items-center rounded-full transition sm:w-14
                                ${isActive ? 'bg-clay-100' : 'bg-transparent'}`}
                  >
                    <Icon name={icon} strokeWidth={isActive ? 2 : 1.75} />
                    <Badge count={badge ? counts[badge] : 0} className="absolute -right-0.5 -top-1" />
                  </span>
                  <span className="max-w-full truncate px-0.5">{t(label)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
