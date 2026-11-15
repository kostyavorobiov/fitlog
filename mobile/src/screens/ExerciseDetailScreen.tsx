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
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/Card';
import { ScreenGestureWrapper } from '../components/ScreenGestureWrapper';
import { setSavedActiveTab, getSavedActiveTab, TabName } from '../components/InstagramTabPager';
import { useAuth } from '../context/AuthContext';
import { WorkoutService } from '../services/workoutService';
import { ExerciseService } from '../services/exerciseService';
import { MuscleGroup, MUSCLE_GROUPS, PastExercisePerformance, PastExerciseSetSummary, getMuscleGroupInfo } from '../types/workout';
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
  const { theme, colors, isDark } = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const {
    id: exerciseId,
    name: initialName,
    muscleGroup: initialMuscleGroup,
    fromTab,
    traineeId,
    traineeName,
  } = useLocalSearchParams<{
    id: string;
    name?: string;
    muscleGroup?: MuscleGroup;
    fromTab?: TabName | 'trainees';
    traineeId?: string;
    traineeName?: string;
  }>();

  const sourceTab = fromTab || 'exercises';
  const effectiveUserId = traineeId || user?.id || '';

  const [loading, setLoading] = useState(true);
  const [exerciseName, setExerciseName] = useState<string>(initialName || '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(initialMuscleGroup || 'other');
  const [history, setHistory] = useState<PastExercisePerformance[]>([]);
  const [expandedSessionIdx, setExpandedSessionIdx] = useState<number | null>(null);
  const [activeTooltipIdx, setActiveTooltipIdx] = useState<number | null>(null);
  const [plotWidth, setPlotWidth] = useState<number>(0);

  // When exiting, guarantee that source tab (e.g. analytics, trainees, or exercises) opens
  const handleBack = useCallback(() => {
    if (sourceTab === 'trainees') {
      setSavedActiveTab('profile');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/trainees');
      }
      return;
    }

    setSavedActiveTab(sourceTab as TabName);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(sourceTab === 'analytics' ? '/(tabs)/analytics' : '/(tabs)/exercises');
    }
  }, [router, sourceTab]);

  const insets = useSafeAreaInsets();
  const topBarAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isTopBarVisibleRef = useRef(true);
  const accumulatedDown = useRef(0);
  const accumulatedUp = useRef(0);
  const [topBarHeight, setTopBarHeight] = useState(56);

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
            useNativeDriver: false,
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
              useNativeDriver: false,
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
              useNativeDriver: false,
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
    if (sourceTab !== 'trainees') {
      setSavedActiveTab(sourceTab);
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => {
      if (sourceTab !== 'trainees') {
        setSavedActiveTab(sourceTab);
      }
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
    if (!effectiveUserId || !exerciseId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    WorkoutService.getAllPastPerformances(effectiveUserId, exerciseId, exerciseName).then((data) => {
      if (isMounted) {
        setHistory(data);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [effectiveUserId, exerciseId, exerciseName]);

  const muscleInfo = getMuscleGroupInfo(muscleGroup);

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
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Top Header Bar */}
        <Animated.View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - topBarHeight) > 2) {
              setTopBarHeight(h);
            }
          }}
          style={[
            styles.topBar,
            {
              backgroundColor: colors.bg,
              marginTop: topBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -topBarHeight],
              }),
              opacity: topBarAnim.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 0.2, 0],
              }),
              overflow: 'hidden',
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleBack}
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text numberOfLines={1} style={[styles.topBarTitle, { color: colors.text }]}>
              {exerciseName || 'Вправа'}
            </Text>
            <Text style={[styles.topBarSub, { color: colors.textSecondary }]}>
              {traineeName ? `Підопічний: ${traineeName} · ${muscleInfo.nameUk}` : muscleInfo.nameUk}
            </Text>
          </View>
        </Animated.View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
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
            {/* Hero 1RM Card - Design from Page 13 */}
            <View style={[styles.heroCard, { backgroundColor: colors.heroCardBg }]}>
              <Text style={[styles.heroCardLabel, { color: colors.heroCardText }]}>
                РОЗРАХУНКОВИЙ 1ПМ
              </Text>
              <View style={styles.heroCardRow}>
                <Text style={[styles.heroCardVal, { color: colors.heroCardText }]}>
                  {stats.best1RM > 0 ? stats.best1RM : '—'}
                </Text>
                <Text style={[styles.heroCardUnit, { color: colors.heroCardText }]}>
                  кг
                </Text>
              </View>
            </View>

            {/* 3 Metric Summary Cards in a Row: РЕКОРД, СЕРЕДНЄ, ПІДХОДІВ */}
            <View style={styles.kpiRow}>
              {/* Record (PR) */}
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiLbl, { color: colors.textSecondary }]}>
                  РЕКОРД
                </Text>
                <View style={styles.kpiValRow}>
                  <Text style={[styles.kpiVal, { color: colors.text }]}>
                    {stats.personalBest > 0 ? stats.personalBest : '—'}
                  </Text>
                  <Text style={[styles.kpiUnit, { color: colors.textSecondary }]}>
                    {' '}кг
                  </Text>
                </View>
              </Card>

              {/* Average Weight */}
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiLbl, { color: colors.textSecondary }]}>
                  СЕРЕДНЄ
                </Text>
                <View style={styles.kpiValRow}>
                  <Text style={[styles.kpiVal, { color: colors.text }]}>
                    {stats.avgWeight > 0 ? stats.avgWeight : '—'}
                  </Text>
                  <Text style={[styles.kpiUnit, { color: colors.textSecondary }]}>
                    {' '}кг
                  </Text>
                </View>
              </Card>

              {/* Total Sets */}
              <Card style={styles.kpiCard}>
                <Text style={[styles.kpiLbl, { color: colors.textSecondary }]}>
                  ПІДХОДІВ
                </Text>
                <Text style={[styles.kpiVal, { color: colors.text }]}>
                  {stats.totalSets}
                </Text>
              </Card>
            </View>

            {/* Interactive Chart Card - Design from Page 13 */}
            <Card style={styles.chartCard}>
              <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                ВАГА ПО ТРЕНУВАННЯХ
              </Text>

              {allPoints.length === 0 ? (
                <View style={styles.chartEmpty}>
                  <Ionicons name="barbell-outline" size={32} color={colors.textSecondary} />
                  <Text style={[styles.chartEmptyText, { color: colors.textSecondary }]}>
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
                          style={[styles.yAxisLabel, { color: colors.textSecondary }]}
                        >
                          {tick}
                        </Text>
                      ))}
                    </View>

                    {/* Chart Plot Area */}
                    <View style={[styles.plotArea, { height: chartHeight }]} onLayout={onChartLayout}>
                      {/* Grid lines */}
                      <View style={StyleSheet.absoluteFill}>
                        {yTicks.map((_, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.gridLine,
                              { backgroundColor: colors.cardBorder },
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
                                      backgroundColor: colors.accent,
                                      left: midX - length / 2,
                                      top: midY - 1.5,
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
                                    {
                                      borderColor: colors.accent,
                                      backgroundColor: colors.card,
                                      left: c.x - (isSelected ? 7 : 5),
                                      top: c.y - (isSelected ? 7 : 5),
                                      width: isSelected ? 14 : 10,
                                      height: isSelected ? 14 : 10,
                                      borderRadius: isSelected ? 7 : 5,
                                      borderWidth: isSelected ? 3.5 : 2.5,
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
                              { color: colors.textSecondary },
                              activeTooltipIdx === idx && { color: colors.accent, fontWeight: '700' },
                            ]}
                          >
                            {p.displayDate}
                          </Text>
                        ))
                      ) : (
                        <>
                          <Text style={[styles.xAxisLabel, { color: colors.textSecondary }]}>
                            {allPoints[0].displayDate}
                          </Text>
                          <Text style={[styles.xAxisLabel, { color: colors.textSecondary }]}>
                            {allPoints[Math.floor(allPoints.length / 2)].displayDate}
                          </Text>
                          <Text style={[styles.xAxisLabel, { color: colors.textSecondary }]}>
                            {allPoints[allPoints.length - 1].displayDate}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Active Tooltip Popover */}
                  {activeTooltipIdx !== null && allPoints[activeTooltipIdx] && (
                    <View style={[styles.tooltipBox, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tooltipDate, { color: colors.text }]}>
                          {allPoints[activeTooltipIdx].displayDate}
                        </Text>
                        <Text style={[styles.tooltipTitle, { color: colors.textSecondary }]}>
                          {allPoints[activeTooltipIdx].workoutTitle}
                        </Text>
                      </View>
                      <Text style={[styles.tooltipVal, { color: colors.accent }]}>
                        {allPoints[activeTooltipIdx].value} кг ({allPoints[activeTooltipIdx].setsCount} підх.)
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Card>

            {/* Recent Sessions Card - Design from Page 13 */}
            <Card style={styles.analyticsCard}>
              <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                ОСТАННІ ТРЕНУВАННЯ
              </Text>

              <View style={styles.sessionsTableSection}>
                {last5Sessions.length === 0 ? (
                  <Text style={[styles.noSessionsText, { color: colors.textSecondary }]}>
                    Ще немає записів
                  </Text>
                ) : (
                  <View style={styles.tableContainer}>
                    {/* Table Rows */}
                    {last5Sessions.map((session, sIdx) => {
                      const isExpanded = expandedSessionIdx === sIdx;

                      return (
                        <View key={sIdx} style={[styles.rowWrapper, { borderBottomColor: colors.cardBorder }]}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setExpandedSessionIdx(isExpanded ? null : sIdx)}
                            style={styles.tableRow}
                          >
                            <View style={[styles.colDate, styles.dateColRow]}>
                              <Text style={[styles.cellDateText, { color: colors.textSecondary }]}>
                                {session.displayDate}
                              </Text>
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={12}
                                color={colors.textSecondary}
                                style={{ marginLeft: 4 }}
                              />
                            </View>

                            <Text style={[styles.colSets, styles.cellSetsText, { color: colors.text }]}>
                              {session.setsCount} підх.
                            </Text>

                            <Text style={[styles.colWeight, styles.cellWeightText, { color: colors.text }]}>
                              {session.maxWeight > 0 ? `${session.maxWeight} кг` : '—'}
                            </Text>

                            <Text style={[styles.colVolume, styles.cellVolumeText, { color: colors.textSecondary }]}>
                              {session.volumeTons > 0 ? `${session.volumeTons} т` : '0 т'}
                            </Text>
                          </TouchableOpacity>

                          {/* Expanded Sets Details */}
                          {isExpanded && session.sets.length > 0 && (
                            <View style={[styles.expandedSetsBox, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}>
                              <Text style={[styles.expandedHeading, { color: colors.textSecondary }]}>
                                ВИКОНАНІ ПІДХОДИ:
                              </Text>
                              <View style={styles.setsGrid}>
                                {session.sets.map((set, setIdx) => (
                                  <View
                                    key={setIdx}
                                    style={[styles.setCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                                  >
                                    <Text style={[styles.setCardNum, { color: colors.textSecondary }]}>
                                      Сет {set.setNumber || setIdx + 1}
                                    </Text>
                                    <Text style={[styles.setCardVal, { color: colors.text }]}>
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

            {/* Achievement Card */}
            {stats.isNewPrInLatest && (
              <View style={[styles.recordBanner, { backgroundColor: isDark ? 'rgba(242, 201, 76, 0.12)' : 'rgba(37, 99, 235, 0.12)', borderColor: colors.accent }]}>
                <Ionicons name="trophy" size={20} color={colors.accent} />
                <View style={styles.recordBannerContent}>
                  <Text style={[styles.recordBannerTitle, { color: colors.accent }]}>Особистий рекорд!</Text>
                  <Text style={[styles.recordBannerDesc, { color: colors.text }]}>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  topBarSub: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
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
    gap: 12,
    paddingBottom: 48,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    justifyContent: 'center',
  },
  heroCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroCardRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroCardVal: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  heroCardUnit: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 6,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
    gap: 4,
  },
  kpiLbl: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  kpiUnit: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  chartCard: {
    padding: 18,
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
    gap: 12,
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
  chartLineSegment: {
    position: 'absolute',
    height: 3,
    borderRadius: 1.5,
  },
  chartDot: {
    position: 'absolute',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  analyticsCard: {
    padding: 18,
    borderRadius: 20,
  },
  sessionsTableSection: {
    paddingTop: 2,
  },
  noSessionsText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  tableContainer: {
    marginTop: 2,
  },
  rowWrapper: {
    borderBottomWidth: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dateColRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colDate: {
    flex: 1.2,
  },
  colSets: {
    flex: 1,
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
    fontSize: 14,
    fontWeight: '600',
  },
  cellSetsText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cellWeightText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cellVolumeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  expandedSetsBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 8,
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
  recordBannerContent: {
    flex: 1,
  },
  recordBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  recordBannerDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
});
