import { useNavigate } from 'react-router-dom';
import Icon from './Icon';

export default function TopBar({ title, subtitle, back = false, action = null, sticky = true }) {
  const navigate = useNavigate();

  return (
    <header
      className={`z-20 shrink-0 border-b border-cream-300/70 bg-cream-100/90 px-4 pb-3 pt-5
                  backdrop-blur-md md:px-8 md:pb-4 md:pt-7 ${sticky ? 'sticky top-0' : ''}`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
        {back && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-600
                       transition hover:bg-cream-200 active:scale-95"
          >
            <Icon name="back" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[20px] font-semibold leading-tight text-ink-800 md:text-[23px]">
            {title}
          </h1>
          {subtitle && <p className="truncate text-[12.5px] text-ink-400">{subtitle}</p>}
        </div>

        {action}
      </div>
    </header>
  );
}
