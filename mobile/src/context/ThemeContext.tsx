import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { MobileStorage } from '../lib/storage';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const THEME_PREF_KEY = 'theme_preference';

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useRNColorScheme();
  const [theme, setThemeState] = useState<Theme>(() => {
    return systemScheme === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    let isMounted = true;
    MobileStorage.getItem<Theme | null>(THEME_PREF_KEY, null).then((saved) => {
      if (isMounted && (saved === 'light' || saved === 'dark')) {
        setThemeState(saved);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme);
    await MobileStorage.setItem(THEME_PREF_KEY, newTheme);
  }, []);

  const toggleTheme = useCallback(async () => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      MobileStorage.setItem(THEME_PREF_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Drop-in replacement for React Native's useColorScheme that respects
 * the user's explicit theme preference from ThemeProvider.
 */
export const useAppColorScheme = (): 'light' | 'dark' => {
  const context = useContext(ThemeContext);
  if (context) {
    return context.theme;
  }
  const system = useRNColorScheme();
  return system === 'light' ? 'light' : 'dark';
};
