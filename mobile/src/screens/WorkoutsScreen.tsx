import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { WorkoutService } from '../services/workoutService';
import { useAuth } from '../context/AuthContext';
import { WorkoutPlan } from '../types/workout';

export type WorkoutFilterStatus = 'all' | 'in_progress' | 'completed';

export const WorkoutsScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { user } = useAuth();

  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([]);
  const [filterStatus, setFilterStatus] = useState<WorkoutFilterStatus>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Creation modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDate, setNewDate] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);

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
      console.warn('[WorkoutsScreen.loadData] Error:', e);
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

  // Open modal with defaults
  const handleOpenCreateModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setNewTitle('');
    setNewDate(today);
    setNewNotes('');
    setIsModalOpen(true);
  };

  // Submit new workout
  const handleCreateWorkoutSubmit = async () => {
    if (!user) return;

    const titleToUse = newTitle.trim() || 'Силове тренування';
    const dateToUse = newDate.trim() || new Date().toISOString().split('T')[0];

    setIsCreating(true);
    try {
      const workoutId = `wo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newWorkout: WorkoutPlan = {
        id: workoutId,
        userId: user.id,
        title: titleToUse,
        scheduledDate: dateToUse,
        status: 'planned',
        notes: newNotes.trim(),
        createdAt: new Date().toISOString(),
        exercises: [],
      };

      const success = await WorkoutService.saveWorkout(newWorkout);
      if (success) {
        setWorkouts((prev) => [newWorkout, ...prev]);
        setIsModalOpen(false);
        router.push({ pathname: '/workout/[id]', params: { id: newWorkout.id } });
      } else {
        Alert.alert('Помилка', 'Не вдалося зберегти тренування');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося створити тренування');
    } finally {
      setIsCreating(false);
    }
  };

  // Delete workout with alert confirmation
  const handleDeleteWorkout = (workout: WorkoutPlan) => {
    if (!user) return;

    Alert.alert(
      'Видалити тренування?',
      `Ви впевнені, що хочете видалити «${workout.title || 'це тренування'}»?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              const ok = await WorkoutService.deleteWorkout(user.id, workout.id);
              if (ok) {
                setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
              } else {
                Alert.alert('Помилка', 'Не вдалося видалити тренування');
              }
            } catch (e) {
              Alert.alert('Помилка', 'Помилка видалення');
            }
          },
        },
      ]
    );
  };

  // Filtered workouts
  const filteredWorkouts = useMemo(() => {
    return workouts.filter((w) => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'in_progress') return w.status === 'in_progress' || w.status === 'planned';
      if (filterStatus === 'completed') return w.status === 'completed';
      return true;
    });
  }, [workouts, filterStatus]);

  const inProgressCount = useMemo(() => {
    return workouts.filter((w) => w.status === 'in_progress' || w.status === 'planned').length;
  }, [workouts]);

  const completedCount = useMemo(() => {
    return workouts.filter((w) => w.status === 'completed').length;
  }, [workouts]);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
      {/* Top Header */}
      <View style={[styles.headerBar, isDark ? styles.borderDark : styles.borderLight]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.screenTitle, isDark ? styles.textDark : styles.textLight]}>
            Тренування
          </Text>
          <Text style={[styles.screenSubtitle, isDark ? styles.subDark : styles.subLight]}>
            {user ? `Атлет: ${user.name || user.email}` : 'Щоденник тренувань'}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleOpenCreateModal}
          style={styles.newWorkoutBtn}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.newWorkoutBtnText}>Нове</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <View style={[styles.filterContainer, isDark ? styles.filterDark : styles.filterLight]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFilterStatus('all')}
            style={[styles.filterBtn, filterStatus === 'all' && styles.filterBtnActive]}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterStatus === 'all' ? styles.filterBtnTextActive : (isDark ? styles.subDark : styles.subLight),
              ]}
            >
              Всі ({workouts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFilterStatus('in_progress')}
            style={[styles.filterBtn, filterStatus === 'in_progress' && styles.filterBtnActive]}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterStatus === 'in_progress' ? styles.filterBtnTextActive : (isDark ? styles.subDark : styles.subLight),
              ]}
            >
              У процесі ({inProgressCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFilterStatus('completed')}
            style={[styles.filterBtn, filterStatus === 'completed' && styles.filterBtnActive]}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterStatus === 'completed' ? styles.filterBtnTextActive : (isDark ? styles.subDark : styles.subLight),
              ]}
            >
              Завершено ({completedCount})
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
              Завантаження списку тренувань...
            </Text>
          </View>
        ) : filteredWorkouts.length === 0 ? (
          <View style={[styles.emptyContainer, isDark ? styles.emptyDark : styles.emptyLight]}>
            <View style={[styles.emptyIconCircle, isDark ? styles.logoDark : styles.logoLight]}>
              <Ionicons name="barbell-outline" size={36} color={isDark ? '#38bdf8' : '#0284c7'} />
            </View>
            <Text style={[styles.emptyTitle, isDark ? styles.textDark : styles.textLight]}>
              {workouts.length === 0
                ? 'Тренувань ще немає'
                : 'Немає тренувань за обраним фільтром'}
            </Text>
            <Text style={[styles.emptySubtitle, isDark ? styles.subDark : styles.subLight]}>
              {workouts.length === 0
                ? 'Створіть своє перше тренування для відстеження підходів, ваги та прогресу.'
                : 'Спробуйте вибрати інший фільтр або створіть нове тренування.'}
            </Text>
            <Button
              title="Створити перше тренування"
              onPress={handleOpenCreateModal}
              style={{ marginTop: 8 }}
            />
          </View>
        ) : (
          <View style={styles.workoutsList}>
            {filteredWorkouts.map((w) => {
              const isCompleted = w.status === 'completed';
              const isInProgress = w.status === 'in_progress';
              const exercises = w.exercises || [];
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
                <TouchableOpacity
                  key={w.id}
                  activeOpacity={0.7}
                  onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
                >
                  <Card style={styles.workoutCard}>
                    {/* Top Row: Status, Date, Coach, Delete Action */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardBadgesRow}>
                        <View
                          style={[
                            styles.statusPill,
                            isCompleted
                              ? styles.statusCompleted
                              : isInProgress
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
                                  : isInProgress
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
                                  : isInProgress
                                  ? '#f59e0b'
                                  : '#64748b',
                              },
                            ]}
                          >
                            {isCompleted ? 'Завершено' : isInProgress ? 'У процесі' : 'Заплановано'}
                          </Text>
                        </View>

                        <View style={styles.dateWrap}>
                          <Ionicons
                            name="calendar-outline"
                            size={12}
                            color={isDark ? '#71717a' : '#94a3b8'}
                          />
                          <Text style={[styles.dateText, isDark ? styles.subDark : styles.subLight]}>
                            {w.scheduledDate}
                          </Text>
                        </View>

                        {w.assignedByCoachId && (
                          <View style={styles.coachBadge}>
                            <Text style={styles.coachText}>Від тренера</Text>
                          </View>
                        )}
                      </View>

                      {/* Delete Quick Button */}
                      <TouchableOpacity
                        activeOpacity={0.6}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleDeleteWorkout(w);
                        }}
                        style={styles.cardDeleteBtn}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={isDark ? '#71717a' : '#a1a1aa'}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Workout Title */}
                    <Text
                      numberOfLines={1}
                      style={[styles.workoutTitle, isDark ? styles.textDark : styles.textLight]}
                    >
                      {w.title || 'Тренування без назви'}
                    </Text>

                    {/* Metrics Row */}
                    <View style={styles.cardMetricsRow}>
                      <View style={styles.metricItem}>
                        <Ionicons
                          name="layers-outline"
                          size={14}
                          color={isDark ? '#71717a' : '#94a3b8'}
                        />
                        <Text style={[styles.metricText, isDark ? styles.subDark : styles.subLight]}>
                          <Text style={[styles.metricVal, isDark ? styles.textDark : styles.textLight]}>
                            {exercises.length}
                          </Text>{' '}
                          вправ
                        </Text>
                      </View>

                      <Text style={[styles.dotSep, isDark ? styles.subDark : styles.subLight]}>·</Text>

                      <View style={styles.metricItem}>
                        <Text style={[styles.metricText, isDark ? styles.subDark : styles.subLight]}>
                          <Text style={[styles.metricVal, isDark ? styles.textDark : styles.textLight]}>
                            {totalSets}
                          </Text>{' '}
                          підходів
                        </Text>
                      </View>

                      {totalVolume > 0 && (
                        <>
                          <Text style={[styles.dotSep, isDark ? styles.subDark : styles.subLight]}>·</Text>
                          <View style={styles.metricItem}>
                            <Text style={[styles.metricText, isDark ? styles.subDark : styles.subLight]}>
                              <Text style={[styles.metricVal, isDark ? styles.textDark : styles.textLight]}>
                                {totalVolume}
                              </Text>{' '}
                              кг
                            </Text>
                          </View>
                        </>
                      )}

                      {w.durationMinutes ? (
                        <>
                          <Text style={[styles.dotSep, isDark ? styles.subDark : styles.subLight]}>·</Text>
                          <View style={styles.metricItem}>
                            <Ionicons
                              name="time-outline"
                              size={13}
                              color={isDark ? '#71717a' : '#94a3b8'}
                            />
                            <Text style={[styles.metricText, isDark ? styles.subDark : styles.subLight]}>
                              {w.durationMinutes} хв
                            </Text>
                          </View>
                        </>
                      ) : null}
                    </View>

                    {/* Notes snippet */}
                    {w.notes ? (
                      <Text
                        numberOfLines={1}
                        style={[styles.notesSnippet, isDark ? styles.subDark : styles.subLight]}
                      >
                        {w.notes}
                      </Text>
                    ) : null}
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Create Workout Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, isDark ? styles.modalDark : styles.modalLight]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark ? styles.textDark : styles.textLight]}>
                Нове тренування
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={isDark ? '#a1a1aa' : '#71717a'} />
              </TouchableOpacity>
            </View>

            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
                Назва тренування
              </Text>
              <TextInput
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="Наприклад: Силове тренування"
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
              />
            </View>

            {/* Date Input with Quick Chips */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
                Дата (РРРР-ММ-ДД)
              </Text>
              <TextInput
                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="2026-09-29"
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                value={newDate}
                onChangeText={setNewDate}
              />
              <View style={styles.quickDateRow}>
                <TouchableOpacity
                  onPress={() => setNewDate(new Date().toISOString().split('T')[0])}
                  style={[styles.quickChip, isDark ? styles.chipDark : styles.chipLight]}
                >
                  <Text style={[styles.quickChipText, isDark ? styles.textDark : styles.textLight]}>
                    Сьогодні
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const tmr = new Date();
                    tmr.setDate(tmr.getDate() + 1);
                    setNewDate(tmr.toISOString().split('T')[0]);
                  }}
                  style={[styles.quickChip, isDark ? styles.chipDark : styles.chipLight]}
                >
                  <Text style={[styles.quickChipText, isDark ? styles.textDark : styles.textLight]}>
                    Завтра
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Notes Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
                Примітки (необов’язково)
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="Цілі, самопочуття або план на день..."
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                multiline
                numberOfLines={3}
                value={newNotes}
                onChangeText={setNewNotes}
              />
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <Button
                title="Скасувати"
                variant="outline"
                onPress={() => setIsModalOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Створити"
                loading={isCreating}
                onPress={handleCreateWorkoutSubmit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  newWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newWorkoutBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 8,
  },
  filterLight: {
    backgroundColor: '#f1f5f9',
  },
  filterDark: {
    backgroundColor: '#18181b',
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterBtnActive: {
    backgroundColor: '#0284c7',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#ffffff',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    textAlign: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 12,
  },
  emptyLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  emptyDark: {
    backgroundColor: '#18181b50',
    borderColor: '#27272a',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoLight: {
    backgroundColor: '#e0f2fe',
  },
  logoDark: {
    backgroundColor: '#0c4a6e',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  workoutsList: {
    gap: 12,
  },
  workoutCard: {
    padding: 14,
    gap: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
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
    fontSize: 11,
    fontWeight: '600',
  },
  dateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  coachBadge: {
    backgroundColor: '#e0e7ff20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coachText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366f1',
  },
  cardDeleteBtn: {
    padding: 4,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
  },
  metricVal: {
    fontWeight: '600',
  },
  dotSep: {
    fontSize: 12,
  },
  notesSnippet: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 16,
  },
  modalLight: {
    backgroundColor: '#ffffff',
  },
  modalDark: {
    backgroundColor: '#18181b',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  inputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    color: '#0f172a',
  },
  inputDark: {
    backgroundColor: '#09090b',
    borderColor: '#27272a',
    color: '#f8fafc',
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  chipDark: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
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
