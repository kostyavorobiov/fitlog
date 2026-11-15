import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { setSavedActiveTab } from '../components/InstagramTabPager';
import { triggerRefreshSuccessHaptic } from '../utils/haptics';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { CreateWorkoutModal } from '../components/CreateWorkoutModal';
import { useAuth } from '../context/AuthContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { WorkoutService } from '../services/workoutService';
import { TemplateService, WorkoutTemplate } from '../services/templateService';
import { WorkoutPlan } from '../types/workout';
import { SwipeableActionCard } from '../components/SwipeableActionCard';
import {
  UKRAINIAN_MONTHS,
  UKRAINIAN_WEEKDAYS_SHORT,
  formatLocalDate,
  formatUkFullDate,
} from '../utils/date';

export const CalendarScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { handleScroll } = useScrollTabBar();

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(formatLocalDate());
  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const isCreatingRef = useRef<boolean>(false);

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

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadWorkouts();
    } catch (e) {
      console.warn('[CalendarScreen.onRefresh] Error:', e);
    } finally {
      setIsRefreshing(false);
      await triggerRefreshSuccessHaptic();
    }
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
  const handleCreateWorkout = async (
    title: string,
    scheduledDate: string,
    notes: string,
    template?: WorkoutTemplate
  ) => {
    if (!user) return;
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreating(true);

    try {
      let newWorkout: WorkoutPlan;
      if (template) {
        newWorkout = TemplateService.createWorkoutFromTemplate(
          template,
          user.id,
          scheduledDate
        );
        if (title.trim()) newWorkout.title = title.trim();
        if (notes.trim()) newWorkout.notes = notes.trim();
      } else {
        const workoutId = `wo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        newWorkout = {
          id: workoutId,
          userId: user.id,
          title,
          scheduledDate,
          status: 'planned',
          notes,
          createdAt: new Date().toISOString(),
          exercises: [],
        };
      }

      // 1. Primary write to DB & local cache
      const success = await WorkoutService.saveWorkout(newWorkout);
      if (success) {
        setWorkouts((prev) => [newWorkout, ...prev.filter((w) => w.id !== newWorkout.id)]);
        setSelectedDateStr(scheduledDate);
        setIsCreateModalOpen(false);

        // 2. Secondary operations: navigate & background data refresh (handled separately)
        try {
          router.push({ pathname: '/workout/[id]', params: { id: newWorkout.id } });
        } catch (navErr) {
          console.warn('[CalendarScreen] Failed navigating to editor:', navErr);
        }

        loadWorkouts().catch((err) => {
          console.warn('[CalendarScreen] Background refresh failed after create:', err);
        });
      } else {
        Alert.alert('Помилка', 'Не вдалося зберегти тренування');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося створити тренування');
    } finally {
      setIsCreating(false);
      isCreatingRef.current = false;
    }
  };

  const handleDeleteWorkout = (workout: WorkoutPlan, onCancel?: () => void) => {
    if (!user) return;
    Alert.alert(
      'Видалити тренування?',
      `Ви впевнені, що хочете видалити «${workout.title || 'це тренування'}»?`,
      [
        {
          text: 'Скасувати',
          style: 'cancel',
          onPress: () => {
            onCancel?.();
          },
        },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            const ok = await WorkoutService.deleteWorkout(user.id, workout.id);
            if (ok) {
              setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
            } else {
              Alert.alert('Помилка', 'Не вдалося видалити тренування');
            }
          },
        },
      ]
    );
  };

  const handleQuickDeleteWorkout = (workout: WorkoutPlan, onCancel?: () => void) => {
    handleDeleteWorkout(workout, onCancel);
  };

  const handleBackToWorkouts = useCallback(() => {
    setSavedActiveTab('index');
    router.replace('/(tabs)');
  }, [router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackToWorkouts();
      return true;
    });
    return () => sub.remove();
  }, [handleBackToWorkouts]);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <Header
        title="Календар"
        showBack={true}
        onBack={handleBackToWorkouts}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Month Navigation & Controls */}
        <Card style={styles.monthHeaderCard}>
          <View style={styles.monthNavRow}>
            <View style={styles.monthTitleWrap}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={[styles.navArrowBtn, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </TouchableOpacity>

              <Text style={[styles.monthTitleText, { color: colors.text }]}>
                {UKRAINIAN_MONTHS[month]} {year}
              </Text>

              <TouchableOpacity
                onPress={handleNextMonth}
                style={[styles.navArrowBtn, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleJumpToToday}
              style={[styles.todayBtn, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.todayBtnText, { color: colors.text }]}>
                Сьогодні
              </Text>
            </TouchableOpacity>
          </View>

          {/* Weekdays row */}
          <View style={[styles.weekDaysRow, { borderBottomColor: colors.cardBorder }]}>
            {UKRAINIAN_WEEKDAYS_SHORT.map((day, idx) => (
              <View key={day} style={styles.weekDayCol}>
                <Text
                  style={[
                    styles.weekDayText,
                    idx >= 5 ? { color: colors.accent } : { color: colors.textSecondary },
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
                    isSelected && { backgroundColor: colors.accent },
                    isToday && !isSelected && { borderWidth: 1.5, borderColor: colors.accent },
                  ]}
                >
                  <View style={styles.dayNumWrap}>
                    <Text
                      style={[
                        styles.dayCellNum,
                        isSelected
                          ? { color: colors.accentText, fontWeight: '800' }
                          : isToday
                          ? { color: colors.accent, fontWeight: '700' }
                          : hasWorkouts
                          ? { color: colors.text }
                          : { color: colors.textSecondary },
                      ]}
                    >
                      {dayNum}
                    </Text>
                    {isToday && !isSelected && <View style={[styles.todayIndicatorDot, { backgroundColor: colors.accent }]} />}
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
                            ? { backgroundColor: colors.accent }
                            : { backgroundColor: colors.textSecondary },
                        ]}
                      />
                    )}
                    {dayWorkouts.length > 1 && (
                      <Text
                        style={[
                          styles.multipleCountText,
                          isSelected ? { color: colors.accentText } : { color: colors.textSecondary },
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
          <View style={[styles.selectedDateHeader, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.dateNavWrap}>
              <TouchableOpacity
                onPress={handlePrevDay}
                style={[styles.miniArrowBtn, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="chevron-back" size={16} color={colors.text} />
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={[styles.selectedDateTitle, { color: colors.text }]}>
                  {formatUkFullDate(selectedDateStr)}
                </Text>
                <Text style={[styles.selectedDateSub, { color: colors.textSecondary }]}>
                  {selectedDateWorkouts.length === 0
                    ? 'На цей день немає запланованих тренувань'
                    : `Заплановано тренувань: ${selectedDateWorkouts.length}`}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleNextDay}
                style={[styles.miniArrowBtn, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="chevron-forward" size={16} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.addForDateBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.8}
              onPress={() => setIsCreateModalOpen(true)}
            >
              <Ionicons name="add" size={16} color={colors.accentText} />
              <Text style={[styles.addForDateText, { color: colors.accentText }]}>
                Додати на цей день
              </Text>
            </TouchableOpacity>
          </View>

          {/* Workouts List for Selected Date */}
          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Завантаження розкладу...
              </Text>
            </View>
          ) : selectedDateWorkouts.length === 0 ? (
            <View style={[styles.emptyDayContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={[styles.emptyIconBox, { backgroundColor: colors.subCard }]}>
                <Ionicons name="calendar-clear-outline" size={26} color={colors.textSecondary} />
              </View>
              <Text style={[styles.emptyDayTitle, { color: colors.text }]}>
                Тренувань на обрану дату немає
              </Text>
              <Text style={[styles.emptyDayDesc, { color: colors.textSecondary }]}>
                Натисніть «Додати на цей день» вище, щоб запланувати тренування.
              </Text>
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
                  <SwipeableActionCard
                    key={w.id}
                    id={w.id}
                    isDark={isDark}
                    onEdit={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
                    onDelete={(onCancel) => handleDeleteWorkout(w, onCancel)}
                    onQuickDelete={(onCancel) => handleQuickDeleteWorkout(w, onCancel)}
                    editLabel="Редагувати"
                    deleteLabel="Видалити"
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
                      style={[
                        styles.workoutItem,
                        { backgroundColor: colors.subCard, borderColor: colors.cardBorder, borderWidth: 1 },
                      ]}
                    >
                    <View style={styles.workoutItemLeft}>
                      <View style={styles.workoutItemTitleRow}>
                        <Text
                          style={[styles.workoutTitle, { color: colors.text }]}
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
                              ? { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent }
                              : { backgroundColor: colors.card },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              isCompleted
                                ? styles.statusTextCompleted
                                : isInProgress
                                ? { color: colors.accent, fontWeight: '700' }
                                : { color: colors.textSecondary },
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
                        <Text style={[styles.metaInfoText, { color: colors.textSecondary }]}>
                          {exercisesCount} вправ • {setsCount} підходів
                        </Text>
                        {totalVolume > 0 && (
                          <Text style={[styles.metaVolumeText, { color: colors.textSecondary }]}>
                            • {totalVolume} кг
                          </Text>
                        )}
                      </View>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.textSecondary}
                      style={styles.chevronIcon}
                    />
                    </TouchableOpacity>
                  </SwipeableActionCard>
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
    backgroundColor: '#F8FAFC',
  },
  bgDark: {
    backgroundColor: '#0B1220',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  headerAddBtnLight: {
    backgroundColor: '#2563EB',
  },
  headerAddBtnDark: {
    backgroundColor: '#2563EB',
  },
  headerAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerAddTextLight: {
    color: '#ffffff',
  },
  headerAddTextDark: {
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 110,
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
    fontSize: 15,
    fontWeight: '700',
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  btnDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  todayBtnLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  todayBtnDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
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
    color: '#60A5FA',
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
    borderRadius: 12,
    marginVertical: 2,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellNum: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayCellNumSelectedLight: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dayCellNumSelectedDark: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dayCellNumToday: {
    color: '#2563EB',
    fontWeight: '700',
  },
  dayMutedLight: {
    color: '#94A3B8',
  },
  dayMutedDark: {
    color: '#64748B',
  },
  todayIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2563EB',
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
    backgroundColor: '#22C55E',
  },
  dotInProgress: {
    backgroundColor: '#60A5FA',
  },
  dotPlanned: {
    backgroundColor: '#2563EB',
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
    borderRadius: 10,
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
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  addForDateBtnLight: {
    backgroundColor: '#2563EB',
  },
  addForDateBtnDark: {
    backgroundColor: '#2563EB',
  },
  addForDateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addForDateTextLight: {
    color: '#ffffff',
  },
  addForDateTextDark: {
    color: '#ffffff',
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
    paddingVertical: 36,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 8,
  },
  emptyLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  emptyDark: {
    backgroundColor: '#1D2939',
    borderColor: '#334155',
  },
  emptyIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyIconBoxLight: {
    backgroundColor: '#F1F5F9',
  },
  emptyIconBoxDark: {
    backgroundColor: '#263140',
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
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
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
    padding: 14,
    borderRadius: 20,
    borderWidth: 0,
  },
  workoutItemLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  workoutItemDark: {
    backgroundColor: '#1D2939',
    borderColor: '#334155',
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
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeCompleted: {
    backgroundColor: '#ecfdf5',
  },
  badgeInProgress: {
    backgroundColor: '#eff6ff',
  },
  badgePlanned: {
    backgroundColor: '#f1f5f9',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: '#22C55E',
  },
  statusTextInProgress: {
    color: '#60A5FA',
  },
  statusTextPlanned: {
    color: '#64748B',
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
  borderLight: {
    borderColor: '#E2E8F0',
  },
  borderDark: {
    borderColor: '#334155',
  },
});
