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

export interface PeriodRange {
  type: 'day' | 'week' | 'month';
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string;   // YYYY-MM-DD
  titleUk: string;
  isCurrent: boolean;
}

/**
 * Calculates calendar-aligned period boundaries (Day, Week starting on Monday, Month starting on 1st)
 */
export const getPeriodRange = (
  period: 'day' | 'week' | 'month',
  currentDate: Date = new Date()
): PeriodRange => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const date = currentDate.getDate();
  const today = new Date();
  const todayStr = formatLocalDate(today);

  if (period === 'day') {
    const targetDayStr = formatLocalDate(currentDate);
    const isToday = targetDayStr === todayStr;

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = targetDayStr === formatLocalDate(yesterday);

    const fullUk = formatUkFullDate(targetDayStr);
    const titleUk = isToday ? `Сьогодні, ${fullUk}` : isYesterday ? `Вчора, ${fullUk}` : fullUk;

    return {
      type: 'day',
      startDateStr: targetDayStr,
      endDateStr: targetDayStr,
      titleUk,
      isCurrent: isToday,
    };
  }

  if (period === 'week') {
    const dayOfWeek = currentDate.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const diffToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(year, month, date - diffToMonday);
    const sunday = new Date(year, month, date - diffToMonday + 6);

    const weekStartStr = formatLocalDate(monday);
    const weekEndStr = formatLocalDate(sunday);

    const now = new Date();
    const isCurrentWeek = now >= monday && now <= sunday;

    const mD = monday.getDate();
    const sD = sunday.getDate();
    const mM = UKRAINIAN_MONTHS_GENITIVE[monday.getMonth()].slice(0, 3);
    const sM = UKRAINIAN_MONTHS_GENITIVE[sunday.getMonth()].slice(0, 3);
    const sY = sunday.getFullYear();

    const titleUk =
      monday.getMonth() === sunday.getMonth()
        ? `${mD} — ${sD} ${sM} ${sY}`
        : `${mD} ${mM} — ${sD} ${sM} ${sY}`;

    return {
      type: 'week',
      startDateStr: weekStartStr,
      endDateStr: weekEndStr,
      titleUk,
      isCurrent: isCurrentWeek,
    };
  }

  // Month: 1st of month to last day of month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEndStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const titleUk = `${UKRAINIAN_MONTHS[month]} ${year}`;

  return {
    type: 'month',
    startDateStr: monthStartStr,
    endDateStr: monthEndStr,
    titleUk,
    isCurrent: isCurrentMonth,
  };
};
