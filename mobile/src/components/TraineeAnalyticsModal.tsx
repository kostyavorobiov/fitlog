import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  BackHandler,
  Platform,
} from 'react-native';
import { ScrollView, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { Card } from './Card';
import { ScreenGestureWrapper } from './ScreenGestureWrapper';
import { WorkoutCalendarView } from './WorkoutCalendarView';
import { ExerciseDetailContent } from './ExerciseDetailModal';
import { WorkoutService } from '../services/workoutService';
import { triggerRefreshSuccessHaptic } from '../utils/haptics';
import { User, WorkoutPlan, MUSCLE_GROUPS } from '../types/workout';
import { getPeriodRange, PeriodRange, formatLocalDate } from '../utils/date';
import {
  calculateAnalytics,
  AnalyticsPeriod,
  AggregatedExercise,
} from '../utils/analytics';

export interface TraineeAnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
  trainee: User | null;
  initialTab?: 'muscles' | 'exercises';
}

export const TraineeAnalyticsModal: React.FC<TraineeAnalyticsModalProps> = ({
  visible,
  onClose,
  trainee,
  initialTab,
}) => {
  const { theme, colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 47 : 24);
  const bottomInset = Math.max(insets.bottom, 16);

  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewTab, setViewTab] = useState<'muscles' | 'exercises'>(initialTab || 'muscles');
  const [selectedExerciseForDetail, setSelectedExerciseForDetail] = useState<AggregatedExercise | null>(null);

  useEffect(() => {
    if (visible && initialTab) {
      setViewTab(initialTab);
    }
  }, [visible, initialTab]);

  useEffect(() => {
    if (!visible) {
      setSelectedExerciseForDetail(null);
    }
  }, [visible]);

  // Handle hardware back press
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedExerciseForDetail) {
        setSelectedExerciseForDetail(null);
        return true;
      }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, selectedExerciseForDetail, onClose]);

  // Load workouts for trainee
  const loadData = useCallback(async () => {
    if (!trainee?.id) {
      setWorkouts([]);
      setIsLoading(false);
      return;
    }

    setHasError(false);
    try {
      const data = await WorkoutService.getWorkouts(trainee.id);
      setWorkouts(data);
    } catch (e) {
      console.warn('[TraineeAnalyticsModal.loadData] Error:', e);
      setHasError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [trainee?.id]);

  useEffect(() => {
    if (visible && trainee?.id) {
      setIsLoading(true);
      loadData();
    }
  }, [visible, trainee?.id, loadData]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (trainee?.id) {
        setHasError(false);
        const data = await WorkoutService.getWorkouts(trainee.id);
        setWorkouts(data);
      }
    } catch (e) {
      console.warn('[TraineeAnalyticsModal.onRefresh] Error:', e);
      setHasError(true);
    } finally {
      setIsRefreshing(false);
      await triggerRefreshSuccessHaptic();
    }
  }, [trainee?.id]);

  // Navigate backward / forward for selected period
  const handlePrevPeriod = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (period === 'day') {
        d.setDate(d.getDate() - 1);
      } else if (period === 'week') {
        d.setDate(d.getDate() - 7);
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  };

  const handleNextPeriod = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (period === 'day') {
        d.setDate(d.getDate() + 1);
      } else if (period === 'week') {
        d.setDate(d.getDate() + 7);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  };

  const handleJumpToToday = () => {
    setCurrentDate(new Date());
  };

  // Period boundary calculation
  const periodRange: PeriodRange = useMemo(() => {
    return getPeriodRange(period, currentDate);
  }, [period, currentDate]);

  // Analytics Computation
  const analyticsData = useMemo(() => {
    return calculateAnalytics(workouts, periodRange);
  }, [workouts, periodRange]);

  // Filtered exercises by search query
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return analyticsData.exercisesList;
    const q = searchQuery.trim().toLowerCase();
    return analyticsData.exercisesList.filter((e) =>
      e.exerciseName.toLowerCase().includes(q)
    );
  }, [analyticsData.exercisesList, searchQuery]);

  const formatVolume = (kg: number): string => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)} т`;
    }
    return `${Math.round(kg)} кг`;
  };

  const handleOpenExerciseDetail = (item: AggregatedExercise) => {
    if (!trainee) return;
    setSelectedExerciseForDetail(item);
  };

  if (!trainee) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (selectedExerciseForDetail) {
          setSelectedExerciseForDetail(null);
        } else {
          onClose();
        }
      }}
      presentationStyle="fullScreen"
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {selectedExerciseForDetail ? (
          <ExerciseDetailContent
            exerciseId={selectedExerciseForDetail.exerciseId}
            exerciseName={selectedExerciseForDetail.exerciseName}
            muscleGroup={selectedExerciseForDetail.muscleGroup}
            userId={trainee.id}
            traineeName={trainee.name || trainee.firstName || 'Підопічний'}
            onClose={() => setSelectedExerciseForDetail(null)}
          />
        ) : (
          <ScreenGestureWrapper enableTabSwipe={false} enableBackSwipe={true} onBack={onClose}>
            <View style={[styles.container, { backgroundColor: colors.bg }]}>
            {/* Header */}
            <View
              style={[
                styles.headerRow,
                {
                  backgroundColor: colors.bg,
                  borderBottomColor: 'transparent',
                  borderBottomWidth: 0,
                  paddingTop: topInset + 6,
                  paddingBottom: 10,
                  minHeight: topInset + 54,
                },
              ]}
            >
              <TouchableOpacity
                onPress={onClose}
                style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Назад"
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.text }]}>
                Аналітика підопічного
              </Text>
              <Text numberOfLines={1} style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {trainee.name || trainee.email}
              </Text>
            </View>

            {/* Period Switcher (День | Тиждень | Місяць) */}
            <View style={[styles.periodContainer, { backgroundColor: colors.subCard, borderColor: colors.cardBorder, borderWidth: 1 }]}>
              {(
                [
                  { key: 'day', label: 'Д' },
                  { key: 'week', label: 'Тижд' },
                  { key: 'month', label: 'Міс' },
                ] as const
              ).map((p) => {
                const isActive = period === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    activeOpacity={0.8}
                    onPress={() => {
                      setPeriod(p.key);
                      setCurrentDate(new Date());
                    }}
                    style={[
                      styles.periodBtn,
                      isActive && { backgroundColor: colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodBtnText,
                        isActive
                          ? { color: colors.accentText, fontWeight: '700' }
                          : { color: colors.textSecondary },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 30 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
          >
            {/* Interactive Month Calendar with workout dots */}
            <WorkoutCalendarView
              workouts={workouts}
              selectedDate={formatLocalDate(currentDate)}
              onSelectDate={(dateStr) => {
                const parts = dateStr.split('-').map(Number);
                if (parts.length === 3) {
                  setCurrentDate(new Date(parts[0], parts[1] - 1, parts[2]));
                  setPeriod('day');
                }
              }}
              isDark={isDark}
            />

            {/* Date Navigation Bar */}
            <Card style={styles.dateNavCard}>
              <View style={styles.dateNavRow}>
                <TouchableOpacity
                  onPress={handlePrevPeriod}
                  style={[styles.navArrowBtn, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={18} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.dateNavCenter}>
                  <View style={styles.dateNavTitleRow}>
                    <Ionicons name="calendar-outline" size={15} color={colors.accent} />
                    <Text
                      numberOfLines={1}
                      style={[styles.dateNavTitle, { color: colors.text }]}
                    >
                      {periodRange.titleUk}
                    </Text>
                  </View>
                  <Text style={[styles.dateNavSub, { color: colors.textSecondary }]}>
                    {period === 'day'
                      ? 'Календарний день'
                      : period === 'week'
                      ? 'Календарний тиждень'
                      : 'Календарний місяць'}
                  </Text>
                </View>

                <View style={styles.dateNavRight}>
                  <TouchableOpacity
                    onPress={handleNextPeriod}
                    style={[styles.navArrowBtn, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </TouchableOpacity>

                  {!periodRange.isCurrent && (
                    <TouchableOpacity
                      onPress={handleJumpToToday}
                      style={[styles.todayBtn, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.todayBtnText, { color: colors.text }]}>
                        Сьогодні
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Card>

            {/* Loading / Error / Content */}
            {isLoading && !isRefreshing ? (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                  Розрахунок аналітики...
                </Text>
              </View>
            ) : hasError ? (
              <Card style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
                <Text style={[styles.errorTitle, { color: colors.text }]}>
                  Помилка завантаження даних
                </Text>
                <Text style={[styles.errorSub, { color: colors.textSecondary }]}>
                  Не вдалося отримати тренування для побудови аналітики.
                </Text>
                <TouchableOpacity style={styles.retryBtn} activeOpacity={0.8} onPress={loadData}>
                  <Ionicons name="refresh" size={16} color="#ffffff" />
                  <Text style={styles.retryBtnText}>Спробувати знову</Text>
                </TouchableOpacity>
              </Card>
            ) : (
              <>
                {/* 4 KPI Metrics Cards */}
                <View style={styles.kpiGrid}>
                  {/* Sets */}
                  <Card style={styles.kpiCard}>
                    <View style={styles.kpiHeaderRow}>
                      <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#22c55e" />
                      </View>
                      <Text style={[styles.kpiTitle, { color: colors.textSecondary }]}>
                        Підходи
                      </Text>
                    </View>
                    <Text style={[styles.kpiValue, { color: colors.text }]}>
                      {analyticsData.periodCompletedSets}
                    </Text>
                    <Text style={[styles.kpiDesc, { color: colors.textSecondary }]}>
                      виконано
                    </Text>
                  </Card>

                  {/* Workouts */}
                  <Card style={styles.kpiCard}>
                    <View style={styles.kpiHeaderRow}>
                      <View style={[styles.kpiIconWrap, { backgroundColor: colors.subCard }]}>
                        <Ionicons name="barbell-outline" size={18} color={colors.accent} />
                      </View>
                      <Text style={[styles.kpiTitle, { color: colors.textSecondary }]}>
                        Тренування
                      </Text>
                    </View>
                    <Text style={[styles.kpiValue, { color: colors.text }]}>
                      {analyticsData.workoutsCount}
                    </Text>
                    <Text style={[styles.kpiDesc, { color: colors.textSecondary }]}>
                      завершено
                    </Text>
                  </Card>

                  {/* Volume */}
                  <Card style={styles.kpiCard}>
                    <View style={styles.kpiHeaderRow}>
                      <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                        <Ionicons name="trending-up-outline" size={18} color="#f59e0b" />
                      </View>
                      <Text style={[styles.kpiTitle, { color: colors.textSecondary }]}>
                        Тоннаж
                      </Text>
                    </View>
                    <Text style={[styles.kpiValue, { color: colors.text }]}>
                      {analyticsData.periodTons > 0
                        ? `${analyticsData.periodTons} т`
                        : formatVolume(analyticsData.periodVolumeKg)}
                    </Text>
                    <Text style={[styles.kpiDesc, { color: colors.textSecondary }]}>
                      загальний тоннаж
                    </Text>
                  </Card>

                  {/* Exercises */}
                  <Card style={styles.kpiCard}>
                    <View style={styles.kpiHeaderRow}>
                      <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                        <Ionicons name="trophy-outline" size={18} color="#a855f7" />
                      </View>
                      <Text style={[styles.kpiTitle, { color: colors.textSecondary }]}>
                        Вправи
                      </Text>
                    </View>
                    <Text style={[styles.kpiValue, { color: colors.text }]}>
                      {analyticsData.exercisesList.length}
                    </Text>
                    <Text style={[styles.kpiDesc, { color: colors.textSecondary }]}>
                      задіяно
                    </Text>
                  </Card>
                </View>

                {analyticsData.periodCompletedSets === 0 ? (
                  <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={[styles.emptyIconBox, { backgroundColor: colors.subCard }]}>
                      <Ionicons name="stats-chart-outline" size={28} color={colors.accent} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      Немає завершених підходів
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                      У підопічного немає завершених підходів за обраний період ({periodRange.titleUk}).
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* View Switcher: М'язи | Вправи */}
                    <View style={[styles.filterContainer, { backgroundColor: colors.subCard, borderColor: colors.cardBorder, borderWidth: 1 }]}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setViewTab('muscles')}
                        style={[styles.filterBtn, viewTab === 'muscles' && { backgroundColor: colors.accent }]}
                      >
                        <Text style={[styles.filterBtnText, viewTab === 'muscles' ? { color: colors.accentText, fontWeight: '700' } : { color: colors.textSecondary, fontWeight: '600' }]}>
                          М'язові групи ({analyticsData.muscleList.length})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setViewTab('exercises')}
                        style={[styles.filterBtn, viewTab === 'exercises' && { backgroundColor: colors.accent }]}
                      >
                        <Text style={[styles.filterBtnText, viewTab === 'exercises' ? { color: colors.accentText, fontWeight: '700' } : { color: colors.textSecondary, fontWeight: '600' }]}>
                          Вправи ({analyticsData.exercisesList.length})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Muscles View */}
                    {viewTab === 'muscles' && (
                      <Card style={styles.breakdownCard}>
                        <View style={[styles.cardHeader, { borderBottomColor: colors.cardBorder }]}>
                          <View>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>
                              Розподіл по м'язах
                            </Text>
                            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                              Відсоток навантаження за підходами
                            </Text>
                          </View>
                          <View style={[styles.totalBadge, { backgroundColor: colors.subCard }]}>
                            <Text style={[styles.totalBadgeText, { color: colors.text }]}>
                              {analyticsData.periodCompletedSets} підх.
                            </Text>
                          </View>
                        </View>

                        <View style={styles.musclesList}>
                          {analyticsData.muscleList.map((item) => (
                            <View key={item.groupKey} style={styles.muscleRow}>
                              <View style={styles.muscleInfoRow}>
                                <View style={styles.muscleNameWrap}>
                                  <View style={[styles.muscleDot, { backgroundColor: item.color }]} />
                                  <Text style={[styles.muscleNameText, { color: colors.text }]}>
                                    {item.nameUk}
                                  </Text>
                                </View>
                                <View style={styles.muscleCountWrap}>
                                  <Text style={[styles.muscleCountText, { color: colors.text }]}>
                                    {item.setsCount}{' '}
                                    <Text style={[styles.countUnitText, { color: colors.textSecondary }]}>
                                      {item.setsCount === 1 ? 'підхід' : item.setsCount >= 2 && item.setsCount <= 4 ? 'підходи' : 'підходів'}
                                    </Text>
                                  </Text>
                                  <Text style={[styles.musclePercentText, { color: colors.textSecondary }]}>
                                    ({item.percentage}%)
                                  </Text>
                                </View>
                              </View>
                              <View style={[styles.progressTrack, { backgroundColor: colors.subCard }]}>
                                <View
                                  style={[
                                    styles.progressFill,
                                    {
                                      width: `${Math.max(2, item.percentage)}%`,
                                      backgroundColor: item.color,
                                    },
                                  ]}
                                />
                              </View>
                            </View>
                          ))}
                        </View>
                      </Card>
                    )}

                    {/* Exercises View */}
                    {viewTab === 'exercises' && (
                      <Card style={styles.breakdownCard}>
                        <View style={[styles.cardHeader, { borderBottomColor: colors.cardBorder }]}>
                          <View>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>
                              Виконані вправи
                            </Text>
                            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                              Всього: {analyticsData.exercisesList.length}
                            </Text>
                          </View>
                        </View>

                        {/* Search input */}
                        {analyticsData.exercisesList.length > 3 && (
                          <View style={[styles.searchWrap, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}>
                            <Ionicons name="search" size={16} color={colors.textSecondary} />
                            <TextInput
                              value={searchQuery}
                              onChangeText={setSearchQuery}
                              placeholder="Пошук вправи..."
                              placeholderTextColor={colors.textSecondary}
                              style={[styles.searchInput, { color: colors.text }]}
                              autoCapitalize="none"
                              clearButtonMode="while-editing"
                            />
                            {Boolean(searchQuery) && (
                              <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                              </TouchableOpacity>
                            )}
                          </View>
                        )}

                        <View style={styles.exercisesList}>
                          {filteredExercises.map((item, idx) => {
                            const muscle = MUSCLE_GROUPS[item.muscleGroup] || MUSCLE_GROUPS.other;
                            return (
                              <TouchableOpacity
                                key={item.exerciseId || `ex_${idx}`}
                                activeOpacity={0.7}
                                onPress={() => handleOpenExerciseDetail(item)}
                                style={[
                                  styles.exerciseItem,
                                  idx > 0 && { borderTopWidth: 1, borderTopColor: colors.cardBorder },
                                ]}
                              >
                                <View style={styles.exLeftCol}>
                                  <Text
                                    numberOfLines={2}
                                    style={[styles.exTitle, { color: colors.text }]}
                                  >
                                    {item.exerciseName}
                                  </Text>
                                  <View style={styles.exMetaRow}>
                                    <View
                                      style={[
                                        styles.muscleBadge,
                                        { backgroundColor: muscle.badgeBg, borderColor: muscle.badgeBorder },
                                      ]}
                                    >
                                      <Text style={[styles.muscleBadgeText, { color: muscle.color }]}>
                                        {muscle.nameUk}
                                      </Text>
                                    </View>
                                    {item.maxWeight > 0 && (
                                      <Text style={[styles.exPrText, { color: colors.textSecondary }]}>
                                        Макс: <Text style={{ fontWeight: '700' }}>{item.maxWeight} кг</Text>
                                        {item.repsAtMaxWeight > 0 ? ` × ${item.repsAtMaxWeight}` : ''}
                                      </Text>
                                    )}
                                  </View>
                                </View>

                                <View style={styles.exRightCol}>
                                  <Text style={[styles.exSetsCount, { color: colors.text }]}>
                                    {item.completedSetsCount}
                                  </Text>
                                  <Text style={[styles.exSetsLabel, { color: colors.textSecondary }]}>
                                    {item.completedSetsCount === 1
                                      ? 'підхід'
                                      : item.completedSetsCount >= 2 && item.completedSetsCount <= 4
                                      ? 'підходи'
                                      : 'підходів'}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </Card>
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </ScreenGestureWrapper>
    )}
  </GestureHandlerRootView>
</Modal>
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
    backgroundColor: '#0b1220',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
    borderBottomWidth: 1,
  },
  headerLight: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
  },
  headerDark: {
    backgroundColor: '#0b1220',
    borderBottomColor: '#334155',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  periodContainer: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 14,
    gap: 2,
  },
  periodLight: {
    backgroundColor: '#f1f5f9',
  },
  periodDark: {
    backgroundColor: '#263140',
  },
  periodBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  periodBtnActiveLight: {
    backgroundColor: '#ffffff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  periodBtnActiveDark: {
    backgroundColor: '#1d2939',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  periodBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  periodTextActiveLight: {
    color: '#2563eb',
    fontWeight: '700',
  },
  periodTextActiveDark: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  dateNavCard: {
    padding: 12,
    borderRadius: 18,
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  btnDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  dateNavCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateNavTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  dateNavSub: {
    fontSize: 11,
    marginTop: 1,
  },
  dateNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  todayBtnLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderColor: '#e2e8f0',
  },
  todayBtnDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderColor: '#334155',
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  todayBtnTextLight: {
    color: '#2563eb',
  },
  todayBtnTextDark: {
    color: '#60a5fa',
  },
  stateContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  stateText: {
    fontSize: 13,
  },
  errorCard: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ef444430',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  errorSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    marginTop: 4,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48.5%',
    padding: 12,
    borderRadius: 18,
    gap: 4,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kpiIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  kpiDesc: {
    fontSize: 10,
  },
  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 20,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  emptyLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  emptyDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBoxLight: {
    backgroundColor: '#f1f5f9',
  },
  emptyIconBoxDark: {
    backgroundColor: '#263140',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyTitleLight: {
    color: '#0f172a',
  },
  emptyTitleDark: {
    color: '#f8fafc',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 280,
  },
  emptySubtitleLight: {
    color: '#64748b',
  },
  emptySubtitleDark: {
    color: '#94a3b8',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 20,
    gap: 4,
  },
  filterLight: {
    backgroundColor: '#f1f5f9',
  },
  filterDark: {
    backgroundColor: '#263140',
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  filterBtnActiveLight: {
    backgroundColor: '#ffffff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  filterBtnActiveDark: {
    backgroundColor: '#1d2939',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  filterBtnText: {
    fontSize: 13,
  },
  filterTextActiveLight: {
    color: '#2563eb',
    fontWeight: '700',
  },
  filterTextActiveDark: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  filterTextInactiveLight: {
    color: '#64748b',
    fontWeight: '600',
  },
  filterTextInactiveDark: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  breakdownCard: {
    padding: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 11,
    marginTop: 2,
  },
  totalBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  totalBadgeText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  musclesList: {
    gap: 10,
  },
  muscleRow: {
    gap: 5,
  },
  muscleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  muscleNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  muscleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  muscleNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  muscleCountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  muscleCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  countUnitText: {
    fontWeight: '400',
    fontSize: 11,
  },
  musclePercentText: {
    fontSize: 11,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackLight: {
    backgroundColor: '#f1f5f9',
  },
  trackDark: {
    backgroundColor: '#263140',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  searchLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  searchDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  exercisesList: {
    gap: 8,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemBorderLight: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  itemBorderDark: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  exLeftCol: {
    flex: 1,
    gap: 4,
    marginRight: 10,
  },
  exTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  exMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  muscleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  muscleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  exPrText: {
    fontSize: 11,
  },
  exRightCol: {
    alignItems: 'flex-end',
    minWidth: 50,
  },
  exSetsCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  exSetsLabel: {
    fontSize: 10,
  },
  textLight: {
    color: '#0f172a',
  },
  textDark: {
    color: '#f8fafc',
  },
  subLight: {
    color: '#64748b',
  },
  subDark: {
    color: '#94a3b8',
  },
});
