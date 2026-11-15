import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Language, translations, TranslationKey } from '../i18n/translations';

const LANGUAGE_STORAGE_KEY = '@fitlog_language_preference';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

let memoryLanguage: Language = 'uk';

export const getSavedLanguageSync = (): Language => memoryLanguage;

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved === 'uk' || saved === 'en') {
          memoryLanguage = saved;
          return saved;
        }
      } catch {}
    }
    return memoryLanguage;
  });

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((saved) => {
        if (!isMounted) return;
        if (saved === 'uk' || saved === 'en') {
          memoryLanguage = saved;
          setLanguageState(saved);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    if (lang !== 'uk' && lang !== 'en') return;
    memoryLanguage = lang;
    setLanguageState(lang);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      }
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (e) {
      console.warn('[LanguageContext] Failed to persist language:', e);
    }
  }, []);

  const toggleLanguage = useCallback(async () => {
    const nextLang: Language = language === 'uk' ? 'en' : 'uk';
    await setLanguage(nextLang);
  }, [language, setLanguage]);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const dict = translations[language] as Record<string, string> | undefined;
      if (dict && dict[key] !== undefined) {
        return dict[key];
      }
      const ukDict = translations.uk as Record<string, string>;
      if (ukDict[key] !== undefined) {
        return ukDict[key];
      }
      return fallback !== undefined ? fallback : key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
