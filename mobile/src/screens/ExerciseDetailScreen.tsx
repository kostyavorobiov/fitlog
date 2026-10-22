import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Card } from '../components/Card';
import { ScreenGestureWrapper } from '../components/ScreenGestureWrapper';
import { useAuth } from '../context/AuthContext';
import { WorkoutService } from '../services/workoutService';
import { ExerciseService } from '../services/exerciseService';
import { MuscleGroup, MUSCLE_GROUPS, PastExercisePerformance, PastExerciseSetSummary } from '../types/workout';
import { calculate1RM } from '../utils/workout';

interface ChartPoint {
  date: string;
  displayDate: string;
  timestamp: number;
  maxWeight: number;
  volume: number;
  est1RM: number;
  setsCount: number;
  workoutTitle: string;
}

interface SessionRow {
  workoutId?: string;
  workoutTitle: string;
  date: string;
  displayDate: string;
  setsCount: number;
  maxWeight: number;
  volumeTons: number;
  sets: PastExerciseSetSummary[];
}

export const ExerciseDetailScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { user } = useAuth();

  const { id: exerciseId, name: initialName, muscleGroup: initialMuscleGroup } = useLocalSearchParams<{
    id: string;
    name?: string;
    muscleGroup?: MuscleGroup;
  }>();

  const [loading, setLoading] = useState(true);
  const [exerciseName, setExerciseName] = useState<string>(initialName || '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(initialMuscleGroup || 'other');
  const [history, setHistory] = useState<PastExercisePerformance[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [plotWidth, setPlotWidth] = useState<number>(0);

  // Load exercise details if missing from params
  useEffect(() => {
    if (!exerciseId) return;

    if (!exerciseName || muscleGroup === 'other') {
      ExerciseService.getExercises().then((list) => {
        const found = list.find((e) => e.id === exerciseId);
        if (found) {
          if (!exerciseName && found.name) setExerciseName(found.name);
          if (found.muscleGroup) setMuscleGroup(found.muscleGroup);
        }
      });
    }
  }, [exerciseId, exerciseName, muscleGroup]);

  // Load performance history
  useEffect(() => {
    if (!user?.id || !exerciseId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    WorkoutService.getAllPastPerformances(user.id, exerciseId, exerciseName).then((data) => {
      if (isMounted) {
        setHistory(data);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user?.id, exerciseId, exerciseName]);

  const muscleInfo = MUSCLE_GROUPS[muscleGroup] || MUSCLE_GROUPS.full_body;

  // Date parsing helpers
  const parseDate = useCallback((dStr: string): Date => {
    if (!dStr) return new Date();
    const parts = dStr.split('T')[0].split('-').map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(dStr);
  }, []);

  const formatShortDate = useCallback((date: Date): string => {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${d}/${m}`;
  }, []);

  const formatLongDateUk = useCallback((date: Date): string => {
    const months = [
      'січ', 'лют', 'бер', 'квіт', 'трав', 'черв',
      'лип', 'серп', 'вер', 'жовт', 'лист', 'груд',
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }, []);

  const formatRazy = (count: number): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'разів';
    if (mod10 === 1) return 'раз';
    if (mod10 >= 2 && mod10 <= 4) return 'рази';
    return 'разів';
  };

  // Chronological chart data points
  const allPoints: ChartPoint[] = useMemo(() => {
    return history
      .map((h) => {
        const dt = parseDate(h.date);
        let maxWeight = 0;
        let volume = 0;
        let best1RM = 0;
        let setsCount = 0;

        (h.sets || []).forEach((s) => {
          const w = Number(s.weight) || 0;
          const r = Number(s.actualReps) || 0;
          if (w > maxWeight) maxWeight = w;
          if (w > 0 && r > 0) {
            volume += w * r;
            const cur1RM = calculate1RM(w, r);
            if (cur1RM > best1RM) best1RM = cur1RM;
          }
          setsCount += 1;
        });

        if (maxWeight === 0 && h.maxWeight) maxWeight = h.maxWeight;
        if (volume === 0 && h.totalVolume) volume = h.totalVolume;
        if (best1RM === 0 && maxWeight > 0) best1RM = maxWeight;

        return {
          date: h.date,
          displayDate: formatShortDate(dt),
          timestamp: dt.getTime(),
          maxWeight,
          volume,
          est1RM: Math.round(best1RM * 10) / 10,
          setsCount,
          workoutTitle: h.workoutTitle || 'Тренування',
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [history, parseDate, formatShortDate]);

  // Overall statistics
  const stats = useMemo(() => {
    if (allPoints.length === 0) {
      return {
        latestWeight: 0,
        dateRangeText: 'Немає даних',
        personalBest: 0,
        best1RM: 0,
        totalSets: 0,
        isLatestPR: false,
      };
    }

    const firstDate = parseDate(allPoints[0].date);
    const lastDate = parseDate(allPoints[allPoints.length - 1].date);
    const dateRangeText =
      allPoints.length === 1
        ? formatLongDateUk(firstDate)
        : `${formatLongDateUk(firstDate)} — ${formatLongDateUk(lastDate)}`;

    let personalBest = 0;
    let best1RM = 0;
    let totalSets = 0;

    allPoints.forEach((p) => {
      if (p.maxWeight > personalBest) personalBest = p.maxWeight;
      if (p.est1RM > best1RM) best1RM = p.est1RM;
      totalSets += p.setsCount;
    });

    const latestPoint = allPoints[allPoints.length - 1];
    const latestWeight = latestPoint?.maxWeight || personalBest;
    const isLatestPR = latestPoint && latestPoint.maxWeight >= personalBest && personalBest > 0;

    return {
      latestWeight,
      dateRangeText,
      personalBest,
      best1RM,
      totalSets,
      isLatestPR,
    };
  }, [allPoints, parseDate, formatLongDateUk]);

  // Last 5 sessions (most recent first)
  const last5Sessions: SessionRow[] = useMemo(() => {
    return history
      .slice()
      .reverse()
      .slice(0, 5)
      .map((h) => {
        let maxWeight = 0;
        let volume = 0;
        let count = 0;

        (h.sets || []).forEach((s) => {
          const w = Number(s.weight) || 0;
          const r = Number(s.actualReps) || 0;
          if (w > maxWeight) maxWeight = w;
          if (w > 0 && r > 0) volume += w * r;
          count += 1;
        });

        if (maxWeight === 0 && h.maxWeight) maxWeight = h.maxWeight;
        if (volume === 0 && h.totalVolume) volume = h.totalVolume;

        return {
          workoutId: h.workoutId,
          workoutTitle: h.workoutTitle || 'Тренування',
          date: h.date,
          displayDate: formatShortDate(parseDate(h.date)),
          setsCount: count,
          maxWeight,
          volumeTons: Math.round((volume / 1000) * 10) / 10,
          sets: h.sets || [],
        };
      });
  }, [history, parseDate, formatShortDate]);

  const toggleRowExpanded = (rowKey: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  };

  const onChartLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) setPlotWidth(width);
  };

  // Chart configuration
  const chartHeight = 150;
  const weights = allPoints.map((p) => p.maxWeight);
  const rawMin = weights.length > 0 ? Math.min(...weights) : 70;
  const rawMax = weights.length > 0 ? Math.max(...weights) : 100;
  // Pad bounds for aesthetic axes
  const minVal = Math.max(0, Math.floor((rawMin - 5) / 5) * 5);
  const maxVal = Math.ceil((rawMax + 10) / 5) * 5;
  const valRange = maxVal - minVal || 10;

  // 4 Y-axis tick values (descending)
  const yTicks = [
    maxVal,
    Math.round(maxVal - valRange * 0.33),
    Math.round(maxVal - valRange * 0.66),
    minVal,
  ];

  return (
    <ScreenGestureWrapper enableTabSwipe={false} enableBackSwipe={true}>
      <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
        {/* Top Header Bar - Exact WorkoutEditorScreen Style */}
        <View style={[styles.topBar, isDark ? styles.borderDark : styles.borderLight]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.back()}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <Ionicons name="arrow-back" size={22} color={isDark ? '#F8FAFC' : '#0F172A'} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text numberOfLines={1} style={[styles.topBarTitle, isDark ? styles.textDark : styles.textLight]}>
              {exerciseName || 'Вправа'}
            </Text>
            <Text style={[styles.topBarSub, isDark ? styles.subDark : styles.subLight]}>
              {muscleInfo.nameUk}
            </Text>
          </View>

          <View style={{ width: 34 }} />
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
            <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
              Завантаження статистики вправи...
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Hero: Big Metric & Date Range */}
            <View style={styles.heroSection}>
              <View style={styles.heroRow}>
                <Text style={[styles.heroVal, isDark ? styles.textDark : styles.textLight]}>
                  {stats.personalBest || stats.latestWeight || 0}
                </Text>
                <Text style={[styles.heroUnit, isDark ? styles.subDark : styles.subLight]}>
                  кг
                </Text>
              </View>
              <Text style={[styles.dateRangeText, isDark ? styles.subDark : styles.subLight]}>
                {stats.dateRangeText}
              </Text>
            </View>

            {/* Chart Card */}
            <Card style={styles.chartCard}>
              {allPoints.length === 0 ? (
                <View style={styles.chartEmpty}>
                  <Ionicons name="barbell-outline" size={32} color={isDark ? '#64748b' : '#94a3b8'} />
                  <Text style={[styles.chartEmptyText, isDark ? styles.subDark : styles.subLight]}>
                    Немає даних для побудови графіка
                  </Text>
                </View>
              ) : (
                <View style={styles.chartContainer}>
                  {/* Y-axis labels and horizontal dashed grid lines */}
                  <View style={styles.chartContentRow}>
                    <View style={styles.yAxisColumn}>
                      {yTicks.map((tick, idx) => (
                        <Text
                          key={idx}
                          style={[styles.yAxisLabel, isDark ? styles.subDark : styles.subLight]}
                        >
                          {tick}
                        </Text>
                      ))}
                    </View>

                    {/* Chart Plot Area */}
                    <View style={[styles.plotArea, { height: chartHeight }]} onLayout={onChartLayout}>
                      {/* Grid Lines */}
                      <View style={StyleSheet.absoluteFill}>
                        {yTicks.map((_, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.gridLine,
                              isDark ? styles.gridLineDark : styles.gridLineLight,
                              { top: `${(idx / (yTicks.length - 1)) * 100}%` },
                            ]}
                          />
                        ))}
                      </View>

                      {/* Line & Dots */}
                      {plotWidth > 0 && allPoints.length > 0 && (() => {
                        const topPad = 12;
                        const bottomPad = 12;
                        const usableHeight = chartHeight - topPad - bottomPad;
                        const sidePad = 14;
                        const usableWidth = Math.max(1, plotWidth - sidePad * 2);

                        const coords = allPoints.map((p, idx) => {
                          const x = allPoints.length === 1
                            ? plotWidth / 2
                            : sidePad + (idx / (allPoints.length - 1)) * usableWidth;
                          const ratio = Math.max(0, Math.min(1, (p.maxWeight - minVal) / valRange));
                          const y = topPad + (1 - ratio) * usableHeight;
                          return { x, y, point: p };
                        });

                        return (
                          <>
                            {/* Filled polygon below line (simulated gradient shading) */}
                            {coords.length >= 2 && (() => {
                              const first = coords[0];
                              const last = coords[coords.length - 1];
                              const avgY = (first.y + last.y) / 2;
                              return (
                                <View
                                  style={[
                                    styles.areaFill,
                                    {
                                      left: first.x,
                                      width: last.x - first.x,
                                      top: avgY,
                                      bottom: 0,
                                      backgroundColor: isDark
                                        ? 'rgba(37, 99, 235, 0.22)'
                                        : 'rgba(37, 99, 235, 0.14)',
                                    },
                                  ]}
                                />
                              );
                            })()}

                            {/* Line Segments */}
                            {coords.map((curr, idx) => {
                              if (idx === coords.length - 1) return null;
                              const next = coords[idx + 1];
                              const dx = next.x - curr.x;
                              const dy = next.y - curr.y;
                              const length = Math.sqrt(dx * dx + dy * dy);
                              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                              return (
                                <View
                                  key={`seg_${idx}`}
                                  style={[
                                    styles.chartLineSegment,
                                    {
                                      left: curr.x,
                                      top: curr.y - 1.5,
                                      width: length,
                                      transform: [
                                        { translateX: 0 },
                                        { translateY: 0 },
                                        { rotate: `${angle}deg` },
                                      ],
                                      transformOrigin: '0% 50%',
                                    },
                                  ]}
                                />
                              );
                            })}

                            {/* Dots */}
                            {coords.map((c, idx) => (
                              <View
                                key={`dot_${idx}`}
                                style={[
                                  styles.chartDot,
                                  {
                                    left: c.x - 5,
                                    top: c.y - 5,
                                  },
                                ]}
                              />
                            ))}
                          </>
                        );
                      })()}
                    </View>
                  </View>

                  {/* X-axis date labels */}
                  <View style={styles.xAxisRow}>
                    <View style={{ width: 34 }} />
                    <View style={styles.xAxisLabelsArea}>
                      {allPoints.length > 0 && (
                        <>
                          <Text style={[styles.xAxisLabel, isDark ? styles.subDark : styles.subLight]}>
                            {allPoints[0].displayDate}
                          </Text>
                          {allPoints.length > 1 && (
                            <Text style={[styles.xAxisLabel, isDark ? styles.subDark : styles.subLight]}>
                              {allPoints[allPoints.length - 1].displayDate}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </Card>

            {/* 3 KPI Cards Row */}
            <View style={styles.kpiRow}>
              {/* Card 1: Record (PR) */}
              <Card style={styles.kpiCard}>
                <Ionicons name="trophy-outline" size={20} color="#F59E0B" style={styles.kpiIcon} />
                <Text style={[styles.kpiVal, isDark ? styles.textDark : styles.textLight]}>
                  {stats.personalBest ? `${stats.personalBest} кг` : '—'}
                </Text>
                <Text style={[styles.kpiLbl, isDark ? styles.subDark : styles.subLight]}>
                  Рекорд (PR)
                </Text>
              </Card>

              {/* Card 2: Estimated 1RM */}
              <Card style={styles.kpiCard}>
                <Ionicons name="trending-up" size={20} color="#3B82F6" style={styles.kpiIcon} />
                <Text style={[styles.kpiVal, isDark ? styles.textDark : styles.textLight]}>
                  {stats.best1RM ? `${stats.best1RM} кг` : '—'}
                </Text>
                <Text numberOfLines={1} style={[styles.kpiLbl, isDark ? styles.subDark : styles.subLight]}>
                  Розрахунковий 1...
                </Text>
              </Card>

              {/* Card 3: Total Sets */}
              <Card style={styles.kpiCard}>
                <Ionicons name="barbell-outline" size={20} color="#10B981" style={styles.kpiIcon} />
                <Text style={[styles.kpiVal, isDark ? styles.textDark : styles.textLight]}>
                  {stats.totalSets}
                </Text>
                <Text style={[styles.kpiLbl, isDark ? styles.subDark : styles.subLight]}>
                  Всього підходів
                </Text>
              </Card>
            </View>

            {/* Progress Analytics Section */}
            <Text style={[styles.sectionHeading, isDark ? styles.subDark : styles.subLight]}>
              АНАЛІТИКА ПРОГРЕСУ
            </Text>

            <Card style={styles.analyticsCard}>
              {/* Card Header with Icon */}
              <View style={styles.analyticsTitleRow}>
                <Ionicons name="barbell-outline" size={20} color="#3B82F6" />
                <Text style={[styles.analyticsTitle, isDark ? styles.textDark : styles.textLight]}>
                  Прогрес
                </Text>
              </View>

              <Text style={[styles.analyticsDesc, isDark ? styles.subDark : styles.subLight]}>
                Ви тренували цю вправу{' '}
                <Text style={[styles.boldText, isDark ? styles.textDark : styles.textLight]}>
                  {history.length}
                </Text>{' '}
                {formatRazy(history.length)} за весь час.
              </Text>

              {/* Table Subtitle */}
              <Text style={[styles.tableSubheader, isDark ? styles.textDark : styles.textLight]}>
                Останні {Math.min(5, history.length)} тренувань
              </Text>

              {/* Sessions Table */}
              {last5Sessions.length === 0 ? (
                <Text style={[styles.noSessionsText, isDark ? styles.subDark : styles.subLight]}>
                  Ще немає збережених тренувань для цієї вправи
                </Text>
              ) : (
                <View style={styles.tableContainer}>
                  {/* Table Header */}
                  <View style={[styles.tableHeaderRow, isDark ? styles.tableBorderDark : styles.tableBorderLight]}>
                    <Text style={[styles.colDate, styles.tableHeaderCell, isDark ? styles.subDark : styles.subLight]}>
                      Дата
                    </Text>
                    <Text style={[styles.colSets, styles.tableHeaderCell, isDark ? styles.subDark : styles.subLight]}>
                      Підходи
                    </Text>
                    <Text style={[styles.colWeight, styles.tableHeaderCell, isDark ? styles.subDark : styles.subLight]}>
                      Макс. вага
                    </Text>
                    <Text style={[styles.colVolume, styles.tableHeaderCell, isDark ? styles.subDark : styles.subLight]}>
                      Тоннаж
                    </Text>
                  </View>

                  {/* Table Rows */}
                  {last5Sessions.map((session, sIdx) => {
                    const rowKey = session.workoutId || `sess_${sIdx}`;
                    const isExpanded = Boolean(expandedRows[rowKey]);

                    return (
                      <View key={rowKey}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => toggleRowExpanded(rowKey)}
                          style={[
                            styles.tableRow,
                            isDark ? styles.tableBorderDark : styles.tableBorderLight,
                          ]}
                        >
                          <View style={[styles.colDate, styles.dateColRow]}>
                            <Text style={[styles.cellDateText, isDark ? styles.textDark : styles.textLight]}>
                              {session.displayDate}
                            </Text>
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={12}
                              color={isDark ? '#94A3B8' : '#64748B'}
                              style={{ marginLeft: 3 }}
                            />
                          </View>

                          <Text style={[styles.colSets, styles.cellSetsText, isDark ? styles.textDark : styles.textLight]}>
                            {session.setsCount}
                          </Text>

                          <Text style={[styles.colWeight, styles.cellWeightText, isDark ? styles.textDark : styles.textLight]}>
                            {session.maxWeight} кг
                          </Text>

                          <Text style={[styles.colVolume, styles.cellVolumeText, isDark ? styles.subDark : styles.subLight]}>
                            {session.volumeTons} т
                          </Text>
                        </TouchableOpacity>

                        {/* Expanded Sets Details */}
                        {isExpanded && session.sets.length > 0 && (
                          <View style={[styles.expandedSetsBox, isDark ? styles.expandedBoxDark : styles.expandedBoxLight]}>
                            {session.sets.map((set, setIdx) => (
                              <View key={setIdx} style={styles.expandedSetRow}>
                                <Text style={[styles.expandedSetNum, isDark ? styles.subDark : styles.subLight]}>
                                  Підхід {set.setNumber || setIdx + 1}:
                                </Text>
                                <Text style={[styles.expandedSetDetails, isDark ? styles.textDark : styles.textLight]}>
                                  {set.weight} кг × {set.actualReps} повт.
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>

            {/* Personal Record Highlight Banner */}
            {stats.personalBest > 0 && (
              <View style={[styles.recordBanner, isDark ? styles.recordBannerDark : styles.recordBannerLight]}>
                <Ionicons name="trophy-outline" size={26} color="#F59E0B" />
                <View style={styles.recordBannerContent}>
                  <Text style={styles.recordBannerTitle}>Особистий рекорд!</Text>
                  <Text style={[styles.recordBannerDesc, isDark ? styles.recordBannerDescDark : styles.recordBannerDescLight]}>
                    Ви встановили новий рекорд у цій вправі на останньому тренуванні!
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ScreenGestureWrapper>
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
    borderBottomColor: '#E2E8F0',
  },
  borderDark: {
    borderBottomColor: '#334155',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  iconBtn: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  topBarSub: {
    fontSize: 11,
    marginTop: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 48,
  },
  heroSection: {
    marginTop: 2,
    marginBottom: 4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroVal: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroUnit: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 3,
  },
  dateRangeText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  chartCard: {
    padding: 14,
    borderRadius: 20,
  },
  chartEmpty: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chartEmptyText: {
    fontSize: 13,
  },
  chartContainer: {
    gap: 8,
  },
  chartContentRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  yAxisColumn: {
    width: 32,
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingRight: 4,
  },
  yAxisLabel: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'left',
  },
  plotArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  gridLineLight: {
    backgroundColor: '#E2E8F0',
  },
  gridLineDark: {
    backgroundColor: 'rgba(51, 65, 85, 0.45)',
  },
  chartLineSegment: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 1.5,
  },
  areaFill: {
    position: 'absolute',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  chartDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#3B82F6',
    zIndex: 3,
  },
  xAxisRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  xAxisLabelsArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  xAxisLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  kpiIcon: {
    marginBottom: 2,
  },
  kpiVal: {
    fontSize: 15,
    fontWeight: '700',
  },
  kpiLbl: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  analyticsCard: {
    padding: 16,
    borderRadius: 20,
    gap: 8,
  },
  analyticsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  analyticsTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  analyticsDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  tableSubheader: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  noSessionsText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  tableContainer: {
    marginTop: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tableBorderLight: {
    borderBottomColor: '#F1F5F9',
  },
  tableBorderDark: {
    borderBottomColor: '#263140',
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dateColRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colDate: {
    flex: 1.2,
  },
  colSets: {
    flex: 0.9,
    textAlign: 'center',
  },
  colWeight: {
    flex: 1.2,
    textAlign: 'center',
  },
  colVolume: {
    flex: 1,
    textAlign: 'right',
  },
  cellDateText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cellSetsText: {
    fontSize: 13,
    fontWeight: '500',
  },
  cellWeightText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cellVolumeText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  expandedSetsBox: {
    padding: 10,
    borderRadius: 12,
    marginVertical: 4,
    gap: 4,
  },
  expandedBoxLight: {
    backgroundColor: '#F1F5F9',
  },
  expandedBoxDark: {
    backgroundColor: '#263140',
  },
  expandedSetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  expandedSetNum: {
    fontSize: 12,
  },
  expandedSetDetails: {
    fontSize: 12,
    fontWeight: '600',
  },
  recordBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 2,
  },
  recordBannerLight: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  recordBannerDark: {
    backgroundColor: '#261C14',
    borderColor: '#78350F',
  },
  recordBannerContent: {
    flex: 1,
  },
  recordBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
  },
  recordBannerDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  recordBannerDescLight: {
    color: '#92400E',
  },
  recordBannerDescDark: {
    color: '#FDE68A',
  },
});
