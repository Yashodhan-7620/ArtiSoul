import Icon from './Icon';
import { LANGUAGES, useT } from '../i18n';

// English / हिन्दी / मराठी. `compact` is the small pill used in headers.
export default function LanguageSwitcher({ compact = false, className = '' }) {
  const { lang, setLang, t } = useT();

  if (compact) {
    return (
      <label className={`relative inline-flex items-center ${className}`}>
        <span className="sr-only">{t('lang.label')}</span>
        <Icon name="globe" className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-400" />
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="appearance-none rounded-full border border-cream-300 bg-white py-1.5 pl-7 pr-3 text-[12.5px] font-semibold text-ink-600 hover:border-clay-300"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className={className}>
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-400">
        <Icon name="globe" className="h-3.5 w-3.5" />
        {t('lang.label')}
      </p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('lang.label')}>
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={lang === l.code}
            onClick={() => setLang(l.code)}
            className={`rounded-2xl border px-3 py-2.5 text-[14px] font-semibold transition ${
              lang === l.code
                ? 'border-clay-500 bg-clay-50 text-clay-700'
                : 'border-cream-300 bg-white text-ink-600 hover:border-clay-200'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
