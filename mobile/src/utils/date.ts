export const UKRAINIAN_MONTHS = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];

export const UKRAINIAN_MONTHS_GENITIVE = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];

export const UKRAINIAN_WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

export const UKRAINIAN_WEEKDAYS_FULL = [
  'Неділя',
  'Понеділок',
  'Вівторок',
  'Середа',
  'Четвер',
  'П’ятниця',
  'Субота',
];

/**
 * Format a Date object into local YYYY-MM-DD string without UTC offset skew
 */
export const formatLocalDate = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse a YYYY-MM-DD string into a local Date object
 */
export const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/**
 * Format a YYYY-MM-DD string into Ukrainian full display: e.g. "29 вересня 2026, Вівторок"
 */
export const formatUkFullDate = (dateStr: string): string => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dt = new Date(y, m - 1, d);
    const dayOfWeek = UKRAINIAN_WEEKDAYS_FULL[dt.getDay()];
    const monthName = UKRAINIAN_MONTHS_GENITIVE[m - 1];
    return `${d} ${monthName} ${y}, ${dayOfWeek}`;
  } catch {
    return dateStr;
  }
};
