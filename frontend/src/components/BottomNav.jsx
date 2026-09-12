import { NavLink } from 'react-router-dom';
import Icon from './Icon';
import { NAV_ITEMS } from './navItems';
import { useAuth } from '../context/AuthContext';

// Phone and tablet navigation. Hidden from lg up, where SideNav takes over.
export default function BottomNav() {
  const { isArtisan } = useAuth();
  const items = NAV_ITEMS.filter((i) => !i.artisanOnly || isArtisan);

  return (
    <nav className="z-20 shrink-0 border-t border-cream-300/70 bg-cream-100/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <ul className="flex items-stretch justify-around">
        {items.map(({ to, icon, label }) => (
          <li key={to} className="flex-1">
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
                    className={`grid h-8 w-14 place-items-center rounded-full transition
                                ${isActive ? 'bg-clay-100' : 'bg-transparent'}`}
                  >
                    <Icon name={icon} strokeWidth={isActive ? 2 : 1.75} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
