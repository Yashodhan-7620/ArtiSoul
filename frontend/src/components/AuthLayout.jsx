import { Link } from 'react-router-dom';
import Icon from './Icon';

const POINTS = [
  { icon: 'pin', text: 'Sorted by how close it is to you' },
  { icon: 'store', text: 'Every shop is run by one person' },
  { icon: 'camera', text: 'A piece goes live in under a minute' },
];

// Auth screens: a single centred column on a phone; on a laptop the brand
// panel fills the space the form doesn't need instead of leaving it empty.
export default function AuthLayout({ children }) {
  return (
    <div className="flex h-full min-h-0 flex-1 lg:grid lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-ink-800 p-12 text-cream-100 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(34rem 26rem at 12% 10%, rgba(194,96,58,0.55), transparent 62%),' +
              'radial-gradient(28rem 24rem at 95% 88%, rgba(217,154,34,0.30), transparent 60%)',
          }}
        />

        <Link to="/" className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-clay-500">
            <Icon name="sparkle" className="h-4.5 w-4.5" strokeWidth={2} />
          </span>
          <span className="font-display text-[21px] font-semibold">ArtiSoul</span>
        </Link>

        <div className="relative">
          <h2 className="font-display text-[40px] font-semibold leading-[1.08] tracking-tight">
            The craft
            <br />
            around <span className="text-clay-300">the corner.</span>
          </h2>
          <ul className="mt-8 space-y-3.5">
            {POINTS.map(({ icon, text }) => (
              <li key={icon} className="flex items-center gap-3 text-[14.5px] text-cream-200/80">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cream-100/10 text-clay-300">
                  <Icon name={icon} className="h-4 w-4" strokeWidth={2} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12.5px] text-cream-200/45">ArtiSoul · Phase 3 · MVP</p>
      </aside>

      {/* Form column */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-clean">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-7 pb-10 pt-14 sm:justify-center lg:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
