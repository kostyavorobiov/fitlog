export interface SupersetPalette {
  id: string;
  nameUk: string;
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
    id: 'emerald',
    nameUk: 'Смарагдовий',
    borderColor: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.12)',
    badgeBorder: 'rgba(16, 185, 129, 0.35)',
    badgeText: '#10b981',
    buttonActiveBg: 'rgba(16, 185, 129, 0.15)',
    buttonActiveBorder: '#10b981',
    buttonActiveText: '#10b981',
  },
  {
    id: 'amber',
    nameUk: 'Бурштиновий',
    borderColor: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeBorder: 'rgba(245, 158, 11, 0.35)',
    badgeText: '#f59e0b',
    buttonActiveBg: 'rgba(245, 158, 11, 0.15)',
    buttonActiveBorder: '#f59e0b',
    buttonActiveText: '#f59e0b',
  },
  {
    id: 'indigo',
    nameUk: 'Індиго',
    borderColor: '#6366f1',
    badgeBg: 'rgba(99, 102, 241, 0.12)',
    badgeBorder: 'rgba(99, 102, 241, 0.35)',
    badgeText: '#818cf8',
    buttonActiveBg: 'rgba(99, 102, 241, 0.15)',
    buttonActiveBorder: '#6366f1',
    buttonActiveText: '#818cf8',
  },
  {
    id: 'rose',
    nameUk: 'Рожевий',
    borderColor: '#f43f5e',
    badgeBg: 'rgba(244, 63, 94, 0.12)',
    badgeBorder: 'rgba(244, 63, 94, 0.35)',
    badgeText: '#fb7185',
    buttonActiveBg: 'rgba(244, 63, 94, 0.15)',
    buttonActiveBorder: '#f43f5e',
    buttonActiveText: '#fb7185',
  },
  {
    id: 'cyan',
    nameUk: 'Блакитний',
    borderColor: '#06b6d4',
    badgeBg: 'rgba(6, 182, 212, 0.12)',
    badgeBorder: 'rgba(6, 182, 212, 0.35)',
    badgeText: '#22d3ee',
    buttonActiveBg: 'rgba(6, 182, 212, 0.15)',
    buttonActiveBorder: '#06b6d4',
    buttonActiveText: '#22d3ee',
  },
  {
    id: 'purple',
    nameUk: 'Фіолетовий',
    borderColor: '#a855f7',
    badgeBg: 'rgba(168, 85, 247, 0.12)',
    badgeBorder: 'rgba(168, 85, 247, 0.35)',
    badgeText: '#c084fc',
    buttonActiveBg: 'rgba(168, 85, 247, 0.15)',
    buttonActiveBorder: '#a855f7',
    buttonActiveText: '#c084fc',
  },
];
