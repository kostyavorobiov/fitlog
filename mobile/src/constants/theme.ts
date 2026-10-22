/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const OceanColors = {
  primary: '#2563EB',
  accent: '#60A5FA',
  success: '#22C55E',
  light: {
    primary: '#2563EB',
    accent: '#60A5FA',
    success: '#22C55E',
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    inactive: '#F1F5F9',
    backgroundElement: '#F1F5F9',
    backgroundSelected: '#E2E8F0',
  },
  dark: {
    primary: '#2563EB',
    accent: '#60A5FA',
    success: '#22C55E',
    background: '#0B1220',
    card: '#1D2939',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: '#334155',
    inactive: '#263140',
    backgroundElement: '#263140',
    backgroundSelected: '#334155',
  },
} as const;

export const Colors = OceanColors;

export const getOceanTheme = (isDark: boolean) => (isDark ? OceanColors.dark : OceanColors.light);

export type ThemeColor = keyof typeof OceanColors.light & keyof typeof OceanColors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
