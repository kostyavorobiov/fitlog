import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import {
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
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { triggerRefreshSuccessHaptic } from '../utils/haptics';
import { setSavedActiveTab } from '../components/InstagramTabPager';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { WorkoutService } from '../services/workoutService';
import { useAuth } from '../context/AuthContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { WorkoutPlan, WorkoutExercise, WorkoutSet } from '../types/workout';
import { SwipeableActionCard } from '../components/SwipeableActionCard';
import { DatePickerModal } from '../components/DatePickerModal';
import { formatDateDDMMYYYY } from '../utils/date';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type WorkoutFilterStatus = 'all' | 'completed' | 'in_progress';

export function formatDateDDMMYY(dateStr?: string): string {
  return formatDateDDMMYYYY(dateStr);
}

const UKRAINIAN_MONTHS = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];

export function getMonthKeyAndLabel(dateStr?: string): { key: string; label: string } {
  if (!dateStr) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return {
      key: `${y}-${m}`,
      label: `${UKRAINIAN_MONTHS[now.getMonth()]} ${y}`,
    };
  }

  const dateOnly = dateStr.split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const label = `${UKRAINIAN_MONTHS[month - 1]} ${year}`;
      return { key, label };
    }
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const label = `${UKRAINIAN_MONTHS[d.getMonth()]} ${year}`;
    return { key, label };
  }

  const now = new Date();
  return {
    key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    label: `${UKRAINIAN_MONTHS[now.getMonth()]} ${now.getFullYear()}`,
  };
}

export interface MonthGroup {
  key: string;
  label: string;
  workouts: WorkoutPlan[];
}

interface SwipeableWorkoutCardProps {
  id: string;
  onCopy?: () => void;
  onDelete: (onCancel?: () => void) => void;
  onQuickDelete?: (onCancel?: () => void) => void;
  confirmTitle?: string;
  confirmMessage?: string;
  isDark: boolean;
  children: React.ReactNode;
}

const SwipeableWorkoutCard: React.FC<SwipeableWorkoutCardProps> = ({
  id,
  onCopy,
  onDelete,
  onQuickDelete,
  confirmTitle,
  confirmMessage,
  isDark,
  children,
}) => {
  return (
    <SwipeableActionCard
      id={id}
      isDark={isDark}
      onCopy={onCopy}
      onDelete={onDelete}
      onQuickDelete={onQuickDelete}
      confirmTitle={confirmTitle}
      confirmMessage={confirmMessage}
    >
      {children}
    </SwipeableActionCard>
  );
};

