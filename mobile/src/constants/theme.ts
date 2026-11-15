import '@/global.css';
import { Platform } from 'react-native';

export type Theme = 'night' | 'paper' | 'blue' | 'navy';

export interface ThemePalette {
  id: Theme;
  name: string;
  isDark: boolean;
  bg: string;
  card: string;
  cardBorder: string;
  subCard: string;
  subCardBorder: string;
  accent: string;            // The key brand color (Lime for Night/Paper, Royal Blue for Blue, Light Cornflower for Navy)
  accentText: string;        // Text color on top of accent (Black for Lime & Sky, White for Blue)
  accentSubtle: string;      // Subtle tint for badges/chips
  accentBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  divider: string;
  tabBarBg: string;
  tabBarBorder: string;
  centerButtonBg: string;
  centerButtonIcon: string;
  inputBg: string;
  inputText: string;
  success: string;
  warning: string;
  danger: string;
  statusInProgressBg: string;
  statusInProgressText: string;
  statusCompletedBg: string;
  statusCompletedText: string;
  heroCardBg: string;
  heroCardText: string;
  heroBtnBg: string;
  heroBtnText: string;
}

export const THEMES: Record<Theme, ThemePalette> = {
  night: {
    id: 'night',
    name: 'Night',
    isDark: true,
    bg: '#0E1015',
    card: '#16171C',
    cardBorder: '#222634',
    subCard: '#212129',
    subCardBorder: '#2D303D',
    accent: '#CCFF00',
    accentText: '#000000',
    accentSubtle: 'rgba(204, 255, 0, 0.15)',
    accentBorder: '#CCFF00',
    text: '#FFFFFF',
    textSecondary: '#8E95A5',
    textMuted: '#5C6375',
    border: '#222634',
    divider: '#1C202C',
    tabBarBg: '#16171C',
    tabBarBorder: '#222634',
    centerButtonBg: '#CCFF00',
    centerButtonIcon: '#000000',
    inputBg: '#212129',
    inputText: '#FFFFFF',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    statusInProgressBg: '#CCFF00',
    statusInProgressText: '#000000',
    statusCompletedBg: 'rgba(255, 255, 255, 0.08)',
    statusCompletedText: '#8E95A5',
    heroCardBg: '#CCFF00',
    heroCardText: '#000000',
    heroBtnBg: '#0E1015',
    heroBtnText: '#CCFF00',
  },
  paper: {
    id: 'paper',
    name: 'Paper',
    isDark: false,
    bg: '#F5F3EC',
    card: '#FFFFFF',
    cardBorder: '#EDE9DF',
    subCard: '#EBE8DE',
    subCardBorder: '#DFDACD',
    accent: '#CCFF00',
    accentText: '#000000',
    accentSubtle: 'rgba(204, 255, 0, 0.22)',
    accentBorder: '#CCFF00',
    text: '#121826',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E5E0D3',
    divider: '#EFECE4',
    tabBarBg: '#FFFFFF',
    tabBarBorder: '#EDE9DF',
    centerButtonBg: '#CCFF00',
    centerButtonIcon: '#000000',
    inputBg: '#EBE8DE',
    inputText: '#121826',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    statusInProgressBg: '#CCFF00',
    statusInProgressText: '#000000',
    statusCompletedBg: '#EBE8DE',
    statusCompletedText: '#64748B',
    heroCardBg: '#CCFF00',
    heroCardText: '#000000',
    heroBtnBg: '#0E1015',
    heroBtnText: '#CCFF00',
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    isDark: false,
    bg: '#F3F5FA',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    subCard: '#E8EEF8',
    subCardBorder: '#D7E2F2',
    accent: '#2563EB',
    accentText: '#FFFFFF',
    accentSubtle: 'rgba(37, 99, 235, 0.12)',
    accentBorder: '#2563EB',
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    divider: '#F1F5F9',
    tabBarBg: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    centerButtonBg: '#2563EB',
    centerButtonIcon: '#FFFFFF',
    inputBg: '#E8EEF8',
    inputText: '#0F172A',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    statusInProgressBg: '#2563EB',
    statusInProgressText: '#FFFFFF',
    statusCompletedBg: '#E8EEF8',
    statusCompletedText: '#64748B',
    heroCardBg: '#2563EB',
    heroCardText: '#FFFFFF',
    heroBtnBg: '#FFFFFF',
    heroBtnText: '#2563EB',
  },
  navy: {
    id: 'navy',
    name: 'Navy',
    isDark: true,
    bg: '#0D111D',
    card: '#171B26',
    cardBorder: '#242A3E',
    subCard: '#242B45',
    subCardBorder: '#313B5C',
    accent: '#5E8BFF',
    accentText: '#0D111D',
    accentSubtle: 'rgba(94, 139, 255, 0.15)',
    accentBorder: '#5E8BFF',
    text: '#FFFFFF',
    textSecondary: '#8290AC',
    textMuted: '#52607D',
    border: '#242A3E',
    divider: '#192133',
    tabBarBg: '#171B26',
    tabBarBorder: '#242A3E',
    centerButtonBg: '#5E8BFF',
    centerButtonIcon: '#0D111D',
    inputBg: '#242B45',
    inputText: '#FFFFFF',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    statusInProgressBg: '#5E8BFF',
    statusInProgressText: '#0D111D',
    statusCompletedBg: '#242B45',
    statusCompletedText: '#8290AC',
    heroCardBg: '#5E8BFF',
    heroCardText: '#0D111D',
    heroBtnBg: '#0D111D',
    heroBtnText: '#5E8BFF',
  },
};

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
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
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
