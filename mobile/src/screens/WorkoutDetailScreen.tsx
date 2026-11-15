import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { WorkoutService } from '../services/workoutService';
import { WorkoutPlan, MuscleGroup } from '../types/workout';

export const WorkoutDetailScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { id, traineeId } = useLocalSearchParams<{ id: string; traineeId?: string }>();
  const { user } = useAuth();
  const targetUserId = traineeId || user?.id || '';

  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const loadWorkout = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await WorkoutService.getWorkoutById(id, targetUserId);
      setWorkout(data);
    } catch (e) {
      console.warn('[WorkoutDetailScreen.loadWorkout] Error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [id, targetUserId]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  // Toggle workout status between planned and completed
  const handleToggleStatus = async () => {
    if (!workout || !user) return;
    setIsUpdating(true);

    const nextStatus = workout.status === 'completed' ? 'planned' : 'completed';
    const updated: WorkoutPlan = {
      ...workout,
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? new Date().toISOString() : undefined,
    };

    try {
      await WorkoutService.saveWorkout(updated);
      setWorkout(updated);
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалося оновити статус тренування');
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete workout
  const handleDeleteWorkout = () => {
    if (!workout || !user) return;

    Alert.alert(
      'Видалити тренування?',
      `Ви впевнені, що хочете видалити «${workout.title || 'це тренування'}»? Дію неможливо скасувати.`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const effectiveUserId = workout.userId || targetUserId || user.id;
              const ok = await WorkoutService.deleteWorkout(effectiveUserId, workout.id, user.id);
              if (ok) {
                router.back();
              } else {
                Alert.alert('Помилка', 'Не вдалося видалити тренування з бази даних');
              }
            } catch (e) {
              Alert.alert('Помилка', 'Помилка при видаленні тренування');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const getMuscleGroupName = (mg?: MuscleGroup | string): string => {
    const map: Record<string, string> = {
      chest: 'Груди',
      back: 'Спина',
      legs: 'Ноги',
      glutes: 'Сідниці',
      shoulders: 'Плечі',
      arms: 'Руки',
      biceps: 'Біцепс',
      triceps: 'Трицепс',
      core: 'Прес / Кор',
      full_body: 'Сідниці',
      cardio: 'Кардіо',
    };
    return mg ? (map[mg] || mg) : 'М’язи';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Завантаження тренування...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.topBar, { borderBottomWidth: 0 }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Тренування не знайдено
          </Text>
          <Text style={[styles.errorSub, { color: colors.textSecondary }]}>
            Можливо, воно було видалене або у вас немає прав доступу.
          </Text>
          <Button title="Повернутися назад" variant="outline" onPress={() => router.back()} style={{ marginTop: 12 }} />
        </View>
      </SafeAreaView>
    );
  }

  const isCompleted = workout.status === 'completed';
  const exercises = workout.exercises || [];
  const totalSets = exercises.reduce((acc, ex) => acc + (ex.sets ? ex.sets.length : 0), 0);

  let totalVolume = 0;
  exercises.forEach((ex) => {
    (ex.sets || []).forEach((s) => {
      if ((s.completedAt || isCompleted) && s.weight && s.actualReps) {
        totalVolume += s.weight * s.actualReps;
      }
    });
  });

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Header Bar */}
      <View style={[styles.topBar, { borderBottomWidth: 0, backgroundColor: colors.bg }]}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.text }]}>
            {workout.title || 'Тренування'}
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {workout.scheduledDate}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={isDeleting}
          onPress={handleDeleteWorkout}
          style={[styles.deleteHeaderBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status & Overview Card */}
        <Card style={styles.overviewCard}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusPill,
                isCompleted
                  ? { backgroundColor: colors.statusCompletedBg }
                  : workout.status === 'in_progress'
                  ? { backgroundColor: colors.statusInProgressBg }
                  : { backgroundColor: colors.subCard },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: isCompleted
                      ? colors.success
                      : workout.status === 'in_progress'
                      ? colors.statusInProgressText
                      : colors.textSecondary,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  {
                    color: isCompleted
                      ? colors.statusCompletedText
                      : workout.status === 'in_progress'
                      ? colors.statusInProgressText
                      : colors.textSecondary,
                  },
                ]}
              >
                {isCompleted ? 'Завершено' : workout.status === 'in_progress' ? 'У процесі' : 'Заплановано'}
              </Text>
            </View>

            {workout.assignedByCoachId && (
              <View style={[styles.coachBadge, { backgroundColor: colors.subCard }]}>
                <Ionicons name="school-outline" size={14} color={colors.accent} />
                <Text style={[styles.coachText, { color: colors.text }]}>Призначено тренером</Text>
              </View>
            )}
          </View>

          {/* Metrics Row */}
          <View style={styles.metricsSummaryRow}>
            <View style={styles.metricSummaryItem}>
              <Text style={[styles.summaryVal, { color: colors.text }]}>
                {exercises.length}
              </Text>
              <Text style={[styles.summaryLbl, { color: colors.textSecondary }]}>
                вправ
              </Text>
            </View>

            <View style={[styles.summaryDivider, { backgroundColor: colors.cardBorder }]} />

            <View style={styles.metricSummaryItem}>
              <Text style={[styles.summaryVal, { color: colors.text }]}>
                {totalSets}
              </Text>
              <Text style={[styles.summaryLbl, { color: colors.textSecondary }]}>
                підходів
              </Text>
            </View>

            <View style={[styles.summaryDivider, { backgroundColor: colors.cardBorder }]} />

            <View style={styles.metricSummaryItem}>
              <Text style={[styles.summaryVal, { color: colors.text }]}>
                {totalVolume > 0 ? `${totalVolume} кг` : '—'}
              </Text>
              <Text style={[styles.summaryLbl, { color: colors.textSecondary }]}>
                тоннаж
              </Text>
            </View>

            {workout.durationMinutes ? (
              <>
                <View style={[styles.summaryDivider, { backgroundColor: colors.cardBorder }]} />
                <View style={styles.metricSummaryItem}>
                  <Text style={[styles.summaryVal, { color: colors.text }]}>
                    {workout.durationMinutes} хв
                  </Text>
                  <Text style={[styles.summaryLbl, { color: colors.textSecondary }]}>
                    час
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Notes if any */}
          {workout.notes ? (
            <View style={[styles.notesWrap, { backgroundColor: colors.subCard, borderColor: colors.subCardBorder }]}>
              <Ionicons name="reader-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.notesText, { color: colors.text }]}>
                {workout.notes}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Exercises Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Вправи ({exercises.length})
          </Text>
        </View>

        {/* Exercises List */}
        {exercises.length === 0 ? (
          <Card style={styles.emptyExercisesCard}>
            <Ionicons name="barbell-outline" size={36} color={colors.textSecondary} />
            <Text style={[styles.emptyExercisesTitle, { color: colors.text }]}>
              У цьому тренуванні ще немає вправ
            </Text>
            <Text style={[styles.emptyExercisesDesc, { color: colors.textSecondary }]}>
              Додайте вправи у редакторі тренування.
            </Text>
          </Card>
        ) : (
          exercises.map((ex, exIndex) => (
            <Card key={ex.id || `ex_${exIndex}`} style={styles.exerciseCard}>
              <View style={styles.exHeader}>
                <View style={[styles.exIndexCircle, { backgroundColor: colors.subCard }]}>
                  <Text style={[styles.exIndexText, { color: colors.text }]}>
                    {exIndex + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exTitle, { color: colors.text }]}>
                    {ex.exerciseName || 'Вправа'}
                  </Text>
                  <View style={[styles.mgBadge, { backgroundColor: colors.subCard }]}>
                    <Text style={[styles.mgText, { color: colors.textSecondary }]}>
                      {getMuscleGroupName(ex.muscleGroup)}
                    </Text>
                  </View>
                </View>
              </View>

              {ex.notes ? (
                <Text style={[styles.exNotes, { color: colors.textSecondary }]}>
                  {ex.notes}
                </Text>
              ) : null}

              {/* Sets Table */}
              {(ex.sets && ex.sets.length > 0) ? (
                <View style={styles.setsTable}>
                  <View style={[styles.setsTableHeader, { borderBottomColor: colors.cardBorder }]}>
                    <Text style={[styles.colHeader, styles.colSet, { color: colors.textSecondary }]}>Сет</Text>
                    <Text style={[styles.colHeader, styles.colWeight, { color: colors.textSecondary }]}>Вага</Text>
                    <Text style={[styles.colHeader, styles.colReps, { color: colors.textSecondary }]}>Повт.</Text>
                    <Text style={[styles.colHeader, styles.colStatus, { color: colors.textSecondary }]}>Статус</Text>
                  </View>

                  {ex.sets.map((s, sIndex) => {
                    const isSetDone = Boolean(s.completedAt);
                    return (
                      <View
                        key={s.id || `set_${sIndex}`}
                        style={[
                          styles.setRow,
                          sIndex > 0 && { borderTopWidth: 1, borderTopColor: colors.cardBorder },
                        ]}
                      >
                        <View style={styles.colSet}>
                          <Text style={[styles.setNum, { color: colors.text }]}>
                            {s.setNumber || sIndex + 1}
                            {s.isWarmup && (
                              <Text style={styles.warmupTag}> (Р)</Text>
                            )}
                          </Text>
                        </View>
                        <View style={styles.colWeight}>
                          <Text style={[styles.setVal, { color: colors.text }]}>
                            {s.weight ? `${s.weight} кг` : '—'}
                          </Text>
                        </View>
                        <View style={styles.colReps}>
                          <Text style={[styles.setVal, { color: colors.text }]}>
                            {s.actualReps !== null && s.actualReps !== undefined
                              ? s.actualReps
                              : s.targetRepsRange || '8-12'}
                          </Text>
                        </View>
                        <View style={styles.colStatus}>
                          <Ionicons
                            name={isSetDone ? 'checkmark-circle' : 'ellipse-outline'}
                            size={18}
                            color={isSetDone ? colors.success : colors.textSecondary}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </Card>
          ))
        )}

        {/* Action Controls */}
        <View style={styles.actionsContainer}>
          <Button
            title={isCompleted ? 'Повернути в заплановані' : 'Позначити як завершене'}
            variant={isCompleted ? 'outline' : 'primary'}
            loading={isUpdating}
            onPress={handleToggleStatus}
          />
          <Button
            title="Видалити це тренування"
            variant="danger"
            loading={isDeleting}
            onPress={handleDeleteWorkout}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
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
  deleteHeaderBtn: {
    padding: 6,
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
  statusInProgress: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
  },
  statusPlanned: {
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
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
  coachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  coachBadgeLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  coachBadgeDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  coachText: {
    fontSize: 11,
    fontWeight: '500',
  },
  coachTextLight: {
    color: '#2563eb',
  },
  coachTextDark: {
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
  notesWrap: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 14,
  },
  notesLight: {
    backgroundColor: '#f1f5f9',
  },
  notesDark: {
    backgroundColor: '#263140',
  },
  notesText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
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
    textAlign: 'center',
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
  mgBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 3,
    borderWidth: 1,
  },
  mgBadgeLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  mgBadgeDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  mgText: {
    fontSize: 10,
    fontWeight: '600',
  },
  exNotes: {
    fontSize: 12,
    fontStyle: 'italic',
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
  actionsContainer: {
    gap: 10,
    marginTop: 12,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
  },
  errorSub: {
    fontSize: 13,
    textAlign: 'center',
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
