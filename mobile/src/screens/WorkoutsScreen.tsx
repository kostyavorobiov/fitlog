import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  PanResponder,
  Animated,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { WorkoutService } from '../services/workoutService';
import { useAuth } from '../context/AuthContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { WorkoutPlan } from '../types/workout';

export type WorkoutFilterStatus = 'all' | 'in_progress' | 'completed';

export function formatDateDDMMYY(dateStr?: string): string {
  if (!dateStr) return '';
  const dateOnly = dateStr.split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const shortYear = year.length === 4 ? year.slice(2) : year;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${shortYear}`;
  }
  return dateStr;
}

interface SwipeableWorkoutCardProps {
  onDelete: () => void;
  isDark: boolean;
  children: React.ReactNode;
}

const SWIPE_DELETE_WIDTH = 84;
const SWIPE_THRESHOLD = -40;

const SwipeableWorkoutCard: React.FC<SwipeableWorkoutCardProps> = ({
  onDelete,
  isDark,
  children,
}) => {
  const panX = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const isOpenRef = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 10 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2
          );
        },
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 10 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2
          );
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          panX.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          const base = isOpenRef.current ? -SWIPE_DELETE_WIDTH : 0;
          const newX = Math.min(0, Math.max(-SWIPE_DELETE_WIDTH - 20, base + gestureState.dx));
          panX.setValue(newX);
        },
        onPanResponderRelease: (_, gestureState) => {
          const currentVal = (panX as any)._value ?? (isOpenRef.current ? -SWIPE_DELETE_WIDTH : 0);
          if (gestureState.dx < -30 || currentVal < SWIPE_THRESHOLD) {
            isOpenRef.current = true;
            Animated.spring(panX, {
              toValue: -SWIPE_DELETE_WIDTH,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          } else {
            isOpenRef.current = false;
            Animated.spring(panX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          isOpenRef.current = false;
          Animated.spring(panX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [panX]
  );

  const handleDelete = () => {
    onDelete();
  };

  const closeSwipe = () => {
    if (isOpenRef.current) {
      isOpenRef.current = false;
      Animated.spring(panX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <Animated.View
      style={[
        styles.swipeContainer,
        {
          opacity: opacityAnim,
          borderColor: isDark ? '#27272a' : '#e4e4e7',
          backgroundColor: isDark ? '#18181b' : '#ffffff',
        },
      ]}
    >
      {/* Background Red Delete Button */}
      <View style={styles.swipeDeleteActionBg}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleDelete}
          style={styles.swipeDeleteBtn}
          accessibilityLabel="Видалити тренування"
        >
          <Ionicons name="trash" size={20} color="#ffffff" />
          <Text style={styles.swipeDeleteBtnText}>Видалити</Text>
        </TouchableOpacity>
      </View>

      {/* Foreground Swipeable Card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.swipeForeground,
          {
            transform: [{ translateX: panX }],
            backgroundColor: isDark ? '#18181b' : '#ffffff',
            borderRightWidth: StyleSheet.hairlineWidth,
            borderRightColor: isDark ? '#27272a' : '#e4e4e7',
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={closeSwipe}
          disabled={!isOpenRef.current}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

export const WorkoutsScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { user } = useAuth();
  const { handleScroll } = useScrollTabBar();

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
      {/* Top Navbar & Section Header */}
      <Header
        title="Тренування"
        rightAction={
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleOpenCreateModal}
            style={[
              styles.newWorkoutBtn,
              isDark ? styles.newWorkoutBtnDark : styles.newWorkoutBtnLight,
            ]}
          >
            <Ionicons name="add" size={16} color={isDark ? '#09090b' : '#ffffff'} />
            <Text
              style={[
                styles.newWorkoutBtnText,
                isDark ? styles.newWorkoutTextDark : styles.newWorkoutTextLight,
              ]}
            >
              Нове тренування
            </Text>
          </TouchableOpacity>
        }
      />

      {/* Filter Tabs (Web Segmented Control Style) */}
      <View style={styles.filterRow}>
        <View style={[styles.filterContainer, isDark ? styles.filterDark : styles.filterLight]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFilterStatus('all')}
            style={[
              styles.filterBtn,
              filterStatus === 'all' && (isDark ? styles.filterBtnActiveDark : styles.filterBtnActiveLight),
            ]}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterStatus === 'all'
                  ? (isDark ? styles.filterTextActiveDark : styles.filterTextActiveLight)
                  : (isDark ? styles.subDark : styles.subLight),
              ]}
            >
              Всі ({workouts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFilterStatus('in_progress')}
            style={[
              styles.filterBtn,
              filterStatus === 'in_progress' && (isDark ? styles.filterBtnActiveDark : styles.filterBtnActiveLight),
            ]}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterStatus === 'in_progress'
                  ? (isDark ? styles.filterTextActiveDark : styles.filterTextActiveLight)
                  : (isDark ? styles.subDark : styles.subLight),
              ]}
            >
              У процесі ({inProgressCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFilterStatus('completed')}
            style={[
              styles.filterBtn,
              filterStatus === 'completed' && (isDark ? styles.filterBtnActiveDark : styles.filterBtnActiveLight),
            ]}
          >
            <Text
              style={[
                styles.filterBtnText,
                filterStatus === 'completed'
                  ? (isDark ? styles.filterTextActiveDark : styles.filterTextActiveLight)
                  : (isDark ? styles.subDark : styles.subLight),
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
        onScroll={handleScroll}
        scrollEventThrottle={16}
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

              return (
                <SwipeableWorkoutCard
                  key={w.id}
                  isDark={isDark}
                  onDelete={() => handleDeleteWorkout(w)}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
                  >
                    <View style={styles.workoutCard}>
                      {/* Top Row: Status, Coach */}
                      <View style={styles.cardTopRow}>
                        <View style={styles.cardBadgesRow}>
                          <Text
                            style={[
                              styles.statusText,
                              {
                                color: isCompleted
                                  ? (isDark ? '#34d399' : '#059669')
                                  : isInProgress
                                    ? (isDark ? '#fbbf24' : '#d97706')
                                    : (isDark ? '#a1a1aa' : '#71717a'),
                              },
                            ]}
                          >
                            {isCompleted ? 'Завершено' : isInProgress ? 'У процесі' : 'Заплановано'}
                          </Text>

                          {w.assignedByCoachId && (
                            <>
                              <Text style={[styles.dotSep, isDark ? styles.dotDark : styles.dotLight]}>·</Text>
                              <Text style={[styles.coachText, isDark ? styles.coachDark : styles.coachLight]}>
                                Від тренера
                              </Text>
                            </>
                          )}
                        </View>
                      </View>

                      {/* Workout Title */}
                      <Text
                        numberOfLines={1}
                        style={[styles.workoutTitle, isDark ? styles.textDark : styles.textLight]}
                      >
                        {w.title || 'Тренування без назви'}
                      </Text>

                      {/* Metrics Row: Date first, then exercises count, then sets count (no kg sum) */}
                      <View style={styles.cardMetricsRow}>
                        <View style={styles.metricItem}>
                          <Ionicons
                            name="calendar-outline"
                            size={13}
                            color={isDark ? '#71717a' : '#94a3b8'}
                          />
                          <Text style={[styles.metricText, isDark ? styles.subDark : styles.subLight]}>
                            {formatDateDDMMYY(w.scheduledDate)}
                          </Text>
                        </View>

                        <Text style={[styles.dotSep, isDark ? styles.subDark : styles.subLight]}>·</Text>

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
                    </View>
                  </TouchableOpacity>
                </SwipeableWorkoutCard>
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newWorkoutBtnLight: {
    backgroundColor: '#18181b',
  },
  newWorkoutBtnDark: {
    backgroundColor: '#f4f4f5',
  },
  newWorkoutBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  newWorkoutTextLight: {
    color: '#ffffff',
  },
  newWorkoutTextDark: {
    color: '#09090b',
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  filterLight: {
    backgroundColor: '#f9fafb',
    borderColor: '#e4e4e7',
  },
  filterDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterBtnActiveLight: {
    backgroundColor: '#18181b',
  },
  filterBtnActiveDark: {
    backgroundColor: '#f4f4f5',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActiveLight: {
    color: '#ffffff',
  },
  filterTextActiveDark: {
    color: '#09090b',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 110,
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
  dotSep: {
    fontSize: 12,
  },
  dotLight: {
    color: '#d4d4d8',
  },
  dotDark: {
    color: '#3f3f46',
  },
  coachText: {
    fontSize: 11,
    fontWeight: '500',
  },
  coachLight: {
    color: '#4f46e5',
  },
  coachDark: {
    color: '#818cf8',
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
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
  },
  swipeDeleteActionBg: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 84,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  swipeDeleteBtn: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeDeleteBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  swipeForeground: {
    zIndex: 2,
  },
});
