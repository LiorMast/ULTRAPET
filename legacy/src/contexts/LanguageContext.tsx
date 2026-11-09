import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Language, Translation, translations, getDir, isRTL } from '../lib/i18n';
import { supabase } from '../lib/supabase';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translation;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

type TextOverrides = Record<string, Record<string, Record<string, string>>>;

function detectInitialLanguage(): Language {
  const stored = localStorage.getItem('up_lang') as Language | null;
  if (stored && (stored === 'he' || stored === 'en')) return stored;
  return 'he';
}

function mergeTextBlocks(base: Translation, overrides: Record<string, Record<string, string>>): Translation {
  const result = { ...base } as Record<string, unknown>;
  for (const [section, keys] of Object.entries(overrides)) {
    if (!(section in result) || typeof result[section] !== 'object') continue;
    const merged = { ...(result[section] as Record<string, unknown>) };
    for (const [key, value] of Object.entries(keys)) {
      if (key in merged) {
        try {
          merged[key] = value.startsWith('[') ? JSON.parse(value) : value;
        } catch {
          merged[key] = value;
        }
      }
    }
    result[section] = merged;
  }
  return result as Translation;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectInitialLanguage);
  const [textOverrides, setTextOverrides] = useState<TextOverrides>({});

  const setLang = (next: Language) => {
    setLangState(next);
    localStorage.setItem('up_lang', next);
  };

  useEffect(() => {
    const dir = getDir(lang);
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    document.body.classList.toggle('lang-he', lang === 'he');
    document.body.classList.toggle('lang-en', lang === 'en');
  }, [lang]);

  useEffect(() => {
    supabase.from('cms_text_blocks').select('*').then(({ data }) => {
      if (!data) return;
      const blocks: TextOverrides = {};
      data.forEach((r: { lang: string; section: string; field_key: string; value: string }) => {
        if (!blocks[r.lang]) blocks[r.lang] = {};
        if (!blocks[r.lang][r.section]) blocks[r.lang][r.section] = {};
        blocks[r.lang][r.section][r.field_key] = r.value;
      });
      setTextOverrides(blocks);
    });
  }, []);

  const t = useMemo(
    () => mergeTextBlocks(translations[lang], textOverrides[lang] || {}),
    [lang, textOverrides]
  );

  const value: LanguageContextValue = {
    lang,
    setLang,
    t,
    dir: getDir(lang),
    isRtl: isRTL(lang),
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
