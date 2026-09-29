import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { useAuth } from '../context/AuthContext';
import { WorkoutService } from '../services/workoutService';
import { WorkoutPlan } from '../types/workout';

export type AnalyticsPeriod = 'week' | 'month' | 'all';

export const AnalyticsScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth();

  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([]);
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!user) {
      setWorkouts([]);
      setIsLoading(false);
      return;
    }

    try {
      const data = await WorkoutService.getWorkouts(user.id);
      setWorkouts(data);
    } catch (e) {
      console.warn('[AnalyticsScreen.loadData] Error:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, [loadData]);

  // Filter workouts by period
  const filteredWorkouts = useMemo(() => {
    if (period === 'all') return workouts;

    const now = new Date();
    const threshold = new Date();
    if (period === 'week') {
      threshold.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      threshold.setDate(now.getDate() - 30);
    }

    const thresholdStr = threshold.toISOString().split('T')[0];
    return workouts.filter((w) => w.scheduledDate >= thresholdStr);
  }, [workouts, period]);

  // Computed metrics
  const metrics = useMemo(() => {
    const totalCount = filteredWorkouts.length;
    const completedWorkouts = filteredWorkouts.filter((w) => w.status === 'completed');
    const completedCount = completedWorkouts.length;

    let totalVolumeKg = 0;
    let totalCompletedSets = 0;
    let totalDurationMinutes = 0;
    let workoutsWithDuration = 0;

    const muscleGroupCounts: Record<string, number> = {};

    filteredWorkouts.forEach((w) => {
      if (w.durationMinutes) {
        totalDurationMinutes += w.durationMinutes;
        workoutsWithDuration++;
      }

      (w.exercises || []).forEach((ex) => {
        const mg = ex.muscleGroup || 'other';
        muscleGroupCounts[mg] = (muscleGroupCounts[mg] || 0) + 1;

        (ex.sets || []).forEach((s) => {
          if (s.completedAt || w.status === 'completed') {
            totalCompletedSets++;
            if (s.weight && s.actualReps) {
              totalVolumeKg += s.weight * s.actualReps;
            }
          }
        });
      });
    });

    const avgDuration = workoutsWithDuration > 0
      ? Math.round(totalDurationMinutes / workoutsWithDuration)
      : 0;

    return {
      totalCount,
      completedCount,
      totalVolumeKg,
      totalCompletedSets,
      avgDuration,
      muscleGroupCounts,
    };
  }, [filteredWorkouts]);

  const formatVolume = (kg: number): string => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)} т`;
    }
    return `${Math.round(kg)} кг`;
  };

  const getMuscleGroupName = (key: string): string => {
    const map: Record<string, string> = {
      chest: 'Груди',
      back: 'Спина',
      legs: 'Ноги',
      shoulders: 'Плечі',
      arms: 'Руки',
      biceps: 'Біцепс',
      triceps: 'Трицепс',
      core: 'Прес / Кор',
      full_body: 'Все тіло',
      cardio: 'Кардіо',
      other: 'Інше',
    };
    return map[key] || key;
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
      <Header title="Аналітика" subtitle="Огляд активності та навантаження" />

      {/* Period Selector Tabs */}
      <View style={styles.periodRow}>
        <View style={[styles.periodContainer, isDark ? styles.periodDark : styles.periodLight]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setPeriod('week')}
            style={[styles.periodBtn, period === 'week' && styles.periodBtnActive]}
          >
            <Text
              style={[
                styles.periodBtnText,
                period === 'week' ? styles.periodBtnTextActive : (isDark ? styles.subDark : styles.subLight),
              ]}
            >
              Тиждень
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setPeriod('month')}
            style={[styles.periodBtn, period === 'month' && styles.periodBtnActive]}
          >
            <Text
              style={[
                styles.periodBtnText,
                period === 'month' ? styles.periodBtnTextActive : (isDark ? styles.subDark : styles.subLight),
              ]}
            >
              Місяць
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setPeriod('all')}
            style={[styles.periodBtn, period === 'all' && styles.periodBtnActive]}
          >
            <Text
              style={[
                styles.periodBtnText,
                period === 'all' ? styles.periodBtnTextActive : (isDark ? styles.subDark : styles.subLight),
              ]}
            >
              Всі
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#38bdf8' : '#0284c7'}
          />
        }
      >
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#0284c7" />
            <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
              Розрахунок аналітики...
            </Text>
          </View>
        ) : (
          <>
            {/* 2x2 Key Metric Cards */}
            <View style={styles.metricsGrid}>
              {/* Completed Workouts */}
              <Card style={styles.metricCard}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="trophy-outline" size={20} color="#10b981" />
                </View>
                <Text style={[styles.metricValue, isDark ? styles.textDark : styles.textLight]}>
                  {metrics.completedCount}
                  <Text style={[styles.metricTotal, isDark ? styles.subDark : styles.subLight]}>
                    {' '}/ {metrics.totalCount}
                  </Text>
                </Text>
                <Text style={[styles.metricLabel, isDark ? styles.subDark : styles.subLight]}>
                  Завершених тренувань
                </Text>
              </Card>

              {/* Total Volume */}
              <Card style={styles.metricCard}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="barbell-outline" size={20} color="#38bdf8" />
                </View>
                <Text style={[styles.metricValue, isDark ? styles.textDark : styles.textLight]}>
                  {formatVolume(metrics.totalVolumeKg)}
                </Text>
                <Text style={[styles.metricLabel, isDark ? styles.subDark : styles.subLight]}>
                  Загальний тоннаж
                </Text>
              </Card>

              {/* Completed Sets */}
              <Card style={styles.metricCard}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="layers-outline" size={20} color="#a855f7" />
                </View>
                <Text style={[styles.metricValue, isDark ? styles.textDark : styles.textLight]}>
                  {metrics.totalCompletedSets}
                </Text>
                <Text style={[styles.metricLabel, isDark ? styles.subDark : styles.subLight]}>
                  Виконано підходів
                </Text>
              </Card>

              {/* Average Duration */}
              <Card style={styles.metricCard}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="time-outline" size={20} color="#f59e0b" />
                </View>
                <Text style={[styles.metricValue, isDark ? styles.textDark : styles.textLight]}>
                  {metrics.avgDuration > 0 ? `${metrics.avgDuration} хв` : '—'}
                </Text>
                <Text style={[styles.metricLabel, isDark ? styles.subDark : styles.subLight]}>
                  Сер. тривалість
                </Text>
              </Card>
            </View>

            {/* Muscle Groups Distribution */}
            <Card style={styles.muscleCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="pie-chart-outline" size={18} color="#0284c7" />
                <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
                  Активність за групами м’язів
                </Text>
              </View>

              {Object.keys(metrics.muscleGroupCounts).length === 0 ? (
                <Text style={[styles.emptyHint, isDark ? styles.subDark : styles.subLight]}>
                  Немає даних за обраний період. Виконайте тренування для побудови графіку.
                </Text>
              ) : (
                <View style={styles.muscleList}>
                  {Object.entries(metrics.muscleGroupCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([groupKey, count]) => {
                      const totalExercises = Object.values(metrics.muscleGroupCounts).reduce((a, b) => a + b, 0);
                      const percentage = Math.round((count / totalExercises) * 100);

                      return (
                        <View key={groupKey} style={styles.muscleRow}>
                          <View style={styles.muscleLabelRow}>
                            <Text style={[styles.muscleName, isDark ? styles.textDark : styles.textLight]}>
                              {getMuscleGroupName(groupKey)}
                            </Text>
                            <Text style={[styles.musclePercent, isDark ? styles.subDark : styles.subLight]}>
                              {count} вправ ({percentage}%)
                            </Text>
                          </View>
                          <View style={[styles.progressBarTrack, isDark ? styles.trackDark : styles.trackLight]}>
                            <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
                          </View>
                        </View>
                      );
                    })}
                </View>
              )}
            </Card>

            {/* Info Hint */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color="#0284c7" />
              <Text style={[styles.infoText, isDark ? styles.subDark : styles.subLight]}>
                Аналітика автоматично розраховується на основі збережених тренувань користувача в базі Supabase.
              </Text>
            </View>
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
    borderRadius: 8,
  },
  periodLight: {
    backgroundColor: '#f1f5f9',
  },
  periodDark: {
    backgroundColor: '#18181b',
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  periodBtnActive: {
    backgroundColor: '#0284c7',
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  periodBtnTextActive: {
    color: '#ffffff',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: 14,
    gap: 6,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff20',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  metricTotal: {
    fontSize: 14,
    fontWeight: '400',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  muscleCard: {
    padding: 16,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  muscleList: {
    gap: 12,
  },
  muscleRow: {
    gap: 6,
  },
  muscleLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  muscleName: {
    fontSize: 13,
    fontWeight: '500',
  },
  musclePercent: {
    fontSize: 11,
  },
  progressBarTrack: {
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
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0284c7',
    borderRadius: 3,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  infoText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
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
