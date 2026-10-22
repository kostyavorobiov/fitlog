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
  const [expandedSessionIdx, setExpandedSessionIdx] = useState<number | null>(null);

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

  // Process data from first day to current day (chronologically ascending)
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

    const latest = allPoints[allPoints.length - 1];
    const isNewPrInLatest = latest.maxWeight >= personalBest && personalBest > 0;

    return {
      avgWeight,
      dateRangeText,
      personalBest,
      best1RM,
      totalSets,
      isNewPrInLatest,
    };
  }, [allPoints]);

  // Last 5 Sessions for table
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

  // Chart min/max scaling
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
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}
      >
        {/* Top Header */}
        <View style={[styles.header, isDark ? styles.borderDark : styles.borderLight]}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.backBtn, isDark ? styles.btnDark : styles.btnLight]}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={isDark ? '#F8FAFC' : '#0F172A'} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
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

          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
              Завантаження аналітики...
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Average Weight Above Chart */}
            <View style={styles.avgSection}>
              <Text style={[styles.avgLabel, isDark ? styles.subDark : styles.subLight]}>
                Середнє
              </Text>
              <View style={styles.avgRow}>
                <Text style={[styles.avgValue, isDark ? styles.textDark : styles.textLight]}>
                  {stats.avgWeight}
                </Text>
                <Text style={[styles.avgUnit, isDark ? styles.subDark : styles.subLight]}>
                  кг
                </Text>
              </View>
              <Text style={[styles.dateRangeText, isDark ? styles.subDark : styles.subLight]}>
                {stats.dateRangeText}
              </Text>
            </View>

            {/* Area Chart (from first day to current day) */}
            <Card style={styles.chartCard}>
              {allPoints.length === 0 ? (
                <View style={styles.chartEmpty}>
                  <Ionicons name="barbell-outline" size={32} color={isDark ? '#64748b' : '#94a3b8'} />
                  <Text style={[styles.chartEmptyText, isDark ? styles.subDark : styles.subLight]}>
                    Немає даних для побудови графіка
                  </Text>
                </View>
              ) : (
                <View>
                  {/* Grid container with vertical bars and dots */}
                  <View style={[styles.chartArea, { height: chartHeight }]}>
                    {/* Horizontal Guideline Lines */}
                    <View style={styles.gridLinesContainer}>
                      <View style={[styles.gridLine, isDark ? styles.lineDark : styles.lineLight]} />
                      <View style={[styles.gridLine, isDark ? styles.lineDark : styles.lineLight]} />
                      <View style={[styles.gridLine, isDark ? styles.lineDark : styles.lineLight]} />
                    </View>

                    {/* Columns representing points */}
                    <View style={styles.pointsRow}>
                      {allPoints.map((p, idx) => {
                        const ratio = Math.max(0.08, (p.maxWeight - minVal) / valRange);
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
                                      ? 'rgba(37, 99, 235, 0.4)'
                                      : 'rgba(37, 99, 235, 0.25)',
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.pointDot,
                                    isSelected && styles.pointDotActive,
                                  ]}
                                />
                              </View>
                            </View>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.pointDateLabel,
                                isDark ? styles.subDark : styles.subLight,
                              ]}
                            >
                              {p.displayDate}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Active Tooltip Details */}
                  {activeTooltipIdx !== null && allPoints[activeTooltipIdx] && (
                    <View style={[styles.tooltipBox, isDark ? styles.tooltipDark : styles.tooltipLight]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tooltipDate, isDark ? styles.textDark : styles.textLight]}>
                          {allPoints[activeTooltipIdx].displayDate} — {allPoints[activeTooltipIdx].workoutTitle}
                        </Text>
                      </View>
                      <Text style={styles.tooltipVal}>
                        {allPoints[activeTooltipIdx].maxWeight} кг ({allPoints[activeTooltipIdx].setsCount} підх.)
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Card>

            {/* 3 Metric Summary Cards in a Row */}
            <View style={styles.kpiRow}>
              {/* Personal Best */}
              <Card style={styles.kpiCard}>
                <Ionicons name="trophy" size={16} color="#f59e0b" style={{ alignSelf: 'center' }} />
                <Text
                  numberOfLines={1}
                  style={[styles.kpiValue, isDark ? styles.textDark : styles.textLight]}
                >
                  {stats.personalBest > 0 ? `${stats.personalBest} кг` : '—'}
                </Text>
                <Text style={[styles.kpiLabel, isDark ? styles.subDark : styles.subLight]}>
                  Рекорд (PR)
                </Text>
              </Card>

              {/* Est. 1RM */}
              <Card style={styles.kpiCard}>
                <Ionicons
                  name="trending-up"
                  size={16}
                  color={isDark ? '#60a5fa' : '#2563eb'}
                  style={{ alignSelf: 'center' }}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.kpiValue, isDark ? styles.textDark : styles.textLight]}
                >
                  {stats.best1RM > 0 ? `${stats.best1RM} кг` : '—'}
                </Text>
                <Text style={[styles.kpiLabel, isDark ? styles.subDark : styles.subLight]}>
                  Розрахунковий 1ПМ
                </Text>
              </Card>

              {/* Total Sets */}
              <Card style={styles.kpiCard}>
                <Ionicons name="barbell" size={16} color="#22c55e" style={{ alignSelf: 'center' }} />
                <Text
                  numberOfLines={1}
                  style={[styles.kpiValue, isDark ? styles.textDark : styles.textLight]}
                >
                  {stats.totalSets}
                </Text>
                <Text style={[styles.kpiLabel, isDark ? styles.subDark : styles.subLight]}>
                  Всього підходів
                </Text>
              </Card>
            </View>

            {/* Progress / Insights Section */}
            <View style={styles.insightsSection}>
              <Text style={[styles.sectionTitle, isDark ? styles.subDark : styles.subLight]}>
                АНАЛІТИКА ПРОГРЕСУ
              </Text>

              <Card style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Ionicons
                    name="fitness-outline"
                    size={18}
                    color={isDark ? '#60a5fa' : '#2563eb'}
                  />
                  <Text style={[styles.progressTitle, isDark ? styles.textDark : styles.textLight]}>
                    Прогрес
                  </Text>
                </View>

                <Text style={[styles.progressSub, isDark ? styles.subDark : styles.subLight]}>
                  Ви тренували цю вправу{' '}
                  <Text style={{ fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a' }}>
                    {allPoints.length}
                  </Text>{' '}
                  {allPoints.length === 1
                    ? 'раз'
                    : allPoints.length >= 2 && allPoints.length <= 4
                    ? 'рази'
                    : 'разів'}{' '}
                  за весь час.
                </Text>

                {/* Last 5 Sessions Table */}
                <View style={styles.tableWrapper}>
                  <Text style={[styles.tableTitle, isDark ? styles.textDark : styles.textLight]}>
                    Останні 5 тренувань
                  </Text>

                  {last5Sessions.length === 0 ? (
                    <Text style={[styles.emptySub, isDark ? styles.subDark : styles.subLight]}>
                      Ще немає записів
                    </Text>
                  ) : (
                    <View style={styles.sessionsList}>
                      {/* Header row */}
                      <View style={[styles.tableHeaderRow, isDark ? styles.borderDark : styles.borderLight]}>
                        <Text style={[styles.thCol, { flex: 1.2 }, isDark ? styles.subDark : styles.subLight]}>
                          Дата
                        </Text>
                        <Text style={[styles.thCol, { textAlign: 'center' }, isDark ? styles.subDark : styles.subLight]}>
                          Підходи
                        </Text>
                        <Text style={[styles.thCol, { textAlign: 'right' }, isDark ? styles.subDark : styles.subLight]}>
                          Макс. вага
                        </Text>
                        <Text style={[styles.thCol, { textAlign: 'right' }, isDark ? styles.subDark : styles.subLight]}>
                          Тоннаж
                        </Text>
                      </View>

                      {/* Sessions Rows */}
                      {last5Sessions.map((session, sIdx) => {
                        const isExpanded = expandedSessionIdx === sIdx;
                        return (
                          <View key={sIdx} style={styles.sessionRowWrap}>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() =>
                                setExpandedSessionIdx(isExpanded ? null : sIdx)
                              }
                              style={[
                                styles.sessionRow,
                                sIdx > 0 && (isDark ? styles.borderDark : styles.borderLight),
                              ]}
                            >
                              <View style={[styles.tdCol, { flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                                <Text style={[styles.dateText, isDark ? styles.textDark : styles.textLight]}>
                                  {session.displayDate}
                                </Text>
                                <Ionicons
                                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                  size={12}
                                  color={isDark ? '#94a3b8' : '#64748b'}
                                />
                              </View>
                              <Text style={[styles.tdCol, styles.centerCol, isDark ? styles.textDark : styles.textLight]}>
                                {session.setsCount}
                              </Text>
                              <Text style={[styles.tdCol, styles.rightCol, isDark ? styles.textDark : styles.textLight]}>
                                {session.maxWeight > 0 ? `${session.maxWeight} кг` : '—'}
                              </Text>
                              <Text style={[styles.tdCol, styles.rightCol, isDark ? styles.subDark : styles.subLight]}>
                                {session.volumeTons > 0 ? `${session.volumeTons} т` : '0'}
                              </Text>
                            </TouchableOpacity>

                            {/* Expanded sets */}
                            {isExpanded && session.sets.length > 0 && (
                              <View style={[styles.expandedSetsBox, isDark ? styles.expandedDark : styles.expandedLight]}>
                                <Text style={[styles.setsHeader, isDark ? styles.subDark : styles.subLight]}>
                                  Виконані підходи:
                                </Text>
                                <View style={styles.setsGrid}>
                                  {session.sets.map((set, setIdx) => (
                                    <View
                                      key={setIdx}
                                      style={[styles.setCard, isDark ? styles.setCardDark : styles.setCardLight]}
                                    >
                                      <Text style={[styles.setNumText, isDark ? styles.subDark : styles.subLight]}>
                                        Сет {set.setNumber || setIdx + 1}
                                      </Text>
                                      <Text style={[styles.setValText, isDark ? styles.textDark : styles.textLight]}>
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

              {/* Achievement Badge */}
              {stats.isNewPrInLatest && (
                <View style={[styles.prBadgeBox, isDark ? styles.prBadgeDark : styles.prBadgeLight]}>
                  <Ionicons name="trophy" size={18} color="#f59e0b" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.prBadgeTitle}>Особистий рекорд!</Text>
                    <Text style={[styles.prBadgeSub, isDark ? styles.subDark : styles.subLight]}>
                      Ви встановили новий рекорд у цій вправі на останньому тренуванні!
                    </Text>
                  </View>
                </View>
              )}
            </View>
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
  borderLight: {
    borderColor: '#e2e8f0',
  },
  borderDark: {
    borderColor: '#334155',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  btnDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  avgSection: {
    paddingTop: 4,
  },
  avgLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  avgRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  avgValue: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  avgUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateRangeText: {
    fontSize: 11,
    marginTop: 2,
  },
  chartCard: {
    padding: 14,
    borderRadius: 20,
  },
  chartEmpty: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chartEmptyText: {
    fontSize: 12,
  },
  chartArea: {
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
    borderColor: '#ffffff',
  },
  pointDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: -6,
    borderWidth: 2,
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
    fontSize: 11,
    fontWeight: '600',
  },
  tooltipVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    fontFamily: 'monospace',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: 18,
    alignItems: 'center',
    gap: 3,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  kpiLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  insightsSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  progressCard: {
    padding: 14,
    borderRadius: 20,
    gap: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressSub: {
    fontSize: 12,
    lineHeight: 18,
  },
  tableWrapper: {
    marginTop: 6,
  },
  tableTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 12,
  },
  sessionsList: {
    gap: 2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  thCol: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
  },
  sessionRowWrap: {
    gap: 4,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tdCol: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  centerCol: {
    textAlign: 'center',
    fontWeight: '700',
  },
  rightCol: {
    textAlign: 'right',
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
  },
  expandedSetsBox: {
    padding: 8,
    borderRadius: 12,
    gap: 6,
    marginBottom: 4,
  },
  expandedLight: {
    backgroundColor: '#f1f5f9',
  },
  expandedDark: {
    backgroundColor: '#263140',
  },
  setsHeader: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  setsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  setCard: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  setCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  setCardDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  setNumText: {
    fontSize: 9,
  },
  setValText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  prBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  prBadgeLight: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  prBadgeDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  prBadgeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
  },
  prBadgeSub: {
    fontSize: 11,
  },
});
