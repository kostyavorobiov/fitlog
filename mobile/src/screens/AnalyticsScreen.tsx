import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { useAuth } from '../context/AuthContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { WorkoutService } from '../services/workoutService';
import { WorkoutPlan, MUSCLE_GROUPS } from '../types/workout';
import { getPeriodRange, PeriodRange } from '../utils/date';
import {
  calculateAnalytics,
  AnalyticsPeriod,
  AggregatedExercise,
  MuscleGroupStats,
} from '../utils/analytics';

export const AnalyticsScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { user } = useAuth();
  const { handleScroll } = useScrollTabBar();

  // Support trainer viewing trainee analytics
  const { traineeId, traineeName } = useLocalSearchParams<{
    traineeId?: string;
    traineeName?: string;
  }>();

  const targetUserId = traineeId || user?.id || '';

  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewTab, setViewTab] = useState<'muscles' | 'exercises'>('muscles');

  // Load workouts
  const loadData = useCallback(async () => {
    if (!targetUserId) {
      setWorkouts([]);
      setIsLoading(false);
      return;
    }

    setHasError(false);
    try {
      const data = await WorkoutService.getWorkouts(targetUserId);
      setWorkouts(data);
    } catch (e) {
      console.warn('[AnalyticsScreen.loadData] Error:', e);
      setHasError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [targetUserId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, [loadData]);

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

  // Analytics Computation (Strictly counting completed sets: completedAt != null)
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

  return (
    <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
      {/* Header with Segmented Period Switcher (День | Тиждень | Місяць) */}
      <Header
        title="Аналітика"
        subtitle={
          traineeName
            ? `Підопічний: ${traineeName}`
            : undefined
        }
        rightAction={
          <View style={[styles.periodContainer, isDark ? styles.periodDark : styles.periodLight]}>
            {(
              [
                { key: 'day', label: 'День' },
                { key: 'week', label: 'Тиждень' },
                { key: 'month', label: 'Місяць' },
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
                    isActive && (isDark ? styles.periodBtnActiveDark : styles.periodBtnActiveLight),
                  ]}
                >
                  <Text
                    style={[
                      styles.periodBtnText,
                      isActive
                        ? (isDark ? styles.periodTextActiveDark : styles.periodTextActiveLight)
                        : (isDark ? styles.subDark : styles.subLight),
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        }
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
            tintColor="#0284c7"
            colors={['#0284c7']}
          />
        }
      >
        {/* Date Navigation Bar (Allows browsing previous/next day, week, month) */}
        <Card style={styles.dateNavCard}>
          <View style={styles.dateNavRow}>
            <TouchableOpacity
              onPress={handlePrevPeriod}
              style={[styles.navArrowBtn, isDark ? styles.btnDark : styles.btnLight]}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={18} color={isDark ? '#fafafa' : '#09090b'} />
            </TouchableOpacity>

            <View style={styles.dateNavCenter}>
              <View style={styles.dateNavTitleRow}>
                <Ionicons name="calendar-outline" size={15} color="#0284c7" />
                <Text
                  numberOfLines={1}
                  style={[styles.dateNavTitle, isDark ? styles.textDark : styles.textLight]}
                >
                  {periodRange.titleUk}
                </Text>
              </View>
              <Text style={[styles.dateNavSub, isDark ? styles.subDark : styles.subLight]}>
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
                style={[styles.navArrowBtn, isDark ? styles.btnDark : styles.btnLight]}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-forward" size={18} color={isDark ? '#fafafa' : '#09090b'} />
              </TouchableOpacity>

              {!periodRange.isCurrent && (
                <TouchableOpacity
                  onPress={handleJumpToToday}
                  style={[styles.todayBtn, isDark ? styles.todayBtnDark : styles.todayBtnLight]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.todayBtnText}>Сьогодні</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Card>

        {/* Loading State */}
        {isLoading && !isRefreshing ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="small" color="#0284c7" />
            <Text style={[styles.stateText, isDark ? styles.subDark : styles.subLight]}>
              Розрахунок аналітики...
            </Text>
          </View>
        ) : hasError ? (
          /* Error State */
          <Card style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
            <Text style={[styles.errorTitle, isDark ? styles.textDark : styles.textLight]}>
              Помилка завантаження даних
            </Text>
            <Text style={[styles.errorSub, isDark ? styles.subDark : styles.subLight]}>
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
              {/* Completed Sets */}
              <Card style={styles.kpiCard}>
                <View style={styles.kpiHeaderRow}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" />
                  </View>
                  <Text style={[styles.kpiTitle, isDark ? styles.subDark : styles.subLight]}>
                    Підходи
                  </Text>
                </View>
                <Text style={[styles.kpiValue, isDark ? styles.textDark : styles.textLight]}>
                  {analyticsData.periodCompletedSets}
                </Text>
                <Text style={[styles.kpiDesc, isDark ? styles.subDark : styles.subLight]}>
                  виконано
                </Text>
              </Card>

              {/* Active Workouts */}
              <Card style={styles.kpiCard}>
                <View style={styles.kpiHeaderRow}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                    <Ionicons name="barbell-outline" size={18} color="#f59e0b" />
                  </View>
                  <Text style={[styles.kpiTitle, isDark ? styles.subDark : styles.subLight]}>
                    Тренування
                  </Text>
                </View>
                <Text style={[styles.kpiValue, isDark ? styles.textDark : styles.textLight]}>
                  {analyticsData.workoutsCount}
                </Text>
                <Text style={[styles.kpiDesc, isDark ? styles.subDark : styles.subLight]}>
                  активних
                </Text>
              </Card>

              {/* Total Volume */}
              <Card style={styles.kpiCard}>
                <View style={styles.kpiHeaderRow}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(2, 132, 199, 0.12)' }]}>
                    <Ionicons name="flame-outline" size={18} color="#0284c7" />
                  </View>
                  <Text style={[styles.kpiTitle, isDark ? styles.subDark : styles.subLight]}>
                    Тоннаж
                  </Text>
                </View>
                <Text style={[styles.kpiValue, isDark ? styles.textDark : styles.textLight]}>
                  {analyticsData.periodTons > 0
                    ? `${analyticsData.periodTons} т`
                    : formatVolume(analyticsData.periodVolumeKg)}
                </Text>
                <Text style={[styles.kpiDesc, isDark ? styles.subDark : styles.subLight]}>
                  піднято
                </Text>
              </Card>

              {/* Tracked Exercises */}
              <Card style={styles.kpiCard}>
                <View style={styles.kpiHeaderRow}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(168, 85, 247, 0.12)' }]}>
                    <Ionicons name="trophy-outline" size={18} color="#a855f7" />
                  </View>
                  <Text style={[styles.kpiTitle, isDark ? styles.subDark : styles.subLight]}>
                    Вправи
                  </Text>
                </View>
                <Text style={[styles.kpiValue, isDark ? styles.textDark : styles.textLight]}>
                  {analyticsData.exercisesList.length}
                </Text>
                <Text style={[styles.kpiDesc, isDark ? styles.subDark : styles.subLight]}>
                  задіяно
                </Text>
              </Card>
            </View>

            {/* Empty State when 0 completed sets */}
            {analyticsData.periodCompletedSets === 0 ? (
              <View style={[styles.emptyContainer, isDark ? styles.emptyDark : styles.emptyLight]}>
                <View style={[styles.emptyIconBox, isDark ? styles.emptyIconBoxDark : styles.emptyIconBoxLight]}>
                  <Ionicons name="layers-outline" size={26} color={isDark ? '#71717a' : '#94a3b8'} />
                </View>
                <Text style={[styles.emptyTitle, isDark ? styles.emptyTitleDark : styles.emptyTitleLight]}>
                  За обраний період немає завершених підходів
                </Text>
                <Text style={[styles.emptySubtitle, isDark ? styles.emptySubtitleDark : styles.emptySubtitleLight]}>
                  Враховуються лише успішно виконані підходи (відмічені галочкою ✓) у запланованих тренуваннях за цей календарний період.
                </Text>
                <TouchableOpacity
                  style={[styles.emptyBtn, isDark ? styles.emptyBtnDark : styles.emptyBtnLight]}
                  activeOpacity={0.8}
                  onPress={() => router.push('/(tabs)')}
                >
                  <Ionicons name="arrow-back" size={16} color={isDark ? '#09090b' : '#ffffff'} />
                  <Text style={[styles.emptyBtnText, isDark ? styles.emptyBtnTextDark : styles.emptyBtnTextLight]}>
                    До списку тренувань
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Section View Switcher (М'язові групи | Вправи) */}
                <View style={[styles.filterContainer, isDark ? styles.filterDark : styles.filterLight]}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setViewTab('muscles')}
                    style={[
                      styles.filterBtn,
                      viewTab === 'muscles' && (isDark ? styles.filterBtnActiveDark : styles.filterBtnActiveLight),
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterBtnText,
                        viewTab === 'muscles'
                          ? (isDark ? styles.filterTextActiveDark : styles.filterTextActiveLight)
                          : (isDark ? styles.filterTextInactiveDark : styles.filterTextInactiveLight),
                      ]}
                    >
                      Групи м'язів ({analyticsData.muscleList.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setViewTab('exercises')}
                    style={[
                      styles.filterBtn,
                      viewTab === 'exercises' && (isDark ? styles.filterBtnActiveDark : styles.filterBtnActiveLight),
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterBtnText,
                        viewTab === 'exercises'
                          ? (isDark ? styles.filterTextActiveDark : styles.filterTextActiveLight)
                          : (isDark ? styles.filterTextInactiveDark : styles.filterTextInactiveLight),
                      ]}
                    >
                      Вправи ({analyticsData.exercisesList.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* View Tab 1: Muscle Groups Distribution */}
                {viewTab === 'muscles' ? (
                  <Card style={styles.breakdownCard}>
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={[styles.cardTitle, isDark ? styles.textDark : styles.textLight]}>
                          Розподіл за групами м’язів
                        </Text>
                        <Text style={[styles.cardSub, isDark ? styles.subDark : styles.subLight]}>
                          Кількість виконаних підходів за період
                        </Text>
                      </View>

                      <View style={styles.totalBadge}>
                        <Text style={styles.totalBadgeText}>
                          {analyticsData.periodCompletedSets} підх.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.musclesList}>
                      {analyticsData.muscleList.map((m) => (
                        <View key={m.groupKey} style={styles.muscleRow}>
                          <View style={styles.muscleInfoRow}>
                            <View style={styles.muscleNameWrap}>
                              <View
                                style={[
                                  styles.muscleDot,
                                  { backgroundColor: m.color },
                                ]}
                              />
                              <Text style={[styles.muscleNameText, isDark ? styles.textDark : styles.textLight]}>
                                {m.nameUk}
                              </Text>
                            </View>

                            <View style={styles.muscleCountWrap}>
                              <Text style={[styles.muscleCountText, isDark ? styles.textDark : styles.textLight]}>
                                {m.setsCount}{' '}
                                <Text style={styles.countUnitText}>
                                  {m.setsCount === 1
                                    ? 'підхід'
                                    : m.setsCount >= 2 && m.setsCount <= 4
                                    ? 'підходи'
                                    : 'підходів'}
                                </Text>
                              </Text>
                              <Text style={[styles.musclePercentText, isDark ? styles.subDark : styles.subLight]}>
                                ({m.percentage}%)
                              </Text>
                            </View>
                          </View>

                          {/* Progress Bar */}
                          <View style={[styles.progressTrack, isDark ? styles.trackDark : styles.trackLight]}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${Math.max(5, m.percentage)}%`,
                                  backgroundColor: m.color,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  </Card>
                ) : (
                  /* View Tab 2: Exercises Breakdown with Aggregated Sets & PRs */
                  <Card style={styles.breakdownCard}>
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={[styles.cardTitle, isDark ? styles.textDark : styles.textLight]}>
                          Агреговані вправи
                        </Text>
                        <Text style={[styles.cardSub, isDark ? styles.subDark : styles.subLight]}>
                          Підсумок виконаних підходів та ваг за період
                        </Text>
                      </View>
                    </View>

                    {/* Search Input for Exercises */}
                    {analyticsData.exercisesList.length > 4 && (
                      <View style={[styles.searchWrap, isDark ? styles.searchDark : styles.searchLight]}>
                        <Ionicons name="search" size={16} color={isDark ? '#71717a' : '#a1a1aa'} />
                        <TextInput
                          style={[styles.searchInput, isDark ? styles.textDark : styles.textLight]}
                          placeholder="Пошук вправи..."
                          placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color={isDark ? '#71717a' : '#a1a1aa'} />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    <View style={styles.exercisesList}>
                      {filteredExercises.map((item, idx) => {
                        const muscle = MUSCLE_GROUPS[item.muscleGroup] || MUSCLE_GROUPS.other;
                        return (
                          <View
                            key={item.exerciseId || `ex_${idx}`}
                            style={[
                              styles.exerciseItem,
                              idx > 0 && (isDark ? styles.itemBorderDark : styles.itemBorderLight),
                            ]}
                          >
                            <View style={styles.exLeftCol}>
                              <Text
                                numberOfLines={2}
                                style={[styles.exTitle, isDark ? styles.textDark : styles.textLight]}
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
                                  <Text style={[styles.exPrText, isDark ? styles.subDark : styles.subLight]}>
                                    Макс: <Text style={{ fontWeight: '700' }}>{item.maxWeight} кг</Text>
                                    {item.repsAtMaxWeight > 0 ? ` × ${item.repsAtMaxWeight}` : ''}
                                  </Text>
                                )}
                              </View>
                            </View>

                            <View style={styles.exRightCol}>
                              <Text style={[styles.exSetsCount, isDark ? styles.textDark : styles.textLight]}>
                                {item.completedSetsCount}
                              </Text>
                              <Text style={[styles.exSetsLabel, isDark ? styles.subDark : styles.subLight]}>
                                {item.completedSetsCount === 1
                                  ? 'підхід'
                                  : item.completedSetsCount >= 2 && item.completedSetsCount <= 4
                                  ? 'підходи'
                                  : 'підходів'}
                              </Text>
                            </View>
                          </View>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgLight: {
    backgroundColor: '#fafafa',
  },
  bgDark: {
    backgroundColor: '#09090b',
  },
  periodRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  periodContainer: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 16,
    gap: 3,
  },
  periodLight: {
    backgroundColor: '#eef2f6',
  },
  periodDark: {
    backgroundColor: '#27272a',
  },
  periodBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderRadius: 12,
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
    backgroundColor: '#18181b',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  periodTextActiveLight: {
    color: '#0f172a',
    fontWeight: '700',
  },
  periodTextActiveDark: {
    color: '#fafafa',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 110,
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
    backgroundColor: '#f9fafb',
    borderColor: '#e4e4e7',
  },
  btnDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
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
    backgroundColor: '#eef2f6',
    borderColor: '#e2e8f0',
  },
  todayBtnDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284c7',
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
    backgroundColor: '#18181b80',
    borderColor: '#27272a',
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBoxLight: {
    backgroundColor: '#eef2f8',
  },
  emptyIconBoxDark: {
    backgroundColor: '#27272a',
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
    color: '#fafafa',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 280,
  },
  emptySubtitleLight: {
    color: '#94a3b8',
  },
  emptySubtitleDark: {
    color: '#71717a',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    marginTop: 16,
  },
  emptyBtnLight: {
    backgroundColor: '#0f172a',
  },
  emptyBtnDark: {
    backgroundColor: '#f4f4f5',
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyBtnTextLight: {
    color: '#ffffff',
  },
  emptyBtnTextDark: {
    color: '#09090b',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 20,
    gap: 4,
  },
  filterLight: {
    backgroundColor: '#eef2f6',
  },
  filterDark: {
    backgroundColor: '#27272a',
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
    backgroundColor: '#18181b',
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
    color: '#0f172a',
    fontWeight: '700',
  },
  filterTextActiveDark: {
    color: '#fafafa',
    fontWeight: '700',
  },
  filterTextInactiveLight: {
    color: '#64748b',
    fontWeight: '600',
  },
  filterTextInactiveDark: {
    color: '#a1a1aa',
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
    borderBottomColor: '#71717a20',
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
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  totalBadgeText: {
    color: '#0284c7',
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
    backgroundColor: '#27272a',
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
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e7',
  },
  searchDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
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
    borderTopColor: '#f1f5f9',
  },
  itemBorderDark: {
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  exLeftCol: {
    flex: 1,
    gap: 4,
    marginRight: 10,
  },
  exTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  exMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  muscleBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  muscleBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  exPrText: {
    fontSize: 11,
  },
  exRightCol: {
    alignItems: 'flex-end',
    minWidth: 55,
  },
  exSetsCount: {
    fontSize: 15,
    fontWeight: '800',
  },
  exSetsLabel: {
    fontSize: 10,
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
});
