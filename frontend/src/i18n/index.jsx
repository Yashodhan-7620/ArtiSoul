import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './en';
import hi from './hi';
import mr from './mr';
import { setFormatLocale } from '../lib/format';

// App language: English, Hindi or Marathi. Strings live in en.js / hi.js /
// mr.js under the same keys; a key missing in Hindi or Marathi falls back to
// English, so a half-translated screen never shows a raw key.

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
];

const DICTS = { en, hi, mr };
const STORAGE_KEY = 'artisoul.lang';

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (DICTS[saved]) return saved;
  } catch {
    /* storage unavailable */
  }
  const browser = (navigator.language || '').slice(0, 2);
  return DICTS[browser] ? browser : 'en';
}

// t('cart.items', { count: 2 }) -> picks 'cart.items_other' when that key exists.
export function translate(lang, key, vars) {
  const dict = DICTS[lang] || en;
  let k = key;
  if (vars && typeof vars.count === 'number') {
    const plural = `${key}_${vars.count === 1 ? 'one' : 'other'}`;
    if (dict[plural] !== undefined || en[plural] !== undefined) k = plural;
  }
  const text = dict[k] ?? en[k] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, name) => (vars[name] ?? m)) : text;
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);
  setFormatLocale(lang); // dates rendered below must use the current language

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* not persisted */
    }
  }, [lang]);

  const setLang = useCallback((code) => DICTS[code] && setLangState(code), []);
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  // Category names are stored in English; show them in the reader's language.
  const tc = useCallback((category) => (category ? translate(lang, `cat.${category}`, null).replace(/^cat\./, '') : ''), [lang]);

  const value = useMemo(() => ({ lang, setLang, t, tc }), [lang, setLang, t, tc]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT must be used inside <LanguageProvider>');
  return ctx;
}
