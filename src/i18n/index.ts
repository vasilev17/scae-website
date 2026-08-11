import { getRelativeLocaleUrl } from 'astro:i18n';

import { locales, type Locale } from './config';
import { bg } from './ui/bg';
import { en, type UiDictionary } from './ui/en';

const dictionaries: Record<Locale, UiDictionary> = { bg, en };

export function getDictionary(locale: Locale): UiDictionary {
  return dictionaries[locale];
}

/** Builds one static route per locale for `src/pages/[locale]/` routes. */
export function localeStaticPaths() {
  return locales.map((locale) => ({ params: { locale } }));
}

export function getAlternateLocales(current: Locale): Locale[] {
  return locales.filter((locale) => locale !== current);
}

export function localeUrl(locale: Locale, path = '/'): string {
  return getRelativeLocaleUrl(locale, path);
}

export * from './config';
