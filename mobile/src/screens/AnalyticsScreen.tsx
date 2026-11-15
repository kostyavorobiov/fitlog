import React, { useState, useCallback, useMemo } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Card } from '../components/Card';
import { useAuth } from '../context/AuthContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { WorkoutService } from '../services/workoutService';
import { WorkoutPlan } from '../types/workout';
import { getPeriodRange, PeriodRange, formatLocalDate } from '../utils/date';
import { WorkoutCalendarView } from '../components/WorkoutCalendarView';
import { setSavedActiveTab } from '../components/InstagramTabPager';
import { triggerRefreshSuccessHaptic } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import {
  calculateAnalytics,
  AnalyticsPeriod,
} from '../utils/analytics';

export const AnalyticsScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { language, t } = useLanguage();
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

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setSavedActiveTab('analytics');
    try {
      if (targetUserId) {
        setHasError(false);
        const data = await WorkoutService.getWorkouts(targetUserId);
        setWorkouts(data);
      }
    } catch (e) {
      console.warn('[AnalyticsScreen.onRefresh] Error:', e);
      setHasError(true);
    } finally {
      setIsRefreshing(false);
      await triggerRefreshSuccessHaptic();
    }
  }, [targetUserId]);

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
    return getPeriodRange(period, currentDate, language);
  }, [period, currentDate, language]);

  // Analytics Computation (Strictly counting completed sets: completedAt != null)
  const analyticsData = useMemo(() => {
    return calculateAnalytics(workouts, periodRange);
  }, [workouts, periodRange]);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Header matching screenshot */}
      <View style={styles.topHeader}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>
          {traineeName ? `${t('analytics.title', 'Аналітика')}: ${traineeName}` : t('analytics.title', 'Аналітика')}
        </Text>

        {/* Date browsing row: Subtitle with navigation arrows */}
        <View style={styles.dateNavRow}>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            {periodRange.title || periodRange.titleUk}
          </Text>

          <View style={styles.navChevrons}>
            <TouchableOpacity
              onPress={handlePrevPeriod}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.chevronBtn, { backgroundColor: colors.subCard }]}
              accessibilityRole="button"
              accessibilityLabel="Попередній період"
            >
              <Ionicons name="chevron-back" size={16} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNextPeriod}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.chevronBtn, { backgroundColor: colors.subCard }]}
              accessibilityRole="button"
              accessibilityLabel="Наступний період"
            >
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </TouchableOpacity>

            {!periodRange.isCurrent && (
              <TouchableOpacity
                onPress={handleJumpToToday}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.todayChip, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}
              >
                <Text style={[styles.todayChipText, { color: colors.accent }]}>
                  {t('common.today', 'Сьогодні')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Period Switcher Pills (День | Тиждень | Місяць) */}
        <View style={[styles.periodSwitcher, { backgroundColor: colors.subCard }]}>
          {(
            [
              { key: 'day', label: t('analytics.day', 'День') },
              { key: 'week', label: t('analytics.week', 'Тиждень') },
              { key: 'month', label: t('analytics.month', 'Місяць') },
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
                  styles.periodPill,
                  isActive && { backgroundColor: colors.accent },
                ]}
              >
                <Text
                  style={[
                    styles.periodPillText,
                    {
                      color: isActive ? colors.accentText : colors.textSecondary,
                      fontWeight: isActive ? '800' : '600',
                    },
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
        {/* 1. ТОННАЖ Card matching PDF & Screenshot */}
        <Card style={styles.tonnageCard}>
          <Text style={[styles.cardHeaderTitle, { color: colors.textSecondary }]}>
            {period === 'day'
              ? t('analytics.volume_day', 'ТОННАЖ ЗА ДЕНЬ')
              : period === 'month'
              ? t('analytics.volume_month', 'ТОННАЖ ЗА МІСЯЦЬ')
              : t('analytics.volume_week', 'ТОННАЖ ЗА ТИЖДЕНЬ')}
          </Text>
          <View style={styles.tonnageRow}>
            <View style={styles.tonnageLeft}>
              <Text style={[styles.tonnageBigNum, { color: colors.text }]}>
                {analyticsData.periodTons > 0
                  ? analyticsData.periodTons
                  : (Math.round((analyticsData.periodVolumeKg / 1000) * 10) / 10) || '0'}
              </Text>
              <Text style={[styles.tonnageUnit, { color: colors.textSecondary }]}>
                {t('common.ton_unit', 'т')}
              </Text>
            </View>

            <View style={styles.tonnageRight}>
              <Text style={[styles.tonnageStatRow, { color: colors.textSecondary }]}>
                {analyticsData.periodCompletedSets} {t('common.sets', 'підходів')}
              </Text>
              <Text style={[styles.tonnageStatRow, { color: colors.textSecondary }]}>
                {analyticsData.exercisesList.length} {t('common.exercises_count', 'вправ')}
              </Text>
            </View>
          </View>
        </Card>

        {/* 2. ГРУПИ М'ЯЗІВ Card matching PDF & Screenshot */}
        <Card style={styles.musclesCard}>
          <Text style={[styles.cardHeaderTitle, { color: colors.textSecondary }]}>
            {t('analytics.muscle_groups', 'ГРУПИ М’ЯЗІВ')}
          </Text>

          {/* Multi-segment Colored Horizontal Bar */}
          <View style={styles.multiBar}>
            {analyticsData.muscleList.length > 0 ? (
              analyticsData.muscleList.map((m) => (
                <View
                  key={m.groupKey}
                  style={{
                    flex: Math.max(1, m.percentage),
                    backgroundColor: m.color,
                    height: 12,
                    borderRadius: 4,
                  }}
                />
              ))
            ) : (
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.subCard,
                  height: 12,
                  borderRadius: 6,
                }}
              />
            )}
          </View>

          {/* Muscle Breakdown List */}
          <View style={styles.musclesListWrap}>
            {analyticsData.muscleList.length > 0 ? (
              analyticsData.muscleList.map((m) => (
                <View key={m.groupKey} style={styles.muscleRowItem}>
                  <View style={styles.muscleRowLeft}>
                    <View style={[styles.muscleDot, { backgroundColor: m.color }]} />
                    <Text style={[styles.muscleNameText, { color: colors.text }]}>
                      {t(`muscles.${m.groupKey}`, m.nameUk)}
                    </Text>
                  </View>
                  <Text style={[styles.muscleStatsText, { color: colors.textSecondary }]}>
                    {m.setsCount} {t('common.sets_short', 'підх.')} · {m.percentage}%
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyMusclesText, { color: colors.textSecondary }]}>
                {t('analytics.no_data', 'Немає виконаних підходів за обраний період')}
              </Text>
            )}
          </View>
        </Card>

        {/* 3. КАЛЕНДАР Card matching Screenshot */}
        <WorkoutCalendarView
          workouts={workouts}
          selectedDate={formatLocalDate(currentDate)}
          displayDate={currentDate}
          hideMonthNav={true}
          onSelectDate={(dateStr) => {
            const parts = dateStr.split('-').map(Number);
            if (parts.length === 3) {
              const nextDate = new Date(parts[0], parts[1] - 1, parts[2]);
              setCurrentDate(nextDate);
            }
          }}
          isDark={isDark}
        />

        {/* Loading Indicator */}
        {isLoading && !isRefreshing && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}

        {/* Error Notification */}
        {hasError && (
          <View style={[styles.errorWrap, { backgroundColor: colors.card, borderColor: colors.danger }]}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>
              Не вдалося оновити дані. Потягніть вниз для повторної спроби.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  screenSubtitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  navChevrons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevronBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    marginLeft: 4,
  },
  todayChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  periodSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 9999,
    marginTop: 4,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
  periodPillText: {
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 120,
    gap: 12,
  },
  tonnageCard: {
    padding: 20,
    borderRadius: 20,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  tonnageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  tonnageLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  tonnageBigNum: {
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 52,
    letterSpacing: -1,
  },
  tonnageUnit: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 4,
  },
  tonnageRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  tonnageStatRow: {
    fontSize: 13,
    fontWeight: '600',
  },
  musclesCard: {
    padding: 20,
    borderRadius: 20,
  },
  multiBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 16,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  musclesListWrap: {
    gap: 12,
  },
  muscleRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  muscleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  muscleDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  muscleNameText: {
    fontSize: 15,
    fontWeight: '700',
  },
  muscleStatsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyMusclesText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  loadingWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