export const WorkoutsScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { user } = useAuth();
  const { handleScroll } = useScrollTabBar();

  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Creation modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDate, setNewDate] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isModalDatePickerOpen, setIsModalDatePickerOpen] = useState<boolean>(false);
  const isCreatingRef = useRef<boolean>(false);

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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setSavedActiveTab('index');
    try {
      if (user) {
        const data = await WorkoutService.getWorkouts(user.id);
        setWorkouts(data);
      }
    } catch (e) {
      console.warn('[WorkoutsScreen.onRefresh] Error:', e);
    } finally {
      setIsRefreshing(false);
      await triggerRefreshSuccessHaptic();
    }
  }, [user]);

  // Open modal with defaults
  const handleOpenCreateModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setNewTitle('');
    setNewDate(today);
    setNewNotes('');
    isCreatingRef.current = false;
    setIsModalOpen(true);
  };

  // Submit new workout
  const handleCreateWorkoutSubmit = async () => {
    if (!user) return;
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setIsCreating(true);

    const titleToUse = newTitle.trim() || 'Силове тренування';
    const dateToUse = newDate.trim() || new Date().toISOString().split('T')[0];

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

      // 1. Primary write to DB & local cache
      const success = await WorkoutService.saveWorkout(newWorkout);
      if (success) {
        setWorkouts((prev) => [newWorkout, ...prev.filter((w) => w.id !== newWorkout.id)]);
        setIsModalOpen(false);

        // 2. Secondary operations: navigate & background data refresh (handled separately)
        try {
          setSavedActiveTab('index');
          router.push({ pathname: '/workout/[id]', params: { id: newWorkout.id } });
        } catch (navErr) {
          console.warn('[WorkoutsScreen] Failed navigating to editor:', navErr);
        }

        loadData().catch((err) => {
          console.warn('[WorkoutsScreen] Background refresh failed after create:', err);
        });
      } else {
        Alert.alert('Помилка', 'Не вдалося зберегти тренування');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося створити тренування');
    } finally {
      setIsCreating(false);
      isCreatingRef.current = false;
    }
  };

  // Delete workout with alert confirmation
  const handleDeleteWorkout = (workout: WorkoutPlan, onCancel?: () => void) => {
    if (!user) return;

    Alert.alert(
      'Видалити тренування?',
      `Ви впевнені, що хочете видалити «${workout.title || 'це тренування'}»?`,
      [
        {
          text: 'Скасувати',
          style: 'cancel',
          onPress: () => {
            onCancel?.();
          },
        },
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

  const handleQuickDeleteWorkout = useCallback(
    (workout: WorkoutPlan, onCancel?: () => void) => {
      handleDeleteWorkout(workout, onCancel);
    },
    [user]
  );

  // Copy workout with exercises and sets
  const handleCopyWorkout = async (source: WorkoutPlan) => {
    if (!user) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const newWorkoutId = `wo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const clonedExercises: WorkoutExercise[] = (source.exercises || []).map((ex, exIdx) => {
        const weId = `we_${Date.now()}_${exIdx}_${Math.random().toString(36).substring(2, 6)}`;
        const clonedSets: WorkoutSet[] = (ex.sets || []).map((s, sIdx) => ({
          id: `set_${Date.now()}_${exIdx}_${sIdx}_${Math.random().toString(36).substring(2, 5)}`,
          workoutExerciseId: weId,
          setNumber: sIdx + 1,
          targetRepsRange: s.targetRepsRange || ex.targetRepsRange || '8-12',
          weight: Number(s.weight) || 0,
          actualReps: s.actualReps !== null && s.actualReps !== undefined ? Number(s.actualReps) : 10,
          completedAt: null,
          isWarmup: Boolean(s.isWarmup),
        }));
        return {
          ...ex,
          id: weId,
          workoutPlanId: newWorkoutId,
          sets: clonedSets,
        };
      });

      const copied: WorkoutPlan = {
        ...source,
        id: newWorkoutId,
        userId: user.id,
        title: `${source.title || 'Тренування'} (Копія)`,
        scheduledDate: today,
        status: 'planned',
        createdAt: new Date().toISOString(),
        completedAt: null,
        exercises: clonedExercises,
      };

      const ok = await WorkoutService.saveWorkout(copied);
      if (ok) {
        setWorkouts((prev) => [copied, ...prev]);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      } else {
        Alert.alert('Помилка', 'Не вдалося скопіювати тренування');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося скопіювати тренування');
    }
  };

  // Sort workouts within each month from newest to oldest
  const sortedWorkouts = useMemo(() => {
    return [...workouts].sort((a, b) => {
      const dateA = a.scheduledDate || a.createdAt || '';
      const dateB = b.scheduledDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
  }, [workouts]);

  // Group workouts by calendar month (YYYY-MM), sorted newest to oldest
  const monthGroups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, { label: string; workouts: WorkoutPlan[] }>();
    for (const w of sortedWorkouts) {
      const { key, label } = getMonthKeyAndLabel(w.scheduledDate);
      if (!map.has(key)) {
        map.set(key, { label, workouts: [] });
      }
      map.get(key)!.workouts.push(w);
    }
    const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return keys.map((key) => ({
      key,
      label: map.get(key)!.label,
      workouts: map.get(key)!.workouts,
    }));
  }, [sortedWorkouts]);

  // Current calendar month key (e.g. "2026-10")
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Determine default open month: current month if present, otherwise newest month with workouts
  const defaultOpenKey = useMemo(() => {
    if (monthGroups.length === 0) return null;
    const hasCurrent = monthGroups.some((g) => g.key === currentMonthKey);
    return hasCurrent ? currentMonthKey : monthGroups[0].key;
  }, [monthGroups, currentMonthKey]);

  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (defaultOpenKey && Object.keys(openMonths).length === 0) {
      setOpenMonths({ [defaultOpenKey]: true });
    }
  }, [defaultOpenKey, openMonths]);

  const toggleMonth = (key: string) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpenMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
      {/* Top Navbar */}
      <Header title="Тренування" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
            colors={['#2563EB']}
          />
        }
      >
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
              Завантаження списку тренувань...
            </Text>
          </View>
        ) : workouts.length === 0 ? (
          <View style={[styles.emptyContainer, isDark ? styles.emptyDark : styles.emptyLight]}>
            <View style={[styles.emptyIconBox, isDark ? styles.emptyIconBoxDark : styles.emptyIconBoxLight]}>
              <Ionicons name="time-outline" size={26} color={isDark ? '#94A3B8' : '#64748B'} />
            </View>
            <Text style={[styles.emptyTitle, isDark ? styles.emptyTitleDark : styles.emptyTitleLight]}>
              Тренувань ще немає
            </Text>
            <Text style={[styles.emptySubtitle, isDark ? styles.emptySubtitleDark : styles.emptySubtitleLight]}>
              Створіть своє перше тренування для відстеження підходів, ваги та прогресу.
            </Text>
          </View>
        ) : (
          <View style={styles.accordionContainer}>
            {monthGroups.map((group) => {
              const isOpen = Boolean(openMonths[group.key]);

              return (
                <View key={group.key} style={styles.monthSection}>
                  {/* Month Accordion Header */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleMonth(group.key)}
                    style={[
                      styles.monthHeader,
                      isDark ? styles.monthHeaderDark : styles.monthHeaderLight,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${group.label}, ${group.workouts.length} тренувань`}
                  >
                    <View style={styles.monthHeaderLeft}>
                      <Text style={[styles.monthTitle, isDark ? styles.textDark : styles.textLight]}>
                        {group.label}
                      </Text>
                      <View style={[styles.monthCountBadge, isDark ? styles.monthCountBadgeDark : styles.monthCountBadgeLight]}>
                        <Text style={[styles.monthCountText, isDark ? styles.monthCountTextDark : styles.monthCountTextLight]}>
                          {group.workouts.length}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={isDark ? '#94A3B8' : '#64748B'}
                    />
                  </TouchableOpacity>

                  {/* Month Workouts List */}
                  {isOpen && (
                    <View style={styles.monthWorkoutsList}>
                      {group.workouts.map((w) => {
                        const isCompleted = w.status === 'completed';
                        const isInProgress = w.status === 'in_progress';
                        const exercises = w.exercises || [];
                        const totalSets = exercises.reduce((acc, ex) => acc + (ex.sets ? ex.sets.length : 0), 0);

                        return (
                          <SwipeableWorkoutCard
                            key={w.id}
                            id={w.id}
                            isDark={isDark}
                            onCopy={() => handleCopyWorkout(w)}
                            onDelete={(onCancel) => handleDeleteWorkout(w, onCancel)}
                            onQuickDelete={(onCancel) => handleQuickDeleteWorkout(w, onCancel)}
                          >
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                setSavedActiveTab('index');
                                router.push({ pathname: '/workout/[id]', params: { id: w.id } });
                              }}
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
                                            ? '#22C55E'
                                            : isInProgress
                                              ? '#60A5FA'
                                              : (isDark ? '#94A3B8' : '#64748B'),
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
                                      color={isDark ? '#94A3B8' : '#64748B'}
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
                                      color={isDark ? '#94A3B8' : '#64748B'}
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
                </View>
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
                <Ionicons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
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
                placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
              />
            </View>

            {/* Date Input with Interactive Calendar */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
                Дата (ДД/ММ/РРРР)
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsModalDatePickerOpen(true)}
                style={[
                  styles.input,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
                  isDark ? styles.inputDark : styles.inputLight,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Оберіть дату тренування"
              >
                <Ionicons name="calendar-outline" size={18} color="#2563EB" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 14, color: isDark ? '#F8FAFC' : '#0F172A' }}>
                  {formatDateDDMMYYYY(newDate)}
                </Text>
              </TouchableOpacity>

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

              <DatePickerModal
                visible={isModalDatePickerOpen}
                selectedDate={newDate}
                onClose={() => setIsModalDatePickerOpen(false)}
                onSelectDate={(newIso: string) => {
                  setNewDate(newIso);
                  setIsModalDatePickerOpen(false);
                }}
              />
            </View>

            {/* Notes Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isDark ? styles.subDark : styles.subLight]}>
                Примітки (необов’язково)
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="Цілі, самопочуття або план на день..."
                placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
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
                disabled={isCreating}
                onPress={() => setIsModalOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Створити"
                loading={isCreating}
                disabled={isCreating}
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
    backgroundColor: '#F8FAFC',
  },
  bgDark: {
    backgroundColor: '#0B1220',
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
  topSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 12,
  },
  bigNewWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bigNewWorkoutBtnLight: {
    backgroundColor: '#2563EB',
  },
  bigNewWorkoutBtnDark: {
    backgroundColor: '#2563EB',
  },
  bigNewWorkoutBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  bigNewWorkoutTextLight: {
    color: '#ffffff',
  },
  bigNewWorkoutTextDark: {
    color: '#ffffff',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 20,
    gap: 4,
  },
  filterLight: {
    backgroundColor: '#F1F5F9',
  },
  filterDark: {
    backgroundColor: '#263140',
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  filterBtnActiveLight: {
    backgroundColor: '#2563EB',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  filterBtnActiveDark: {
    backgroundColor: '#2563EB',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  filterBtnText: {
    fontSize: 13,
  },
  filterTextActiveLight: {
    color: '#ffffff',
    fontWeight: '700',
  },
  filterTextActiveDark: {
    color: '#ffffff',
    fontWeight: '700',
  },
  filterTextInactiveLight: {
    color: '#64748B',
    fontWeight: '600',
  },
  filterTextInactiveDark: {
    color: '#94A3B8',
    fontWeight: '600',
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
    paddingVertical: 56,
    paddingHorizontal: 20,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  emptyLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  emptyDark: {
    backgroundColor: '#1D2939',
    borderColor: '#334155',
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBoxLight: {
    backgroundColor: '#F1F5F9',
  },
  emptyIconBoxDark: {
    backgroundColor: '#263140',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyTitleLight: {
    color: '#0F172A',
  },
  emptyTitleDark: {
    color: '#F8FAFC',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 260,
  },
  emptySubtitleLight: {
    color: '#64748B',
  },
  emptySubtitleDark: {
    color: '#94A3B8',
  },
  accordionContainer: {
    gap: 14,
  },
  monthSection: {
    gap: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  monthHeaderLight: {
    backgroundColor: '#F1F5F9',
  },
  monthHeaderDark: {
    backgroundColor: '#263140',
  },
  monthHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  monthCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  monthCountBadgeLight: {
    backgroundColor: '#FFFFFF',
  },
  monthCountBadgeDark: {
    backgroundColor: '#1D2939',
  },
  monthCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  monthCountTextLight: {
    color: '#64748B',
  },
  monthCountTextDark: {
    color: '#94A3B8',
  },
  monthWorkoutsList: {
    gap: 10,
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
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: '#ecfdf5',
  },
  statusInProgress: {
    backgroundColor: '#eff6ff',
  },
  statusPlanned: {
    backgroundColor: '#F1F5F9',
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
    color: '#64748B',
  },
  dotDark: {
    color: '#94A3B8',
  },
  coachText: {
    fontSize: 11,
    fontWeight: '500',
  },
  coachLight: {
    color: '#2563EB',
  },
  coachDark: {
    color: '#60A5FA',
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 16,
  },
  modalLight: {
    backgroundColor: '#FFFFFF',
  },
  modalDark: {
    backgroundColor: '#1D2939',
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
    borderRadius: 20,
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
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  inputLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    color: '#0F172A',
  },
  inputDark: {
    backgroundColor: '#0B1220',
    borderColor: '#334155',
    color: '#F8FAFC',
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  chipDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
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
    borderColor: '#E2E8F0',
  },
  borderDark: {
    borderColor: '#334155',
  },
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
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
