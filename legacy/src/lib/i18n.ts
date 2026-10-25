import { en } from './translations/en';
import { he } from './translations/he';

export type Language = 'he' | 'en';
// Future: | 'ru' | 'ar'

export const LANGUAGES: Language[] = ['he', 'en'];
export const RTL_LANGUAGES: Language[] = ['he'];
// Future: push 'ar' to RTL_LANGUAGES

export const translations = { en, he } as const;

export function isRTL(lang: Language): boolean {
  return RTL_LANGUAGES.includes(lang);
}

export function getDir(lang: Language): 'rtl' | 'ltr' {
  return isRTL(lang) ? 'rtl' : 'ltr';
}

export type { Translation } from './translations/en';
export { en, he };
