import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
  BackHandler,
  Animated,
  Easing,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Card } from '../components/Card';
import { ScreenGestureWrapper } from '../components/ScreenGestureWrapper';
import { setSavedActiveTab, getSavedActiveTab, TabName } from '../components/InstagramTabPager';
import { useAuth } from '../context/AuthContext';
import { WorkoutService } from '../services/workoutService';
import { ExerciseService } from '../services/exerciseService';
import { MuscleGroup, MUSCLE_GROUPS, PastExercisePerformance, PastExerciseSetSummary } from '../types/workout';
import { calculate1RM } from '../utils/workout';

interface ChartPoint {
  date: string;
  displayDate: string;
  timestamp: number;
  value: number;
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

  const { id: exerciseId, name: initialName, muscleGroup: initialMuscleGroup, fromTab } = useLocalSearchParams<{
    id: string;
    name?: string;
    muscleGroup?: MuscleGroup;
    fromTab?: TabName;
  }>();

  const sourceTab = (fromTab as TabName) || getSavedActiveTab() || 'exercises';

  const [loading, setLoading] = useState(true);
  const [exerciseName, setExerciseName] = useState<string>(initialName || '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(initialMuscleGroup || 'other');
  const [history, setHistory] = useState<PastExercisePerformance[]>([]);
  const [expandedSessionIdx, setExpandedSessionIdx] = useState<number | null>(null);
  const [activeTooltipIdx, setActiveTooltipIdx] = useState<number | null>(null);
  const [plotWidth, setPlotWidth] = useState<number>(0);

  // When exiting, guarantee that original screen opens
  const handleBack = useCallback(() => {
    setSavedActiveTab(sourceTab);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate(sourceTab === 'index' ? '/(tabs)' : (`/(tabs)/${sourceTab}` as any));
    }
  }, [router, sourceTab]);

  const insets = useSafeAreaInsets();
  const topBarAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isTopBarVisibleRef = useRef(true);
  const accumulatedDown = useRef(0);
  const accumulatedUp = useRef(0);
  const [topBarHeight, setTopBarHeight] = useState(56 + Math.max(insets.top, 0));

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const contentHeight = event.nativeEvent.contentSize?.height || 0;
      const layoutHeight = event.nativeEvent.layoutMeasurement?.height || 0;
      const diff = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      // Always show when near the top (and ignore top overscroll bounce)
      if (currentY <= 25) {
        accumulatedDown.current = 0;
        accumulatedUp.current = 0;
        if (!isTopBarVisibleRef.current) {
          isTopBarVisibleRef.current = true;
          Animated.timing(topBarAnim, {
            toValue: 0,
            duration: 200,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
        return;
      }

      // Check if past or at bottom overscroll on iOS
      const maxScrollY = contentHeight > layoutHeight ? contentHeight - layoutHeight : 0;
      const isPastBottom = maxScrollY > 0 && currentY >= maxScrollY;
      if (isPastBottom) {
        accumulatedDown.current = 0;
        accumulatedUp.current = 0;
        return;
      }

      // Hysteresis calculation to prevent rapid flickering / jumping:
      if (diff > 0) {
        // Scrolling down (finger swiping up)
        accumulatedUp.current = 0;
        accumulatedDown.current += diff;

        if (accumulatedDown.current > 12 && currentY > 25) {
          if (isTopBarVisibleRef.current) {
            isTopBarVisibleRef.current = false;
            Animated.timing(topBarAnim, {
              toValue: 1,
              duration: 200,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: Platform.OS !== 'web',
            }).start();
          }
          accumulatedDown.current = 0;
        }
      } else if (diff < 0) {
        // Scrolling up (finger swiping down)
        accumulatedDown.current = 0;
        accumulatedUp.current += Math.abs(diff);

        if (accumulatedUp.current > 16) {
          if (!isTopBarVisibleRef.current) {
            isTopBarVisibleRef.current = true;
            Animated.timing(topBarAnim, {
              toValue: 0,
              duration: 200,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: Platform.OS !== 'web',
            }).start();
          }
          accumulatedUp.current = 0;
        }
      }
    },
    [topBarAnim]
  );

  // Keep source tab active when entering or leaving
  useEffect(() => {
    setSavedActiveTab(sourceTab);
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => {
      setSavedActiveTab(sourceTab);
      sub.remove();
    };
  }, [handleBack, sourceTab]);

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

  // Date parsing helpers matching web version
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

  // Process all history data chronologically from first day to current day
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
          value: maxWeight,
          maxWeight,
          volume,
          est1RM: Math.round(best1RM * 10) / 10,
          setsCount,
          workoutTitle: h.workoutTitle || 'Тренування',
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [history, parseDate, formatShortDate]);

