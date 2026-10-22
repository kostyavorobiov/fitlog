import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  UKRAINIAN_MONTHS,
  UKRAINIAN_WEEKDAYS_SHORT,
  formatLocalDate,
  formatDateDDMMYYYY,
  parseDateToISO,
} from '../utils/date';

export interface DatePickerModalProps {
  visible: boolean;
  value?: string; // Can be YYYY-MM-DD or DD/MM/YYYY
  selectedDate?: string;
  title?: string;
  onClose: () => void;
  onSelect?: (isoDate: string, displayDate: string) => void;
  onSelectDate?: (isoDate: string, displayDate?: string) => void;
}

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  value,
  selectedDate,
  title = 'Виберіть дату',
  onClose,
  onSelect,
  onSelectDate,
}) => {
  const isDark = useColorScheme() === 'dark';
  const effectiveDateValue = value || selectedDate;

  const triggerSelect = (iso: string, displayDate: string) => {
    if (onSelect) onSelect(iso, displayDate);
    if (onSelectDate) onSelectDate(iso, displayDate);
  };

  // Normalize initial date
  const initialIso = useMemo(() => {
    return effectiveDateValue ? parseDateToISO(effectiveDateValue) : formatLocalDate();
  }, [effectiveDateValue]);

  const [selectedIso, setSelectedIso] = useState<string>(initialIso);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const [y, m] = initialIso.split('-').map(Number);
    return new Date(y, (m || 1) - 1, 1);
  });

  useEffect(() => {
    if (visible) {
      const iso = effectiveDateValue ? parseDateToISO(effectiveDateValue) : formatLocalDate();
      setSelectedIso(iso);
      const [y, m] = iso.split('-').map(Number);
      setViewDate(new Date(y, (m || 1) - 1, 1));
    }
  }, [visible, effectiveDateValue]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const todayIso = useMemo(() => formatLocalDate(), []);

  // Calendar cells
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    // Monday first (0 = Monday, 6 = Sunday)
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(day);
    }
    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedIso(iso);
    const formatted = formatDateDDMMYYYY(iso);
    triggerSelect(iso, formatted);
    onClose();
  };

  const handleQuickSelect = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const iso = formatLocalDate(d);
    setSelectedIso(iso);
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    const formatted = formatDateDDMMYYYY(iso);
    triggerSelect(iso, formatted);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.headerTitle, isDark ? styles.textDark : styles.textLight]}>
                {title}
              </Text>
              <Text style={[styles.headerSub, isDark ? styles.subDark : styles.subLight]}>
                Формат: {formatDateDDMMYYYY(selectedIso)} (ДД/ММ/Рік)
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Quick chips */}
          <View style={styles.quickChipsRow}>
            <TouchableOpacity
              onPress={() => handleQuickSelect(-1)}
              style={[styles.chip, isDark ? styles.chipDark : styles.chipLight]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isDark ? styles.subDark : styles.subLight]}>
                Вчора
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleQuickSelect(0)}
              style={[styles.chip, styles.chipPrimary]}
              activeOpacity={0.7}
            >
              <Text style={styles.chipPrimaryText}>Сьогодні</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleQuickSelect(1)}
              style={[styles.chip, isDark ? styles.chipDark : styles.chipLight]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isDark ? styles.subDark : styles.subLight]}>
                Завтра
              </Text>
            </TouchableOpacity>
          </View>

          {/* Month Navigation */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              style={[styles.navBtn, isDark ? styles.navBtnDark : styles.navBtnLight]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={18} color={isDark ? '#F8FAFC' : '#0F172A'} />
            </TouchableOpacity>

            <Text style={[styles.monthTitle, isDark ? styles.textDark : styles.textLight]}>
              {UKRAINIAN_MONTHS[viewMonth]} {viewYear}
            </Text>

            <TouchableOpacity
              onPress={handleNextMonth}
              style={[styles.navBtn, isDark ? styles.navBtnDark : styles.navBtnLight]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-forward" size={18} color={isDark ? '#F8FAFC' : '#0F172A'} />
            </TouchableOpacity>
          </View>

          {/* Weekdays Row */}
          <View style={styles.weekDaysRow}>
            {UKRAINIAN_WEEKDAYS_SHORT.map((day, idx) => (
              <View key={day} style={styles.weekDayCol}>
                <Text
                  style={[
                    styles.weekDayText,
                    idx >= 5 ? styles.weekEndText : (isDark ? styles.subDark : styles.subLight),
                  ]}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.grid}>
            {calendarCells.map((dayNum, idx) => {
              if (dayNum === null) {
                return <View key={`empty_${idx}`} style={styles.emptyCell} />;
              }

              const cellIso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = selectedIso === cellIso;
              const isToday = todayIso === cellIso;

              return (
                <TouchableOpacity
                  key={`day_${dayNum}`}
                  onPress={() => handleSelectDay(dayNum)}
                  activeOpacity={0.7}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && (isDark ? styles.dayCellTodayDark : styles.dayCellTodayLight),
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected
                        ? styles.dayTextSelected
                        : isToday
                        ? (isDark ? styles.todayTextDark : styles.todayTextLight)
                        : (isDark ? styles.textDark : styles.textLight),
                    ]}
                  >
                    {dayNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  cardDark: {
    backgroundColor: '#1D2939',
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 4,
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
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  chipDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipPrimary: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnLight: {
    backgroundColor: '#F1F5F9',
  },
  navBtnDark: {
    backgroundColor: '#0F172A',
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCol: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: '700',
  },
  weekEndText: {
    color: '#EF4444',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyCell: {
    width: '14.28%',
    height: 38,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  dayCellSelected: {
    backgroundColor: '#2563EB',
  },
  dayCellTodayLight: {
    backgroundColor: '#E0E7FF',
  },
  dayCellTodayDark: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  todayTextLight: {
    color: '#2563EB',
    fontWeight: '700',
  },
  todayTextDark: {
    color: '#60A5FA',
    fontWeight: '700',
  },
});
