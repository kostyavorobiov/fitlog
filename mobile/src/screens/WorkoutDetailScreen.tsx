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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { WorkoutService } from '../services/workoutService';
import { WorkoutPlan, MuscleGroup } from '../types/workout';

export const WorkoutDetailScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
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
      shoulders: 'Плечі',
      arms: 'Руки',
      biceps: 'Біцепс',
      triceps: 'Трицепс',
      core: 'Прес / Кор',
      full_body: 'Все тіло',
      cardio: 'Кардіо',
    };
    return mg ? (map[mg] || mg) : 'М’язи';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={isDark ? '#fafafa' : '#18181b'} />
          <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
            Завантаження тренування...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#f8fafc' : '#0f172a'} />
          </TouchableOpacity>
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={[styles.errorTitle, isDark ? styles.textDark : styles.textLight]}>
            Тренування не знайдено
          </Text>
          <Text style={[styles.errorSub, isDark ? styles.subDark : styles.subLight]}>
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
    <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
      {/* Top Header Bar */}
      <View style={[styles.topBar, isDark ? styles.borderDark : styles.borderLight]}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={isDark ? '#f8fafc' : '#0f172a'} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text numberOfLines={1} style={[styles.headerTitle, isDark ? styles.textDark : styles.textLight]}>
            {workout.title || 'Тренування'}
          </Text>
          <Text style={[styles.headerSub, isDark ? styles.subDark : styles.subLight]}>
            {workout.scheduledDate}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={isDeleting}
          onPress={handleDeleteWorkout}
          style={styles.deleteHeaderBtn}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
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
                  ? styles.statusCompleted
                  : workout.status === 'in_progress'
                  ? styles.statusInProgress
                  : styles.statusPlanned,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: isCompleted
                      ? '#10b981'
                      : workout.status === 'in_progress'
                      ? '#f59e0b'
                      : '#94a3b8',
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  {
                    color: isCompleted
                      ? '#10b981'
                      : workout.status === 'in_progress'
                      ? '#f59e0b'
                      : '#64748b',
                  },
                ]}
              >
                {isCompleted ? 'Завершено' : workout.status === 'in_progress' ? 'У процесі' : 'Заплановано'}
              </Text>
            </View>

            {workout.assignedByCoachId && (
              <View style={styles.coachBadge}>
                <Ionicons name="school-outline" size={14} color="#6366f1" />
                <Text style={styles.coachText}>Призначено тренером</Text>
              </View>
            )}
          </View>

          {/* Metrics Row */}
          <View style={styles.metricsSummaryRow}>
            <View style={styles.metricSummaryItem}>
              <Text style={[styles.summaryVal, isDark ? styles.textDark : styles.textLight]}>
                {exercises.length}
              </Text>
              <Text style={[styles.summaryLbl, isDark ? styles.subDark : styles.subLight]}>
                вправ
              </Text>
            </View>

            <View style={[styles.summaryDivider, isDark ? styles.borderDark : styles.borderLight]} />

            <View style={styles.metricSummaryItem}>
              <Text style={[styles.summaryVal, isDark ? styles.textDark : styles.textLight]}>
                {totalSets}
              </Text>
              <Text style={[styles.summaryLbl, isDark ? styles.subDark : styles.subLight]}>
                підходів
              </Text>
            </View>

            <View style={[styles.summaryDivider, isDark ? styles.borderDark : styles.borderLight]} />

            <View style={styles.metricSummaryItem}>
              <Text style={[styles.summaryVal, isDark ? styles.textDark : styles.textLight]}>
                {totalVolume > 0 ? `${totalVolume} кг` : '—'}
              </Text>
              <Text style={[styles.summaryLbl, isDark ? styles.subDark : styles.subLight]}>
                тоннаж
              </Text>
            </View>

            {workout.durationMinutes ? (
              <>
                <View style={[styles.summaryDivider, isDark ? styles.borderDark : styles.borderLight]} />
                <View style={styles.metricSummaryItem}>
                  <Text style={[styles.summaryVal, isDark ? styles.textDark : styles.textLight]}>
                    {workout.durationMinutes} хв
                  </Text>
                  <Text style={[styles.summaryLbl, isDark ? styles.subDark : styles.subLight]}>
                    час
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Notes if any */}
          {workout.notes ? (
            <View style={[styles.notesWrap, isDark ? styles.notesDark : styles.notesLight]}>
              <Ionicons name="reader-outline" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
              <Text style={[styles.notesText, isDark ? styles.textDark : styles.textLight]}>
                {workout.notes}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Exercises Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, isDark ? styles.textDark : styles.textLight]}>
            Вправи ({exercises.length})
          </Text>
        </View>

        {/* Exercises List */}
        {exercises.length === 0 ? (
          <Card style={styles.emptyExercisesCard}>
            <Ionicons name="barbell-outline" size={36} color={isDark ? '#71717a' : '#a1a1aa'} />
            <Text style={[styles.emptyExercisesTitle, isDark ? styles.textDark : styles.textLight]}>
              У цьому тренуванні ще немає вправ
            </Text>
            <Text style={[styles.emptyExercisesDesc, isDark ? styles.subDark : styles.subLight]}>
              Повний мобільний редактор вправ (WorkoutEditor) з вибором з каталогу буде додано на наступному етапі.
            </Text>
          </Card>
        ) : (
          exercises.map((ex, exIndex) => (
            <Card key={ex.id || `ex_${exIndex}`} style={styles.exerciseCard}>
              <View style={styles.exHeader}>
                <View style={[styles.exIndexCircle, isDark ? styles.exIndexCircleDark : styles.exIndexCircleLight]}>
                  <Text style={[styles.exIndexText, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
                    {exIndex + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exTitle, isDark ? styles.textDark : styles.textLight]}>
                    {ex.exerciseName || 'Вправа'}
                  </Text>
                  <View style={[styles.mgBadge, isDark ? styles.mgBadgeDark : styles.mgBadgeLight]}>
                    <Text style={[styles.mgText, isDark ? styles.subDark : styles.subLight]}>
                      {getMuscleGroupName(ex.muscleGroup)}
                    </Text>
                  </View>
                </View>
              </View>

              {ex.notes ? (
                <Text style={[styles.exNotes, isDark ? styles.subDark : styles.subLight]}>
                  {ex.notes}
                </Text>
              ) : null}

              {/* Sets Table */}
              {(ex.sets && ex.sets.length > 0) ? (
                <View style={styles.setsTable}>
                  <View style={styles.setsTableHeader}>
                    <Text style={[styles.colHeader, styles.colSet, isDark ? styles.subDark : styles.subLight]}>Сет</Text>
                    <Text style={[styles.colHeader, styles.colWeight, isDark ? styles.subDark : styles.subLight]}>Вага</Text>
                    <Text style={[styles.colHeader, styles.colReps, isDark ? styles.subDark : styles.subLight]}>Повт.</Text>
                    <Text style={[styles.colHeader, styles.colStatus, isDark ? styles.subDark : styles.subLight]}>Статус</Text>
                  </View>

                  {ex.sets.map((s, sIndex) => {
                    const isSetDone = Boolean(s.completedAt);
                    return (
                      <View
                        key={s.id || `set_${sIndex}`}
                        style={[
                          styles.setRow,
                          sIndex > 0 && (isDark ? styles.rowBorderDark : styles.rowBorderLight),
                        ]}
                      >
                        <View style={styles.colSet}>
                          <Text style={[styles.setNum, isDark ? styles.textDark : styles.textLight]}>
                            {s.setNumber || sIndex + 1}
                            {s.isWarmup && (
                              <Text style={styles.warmupTag}> (Р)</Text>
                            )}
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
                              : s.targetRepsRange || '8-12'}
                          </Text>
                        </View>
                        <View style={styles.colStatus}>
                          <Ionicons
                            name={isSetDone ? 'checkmark-circle' : 'ellipse-outline'}
                            size={18}
                            color={isSetDone ? '#10b981' : (isDark ? '#71717a' : '#a1a1aa')}
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
    backgroundColor: '#fafafa',
  },
  bgDark: {
    backgroundColor: '#09090b',
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
    backgroundColor: '#ecfdf5',
  },
  statusInProgress: {
    backgroundColor: '#fffbeb',
  },
  statusPlanned: {
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#e0e7ff20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  coachText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6366f1',
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
    borderRadius: 8,
  },
  notesLight: {
    backgroundColor: '#f8fafc',
  },
  notesDark: {
    backgroundColor: '#18181b',
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
    backgroundColor: '#18181b',
  },
  exIndexCircleDark: {
    backgroundColor: '#f4f4f5',
  },
  exIndexText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textPrimaryLight: {
    color: '#ffffff',
  },
  textPrimaryDark: {
    color: '#09090b',
  },
  exTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  mgBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
    borderWidth: 1,
  },
  mgBadgeLight: {
    backgroundColor: '#f4f4f5',
    borderColor: '#e4e4e7',
  },
  mgBadgeDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
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
    borderBottomColor: '#71717a20',
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
    borderTopColor: '#f1f5f9',
  },
  rowBorderDark: {
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  setNum: {
    fontSize: 13,
    fontWeight: '600',
  },
  warmupTag: {
    fontSize: 10,
    color: '#f59e0b',
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
  borderLight: {
    borderColor: '#e4e4e7',
  },
  borderDark: {
    borderColor: '#27272a',
  },
});
