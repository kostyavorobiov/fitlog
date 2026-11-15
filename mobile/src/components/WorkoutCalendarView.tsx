import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { WorkoutPlan } from '../types/workout';
import { formatLocalDate, UKRAINIAN_MONTHS, ENGLISH_MONTHS, UKRAINIAN_WEEKDAYS_SHORT, ENGLISH_WEEKDAYS_SHORT } from '../utils/date';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export interface WorkoutCalendarViewProps {
  workouts: WorkoutPlan[];
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  isDark?: boolean;
  style?: any;
  displayDate?: Date;
  hideMonthNav?: boolean;
}

export const WorkoutCalendarView: React.FC<WorkoutCalendarViewProps> = ({
  workouts,
  selectedDate,
  onSelectDate,
  style,
  displayDate,
  hideMonthNav = false,
}) => {
  const { colors, isDark } = useTheme();
  const { language, t } = useLanguage();

  const monthsList = language === 'en' ? ENGLISH_MONTHS : UKRAINIAN_MONTHS;
  const weekdaysList = language === 'en' ? ENGLISH_WEEKDAYS_SHORT : UKRAINIAN_WEEKDAYS_SHORT;
  const [internalMonthDate, setInternalMonthDate] = useState<Date>(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-').map(Number);
      if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, 1);
      }
    }
    return new Date();
  });

  const activeDate = displayDate || internalMonthDate;
  const year = activeDate.getFullYear();
  const month = activeDate.getMonth();
  const todayStr = formatLocalDate(new Date());

  const handlePrevMonth = () => {
    setInternalMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setInternalMonthDate(new Date(year, month + 1, 1));
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setInternalMonthDate(today);
    onSelectDate(formatLocalDate(today));
  };

  // Generate calendar grid cells (Monday first)
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

  const calendarCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(day);
    }
    return cells;
  }, [startDayOfWeek, daysInMonth]);

  // Index workouts by scheduledDate for fast day lookup
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, WorkoutPlan[]>();
    workouts.forEach((w) => {
      const dateKey = w.scheduledDate;
      if (!dateKey) return;
      const list = map.get(dateKey) || [];
      list.push(w);
      map.set(dateKey, list);
    });
    return map;
  }, [workouts]);

  return (
    <Card style={[styles.card, style]}>
      {/* Calendar Header matching PDF */}
      <View style={styles.headerTitleRow}>
        <Text style={[styles.headerUppercaseTitle, { color: colors.textSecondary }]}>
          {t('analytics.calendar', 'КАЛЕНДАР')}
        </Text>
        {!hideMonthNav && (
          <View style={styles.monthNavControls}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              style={[styles.navArrowBtn, { backgroundColor: colors.subCard }]}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={16} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.monthNavLabel, { color: colors.text }]}>
              {monthsList[month]} {year}
            </Text>
            <TouchableOpacity
              onPress={handleNextMonth}
              style={[styles.navArrowBtn, { backgroundColor: colors.subCard }]}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Weekdays Row */}
      <View style={[styles.weekDaysRow, { borderBottomColor: colors.divider }]}>
        {weekdaysList.map((day, idx) => (
          <View key={day} style={styles.weekDayCol}>
            <Text
              style={[
                styles.weekDayText,
                { color: colors.textSecondary },
              ]}
            >
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Days Grid */}
      <View style={styles.daysGrid}>
        {calendarCells.map((dayNum, idx) => {
          if (dayNum === null) {
            return <View key={`empty_${idx}`} style={styles.emptyCell} />;
          }

          const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const isSelected = selectedDate === cellDateStr;
          const isToday = todayStr === cellDateStr;
          const dayWorkouts = workoutsByDate.get(cellDateStr) || [];
          const hasWorkouts = dayWorkouts.length > 0;

          return (
            <TouchableOpacity
              key={`day_${dayNum}`}
              activeOpacity={0.7}
              onPress={() => onSelectDate(cellDateStr)}
              style={[
                styles.dayCell,
                {
                  backgroundColor: hasWorkouts
                    ? colors.accent
                    : colors.subCard,
                  borderColor: (isSelected || isToday) ? colors.accent : 'transparent',
                  borderWidth: (isSelected || isToday) ? 2 : 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.dayCellNum,
                  {
                    color: hasWorkouts
                      ? colors.accentText
                      : colors.text,
                    fontWeight: (hasWorkouts || isSelected || isToday) ? '800' : '600',
                  },
                ]}
              >
                {dayNum}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerUppercaseTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  monthNavControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthNavLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  navArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDaysRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 10,
  },
  weekDayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyCell: {
    width: '12%',
    aspectRatio: 1,
    margin: '1.14%',
  },
  dayCell: {
    width: '12%',
    aspectRatio: 1,
    margin: '1.14%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  dayCellNum: {
    fontSize: 14,
    fontWeight: '700',
  },
});
