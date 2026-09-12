import { Link, NavLink } from 'react-router-dom';
import Icon from './Icon';
import { NAV_ITEMS } from './navItems';
import { initials } from '../lib/format';
import { useAuth } from '../context/AuthContext';

// Desktop navigation. Appears only at lg and up; below that a 248px rail
// would squeeze the content column more than it helps, so BottomNav takes over.
export default function SideNav() {
  const { user, isArtisan } = useAuth();
  const items = NAV_ITEMS.filter((i) => !i.artisanOnly || isArtisan);

  return (
    <aside className="hidden w-[264px] shrink-0 flex-col border-r border-cream-300 bg-cream-50/60 px-4 py-6 lg:flex">
      <Link to="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-clay-500 text-cream-100">
          <Icon name="sparkle" className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <span className="font-display text-[21px] font-semibold text-ink-900">ArtiSoul</span>
      </Link>

      <nav className="flex-1">
        <ul className="space-y-1">
          {items.map(({ to, icon, label, desktopLabel }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/artisan'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14.5px] font-semibold transition
                   ${
                     isActive
                       ? 'bg-clay-100 text-clay-700'
                       : 'text-ink-500 hover:bg-cream-200 hover:text-ink-700'
                   }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon name={icon} strokeWidth={isActive ? 2 : 1.75} />
                    {desktopLabel || label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {user ? (
        <Link
          to="/account"
          className="mt-4 flex items-center gap-3 rounded-2xl border border-cream-300 bg-white p-3
                     transition hover:border-clay-200"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-clay-500 text-[13px] font-semibold text-white">
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-ink-800">{user.name}</span>
            <span className="block text-[11.5px] capitalize text-ink-400">{user.role}</span>
          </span>
        </Link>
      ) : (
        <Link
          to="/login"
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-clay-500 px-4 py-3
                     text-[14px] font-semibold text-white transition hover:bg-clay-600"
        >
          Log in
        </Link>
      )}
    </aside>
  );
}
