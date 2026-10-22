import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Card } from './Card';
import { WorkoutService } from '../services/workoutService';
import { MuscleGroup, MUSCLE_GROUPS, PastExercisePerformance } from '../types/workout';
import { calculate1RM } from '../utils/workout';

export interface ExerciseDetailModalProps {
  visible: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseName: string;
  muscleGroup?: MuscleGroup;
  userId: string;
}

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

export const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({
  visible,
  onClose,
  exerciseId,
  exerciseName,
  muscleGroup = 'other',
  userId,
}) => {
  const isDark = useColorScheme() === 'dark';
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PastExercisePerformance[]>([]);
  const [activeTooltipIdx, setActiveTooltipIdx] = useState<number | null>(null);

  const muscleInfo = MUSCLE_GROUPS[muscleGroup] || MUSCLE_GROUPS.full_body;

  useEffect(() => {
    if (!visible || !exerciseId) return;

    let isMounted = true;
    setLoading(true);

    WorkoutService.getAllPastPerformances(userId, exerciseId, exerciseName).then((data) => {
      if (isMounted) {
        setHistory(data);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [visible, exerciseId, exerciseName, userId]);

  // Format date helper: YYYY-MM-DD -> DD/MM
  const parseDate = (dStr: string): Date => {
    if (!dStr) return new Date();
    const parts = dStr.split('T')[0].split('-').map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(dStr);
  };

  const formatShortDate = (date: Date): string => {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${d}/${m}`;
  };

  const formatLongDateUk = (date: Date): string => {
    const months = [
      'січ', 'лют', 'бер', 'квіт', 'трав', 'черв',
      'лип', 'серп', 'вер', 'жовт', 'лист', 'груд',
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Process data chronologically from first day to current day
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
  }, [history]);

  // Overall Stats across all time
  const stats = useMemo(() => {
    if (allPoints.length === 0) {
      return {
        avgWeight: 0,
        dateRangeText: 'Немає даних',
        personalBest: 0,
        best1RM: 0,
        totalSets: 0,
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

    return {
      avgWeight,
      dateRangeText,
      personalBest,
      best1RM,
      totalSets,
    };
  }, [allPoints]);

  // Last 5 Sessions (newest first)
  const last5Sessions = useMemo(() => {
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
  }, [history]);

  // Chart math
  const chartHeight = 150;
  const values = allPoints.map((p) => p.maxWeight);
  let minVal = values.length > 0 ? Math.min(...values) : 0;
  let maxVal = values.length > 0 ? Math.max(...values) : 100;
  if (minVal === maxVal) {
    minVal = Math.max(0, minVal - 10);
    maxVal = maxVal + 10;
  }
  const valRange = maxVal - minVal || 1;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}
      >
        {/* Top Header Bar - Exact Workout Style */}
        <View style={[styles.topBar, isDark ? styles.borderDark : styles.borderLight]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onClose}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={isDark ? '#f8fafc' : '#0f172a'}
            />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text
              numberOfLines={1}
              style={[styles.headerTitle, isDark ? styles.textDark : styles.textLight]}
            >
              {exerciseName}
            </Text>
            <Text style={[styles.headerSub, isDark ? styles.subDark : styles.subLight]}>
              {muscleInfo.nameUk}
            </Text>
          </View>

          <View style={{ width: 32 }} />
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
            <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
              Завантаження аналітики вправи...
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Status & Overview Card - Matching Workout Overview */}
            <Card style={styles.overviewCard}>
              <View style={styles.statusRow}>
                <View style={[styles.statusPill, styles.statusCompleted]}>
                  <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
                  <Text style={[styles.statusText, { color: '#22c55e' }]}>
                    Вправа каталогу
                  </Text>
                </View>

                <View style={[styles.badgePill, isDark ? styles.badgePillDark : styles.badgePillLight]}>
                  <Ionicons name="barbell-outline" size={13} color={isDark ? '#60a5fa' : '#2563eb'} />
                  <Text style={[styles.badgeText, isDark ? styles.badgeTextDark : styles.badgeTextLight]}>
                    {muscleInfo.nameUk}
                  </Text>
                </View>
              </View>

              {/* Metrics Summary Row with Dividers */}
              <View style={styles.metricsSummaryRow}>
                <View style={styles.metricSummaryItem}>
                  <Text style={[styles.summaryVal, isDark ? styles.textDark : styles.textLight]}>
                    {stats.personalBest > 0 ? `${stats.personalBest} кг` : '—'}
                  </Text>
                  <Text style={[styles.summaryLbl, isDark ? styles.subDark : styles.subLight]}>
                    Рекорд (PR)
                  </Text>
                </View>

                <View style={[styles.summaryDivider, isDark ? styles.borderDark : styles.borderLight]} />

                <View style={styles.metricSummaryItem}>
                  <Text style={[styles.summaryVal, isDark ? styles.textDark : styles.textLight]}>
                    {stats.best1RM > 0 ? `${stats.best1RM} кг` : '—'}
                  </Text>
                  <Text style={[styles.summaryLbl, isDark ? styles.subDark : styles.subLight]}>
                    Розрахунковий 1ПМ
                  </Text>
                </View>

                <View style={[styles.summaryDivider, isDark ? styles.borderDark : styles.borderLight]} />

                <View style={styles.metricSummaryItem}>
                  <Text style={[styles.summaryVal, isDark ? styles.textDark : styles.textLight]}>
                    {stats.totalSets}
                  </Text>
                  <Text style={[styles.summaryLbl, isDark ? styles.subDark : styles.subLight]}>
                    Підходів
                  </Text>
                </View>
              </View>
            </Card>

            {/* Chart Card in Workout Card Style */}
            <Card style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chartTitle, isDark ? styles.textDark : styles.textLight]}>
                    Динаміка максимальної ваги
                  </Text>
                  <Text style={[styles.chartSub, isDark ? styles.subDark : styles.subLight]}>
                    {stats.dateRangeText}
                  </Text>
                </View>
                {stats.avgWeight > 0 && (
                  <View style={[styles.avgBadge, isDark ? styles.avgBadgeDark : styles.avgBadgeLight]}>
                    <Text style={[styles.avgBadgeText, isDark ? styles.badgeTextDark : styles.badgeTextLight]}>
                      Сер: {stats.avgWeight} кг
                    </Text>
                  </View>
                )}
              </View>

              {allPoints.length === 0 ? (
                <View style={styles.chartEmpty}>
                  <Ionicons name="barbell-outline" size={32} color={isDark ? '#64748b' : '#94a3b8'} />
                  <Text style={[styles.chartEmptyText, isDark ? styles.subDark : styles.subLight]}>
                    Немає даних для побудови графіка
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 12 }}>
                  {/* Chart Grid and Bars */}
                  <View style={[styles.chartArea, { height: chartHeight }]}>
                    <View style={styles.gridLinesContainer}>
                      <View style={[styles.gridLine, isDark ? styles.lineDark : styles.lineLight]} />
                      <View style={[styles.gridLine, isDark ? styles.lineDark : styles.lineLight]} />
                      <View style={[styles.gridLine, isDark ? styles.lineDark : styles.lineLight]} />
                    </View>

                    <View style={styles.pointsRow}>
                      {allPoints.map((p, idx) => {
                        const ratio = Math.max(0.1, (p.maxWeight - minVal) / valRange);
                        const isSelected = activeTooltipIdx === idx;

                        return (
                          <TouchableOpacity
                            key={idx}
                            activeOpacity={0.7}
                            onPress={() => setActiveTooltipIdx(isSelected ? null : idx)}
                            style={styles.pointCol}
                          >
                            <View style={styles.barTrack}>
                              <View
                                style={[
                                  styles.barFill,
                                  {
                                    height: `${Math.round(ratio * 100)}%`,
                                    backgroundColor: isSelected
                                      ? '#2563eb'
                                      : isDark
                                      ? 'rgba(96, 165, 250, 0.45)'
                                      : 'rgba(37, 99, 235, 0.35)',
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.pointDot,
                                    isSelected && styles.pointDotActive,
                                    { borderColor: isDark ? '#1d2939' : '#ffffff' },
                                  ]}
                                />
                              </View>
                            </View>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.pointDateLabel,
                                isDark ? styles.subDark : styles.subLight,
                                isSelected && { color: isDark ? '#60a5fa' : '#2563eb', fontWeight: '700' },
                              ]}
                            >
                              {p.displayDate}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Active Tooltip Popover */}
                  {activeTooltipIdx !== null && allPoints[activeTooltipIdx] && (
                    <View style={[styles.tooltipBox, isDark ? styles.tooltipDark : styles.tooltipLight]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tooltipDate, isDark ? styles.textDark : styles.textLight]}>
                          {allPoints[activeTooltipIdx].workoutTitle}
                        </Text>
                        <Text style={[styles.tooltipSub, isDark ? styles.subDark : styles.subLight]}>
                          {allPoints[activeTooltipIdx].displayDate} • {allPoints[activeTooltipIdx].setsCount} підходів
                        </Text>
                      </View>
                      <Text style={styles.tooltipVal}>
                        {allPoints[activeTooltipIdx].maxWeight} кг
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Card>

            {/* Workout History Sessions Section Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, isDark ? styles.textDark : styles.textLight]}>
                Останні тренування ({last5Sessions.length})
              </Text>
            </View>

            {/* List of Sessions in Exact Workout ExerciseCard Style */}
            {last5Sessions.length === 0 ? (
              <Card style={styles.emptyExercisesCard}>
                <Ionicons name="barbell-outline" size={36} color={isDark ? '#334155' : '#94a3b8'} />
                <Text style={[styles.emptyExercisesTitle, isDark ? styles.textDark : styles.textLight]}>
                  У вас ще немає збережених підходів
                </Text>
                <Text style={[styles.emptyExercisesDesc, isDark ? styles.subDark : styles.subLight]}>
                  Додайте цю вправу до тренування та запишіть підходи, щоб відстежувати прогрес.
                </Text>
              </Card>
            ) : (
              last5Sessions.map((session, sIndex) => (
                <Card key={session.workoutId || `sess_${sIndex}`} style={styles.exerciseCard}>
                  {/* Workout Session Header */}
                  <View style={styles.exHeader}>
                    <View
                      style={[
                        styles.exIndexCircle,
                        isDark ? styles.exIndexCircleDark : styles.exIndexCircleLight,
                      ]}
                    >
                      <Text
                        style={[
                          styles.exIndexText,
                          isDark ? styles.textPrimaryDark : styles.textPrimaryLight,
                        ]}
                      >
                        {sIndex + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.exTitle, isDark ? styles.textDark : styles.textLight]}>
                        {session.workoutTitle}
                      </Text>
                      <View style={styles.sessionMetaRow}>
                        <Text style={[styles.sessionDate, isDark ? styles.subDark : styles.subLight]}>
                          {formatLongDateUk(parseDate(session.date))}
                        </Text>
                        <Text style={[styles.sessionDot, isDark ? styles.subDark : styles.subLight]}>•</Text>
                        <Text style={[styles.sessionMaxWeight, { color: isDark ? '#60a5fa' : '#2563eb' }]}>
                          Макс: {session.maxWeight} кг
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.setsCountPill, isDark ? styles.setsCountPillDark : styles.setsCountPillLight]}>
                      <Text style={[styles.setsCountText, isDark ? styles.textDark : styles.textLight]}>
                        {session.setsCount} {session.setsCount === 1 ? 'підхід' : session.setsCount >= 2 && session.setsCount <= 4 ? 'підходи' : 'підходів'}
                      </Text>
                    </View>
                  </View>

                  {/* Sets Table - EXACTLY matching WorkoutDetailScreen */}
                  {session.sets && session.sets.length > 0 && (
                    <View style={styles.setsTable}>
                      <View style={[styles.setsTableHeader, isDark ? styles.rowBorderDark : styles.rowBorderLight]}>
                        <Text style={[styles.colHeader, styles.colSet, isDark ? styles.subDark : styles.subLight]}>Сет</Text>
                        <Text style={[styles.colHeader, styles.colWeight, isDark ? styles.subDark : styles.subLight]}>Вага</Text>
                        <Text style={[styles.colHeader, styles.colReps, isDark ? styles.subDark : styles.subLight]}>Повт.</Text>
                        <Text style={[styles.colHeader, styles.colStatus, isDark ? styles.subDark : styles.subLight]}>Статус</Text>
                      </View>

                      {session.sets.map((s, sIndex) => {
                        return (
                          <View
                            key={`set_${s.setNumber || sIndex}`}
                            style={[
                              styles.setRow,
                              sIndex > 0 && (isDark ? styles.rowBorderDark : styles.rowBorderLight),
                            ]}
                          >
                            <View style={styles.colSet}>
                              <Text style={[styles.setNum, isDark ? styles.textDark : styles.textLight]}>
                                {s.setNumber || sIndex + 1}
                              </Text>
                            </View>
                            <View style={styles.colWeight}>
                              <Text style={[styles.setVal, isDark ? styles.textDark : styles.textLight]}>
                                {s.weight ? `${s.weight} кг` : '—'}
                              </Text>
                            </View>
                            <View style={styles.colReps}>
                              <Text style={[styles.setVal, isDark ? styles.textDark : styles.textLight]}>
                                {s.actualReps !== null && s.actualReps !== undefined
                                  ? s.actualReps
                                  : s.targetRepsRange || '—'}
                              </Text>
                            </View>
                            <View style={styles.colStatus}>
                              <Ionicons
                                name="checkmark-circle"
                                size={18}
                                color="#22c55e"
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Card>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  overviewCard: {
    padding: 16,
    gap: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgePillLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  badgePillDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderColor: 'rgba(37, 99, 235, 0.35)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextLight: {
    color: '#2563eb',
  },
  badgeTextDark: {
    color: '#60a5fa',
  },
  metricsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  metricSummaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryVal: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryLbl: {
    fontSize: 11,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    borderRightWidth: 1,
  },
  chartCard: {
    padding: 16,
    gap: 10,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  chartSub: {
    fontSize: 12,
    marginTop: 2,
  },
  avgBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  avgBadgeLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  avgBadgeDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderColor: 'rgba(37, 99, 235, 0.35)',
  },
  avgBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chartEmpty: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chartEmptyText: {
    fontSize: 12,
  },
  chartArea: {
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  gridLinesContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  gridLine: {
    height: 1,
    width: '100%',
  },
  lineLight: {
    backgroundColor: '#f1f5f9',
  },
  lineDark: {
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
    paddingBottom: 18,
  },
  pointCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    paddingHorizontal: 2,
  },
  barTrack: {
    width: 14,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: 6,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginTop: -4,
    borderWidth: 1.5,
  },
  pointDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: -6,
    borderWidth: 2,
    backgroundColor: '#2563eb',
  },
  pointDateLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  tooltipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
  },
  tooltipLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  tooltipDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  tooltipDate: {
    fontSize: 12,
    fontWeight: '700',
  },
  tooltipSub: {
    fontSize: 11,
    marginTop: 1,
  },
  tooltipVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
  },
  sectionHeaderRow: {
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyExercisesCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderStyle: 'dashed',
  },
  emptyExercisesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyExercisesDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  exerciseCard: {
    padding: 16,
    gap: 12,
  },
  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exIndexCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exIndexCircleLight: {
    backgroundColor: '#2563eb',
  },
  exIndexCircleDark: {
    backgroundColor: '#60a5fa',
  },
  exIndexText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textPrimaryLight: {
    color: '#ffffff',
  },
  textPrimaryDark: {
    color: '#0b1220',
  },
  exTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  sessionDate: {
    fontSize: 12,
  },
  sessionDot: {
    fontSize: 12,
  },
  sessionMaxWeight: {
    fontSize: 12,
    fontWeight: '600',
  },
  setsCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  setsCountPillLight: {
    backgroundColor: '#f1f5f9',
  },
  setsCountPillDark: {
    backgroundColor: '#263140',
  },
  setsCountText: {
    fontSize: 11,
    fontWeight: '500',
  },
  setsTable: {
    marginTop: 4,
  },
  setsTableHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  colHeader: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  colSet: {
    width: 50,
  },
  colWeight: {
    flex: 1,
  },
  colReps: {
    width: 70,
  },
  colStatus: {
    width: 40,
    alignItems: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowBorderLight: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  rowBorderDark: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  setNum: {
    fontSize: 13,
    fontWeight: '600',
  },
  warmupTag: {
    fontSize: 10,
    color: '#60a5fa',
  },
  setVal: {
    fontSize: 13,
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
  borderLight: {
    borderColor: '#e2e8f0',
  },
  borderDark: {
    borderColor: '#334155',
  },
});
