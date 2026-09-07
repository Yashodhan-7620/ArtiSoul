import { Link, Navigate } from 'react-router-dom';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: 'pin', title: 'Sorted by how close', body: 'Every result is ranked by real walking distance, not by who paid.' },
  { icon: 'store', title: 'Shops run by one person', body: 'No resellers, no middlemen — you meet the maker.' },
  { icon: 'camera', title: 'Listed in under a minute', body: 'A photo, a name and a price is the whole form.' },
];

export default function Welcome() {
  const { user, isArtisan } = useAuth();

  // Already signed in? Skip the pitch and go straight to the app.
  if (user) return <Navigate to={isArtisan ? '/artisan' : '/feed'} replace />;

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto scroll-clean bg-ink-800 text-cream-100">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(38rem 30rem at 12% 6%, rgba(194,96,58,0.5), transparent 62%),' +
            'radial-gradient(32rem 28rem at 92% 82%, rgba(217,154,34,0.28), transparent 60%)',
        }}
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-7 pb-10 pt-10 lg:px-10 lg:pb-14 lg:pt-8">
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-clay-500">
              <Icon name="sparkle" className="h-4.5 w-4.5" strokeWidth={2} />
            </span>
            <span className="font-display text-[21px] font-semibold">ArtiSoul</span>
          </span>

          <Link to="/login" className="hidden lg:block">
            <Button variant="outline" size="sm">
              Log in
            </Button>
          </Link>
        </header>

        {/* Hero — stacked on a phone, two columns from lg up */}
        <div className="flex flex-1 flex-col justify-center py-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-16">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cream-100/20 bg-cream-100/10 px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cream-200">
              <Icon name="sparkle" className="h-3.5 w-3.5" strokeWidth={2} />
              Handmade, nearby
            </span>

            <h1 className="mt-7 font-display text-[42px] font-semibold leading-[1.06] tracking-tight sm:text-[52px] lg:text-[60px]">
              The craft
              <br />
              around
              <br />
              <span className="text-clay-300">the corner.</span>
            </h1>

            <p className="mt-5 max-w-[38ch] text-[15px] leading-relaxed text-cream-200/75 lg:text-[17px]">
              ArtiSoul puts every potter, weaver and woodworker within walking distance on a
              single feed — and gives them a shop that takes two minutes to open.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup" className="sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto sm:px-8">
                  Create an account
                </Button>
              </Link>
              <Link to="/feed" className="sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto sm:px-8">
                  Browse without signing in
                </Button>
              </Link>
            </div>

            <p className="mt-5 text-[13.5px] text-cream-200/60 lg:hidden">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-clay-300 underline-offset-4 hover:underline">
                Log in
              </Link>
            </p>
          </div>

          {/* Feature cards: a compact row on mobile, a stacked list on desktop */}
          <div className="mt-12 grid grid-cols-3 gap-2.5 lg:mt-0 lg:grid-cols-1 lg:gap-3">
            {FEATURES.map(({ icon, title, body }) => (
              <div
                key={icon}
                className="rounded-2xl border border-cream-100/12 bg-cream-100/[0.07] p-3 lg:flex lg:items-start lg:gap-4 lg:p-5"
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl text-clay-300 lg:h-11 lg:w-11 lg:shrink-0 lg:bg-cream-100/10">
                  <Icon name={icon} className="h-4 w-4 lg:h-5 lg:w-5" strokeWidth={2} />
                </span>
                <span className="lg:min-w-0">
                  <span className="mt-2 block text-[11.5px] font-semibold leading-tight text-cream-100 lg:mt-0 lg:text-[16px]">
                    {title}
                  </span>
                  <span className="mt-1 hidden text-[13.5px] leading-relaxed text-cream-200/65 lg:block">
                    {body}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
