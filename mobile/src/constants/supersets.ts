export interface SupersetPalette {
  id: string;
  nameUk: string;
  color: string;
  textColor: string;
  borderColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  buttonActiveBg: string;
  buttonActiveBorder: string;
  buttonActiveText: string;
}

export const SUPERSET_PALETTES: SupersetPalette[] = [
  {
    id: 'accent',
    nameUk: 'Акцентний',
    color: '#F2C94C',
    textColor: '#000000',
    borderColor: '#F2C94C',
    badgeBg: '#F2C94C',
    badgeBorder: '#F2C94C',
    badgeText: '#000000',
    buttonActiveBg: '#F2C94C',
    buttonActiveBorder: '#F2C94C',
    buttonActiveText: '#000000',
  },
  {
    id: 'coral',
    nameUk: 'Кораловий',
    color: '#FF6B4A',
    textColor: '#FFFFFF',
    borderColor: '#FF6B4A',
    badgeBg: '#FF6B4A',
    badgeBorder: '#FF6B4A',
    badgeText: '#FFFFFF',
    buttonActiveBg: '#FF6B4A',
    buttonActiveBorder: '#FF6B4A',
    buttonActiveText: '#FFFFFF',
  },
  {
    id: 'emerald',
    nameUk: 'Смарагдовий',
    color: '#10B981',
    textColor: '#FFFFFF',
    borderColor: '#10B981',
    badgeBg: '#10B981',
    badgeBorder: '#10B981',
    badgeText: '#FFFFFF',
    buttonActiveBg: '#10B981',
    buttonActiveBorder: '#10B981',
    buttonActiveText: '#FFFFFF',
  },
  {
    id: 'purple',
    nameUk: 'Фіолетовий',
    color: '#8B5CF6',
    textColor: '#FFFFFF',
    borderColor: '#8B5CF6',
    badgeBg: '#8B5CF6',
    badgeBorder: '#8B5CF6',
    badgeText: '#FFFFFF',
    buttonActiveBg: '#8B5CF6',
    buttonActiveBorder: '#8B5CF6',
    buttonActiveText: '#FFFFFF',
  },
  {
    id: 'cyan',
    nameUk: 'Блакитний',
    color: '#06B6D4',
    textColor: '#FFFFFF',
    borderColor: '#06B6D4',
    badgeBg: '#06B6D4',
    badgeBorder: '#06B6D4',
    badgeText: '#FFFFFF',
    buttonActiveBg: '#06B6D4',
    buttonActiveBorder: '#06B6D4',
    buttonActiveText: '#FFFFFF',
  },
  {
    id: 'rose',
    nameUk: 'Рожевий',
    color: '#F43F5E',
    textColor: '#FFFFFF',
    borderColor: '#F43F5E',
    badgeBg: '#F43F5E',
    badgeBorder: '#F43F5E',
    badgeText: '#FFFFFF',
    buttonActiveBg: '#F43F5E',
    buttonActiveBorder: '#F43F5E',
    buttonActiveText: '#FFFFFF',
  },
  {
    id: 'amber',
    nameUk: 'Бурштиновий',
    color: '#F59E0B',
    textColor: '#000000',
    borderColor: '#F59E0B',
    badgeBg: '#F59E0B',
    badgeBorder: '#F59E0B',
    badgeText: '#000000',
    buttonActiveBg: '#F59E0B',
    buttonActiveBorder: '#F59E0B',
    buttonActiveText: '#000000',
  },
];

export function getSupersetPalette(index: number, themeAccent?: string, themeAccentText?: string): SupersetPalette {
  const palette = SUPERSET_PALETTES[index % SUPERSET_PALETTES.length];
  if (index === 0 && themeAccent) {
    return {
      ...palette,
      color: themeAccent,
      textColor: themeAccentText ?? '#000000',
      borderColor: themeAccent,
      badgeBg: themeAccent,
      badgeText: themeAccentText ?? '#000000',
    };
  }
  return palette;
}