  // Overall statistics matching web version
  const stats = useMemo(() => {
    if (allPoints.length === 0) {
      return {
        avgWeight: 0,
        dateRangeText: 'Немає даних',
        personalBest: 0,
        best1RM: 0,
        totalSets: 0,
        isNewPrInLatest: false,
      };
    }

    const sumWeight = allPoints.reduce((acc, p) => acc + p.maxWeight, 0);
    const avgWeight = Math.round((sumWeight / allPoints.length) * 10) / 10;

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
    const isNewPrInLatest = latestPoint && latestPoint.maxWeight >= personalBest && personalBest > 0;

    return {
      avgWeight,
      dateRangeText,
      personalBest,
      best1RM,
      totalSets,
      isNewPrInLatest,
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

  const onChartLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) setPlotWidth(width);
  };

  // Chart configuration matching web version
  const chartHeight = 160;
  const weights = allPoints.map((p) => p.value);
  const rawMin = weights.length > 0 ? Math.min(...weights) : 70;
  const rawMax = weights.length > 0 ? Math.max(...weights) : 100;
  const minVal = Math.max(0, Math.floor((rawMin - 5) / 5) * 5);
  const maxVal = Math.ceil((rawMax + 10) / 5) * 5;
  const valRange = maxVal - minVal || 10;

  // 4 horizontal ticks
  const yTicks = [
    maxVal,
    Math.round(maxVal - valRange * 0.33),
    Math.round(maxVal - valRange * 0.66),
    minVal,
  ];

  return (
    <ScreenGestureWrapper enableTabSwipe={false} enableBackSwipe={true} onBack={handleBack}>
      <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>


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
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {/* Average Weight Above Chart - Matching mobile web version */}
            <View style={styles.heroSection}>
              <Text style={[styles.heroLabel, isDark ? styles.subDark : styles.subLight]}>
                Середнє
              </Text>
              <View style={styles.heroRow}>
                <Text style={[styles.heroVal, isDark ? styles.textDark : styles.textLight]}>
                  {stats.avgWeight}
                </Text>
                <Text style={[styles.heroUnit, isDark ? styles.subDark : styles.subLight]}>
                  кг
                </Text>
              </View>
              <Text style={[styles.dateRangeText, isDark ? styles.subDark : styles.subLight]}>
                {stats.dateRangeText}
              </Text>
            </View>

            {/* Interactive Chart Card - Matching mobile web version */}
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
                      {/* Dashed Horizontal Grid Lines */}
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

                      {/* Line, Fill & Dots */}
                      {plotWidth > 0 && allPoints.length > 0 && (() => {
                        const topPad = 14;
                        const bottomPad = 14;
                        const usableHeight = chartHeight - topPad - bottomPad;
                        const sidePad = 14;
                        const usableWidth = Math.max(1, plotWidth - sidePad * 2);

                        const coords = allPoints.map((p, idx) => {
                          const x = allPoints.length === 1
                            ? plotWidth / 2
                            : sidePad + (idx / (allPoints.length - 1)) * usableWidth;
                          const ratio = Math.max(0, Math.min(1, (p.value - minVal) / valRange));
                          const y = topPad + (1 - ratio) * usableHeight;
                          return { x, y, point: p, index: idx };
                        });

                        return (
                          <>
                            {/* Area Fill under curve segments */}
                            {coords.map((curr, idx) => {
                              if (idx === coords.length - 1) return null;
                              const next = coords[idx + 1];
                              const minSegmentY = Math.min(curr.y, next.y);
                              const segmentWidth = Math.max(0, next.x - curr.x);
                              const fillHeight = Math.max(0, chartHeight - bottomPad - minSegmentY);

                              return (
                                <View
                                  key={`fill_${idx}`}
                                  style={{
                                    position: 'absolute',
                                    left: curr.x,
                                    width: segmentWidth,
                                    top: minSegmentY,
                                    height: fillHeight,
                                    backgroundColor: isDark
                                      ? 'rgba(37, 99, 235, 0.16)'
                                      : 'rgba(37, 99, 235, 0.10)',
                                    borderTopLeftRadius: 3,
                                    borderTopRightRadius: 3,
                                  }}
                                />
                              );
                            })}

                            {/* Line Segments */}
                            {coords.map((curr, idx) => {
                              if (idx === coords.length - 1) return null;
                              const next = coords[idx + 1];
                              const dx = next.x - curr.x;
                              const dy = next.y - curr.y;
                              const length = Math.sqrt(dx * dx + dy * dy);
                              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                              const midX = (curr.x + next.x) / 2;
                              const midY = (curr.y + next.y) / 2;

                              return (
                                <View
                                  key={`seg_${idx}`}
                                  style={[
                                    styles.chartLineSegment,
                                    {
                                      left: midX - length / 2,
                                      top: midY - 1.25,
                                      width: length,
                                      transform: [{ rotate: `${angle}deg` }],
                                    },
                                  ]}
                                />
                              );
                            })}

                            {/* Dots at Data Points */}
                            {coords.map((c, idx) => {
                              const isSelected = activeTooltipIdx === idx;
                              return (
                                <TouchableOpacity
                                  key={`dot_${idx}`}
                                  activeOpacity={0.7}
                                  onPress={() => setActiveTooltipIdx(isSelected ? null : idx)}
                                  hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                                  style={[
                                    styles.chartDot,
                                    isSelected && styles.chartDotActive,
                                    {
                                      left: c.x - (isSelected ? 6 : 5),
                                      top: c.y - (isSelected ? 6 : 5),
                                    },
                                  ]}
                                />
                              );
                            })}
                          </>
                        );
                      })()}
                    </View>
                  </View>

                  {/* X-axis date labels */}
                  <View style={styles.xAxisRow}>
                    <View style={{ width: 32 }} />
                    <View style={styles.xAxisLabelsArea}>
                      {allPoints.length <= 5 ? (
                        allPoints.map((p, idx) => (
                          <Text
                            key={idx}
                            style={[
                              styles.xAxisLabel,
                              isDark ? styles.subDark : styles.subLight,
                              activeTooltipIdx === idx && { color: '#2563EB', fontWeight: '700' },
                            ]}
                          >
                            {p.displayDate}
                          </Text>
                        ))
                      ) : (
                        <>
                          <Text style={[styles.xAxisLabel, isDark ? styles.subDark : styles.subLight]}>
                            {allPoints[0].displayDate}
                          </Text>
                          <Text style={[styles.xAxisLabel, isDark ? styles.subDark : styles.subLight]}>
                            {allPoints[Math.floor(allPoints.length / 2)].displayDate}
                          </Text>
                          <Text style={[styles.xAxisLabel, isDark ? styles.subDark : styles.subLight]}>
                            {allPoints[allPoints.length - 1].displayDate}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Active Tooltip Popover matching mobile web */}
                  {activeTooltipIdx !== null && allPoints[activeTooltipIdx] && (
                    <View style={[styles.tooltipBox, isDark ? styles.tooltipBoxDark : styles.tooltipBoxLight]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tooltipDate, isDark ? styles.textDark : styles.textLight]}>
                          {allPoints[activeTooltipIdx].displayDate}
                        </Text>
                        <Text style={[styles.tooltipTitle, isDark ? styles.subDark : styles.subLight]}>
                          {allPoints[activeTooltipIdx].workoutTitle}
                        </Text>
                      </View>
                      <Text style={styles.tooltipVal}>
                        {allPoints[activeTooltipIdx].value} кг ({allPoints[activeTooltipIdx].setsCount} підх.)
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Card>

            {/* 3 Metric Summary Cards in a Row - Matching mobile web version */}
            <View style={styles.kpiRow}>
              {/* Personal Best */}
              <Card style={styles.kpiCard}>
                <Ionicons name="trophy" size={16} color="#F59E0B" style={styles.kpiIcon} />
                <Text style={[styles.kpiVal, isDark ? styles.textDark : styles.textLight]}>
                  {stats.personalBest > 0 ? `${stats.personalBest} кг` : '—'}
                </Text>
                <Text style={[styles.kpiLbl, isDark ? styles.subDark : styles.subLight]}>
                  Рекорд (PR)
                </Text>
              </Card>

              {/* Est. 1RM */}
              <Card style={styles.kpiCard}>
                <Ionicons name="trending-up" size={16} color="#3B82F6" style={styles.kpiIcon} />
                <Text style={[styles.kpiVal, isDark ? styles.textDark : styles.textLight]}>
                  {stats.best1RM > 0 ? `${stats.best1RM} кг` : '—'}
                </Text>
                <Text numberOfLines={1} style={[styles.kpiLbl, isDark ? styles.subDark : styles.subLight]}>
                  Розрахунковий 1ПМ
                </Text>
              </Card>

              {/* Total Sets */}
              <Card style={styles.kpiCard}>
                <Ionicons name="barbell" size={16} color="#10B981" style={styles.kpiIcon} />
                <Text style={[styles.kpiVal, isDark ? styles.textDark : styles.textLight]}>
                  {stats.totalSets}
                </Text>
                <Text style={[styles.kpiLbl, isDark ? styles.subDark : styles.subLight]}>
                  Всього підходів
                </Text>
              </Card>
            </View>

            {/* Progress Analytics Section - Matching mobile web version */}
            <Text style={[styles.sectionHeading, isDark ? styles.subDark : styles.subLight]}>
              АНАЛІТИКА ПРОГРЕСУ
            </Text>

            <Card style={styles.analyticsCard}>
              {/* Header: Dumbbell + Прогрес */}
              <View style={styles.analyticsTitleRow}>
                <Ionicons name="barbell-outline" size={17} color="#3B82F6" />
                <Text style={[styles.analyticsTitle, isDark ? styles.textDark : styles.textLight]}>
                  Прогрес
                </Text>
              </View>

              <Text style={[styles.analyticsDesc, isDark ? styles.subDark : styles.subLight]}>
                Ви тренували цю вправу{' '}
                <Text style={[styles.boldText, isDark ? styles.textDark : styles.textLight]}>
                  {allPoints.length}
                </Text>{' '}
                {formatRazy(allPoints.length)} за весь час.
              </Text>

              {/* Last 5 Sessions Table */}
              <View style={styles.sessionsTableSection}>
                <Text style={[styles.tableSubheader, isDark ? styles.textDark : styles.textLight]}>
                  Останні 5 тренувань
                </Text>

                {last5Sessions.length === 0 ? (
                  <Text style={[styles.noSessionsText, isDark ? styles.subDark : styles.subLight]}>
                    Ще немає записів
                  </Text>
                ) : (
                  <View style={styles.tableContainer}>
                    {/* Header Row */}
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
                      const isExpanded = expandedSessionIdx === sIdx;

                      return (
                        <View key={sIdx} style={styles.rowWrapper}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setExpandedSessionIdx(isExpanded ? null : sIdx)}
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
                              {session.maxWeight > 0 ? `${session.maxWeight} кг` : '—'}
                            </Text>

                            <Text style={[styles.colVolume, styles.cellVolumeText, isDark ? styles.subDark : styles.subLight]}>
                              {session.volumeTons > 0 ? `${session.volumeTons} т` : '0'}
                            </Text>
                          </TouchableOpacity>

                          {/* Expanded Sets Details - Grid of cards matching web version */}
                          {isExpanded && session.sets.length > 0 && (
                            <View style={[styles.expandedSetsBox, isDark ? styles.expandedBoxDark : styles.expandedBoxLight]}>
                              <Text style={[styles.expandedHeading, isDark ? styles.subDark : styles.subLight]}>
                                ВИКОНАНІ ПІДХОДИ:
                              </Text>
                              <View style={styles.setsGrid}>
                                {session.sets.map((set, setIdx) => (
                                  <View
                                    key={setIdx}
                                    style={[styles.setCard, isDark ? styles.setCardDark : styles.setCardLight]}
                                  >
                                    <Text style={[styles.setCardNum, isDark ? styles.subDark : styles.subLight]}>
                                      Сет {set.setNumber || setIdx + 1}
                                    </Text>
                                    <Text style={[styles.setCardVal, isDark ? styles.textDark : styles.textLight]}>
                                      {set.weight} кг × {set.actualReps}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </Card>

            {/* Achievement Card matching mobile web version */}
            {stats.isNewPrInLatest && (
              <View style={[styles.recordBanner, isDark ? styles.recordBannerDark : styles.recordBannerLight]}>
                <Ionicons name="trophy" size={20} color="#F59E0B" />
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

        {/* Instagram-style Floating Top Header Bar */}
        <Animated.View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - topBarHeight) > 2) {
              setTopBarHeight(h);
            }
          }}
          style={[
            styles.topBar,
            isDark ? styles.borderDark : styles.borderLight,
            isDark ? styles.topBarDark : styles.topBarLight,
            Platform.OS === 'web' && ({ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any),
            {
              paddingTop: Math.max(insets.top, 0),
              transform: [{
                translateY: topBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -topBarHeight],
                  extrapolate: 'clamp',
                }),
              }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleBack}
            style={styles.iconBtn}
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
        </Animated.View>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topBarLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomColor: '#E2E8F0',
  },
  topBarDark: {
    backgroundColor: 'rgba(11, 18, 32, 0.95)',
    borderBottomColor: '#334155',
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
    fontWeight: '600',
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
    paddingTop: 68,
    gap: 14,
    paddingBottom: 48,
  },
  heroSection: {
    marginTop: 2,
    marginBottom: 2,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  heroVal: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroUnit: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  dateRangeText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
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
    fontSize: 10,
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
    height: 2.5,
    backgroundColor: '#2563EB',
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
    borderWidth: 2,
    borderColor: '#2563EB',
    zIndex: 3,
  },
  chartDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
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
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tooltipBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tooltipBoxLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  tooltipBoxDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  tooltipDate: {
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipTitle: {
    fontSize: 11,
    marginTop: 1,
  },
  tooltipVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  kpiIcon: {
    marginBottom: 1,
  },
  kpiVal: {
    fontSize: 14,
    fontWeight: '800',
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
    marginTop: 2,
    paddingHorizontal: 2,
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
    fontSize: 15,
    fontWeight: '700',
  },
  analyticsDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  sessionsTableSection: {
    paddingTop: 4,
  },
  tableSubheader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  noSessionsText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  tableContainer: {
    marginTop: 2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  tableBorderLight: {
    borderBottomColor: '#E2E8F0',
  },
  tableBorderDark: {
    borderBottomColor: 'rgba(51, 65, 85, 0.6)',
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '600',
  },
  rowWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.25)',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
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
    textAlign: 'right',
  },
  colVolume: {
    flex: 1,
    textAlign: 'right',
  },
  cellDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cellSetsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cellWeightText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cellVolumeText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  expandedSetsBox: {
    padding: 10,
    borderRadius: 14,
    marginBottom: 8,
    gap: 6,
  },
  expandedBoxLight: {
    backgroundColor: '#F1F5F9',
  },
  expandedBoxDark: {
    backgroundColor: 'rgba(38, 49, 64, 0.6)',
  },
  expandedHeading: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  setsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  setCard: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 84,
  },
  setCardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  setCardDark: {
    backgroundColor: '#1D2939',
    borderColor: '#334155',
  },
  setCardNum: {
    fontSize: 9,
  },
  setCardVal: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  recordBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 2,
  },
  recordBannerLight: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  recordBannerDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  recordBannerContent: {
    flex: 1,
  },
  recordBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
  },
  recordBannerDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  recordBannerDescLight: {
    color: '#92400E',
  },
  recordBannerDescDark: {
    color: '#FDE68A',
  },
});
