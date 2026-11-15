import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { MobileStorage } from '../lib/storage';
import { Theme, ThemePalette, THEMES } from '../constants/theme';

export type { Theme, ThemePalette };

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  colors: ThemePalette;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const THEME_PREF_KEY = 'theme_preference';

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useRNColorScheme();
  const [theme, setThemeState] = useState<Theme>(() => {
    return systemScheme === 'light' ? 'paper' : 'night';
  });

  useEffect(() => {
    let isMounted = true;
    MobileStorage.getItem<string | null>(THEME_PREF_KEY, null).then((saved) => {
      if (!isMounted || !saved) return;
      if (saved === 'dark') {
        setThemeState('night');
      } else if (saved === 'light') {
        setThemeState('paper');
      } else if (['night', 'paper', 'blue', 'navy'].includes(saved)) {
        setThemeState(saved as Theme);
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
      // Toggle cycles: night -> paper -> blue -> navy -> night
      const nextMap: Record<Theme, Theme> = {
        night: 'paper',
        paper: 'blue',
        blue: 'navy',
        navy: 'night',
      };
      const next = nextMap[prev] || 'night';
      MobileStorage.setItem(THEME_PREF_KEY, next);
      return next;
    });
  }, []);

  const currentTheme = THEMES[theme] || THEMES.night;
  const isDark = currentTheme.isDark;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors: currentTheme, toggleTheme, setTheme }}>
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
    return context.isDark ? 'dark' : 'light';
  }
  const system = useRNColorScheme();
  return system === 'light' ? 'light' : 'dark';
};
