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
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Card } from './Card';
import { ScreenGestureWrapper } from './ScreenGestureWrapper';
import { WorkoutCalendarView } from './WorkoutCalendarView';
import { WorkoutService } from '../services/workoutService';
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
}

export const TraineeAnalyticsModal: React.FC<TraineeAnalyticsModalProps> = ({
  visible,
  onClose,
  trainee,
}) => {
  const isDark = useColorScheme() === 'dark';

  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewTab, setViewTab] = useState<'muscles' | 'exercises'>('muscles');

  // Handle hardware back press
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

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

  if (!trainee) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <ScreenGestureWrapper enableTabSwipe={false} enableBackSwipe={true} onBack={onClose}>
        <SafeAreaView edges={['top', 'bottom']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
          {/* Header */}
          <View style={[styles.headerRow, isDark ? styles.headerDark : styles.headerLight]}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.backBtn, isDark ? styles.btnDark : styles.btnLight]}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={20} color={isDark ? '#f8fafc' : '#0f172a'} />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text numberOfLines={1} style={[styles.headerTitle, isDark ? styles.textDark : styles.textLight]}>
                Аналітика підопічного
              </Text>
              <Text numberOfLines={1} style={[styles.headerSubtitle, isDark ? styles.subDark : styles.subLight]}>
                {trainee.name || trainee.email}
              </Text>
            </View>

            {/* Period Switcher (День | Тиждень | Місяць) */}
            <View style={[styles.periodContainer, isDark ? styles.periodDark : styles.periodLight]}>
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
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor="#2563eb"
                colors={['#2563eb']}
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
                  style={[styles.navArrowBtn, isDark ? styles.btnDark : styles.btnLight]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={18} color={isDark ? '#f8fafc' : '#0f172a'} />
                </TouchableOpacity>

                <View style={styles.dateNavCenter}>
                  <View style={styles.dateNavTitleRow}>
                    <Ionicons name="calendar-outline" size={15} color={isDark ? '#60a5fa' : '#2563eb'} />
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
                    <Ionicons name="chevron-forward" size={18} color={isDark ? '#f8fafc' : '#0f172a'} />
                  </TouchableOpacity>

                  {!periodRange.isCurrent && (
                    <TouchableOpacity
                      onPress={handleJumpToToday}
                      style={[styles.todayBtn, isDark ? styles.todayBtnDark : styles.todayBtnLight]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.todayBtnText, isDark ? styles.todayBtnTextDark : styles.todayBtnTextLight]}>
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
                <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
                <Text style={[styles.stateText, isDark ? styles.subDark : styles.subLight]}>
                  Розрахунок аналітики...
                </Text>
              </View>
            ) : hasError ? (
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
                  {/* Sets */}
                  <Card style={styles.kpiCard}>
                    <View style={styles.kpiHeaderRow}>
                      <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#22c55e" />
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

                  {/* Workouts */}
                  <Card style={styles.kpiCard}>
                    <View style={styles.kpiHeaderRow}>
                      <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(37, 99, 235, 0.15)' }]}>
                        <Ionicons name="barbell-outline" size={18} color={isDark ? '#60a5fa' : '#2563eb'} />
                      </View>
                      <Text style={[styles.kpiTitle, isDark ? styles.subDark : styles.subLight]}>
                        Тренування
                      </Text>
                    </View>
                    <Text style={[styles.kpiValue, isDark ? styles.textDark : styles.textLight]}>
                      {analyticsData.workoutsCount}
                    </Text>
                    <Text style={[styles.kpiDesc, isDark ? styles.subDark : styles.subLight]}>
                      завершено
                    </Text>
                  </Card>

                  {/* Volume */}
                  <Card style={styles.kpiCard}>
                    <View style={styles.kpiHeaderRow}>
                      <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                        <Ionicons name="trending-up-outline" size={18} color="#f59e0b" />
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
                      загальний тоннаж
                    </Text>
                  </Card>

                  {/* Exercises */}
                  <Card style={styles.kpiCard}>
                    <View style={styles.kpiHeaderRow}>
                      <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
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

                {analyticsData.periodCompletedSets === 0 ? (
                  <View style={[styles.emptyContainer, isDark ? styles.emptyDark : styles.emptyLight]}>
                    <View style={[styles.emptyIconBox, isDark ? styles.emptyIconBoxDark : styles.emptyIconBoxLight]}>
                      <Ionicons name="stats-chart-outline" size={28} color={isDark ? '#60a5fa' : '#2563eb'} />
                    </View>
                    <Text style={[styles.emptyTitle, isDark ? styles.emptyTitleDark : styles.emptyTitleLight]}>
                      Немає завершених підходів
                    </Text>
                    <Text style={[styles.emptySubtitle, isDark ? styles.emptySubtitleDark : styles.emptySubtitleLight]}>
                      У підопічного немає завершених підходів за обраний період ({periodRange.titleUk}).
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* View Switcher: М'язи | Вправи */}
                    <View style={[styles.filterContainer, isDark ? styles.filterDark : styles.filterLight]}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setViewTab('muscles')}
                        style={[styles.filterBtn, viewTab === 'muscles' && (isDark ? styles.filterBtnActiveDark : styles.filterBtnActiveLight)]}
                      >
                        <Text style={[styles.filterBtnText, viewTab === 'muscles' ? (isDark ? styles.filterTextActiveDark : styles.filterTextActiveLight) : (isDark ? styles.filterTextInactiveDark : styles.filterTextInactiveLight)]}>
                          М'язові групи ({analyticsData.muscleList.length})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setViewTab('exercises')}
                        style={[styles.filterBtn, viewTab === 'exercises' && (isDark ? styles.filterBtnActiveDark : styles.filterBtnActiveLight)]}
                      >
                        <Text style={[styles.filterBtnText, viewTab === 'exercises' ? (isDark ? styles.filterTextActiveDark : styles.filterTextActiveLight) : (isDark ? styles.filterTextInactiveDark : styles.filterTextInactiveLight)]}>
                          Вправи ({analyticsData.exercisesList.length})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Muscles View */}
                    {viewTab === 'muscles' && (
                      <Card style={styles.breakdownCard}>
                        <View style={[styles.cardHeader, isDark ? styles.itemBorderDark : styles.itemBorderLight]}>
                          <View>
                            <Text style={[styles.cardTitle, isDark ? styles.textDark : styles.textLight]}>
                              Розподіл по м'язах
                            </Text>
                            <Text style={[styles.cardSub, isDark ? styles.subDark : styles.subLight]}>
                              Відсоток навантаження за підходами
                            </Text>
                          </View>
                          <View style={styles.totalBadge}>
                            <Text style={styles.totalBadgeText}>
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
                                  <Text style={[styles.muscleNameText, isDark ? styles.textDark : styles.textLight]}>
                                    {item.nameUk}
                                  </Text>
                                </View>
                                <View style={styles.muscleCountWrap}>
                                  <Text style={[styles.muscleCountText, isDark ? styles.textDark : styles.textLight]}>
                                    {item.setsCount}{' '}
                                    <Text style={[styles.countUnitText, isDark ? styles.subDark : styles.subLight]}>
                                      {item.setsCount === 1 ? 'підхід' : item.setsCount >= 2 && item.setsCount <= 4 ? 'підходи' : 'підходів'}
                                    </Text>
                                  </Text>
                                  <Text style={[styles.musclePercentText, isDark ? styles.subDark : styles.subLight]}>
                                    ({item.percentage}%)
                                  </Text>
                                </View>
                              </View>
                              <View style={[styles.progressTrack, isDark ? styles.trackDark : styles.trackLight]}>
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
                        <View style={[styles.cardHeader, isDark ? styles.itemBorderDark : styles.itemBorderLight]}>
                          <View>
                            <Text style={[styles.cardTitle, isDark ? styles.textDark : styles.textLight]}>
                              Виконані вправи
                            </Text>
                            <Text style={[styles.cardSub, isDark ? styles.subDark : styles.subLight]}>
                              Всього: {analyticsData.exercisesList.length}
                            </Text>
                          </View>
                        </View>

                        {/* Search input */}
                        {analyticsData.exercisesList.length > 3 && (
                          <View style={[styles.searchWrap, isDark ? styles.searchDark : styles.searchLight]}>
                            <Ionicons name="search" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
                            <TextInput
                              value={searchQuery}
                              onChangeText={setSearchQuery}
                              placeholder="Пошук вправи..."
                              placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                              style={[styles.searchInput, isDark ? styles.textDark : styles.textLight]}
                              autoCapitalize="none"
                              clearButtonMode="while-editing"
                            />
                            {Boolean(searchQuery) && (
                              <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
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
      </ScreenGestureWrapper>
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
    paddingVertical: 10,
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
