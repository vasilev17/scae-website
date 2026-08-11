export const locales = ['bg', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'bg';

export const localeLabels: Record<Locale, string> = {
  bg: 'БГ',
  en: 'EN',
};

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function resolveLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : defaultLocale;
}
