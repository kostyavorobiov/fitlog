import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { CreateWorkoutModal } from '../components/CreateWorkoutModal';
import { useAuth } from '../context/AuthContext';
import { WorkoutService } from '../services/workoutService';
import { WorkoutPlan } from '../types/workout';
import {
  UKRAINIAN_MONTHS,
  UKRAINIAN_WEEKDAYS_SHORT,
  formatLocalDate,
  formatUkFullDate,
} from '../utils/date';

export const CalendarScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { user } = useAuth();

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(formatLocalDate());
  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const todayStr = useMemo(() => formatLocalDate(), []);

  // Load workouts for user
  const loadWorkouts = useCallback(async () => {
    if (!user) {
      setWorkouts([]);
      setIsLoading(false);
      return;
    }

    try {
      const data = await WorkoutService.getWorkouts(user.id);
      setWorkouts(data);
    } catch (err) {
      console.warn('[CalendarScreen.loadWorkouts] Error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  // Refresh every time screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadWorkouts();
  }, [loadWorkouts]);

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentMonthDate(today);
    setSelectedDateStr(formatLocalDate(today));
  };

  // Day navigation for selected date
  const handlePrevDay = () => {
    try {
      const [y, m, d] = selectedDateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() - 1);
      const newStr = formatLocalDate(dt);
      setSelectedDateStr(newStr);
      if (dt.getMonth() !== currentMonthDate.getMonth() || dt.getFullYear() !== currentMonthDate.getFullYear()) {
        setCurrentMonthDate(new Date(dt.getFullYear(), dt.getMonth(), 1));
      }
    } catch (e) {
      console.warn('Error going to prev day:', e);
    }
  };

  const handleNextDay = () => {
    try {
      const [y, m, d] = selectedDateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + 1);
      const newStr = formatLocalDate(dt);
      setSelectedDateStr(newStr);
      if (dt.getMonth() !== currentMonthDate.getMonth() || dt.getFullYear() !== currentMonthDate.getFullYear()) {
        setCurrentMonthDate(new Date(dt.getFullYear(), dt.getMonth(), 1));
      }
    } catch (e) {
      console.warn('Error going to next day:', e);
    }
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
      const list = map.get(dateKey) || [];
      list.push(w);
      map.set(dateKey, list);
    });
    return map;
  }, [workouts]);

  // Workouts on the selected date
  const selectedDateWorkouts = useMemo(() => {
    return workoutsByDate.get(selectedDateStr) || [];
  }, [workoutsByDate, selectedDateStr]);

  // Handle create new workout for selected date
  const handleCreateWorkout = async (title: string, scheduledDate: string, notes: string) => {
    if (!user) return;
    setIsCreating(true);

    try {
      const workoutId = `wo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newWorkout: WorkoutPlan = {
        id: workoutId,
        userId: user.id,
        title,
        scheduledDate,
        status: 'planned',
        notes,
        createdAt: new Date().toISOString(),
        exercises: [],
      };

      const success = await WorkoutService.saveWorkout(newWorkout);
      if (success) {
        setWorkouts((prev) => [newWorkout, ...prev]);
        setSelectedDateStr(scheduledDate);
        setIsCreateModalOpen(false);
        // Directly open editor for the new workout
        router.push({ pathname: '/workout/[id]', params: { id: newWorkout.id } });
      } else {
        Alert.alert('Помилка', 'Не вдалося зберегти тренування');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося створити тренування');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
      {/* Header */}
      <Header
        title="Календар"
        subtitle="Графік тренувань"
        rightAction={
          <TouchableOpacity
            style={styles.headerAddBtn}
            activeOpacity={0.8}
            onPress={() => setIsCreateModalOpen(true)}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.headerAddBtnText}>Додати</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#0284c7"
            colors={['#0284c7']}
          />
        }
      >
        {/* Month Navigation & Controls */}
        <Card style={styles.monthHeaderCard}>
          <View style={styles.monthNavRow}>
            <View style={styles.monthTitleWrap}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={[styles.navArrowBtn, isDark ? styles.btnDark : styles.btnLight]}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={18} color={isDark ? '#fafafa' : '#09090b'} />
              </TouchableOpacity>

              <Text style={[styles.monthTitleText, isDark ? styles.textDark : styles.textLight]}>
                {UKRAINIAN_MONTHS[month]} {year}
              </Text>

              <TouchableOpacity
                onPress={handleNextMonth}
                style={[styles.navArrowBtn, isDark ? styles.btnDark : styles.btnLight]}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-forward" size={18} color={isDark ? '#fafafa' : '#09090b'} />
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

          {/* Weekdays row */}
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

          {/* Calendar days grid */}
          <View style={styles.daysGrid}>
            {calendarCells.map((dayNum, idx) => {
              if (dayNum === null) {
                return <View key={`empty_${idx}`} style={styles.emptyCell} />;
              }

              const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = selectedDateStr === cellDateStr;
              const isToday = todayStr === cellDateStr;
              const dayWorkouts = workoutsByDate.get(cellDateStr) || [];
              const hasWorkouts = dayWorkouts.length > 0;
              const allDone = hasWorkouts && dayWorkouts.every((w) => w.status === 'completed');
              const hasInProgress = hasWorkouts && dayWorkouts.some((w) => w.status === 'in_progress');

              return (
                <TouchableOpacity
                  key={`day_${dayNum}`}
                  activeOpacity={0.7}
                  onPress={() => setSelectedDateStr(cellDateStr)}
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
                          ? styles.dayCellNumSelected
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

        {/* Selected Date Header & Workouts */}
        <Card style={styles.selectedDateCard}>
          <View style={[styles.selectedDateHeader, isDark ? styles.borderDark : styles.borderLight]}>
            <View style={styles.dateNavWrap}>
              <TouchableOpacity
                onPress={handlePrevDay}
                style={[styles.miniArrowBtn, isDark ? styles.btnDark : styles.btnLight]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="chevron-back" size={16} color={isDark ? '#e4e4e7' : '#27272a'} />
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={[styles.selectedDateTitle, isDark ? styles.textDark : styles.textLight]}>
                  {formatUkFullDate(selectedDateStr)}
                </Text>
                <Text style={[styles.selectedDateSub, isDark ? styles.subDark : styles.subLight]}>
                  {selectedDateWorkouts.length === 0
                    ? 'На цей день немає запланованих тренувань'
                    : `Заплановано тренувань: ${selectedDateWorkouts.length}`}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleNextDay}
                style={[styles.miniArrowBtn, isDark ? styles.btnDark : styles.btnLight]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="chevron-forward" size={16} color={isDark ? '#e4e4e7' : '#27272a'} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.addForDateBtn}
              activeOpacity={0.8}
              onPress={() => setIsCreateModalOpen(true)}
            >
              <Ionicons name="add" size={16} color="#0284c7" />
              <Text style={styles.addForDateText}>Додати на цей день</Text>
            </TouchableOpacity>
          </View>

          {/* Workouts List for Selected Date */}
          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#0284c7" />
              <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
                Завантаження розкладу...
              </Text>
            </View>
          ) : selectedDateWorkouts.length === 0 ? (
            <View style={styles.emptyDayContainer}>
              <Ionicons name="calendar-clear-outline" size={38} color={isDark ? '#52525b' : '#d4d4d8'} />
              <Text style={[styles.emptyDayTitle, isDark ? styles.textDark : styles.textLight]}>
                Тренувань на обрану дату немає
              </Text>
              <Text style={[styles.emptyDayDesc, isDark ? styles.subDark : styles.subLight]}>
                Заплануйте заняття на цей день, щоб зафіксувати вправи та підходи.
              </Text>
              <TouchableOpacity
                style={styles.emptyCreateBtn}
                activeOpacity={0.8}
                onPress={() => setIsCreateModalOpen(true)}
              >
                <Ionicons name="add-circle" size={18} color="#ffffff" />
                <Text style={styles.emptyCreateBtnText}>Створити тренування</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.workoutsList}>
              {selectedDateWorkouts.map((w) => {
                const isCompleted = w.status === 'completed';
                const isInProgress = w.status === 'in_progress';
                const exercisesCount = w.exercises?.length || 0;
                const setsCount = (w.exercises || []).reduce(
                  (acc, ex) => acc + (ex.sets?.length || 0),
                  0
                );

                let totalVolume = 0;
                (w.exercises || []).forEach((ex) => {
                  (ex.sets || []).forEach((s) => {
                    if ((s.completedAt || isCompleted) && s.weight && s.actualReps) {
                      totalVolume += s.weight * s.actualReps;
                    }
                  });
                });

                return (
                  <TouchableOpacity
                    key={w.id}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
                    style={[
                      styles.workoutItem,
                      isDark ? styles.workoutItemDark : styles.workoutItemLight,
                    ]}
                  >
                    <View style={styles.workoutItemLeft}>
                      <View style={styles.workoutItemTitleRow}>
                        <Text
                          style={[styles.workoutTitle, isDark ? styles.textDark : styles.textLight]}
                          numberOfLines={1}
                        >
                          {w.title || 'Тренування'}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            isCompleted
                              ? styles.badgeCompleted
                              : isInProgress
                              ? styles.badgeInProgress
                              : styles.badgePlanned,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              isCompleted
                                ? styles.statusTextCompleted
                                : isInProgress
                                ? styles.statusTextInProgress
                                : styles.statusTextPlanned,
                            ]}
                          >
                            {isCompleted
                              ? 'Завершено ✓'
                              : isInProgress
                              ? 'У процесі ⚡'
                              : 'Заплановано'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.workoutItemMetaRow}>
                        <Text style={[styles.metaInfoText, isDark ? styles.subDark : styles.subLight]}>
                          {exercisesCount} вправ • {setsCount} підходів
                        </Text>
                        {totalVolume > 0 && (
                          <Text style={[styles.metaVolumeText, isDark ? styles.subDark : styles.subLight]}>
                            • {totalVolume} кг
                          </Text>
                        )}
                      </View>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={isDark ? '#71717a' : '#a1a1aa'}
                      style={styles.chevronIcon}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Create Workout Modal */}
      <CreateWorkoutModal
        visible={isCreateModalOpen}
        initialDate={selectedDateStr}
        isLoading={isCreating}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateWorkout}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgLight: {
    backgroundColor: '#f8fafc',
  },
  bgDark: {
    backgroundColor: '#09090b',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerAddBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  monthHeaderCard: {
    padding: 14,
    gap: 12,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthTitleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  btnDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  todayBtnLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  todayBtnDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  weekDayCol: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  weekendText: {
    color: '#f59e0b',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyCell: {
    width: '14.28%',
    height: 48,
  },
  dayCell: {
    width: '14.28%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  dayCellSelectedLight: {
    backgroundColor: '#0284c7',
  },
  dayCellSelectedDark: {
    backgroundColor: '#0284c7',
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#0284c7',
  },
  dayNumWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellNum: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayCellNumSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dayCellNumToday: {
    color: '#0284c7',
    fontWeight: '700',
  },
  dayMutedLight: {
    color: '#94a3b8',
  },
  dayMutedDark: {
    color: '#52525b',
  },
  todayIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f59e0b',
    position: 'absolute',
    bottom: -5,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 8,
    marginTop: 2,
  },
  workoutDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotCompleted: {
    backgroundColor: '#10b981',
  },
  dotInProgress: {
    backgroundColor: '#f59e0b',
  },
  dotPlanned: {
    backgroundColor: '#0284c7',
  },
  multipleCountText: {
    fontSize: 8,
    fontWeight: '700',
  },
  multipleCountSelected: {
    color: '#ffffff',
  },
  selectedDateCard: {
    padding: 16,
    gap: 12,
  },
  selectedDateHeader: {
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  dateNavWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  selectedDateTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  selectedDateSub: {
    fontSize: 12,
    marginTop: 2,
  },
  addForDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
  },
  addForDateText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '600',
  },
  centerContainer: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyDayContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyDayTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyDayDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  emptyCreateBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  workoutsList: {
    gap: 10,
  },
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  workoutItemLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  workoutItemDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  workoutItemLeft: {
    flex: 1,
    gap: 4,
  },
  workoutItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 6,
  },
  workoutTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  badgeCompleted: {
    backgroundColor: '#ecfdf5',
  },
  badgeInProgress: {
    backgroundColor: '#fffbeb',
  },
  badgePlanned: {
    backgroundColor: '#f1f5f9',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: '#10b981',
  },
  statusTextInProgress: {
    color: '#f59e0b',
  },
  statusTextPlanned: {
    color: '#64748b',
  },
  workoutItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaInfoText: {
    fontSize: 12,
  },
  metaVolumeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  chevronIcon: {
    marginLeft: 6,
  },
  textLight: {
    color: '#09090b',
  },
  textDark: {
    color: '#fafafa',
  },
  subLight: {
    color: '#71717a',
  },
  subDark: {
    color: '#a1a1aa',
  },
  borderLight: {
    borderColor: '#e2e8f0',
  },
  borderDark: {
    borderColor: '#27272a',
  },
});
