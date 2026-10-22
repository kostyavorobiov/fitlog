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
import { formatLocalDate } from '../utils/date';

const UKRAINIAN_MONTHS = [
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

const UKRAINIAN_WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

export interface WorkoutCalendarViewProps {
  workouts: WorkoutPlan[];
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  isDark: boolean;
  style?: any;
}

export const WorkoutCalendarView: React.FC<WorkoutCalendarViewProps> = ({
  workouts,
  selectedDate,
  onSelectDate,
  isDark,
  style,
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-').map(Number);
      if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, 1);
      }
    }
    return new Date();
  });

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const todayStr = formatLocalDate(new Date());

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentMonthDate(today);
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
      {/* Month Navigation & Controls */}
      <View style={styles.monthNavRow}>
        <View style={styles.monthTitleWrap}>
          <TouchableOpacity
            onPress={handlePrevMonth}
            style={[styles.navArrowBtn, isDark ? styles.btnDark : styles.btnLight]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Попередній місяць"
          >
            <Ionicons name="chevron-back" size={18} color={isDark ? '#F8FAFC' : '#0F172A'} />
          </TouchableOpacity>

          <Text style={[styles.monthTitleText, isDark ? styles.textDark : styles.textLight]}>
            {UKRAINIAN_MONTHS[month]} {year}
          </Text>

          <TouchableOpacity
            onPress={handleNextMonth}
            style={[styles.navArrowBtn, isDark ? styles.btnDark : styles.btnLight]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Наступний місяць"
          >
            <Ionicons name="chevron-forward" size={18} color={isDark ? '#F8FAFC' : '#0F172A'} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleJumpToToday}
          style={[styles.todayBtn, isDark ? styles.todayBtnDark : styles.todayBtnLight]}
          activeOpacity={0.7}
        >
          <Text style={[styles.todayBtnText, isDark ? styles.textDark : styles.textLight]}>
            Сьогодні
          </Text>
        </TouchableOpacity>
      </View>

      {/* Weekdays Row */}
      <View style={[styles.weekDaysRow, isDark ? styles.borderDark : styles.borderLight]}>
        {UKRAINIAN_WEEKDAYS_SHORT.map((day, idx) => (
          <View key={day} style={styles.weekDayCol}>
            <Text
              style={[
                styles.weekDayText,
                idx >= 5 ? styles.weekendText : (isDark ? styles.subDark : styles.subLight),
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
          const allDone = hasWorkouts && dayWorkouts.every((w) => w.status === 'completed');
          const hasInProgress = hasWorkouts && dayWorkouts.some((w) => w.status === 'in_progress');

          return (
            <TouchableOpacity
              key={`day_${dayNum}`}
              activeOpacity={0.7}
              onPress={() => onSelectDate(cellDateStr)}
              style={[
                styles.dayCell,
                isSelected && (isDark ? styles.dayCellSelectedDark : styles.dayCellSelectedLight),
                isToday && !isSelected && styles.dayCellToday,
              ]}
            >
              <View style={styles.dayNumWrap}>
                <Text
                  style={[
                    styles.dayCellNum,
                    isSelected
                      ? (isDark ? styles.dayCellNumSelectedDark : styles.dayCellNumSelectedLight)
                      : isToday
                      ? styles.dayCellNumToday
                      : hasWorkouts
                      ? (isDark ? styles.textDark : styles.textLight)
                      : (isDark ? styles.dayMutedDark : styles.dayMutedLight),
                  ]}
                >
                  {dayNum}
                </Text>
                {isToday && !isSelected && <View style={styles.todayIndicatorDot} />}
              </View>

              {/* Workout Dots Indicator */}
              <View style={styles.dotsContainer}>
                {hasWorkouts && (
                  <View
                    style={[
                      styles.workoutDot,
                      allDone
                        ? styles.dotCompleted
                        : hasInProgress
                        ? styles.dotInProgress
                        : styles.dotPlanned,
                    ]}
                  />
                )}
                {dayWorkouts.length > 1 && (
                  <Text
                    style={[
                      styles.multipleCountText,
                      isSelected ? styles.multipleCountSelected : (isDark ? styles.subDark : styles.subLight),
                    ]}
                  >
                    +{dayWorkouts.length}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 20,
    marginBottom: 16,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLight: {
    backgroundColor: '#F1F5F9',
  },
  btnDark: {
    backgroundColor: '#1E293B',
  },
  monthTitleText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    minWidth: 120,
    textAlign: 'center',
  },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  todayBtnLight: {
    backgroundColor: '#F1F5F9',
  },
  todayBtnDark: {
    backgroundColor: '#1E293B',
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  weekDaysRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 6,
    marginBottom: 6,
  },
  borderLight: {
    borderColor: '#E2E8F0',
  },
  borderDark: {
    borderColor: '#334155',
  },
  weekDayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: '600',
  },
  weekendText: {
    color: '#EF4444',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyCell: {
    width: `${100 / 7}%`,
    height: 44,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 2,
  },
  dayCellSelectedLight: {
    backgroundColor: '#2563EB',
  },
  dayCellSelectedDark: {
    backgroundColor: '#2563EB',
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  dayNumWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellNum: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayCellNumSelectedLight: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayCellNumSelectedDark: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayCellNumToday: {
    color: '#2563EB',
    fontWeight: '700',
  },
  todayIndicatorDot: {
    position: 'absolute',
    top: -2,
    right: -5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2563EB',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 6,
    marginTop: 2,
    gap: 2,
  },
  workoutDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotCompleted: {
    backgroundColor: '#22C55E',
  },
  dotInProgress: {
    backgroundColor: '#F59E0B',
  },
  dotPlanned: {
    backgroundColor: '#3B82F6',
  },
  multipleCountText: {
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 8,
  },
  multipleCountSelected: {
    color: '#FFFFFF',
  },
  textLight: {
    color: '#0F172A',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subLight: {
    color: '#64748B',
  },
  subDark: {
    color: '#94A3B8',
  },
  dayMutedLight: {
    color: '#94A3B8',
  },
  dayMutedDark: {
    color: '#64748B',
  },
});
