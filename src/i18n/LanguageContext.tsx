import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { STRINGS, StringKey, Lang, format } from './strings';
import { getStoredLanguage, setStoredLanguage } from '../utils/themeStorage';

// 'recipes_count' when both 'recipes_count_one' and 'recipes_count_other' exist.
type PluralBase = {
  [K in StringKey]: K extends `${infer B}_one` ? (`${B}_other` extends StringKey ? B : never) : never
}[StringKey];

interface LanguageContextValue {
  lang: Lang;
  isRTL: boolean;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, params?: Record<string, string | number>) => string;
  /** Picks `<base>_one` for 1, `<base>_other` otherwise, and fills {count}. */
  tp: (base: PluralBase, count: number) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function deviceLanguage(): Lang {
  let locale = '';
  try {
    locale = Platform.OS === 'web' && typeof navigator !== 'undefined'
      ? navigator.language
      : Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    // Intl can be missing on old Android JS engines; fall back to English.
  }
  return /^(he|iw)\b/i.test(locale ?? '') ? 'he' : 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(deviceLanguage);

  useEffect(() => {
    getStoredLanguage().then((stored) => {
      if (stored === 'en' || stored === 'he') setLangState(stored);
    });
  }, []);

  const isRTL = lang === 'he';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, isRTL]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    setStoredLanguage(next);
  }, []);

  const t = useCallback(
    (key: StringKey, params?: Record<string, string | number>) => format(STRINGS[lang][key] ?? STRINGS.en[key], params),
    [lang],
  );
  const tp = useCallback(
    (base: PluralBase, count: number) => t(`${base}_${count === 1 ? 'one' : 'other'}` as StringKey, { count }),
    [t],
  );

  return (
    <LanguageContext.Provider value={{ lang, isRTL, setLang, t, tp }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
