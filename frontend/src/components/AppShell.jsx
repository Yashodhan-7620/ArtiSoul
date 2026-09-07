import { useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import SideNav from './SideNav';

// One layout that adapts instead of a fixed phone frame:
//   < 768px  full-bleed app with a bottom tab bar
//   >= 768px a persistent left sidebar and a wide content area
export default function AppShell({ nav = true, children }) {
  const { pathname } = useLocation();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-cream-100">
      {nav && <SideNav />}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* key on pathname replays the enter animation on every navigation */}
        <div key={pathname} className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
        {nav && <BottomNav />}
      </div>
    </div>
  );
}

// Keeps content from stretching to absurd line lengths on a wide monitor.
// `size` picks the ceiling: forms want a narrow column, the feed wants room.
const SIZES = {
  form: 'max-w-2xl',
  page: 'max-w-6xl',
  wide: 'max-w-7xl',
};

export function Container({ size = 'page', className = '', children }) {
  return <div className={`mx-auto w-full ${SIZES[size]} ${className}`}>{children}</div>;
}
