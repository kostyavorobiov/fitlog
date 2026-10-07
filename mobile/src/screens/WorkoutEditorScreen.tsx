import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
  PanResponder,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ExerciseSelectorModal } from '../components/ExerciseSelectorModal';
import { useAuth } from '../context/AuthContext';
import { WorkoutService } from '../services/workoutService';
import { ExerciseService } from '../services/exerciseService';
import {
  WorkoutPlan,
  WorkoutExercise,
  WorkoutSet,
  Exercise,
  MuscleGroup,
  MUSCLE_GROUPS,
  PastExercisePerformance,
  REPS_RANGES,
} from '../types/workout';

import { SupersetPalette, SUPERSET_PALETTES } from '../constants/supersets';

export const computeWorkoutStatus = (exercises: WorkoutExercise[]): 'completed' | 'in_progress' => {
  if (!exercises || exercises.length === 0) return 'in_progress';
  const totalSets = exercises.reduce((acc, ex) => acc + (ex.sets ? ex.sets.length : 0), 0);
  if (totalSets === 0) return 'in_progress';
  const allSetsDone = exercises.every(
    (ex) => ex.sets && ex.sets.length > 0 && ex.sets.every((s) => Boolean(s.completedAt))
  );
  return allSetsDone ? 'completed' : 'in_progress';
};

const TITLE_PRESETS = [
  'Груди та Тріцепс',
  'Спина та Біцепс',
  'День ніг',
  'Плечі та Прес',
  'Full Body',
  'Кардіо + Кор',
];

interface SwipeableExerciseCardProps {
  onDelete: () => void;
  onChangeExercise?: () => void;
  isDark: boolean;
  children: React.ReactNode;
}

const SWIPE_ACTION_WIDTH = 76;
const SWIPE_TOTAL_WIDTH = SWIPE_ACTION_WIDTH * 2;
const SWIPE_THRESHOLD = -35;

const SwipeableExerciseCard: React.FC<SwipeableExerciseCardProps> = ({
  onDelete,
  onChangeExercise,
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
          const base = isOpenRef.current ? -SWIPE_TOTAL_WIDTH : 0;
          const newX = Math.min(0, Math.max(-SWIPE_TOTAL_WIDTH - 20, base + gestureState.dx));
          panX.setValue(newX);
        },
        onPanResponderRelease: (_, gestureState) => {
          const currentVal = (panX as any)._value ?? (isOpenRef.current ? -SWIPE_TOTAL_WIDTH : 0);
          if (gestureState.dx < -30 || currentVal < SWIPE_THRESHOLD) {
            isOpenRef.current = true;
            Animated.spring(panX, {
              toValue: -SWIPE_TOTAL_WIDTH,
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
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(panX, {
        toValue: -350,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDelete();
    });
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
    <Animated.View style={[styles.swipeContainer, { opacity: opacityAnim }]}>
      {/* Background Actions: Change (Yellow) & Delete (Red) */}
      <View style={styles.swipeActionsBg}>
        {/* Yellow Change Exercise Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            closeSwipe();
            onChangeExercise?.();
          }}
          style={styles.swipeChangeBtn}
          accessibilityLabel="Змінити вправу"
        >
          <Ionicons name="swap-horizontal" size={20} color="#09090b" />
          <Text style={styles.swipeChangeBtnText}>Змінити</Text>
        </TouchableOpacity>

        {/* Red Delete Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleDelete}
          style={styles.swipeDeleteBtn}
          accessibilityLabel="Видалити вправу"
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

interface ExerciseProgressRingProps {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  isDark?: boolean;
}

const ExerciseProgressRing: React.FC<ExerciseProgressRingProps> = ({
  completed,
  total,
  size = 30,
  strokeWidth = 2.5,
  isDark = false,
}) => {
  const isAllDone = total > 0 && completed >= total;
  const progress = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;
  const halfSize = size / 2;

  const color = isAllDone ? '#10b981' : '#3b82f6';
  const trackColor = isDark ? '#27272a' : '#e2e8f0';
  const bgFill = isAllDone
    ? 'rgba(16, 185, 129, 0.08)'
    : progress > 0
      ? 'rgba(59, 130, 246, 0.06)'
      : 'transparent';

  const rightAngle = -135 + Math.min(progress, 0.5) * 360;
  const leftAngle = progress <= 0.5 ? 45 : 45 + (progress - 0.5) * 360;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
      accessibilityLabel={`Прогрес вправи: ${completed} з ${total} підходів`}
    >
      {/* Background track circle */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: halfSize,
          borderWidth: strokeWidth,
          borderColor: trackColor,
          backgroundColor: bgFill,
        }}
      />

      {/* Progress Ring */}
      {isAllDone ? (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: halfSize,
            borderWidth: strokeWidth,
            borderColor: '#10b981',
          }}
        />
      ) : progress > 0 ? (
        <>
          {/* Right half (0 - 180 deg) */}
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: halfSize,
              height: size,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: size,
                height: size,
                borderRadius: halfSize,
                borderWidth: strokeWidth,
                borderColor: 'transparent',
                borderTopColor: color,
                borderRightColor: color,
                transform: [{ rotate: `${rightAngle}deg` }],
              }}
            />
          </View>

          {/* Left half (180 - 360 deg) */}
          {progress > 0.5 && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: halfSize,
                height: size,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: size,
                  height: size,
                  borderRadius: halfSize,
                  borderWidth: strokeWidth,
                  borderColor: 'transparent',
                  borderTopColor: color,
                  borderRightColor: color,
                  transform: [{ rotate: `${leftAngle}deg` }],
                }}
              />
            </View>
          )}
        </>
      ) : null}

      {/* Center Label / Checkmark */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isAllDone ? (
          <Ionicons name="checkmark" size={13} color="#10b981" />
        ) : (
          <Text
            style={{
              fontSize: 9,
              fontWeight: '700',
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              color:
                progress > 0
                  ? isDark
                    ? '#60a5fa'
                    : '#2563eb'
                  : isDark
                    ? '#71717a'
                    : '#a1a1aa',
              includeFontPadding: false,
              textAlign: 'center',
            }}
          >
            {total > 0 ? `${completed}/${total}` : '0'}
          </Text>
        )}
      </View>
    </View>
  );
};

export const WorkoutEditorScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, traineeId } = useLocalSearchParams<{ id: string; traineeId?: string }>();
  const { user } = useAuth();
  const targetUserId = traineeId || user?.id || '';

  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);
  const [saveNoticeMsg, setSaveNoticeMsg] = useState<string>('Збережено ✓');
  const [isTitleModalOpen, setIsTitleModalOpen] = useState<boolean>(false);
  const [lastPerformances, setLastPerformances] = useState<Record<string, PastExercisePerformance | null>>({});
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [exerciseToReplaceId, setExerciseToReplaceId] = useState<string | null>(null);
  const [activeRepsPickerWeId, setActiveRepsPickerWeId] = useState<string | null>(null);

  const handleChangeExercise = (weId: string) => {
    setExerciseToReplaceId(weId);
    setIsSelectorOpen(true);
  };

  const handleToggleExpand = (weId: string) => {
    setExpandedExerciseId((prev) => (prev === weId ? null : weId));
  };

  const workoutRef = useRef<WorkoutPlan | null>(null);
  workoutRef.current = workout;

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const exerciseLayoutsRef = useRef<{ [weId: string]: number }>({});

  // Load workout details
  const loadWorkout = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await WorkoutService.getWorkoutById(id, targetUserId);
      if (data) {
        setWorkout(data);
        workoutRef.current = data;
        loadPerformancesForWorkout(data, data.userId);
      }
    } catch (e) {
      console.warn('[WorkoutEditorScreen.loadWorkout] Error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [id, targetUserId]);

  const scrollToExerciseCard = (weId: string) => {
    setTimeout(() => {
      const y = exerciseLayoutsRef.current[weId];
      if (typeof y === 'number') {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
      }
    }, 120);
  };

  const loadPerformancesForWorkout = async (w: WorkoutPlan, ownerUserId?: string) => {
    const effectiveUserId = ownerUserId || w.userId || targetUserId;
    if (!effectiveUserId || !w.exercises) return;
    const perfs: Record<string, PastExercisePerformance | null> = {};
    for (const ex of w.exercises) {
      try {
        const perf = await WorkoutService.getLastExercisePerformance(effectiveUserId, ex.exerciseId, w.id, ex.exerciseName);
        perfs[ex.exerciseId] = perf;
      } catch {
        perfs[ex.exerciseId] = null;
      }
    }
    setLastPerformances(perfs);
  };

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  // Clean up autoSave timer
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
        if (workoutRef.current) void WorkoutService.saveWorkout(workoutRef.current);
      }
    };
  }, []);

  // Central update & persist helper
  const updateAndSave = (updated: WorkoutPlan, immediateSave: boolean = false) => {
    // Preserve trainee context: if coach is editing trainee's workout, ensure coach ID is assigned
    if (user?.id && updated.userId !== user.id && !updated.assignedByCoachId) {
      updated.assignedByCoachId = user.id;
    }

    const autoStatus = computeWorkoutStatus(updated.exercises || []);
    updated.status = autoStatus;
    updated.completedAt = autoStatus === 'completed' ? (updated.completedAt || new Date().toISOString()) : null;

    setWorkout(updated);
    workoutRef.current = updated;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (immediateSave) {
      WorkoutService.saveWorkout(updated);
    } else {
      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveTimerRef.current = null;
        if (workoutRef.current) {
          WorkoutService.saveWorkout(workoutRef.current);
        }
      }, 500);
    }
  };

  // Map superset groups to palettes
  const supersetColorMap = useMemo(() => {
    const map = new Map<string, SupersetPalette>();
    if (!workout || !workout.exercises) return map;

    const uniqueGroups: string[] = [];
    workout.exercises.forEach((e) => {
      if (e.supersetGroupId && !uniqueGroups.includes(e.supersetGroupId)) {
        uniqueGroups.push(e.supersetGroupId);
      }
    });

    uniqueGroups.forEach((groupId, idx) => {
      map.set(groupId, SUPERSET_PALETTES[idx % SUPERSET_PALETTES.length]);
    });
    return map;
  }, [workout?.exercises]);

  // Handle title change
  const handleUpdateTitle = (newTitle: string) => {
    if (!workout) return;
    const updated = { ...workout, title: newTitle };
    updateAndSave(updated);
  };

  // Handle date change
  const handleUpdateDate = (newDate: string) => {
    if (!workout) return;
    const updated = { ...workout, scheduledDate: newDate };
    updateAndSave(updated);
  };

  // Add exercise to workout
  const handleSelectExercise = async (exercise: Exercise) => {
    if (!workout || !user) return;

    const effectiveUserId = workout.userId || targetUserId || user.id;

    // Check if exercise has previous performance across workout history
    let lastPerf: PastExercisePerformance | null = null;
    try {
      lastPerf = await WorkoutService.getLastExercisePerformance(effectiveUserId, exercise.id, workout.id, exercise.name);
      setLastPerformances((prev) => ({ ...prev, [exercise.id]: lastPerf }));
    } catch (e) {
      console.warn('Error getting last exercise performance:', e);
    }

    // If coach is creating/adding exercise for trainee, automatically copy it into trainee's custom catalog
    const isTraineeWorkout = Boolean(traineeId || (workout && workout.userId && workout.userId !== user.id) || (workout && workout.assignedByCoachId));
    const effectiveTraineeId = workout.userId || traineeId;
    if (isTraineeWorkout && effectiveTraineeId && exercise.userId !== effectiveTraineeId) {
      try {
        const traineeExercises = await ExerciseService.getExercises(effectiveTraineeId);
        const exists = traineeExercises.some(
          (e) => e.name.toLowerCase().trim() === exercise.name.toLowerCase().trim()
        );
        if (!exists) {
          const cloned: Exercise = {
            ...exercise,
            id: `custom_ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            userId: effectiveTraineeId,
            isDefault: false,
            createdAt: new Date().toISOString(),
          };
          await ExerciseService.createExercise(cloned);
        }
      } catch (err) {
        console.warn('Failed to add exercise to trainee library:', err);
      }
    }

    const targetRange = (lastPerf?.sets?.[0]?.targetRepsRange || '8-12') as string;

    // Handle replace existing exercise
    if (exerciseToReplaceId) {
      const currentExercises = workout.exercises || [];
      const exIndex = currentExercises.findIndex((e) => e.id === exerciseToReplaceId);
      if (exIndex === -1) {
        setExerciseToReplaceId(null);
        setIsSelectorOpen(false);
        return;
      }

      const existingWe = currentExercises[exIndex];
      const hasCompletedSets = (existingWe.sets || []).some((s) => Boolean(s.completedAt));
      let updatedSets = existingWe.sets || [];

      if (!hasCompletedSets) {
        if (lastPerf && Array.isArray(lastPerf.sets) && lastPerf.sets.length > 0) {
          updatedSets = lastPerf.sets.map((ps, idx) => ({
            id: (existingWe.sets && existingWe.sets[idx]) ? existingWe.sets[idx].id : `set_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
            workoutExerciseId: existingWe.id,
            setNumber: idx + 1,
            targetRepsRange: ps.targetRepsRange || targetRange,
            weight: Number(ps.weight) || 20,
            actualReps: ps.actualReps !== null && ps.actualReps !== undefined ? Number(ps.actualReps) : 10,
            completedAt: null,
          }));
        } else {
          updatedSets = updatedSets.map((s) => ({
            ...s,
            targetRepsRange: targetRange,
          }));
        }
      }

      const updatedExercise: WorkoutExercise = {
        ...existingWe,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        muscleGroup: exercise.muscleGroup,
        targetRepsRange: targetRange,
        setCount: updatedSets.length,
        sets: updatedSets,
      };

      const updatedExercises = [...currentExercises];
      updatedExercises[exIndex] = updatedExercise;

      const updated: WorkoutPlan = {
        ...workout,
        exercises: updatedExercises,
      };

      updateAndSave(updated, true);
      setExerciseToReplaceId(null);
      setIsSelectorOpen(false);
      return;
    }

    const weId = `we_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Initial sets: prefill with past workout data if available
    let initialSets: WorkoutSet[] = [];
    if (lastPerf && Array.isArray(lastPerf.sets) && lastPerf.sets.length > 0) {
      initialSets = lastPerf.sets.map((ps, idx) => ({
        id: `set_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
        workoutExerciseId: weId,
        setNumber: idx + 1,
        targetRepsRange: ps.targetRepsRange || targetRange,
        weight: Number(ps.weight) || 20,
        actualReps: ps.actualReps !== null && ps.actualReps !== undefined ? Number(ps.actualReps) : 10,
        completedAt: null,
      }));
    } else {
      initialSets = [1, 2, 3].map((num) => ({
        id: `set_${Date.now()}_${num}_${Math.random().toString(36).substring(2, 5)}`,
        workoutExerciseId: weId,
        setNumber: num,
        targetRepsRange: targetRange,
        weight: 20,
        actualReps: 10,
        completedAt: null,
      }));
    }

    const currentExercises = workout.exercises || [];
    const newWorkoutExercise: WorkoutExercise = {
      id: weId,
      workoutPlanId: workout.id,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      order: currentExercises.length + 1,
      targetRepsRange: targetRange,
      setCount: initialSets.length,
      sets: initialSets,
    };

    const updated: WorkoutPlan = {
      ...workout,
      exercises: [...currentExercises, newWorkoutExercise],
    };

    updateAndSave(updated, true);
    setIsSelectorOpen(false);

    // Automatically expand newly added exercise card
    setExpandedExerciseId(weId);

    // Auto-scroll to newly added exercise smoothly
    setTimeout(() => {
      scrollToExerciseCard(weId);
    }, 150);
  };

  // Remove exercise
  const handleRemoveExercise = (weId: string) => {
    if (!workout) return;
    if (expandedExerciseId === weId) {
      setExpandedExerciseId(null);
    }
    const currentExercises = workout.exercises || [];
    const exerciseIndex = currentExercises.findIndex((e) => e.id === weId);
    if (exerciseIndex === -1) return;

    const exerciseToRemove = currentExercises[exerciseIndex];

    // Determine target exercise to scroll to:
    // If deleted is not first -> previous exercise (exerciseIndex - 1)
    // If deleted is first -> next exercise (exerciseIndex + 1)
    const targetExercise = exerciseIndex > 0
      ? currentExercises[exerciseIndex - 1]
      : currentExercises[exerciseIndex + 1];

    const targetY = targetExercise ? exerciseLayoutsRef.current[targetExercise.id] : undefined;

    let updatedExercises = currentExercises
      .filter((e) => e.id !== weId)
      .map((e, idx) => ({ ...e, order: idx + 1 }));

    // If removed exercise was in a superset, clean up any orphan
    if (exerciseToRemove?.supersetGroupId) {
      const remainingInGroup = updatedExercises.filter(
        (e) => e.supersetGroupId === exerciseToRemove.supersetGroupId
      );
      if (remainingInGroup.length <= 1) {
        updatedExercises = updatedExercises.map((e) =>
          e.supersetGroupId === exerciseToRemove.supersetGroupId
            ? { ...e, supersetGroupId: null }
            : e
        );
      }
    }

    delete exerciseLayoutsRef.current[weId];

    updateAndSave({ ...workout, exercises: updatedExercises }, true);

    // Smoothly scroll to previous or next exercise without jarring jump
    if (typeof targetY === 'number') {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 16), animated: true });
      }, 100);
    }
  };

  // Move exercise Up / Down
  const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
    if (!workout) return;
    const items = [...(workout.exercises || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    const renumbered = items.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    updateAndSave({ ...workout, exercises: renumbered }, true);
  };

  // Superset toggle logic: join adjacent or unlink
  const handleToggleSuperset = (weIndex: number) => {
    if (!workout) return;
    const items = [...(workout.exercises || [])];
    const current = items[weIndex];
    if (!current) return;

    if (current.supersetGroupId) {
      // Unlink current exercise
      const oldGroup = current.supersetGroupId;
      let updated = items.map((e) => (e.id === current.id ? { ...e, supersetGroupId: null } : e));

      // If only 1 remains in old group, clear it too
      const remaining = updated.filter((e) => e.supersetGroupId === oldGroup);
      if (remaining.length <= 1) {
        updated = updated.map((e) => (e.supersetGroupId === oldGroup ? { ...e, supersetGroupId: null } : e));
      }
      updateAndSave({ ...workout, exercises: updated }, true);
    } else {
      // Connect with neighbor
      const next = items[weIndex + 1];
      const prev = items[weIndex - 1];

      if (next && next.supersetGroupId) {
        // Join next superset
        const updated = items.map((e, idx) =>
          idx === weIndex ? { ...e, supersetGroupId: next.supersetGroupId } : e
        );
        updateAndSave({ ...workout, exercises: updated }, true);
      } else if (prev && prev.supersetGroupId) {
        // Join prev superset
        const updated = items.map((e, idx) =>
          idx === weIndex ? { ...e, supersetGroupId: prev.supersetGroupId } : e
        );
        updateAndSave({ ...workout, exercises: updated }, true);
      } else if (next) {
        // Create new superset with next
        const newGroupId = `SS-${Date.now().toString().slice(-4)}`;
        const updated = items.map((e, idx) =>
          idx === weIndex || idx === weIndex + 1 ? { ...e, supersetGroupId: newGroupId } : e
        );
        updateAndSave({ ...workout, exercises: updated }, true);
      } else if (prev) {
        // Create new superset with prev
        const newGroupId = `SS-${Date.now().toString().slice(-4)}`;
        const updated = items.map((e, idx) =>
          idx === weIndex || idx === weIndex - 1 ? { ...e, supersetGroupId: newGroupId } : e
        );
        updateAndSave({ ...workout, exercises: updated }, true);
      }
    }
  };

  // Change target reps range
  const handleTargetRepsRangeChange = (weId: string, range: string) => {
    if (!workout) return;
    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const updatedSets = (e.sets || []).map((s) => ({ ...s, targetRepsRange: range }));
        return { ...e, targetRepsRange: range, sets: updatedSets };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Quick set count change (2, 3, 4, 5)
  const handleSetCountChange = (weId: string, count: number) => {
    if (!workout) return;
    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        let sets = [...(e.sets || [])];
        if (count > sets.length) {
          const lastSet = sets[sets.length - 1];
          for (let i = sets.length; i < count; i++) {
            sets.push({
              id: `set_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
              workoutExerciseId: weId,
              setNumber: i + 1,
              targetRepsRange: e.targetRepsRange || lastSet?.targetRepsRange || '8-12',
              weight: lastSet?.weight || 20,
              actualReps: lastSet?.actualReps || 10,
              completedAt: null,
            });
          }
        } else if (count < sets.length) {
          sets = sets.slice(0, count);
        }
        return { ...e, setCount: count, sets };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises }, true);
  };

  // Add individual set
  const handleAddSet = (weId: string) => {
    if (!workout) return;
    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const sets = e.sets || [];
        const lastSet = sets[sets.length - 1];
        const newSet: WorkoutSet = {
          id: `set_${Date.now()}_${sets.length}_${Math.random().toString(36).substring(2, 5)}`,
          workoutExerciseId: weId,
          setNumber: sets.length + 1,
          targetRepsRange: e.targetRepsRange || lastSet?.targetRepsRange || '8-12',
          weight: lastSet?.weight || 20,
          actualReps: lastSet?.actualReps || 10,
          completedAt: null,
        };
        const newSets = [...sets, newSet];
        return { ...e, setCount: newSets.length, sets: newSets };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises }, true);
  };

  // Remove individual set
  const handleRemoveSet = (weId: string, setId: string) => {
    if (!workout) return;
    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const filtered = (e.sets || []).filter((s) => s.id !== setId);
        const renumbered = filtered.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
        return { ...e, setCount: renumbered.length, sets: renumbered };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises }, true);
  };

  // Update set weight / reps directly
  const handleUpdateSet = (
    weId: string,
    setId: string,
    field: 'weight' | 'actualReps',
    value: number | null
  ) => {
    if (!workout) return;
    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const updatedSets = (e.sets || []).map((s) => {
          if (s.id === setId) {
            return { ...s, [field]: value };
          }
          return s;
        });
        return { ...e, sets: updatedSets };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Step adjust weight (+/- 1) or reps (+/- 1)
  const handleStepAdjust = (
    weId: string,
    setId: string,
    field: 'weight' | 'actualReps',
    delta: number
  ) => {
    if (!workout) return;
    const currentEx = (workout.exercises || []).find((e) => e.id === weId);
    const currentSet = currentEx?.sets?.find((s) => s.id === setId);
    if (!currentSet) return;

    const currentVal = field === 'weight' ? currentSet.weight : (currentSet.actualReps ?? 10);
    const nextVal = Math.max(0, Math.round((currentVal + delta) * 10) / 10);
    handleUpdateSet(weId, setId, field, nextVal);
  };

  // Toggle set completed
  const handleToggleCompleteSet = (weId: string, setItem: WorkoutSet) => {
    if (!workout) return;
    const isNowCompleted = !setItem.completedAt;
    const completedAt = isNowCompleted ? new Date().toISOString() : null;

    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const updatedSets = (e.sets || []).map((s) => {
          if (s.id === setItem.id) {
            return { ...s, completedAt };
          }
          return s;
        });
        return { ...e, sets: updatedSets };
      }
      return e;
    });

    const updatedWorkout: WorkoutPlan = {
      ...workout,
      exercises: updatedExercises,
    };

    updateAndSave(updatedWorkout, true);

    // Auto-advance logic
    if (isNowCompleted) {
      const currentEx = updatedExercises.find((e) => e.id === weId);
      if (currentEx) {
        // Superset navigation: cycle exercises or advance when superset is completed
        if (currentEx.supersetGroupId) {
          const supersetExercises = updatedExercises.filter(
            (e) => e.supersetGroupId === currentEx.supersetGroupId
          );
          if (supersetExercises.length > 1) {
            // Check if all sets of all exercises in this superset are completed
            const isAllSupersetCompleted = supersetExercises.every(
              (e) => e.sets && e.sets.length > 0 && e.sets.every((s) => Boolean(s.completedAt))
            );

            if (isAllSupersetCompleted) {
              // Find the index of the last exercise belonging to this superset in the workout
              let lastSupersetExIndex = -1;
              for (let i = 0; i < updatedExercises.length; i++) {
                if (updatedExercises[i].supersetGroupId === currentEx.supersetGroupId) {
                  lastSupersetExIndex = i;
                }
              }

              if (lastSupersetExIndex >= 0 && lastSupersetExIndex < updatedExercises.length - 1) {
                // Next exercise in workout after the superset
                const nextExAfterSuperset = updatedExercises[lastSupersetExIndex + 1];
                setExpandedExerciseId(nextExAfterSuperset.id);
                scrollToExerciseCard(nextExAfterSuperset.id);
              } else {
                // Superset is at the end of workout: open the last exercise
                const lastEx = updatedExercises[updatedExercises.length - 1];
                if (lastEx) {
                  setExpandedExerciseId(lastEx.id);
                  scrollToExerciseCard(lastEx.id);
                }
              }
              return;
            }

            // Superset is still in progress: find next exercise with remaining sets, cycling forward
            const currentIdxInSuperset = supersetExercises.findIndex((e) => e.id === currentEx.id);
            let nextEx: WorkoutExercise | null = null;
            for (let step = 1; step <= supersetExercises.length; step++) {
              const candidate = supersetExercises[(currentIdxInSuperset + step) % supersetExercises.length];
              if (candidate.sets && candidate.sets.some((s) => !s.completedAt)) {
                nextEx = candidate;
                break;
              }
            }
            if (!nextEx) {
              const nextIdxInSuperset = (currentIdxInSuperset + 1) % supersetExercises.length;
              nextEx = supersetExercises[nextIdxInSuperset];
            }

            if (nextEx) {
              setExpandedExerciseId(nextEx.id);
              scrollToExerciseCard(nextEx.id);
            }
            return;
          }
        }

        // Regular exercise: after all sets are completed, advance to next exercise in workout
        const isAllSetsOfExCompleted =
          currentEx.sets &&
          currentEx.sets.length > 0 &&
          currentEx.sets.every((s) => Boolean(s.completedAt));

        if (isAllSetsOfExCompleted) {
          const currentExIndex = updatedExercises.findIndex((e) => e.id === weId);
          if (currentExIndex < updatedExercises.length - 1) {
            const nextEx = updatedExercises[currentExIndex + 1];
            if (nextEx) {
              setExpandedExerciseId(nextEx.id);
              scrollToExerciseCard(nextEx.id);
            }
          }
        }
      }
    }
  };

  // Toggle warmup flag
  const handleToggleWarmup = (weId: string, setId: string) => {
    if (!workout) return;
    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const updatedSets = (e.sets || []).map((s) => {
          if (s.id === setId) {
            return { ...s, isWarmup: !s.isWarmup };
          }
          return s;
        });
        return { ...e, sets: updatedSets };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises }, true);
  };

  // Refill this exercise with previous performance
  const handleApplyPreviousPerformance = (weId: string, exerciseId: string) => {
    const perf = lastPerformances[exerciseId];
    if (!workout || !perf || !perf.sets || perf.sets.length === 0) {
      Alert.alert('Інформація', 'Для цієї вправи ще немає попередніх записів');
      return;
    }

    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const sets: WorkoutSet[] = perf.sets.map((ps, idx) => ({
          id: `set_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
          workoutExerciseId: weId,
          setNumber: idx + 1,
          targetRepsRange: ps.targetRepsRange || e.targetRepsRange || '8-12',
          weight: Number(ps.weight) || 20,
          actualReps: ps.actualReps !== null && ps.actualReps !== undefined ? Number(ps.actualReps) : 10,
          completedAt: null,
        }));
        return {
          ...e,
          setCount: sets.length,
          sets,
        };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises }, true);
    Alert.alert('Успішно', 'Попередні підходи та ваги заповнено!');
  };

  // Repeat entire previous workout
  const handleRepeatPreviousWorkout = async () => {
    if (!workout) return;
    const effectiveUserId = workout.userId || targetUserId;
    if (!effectiveUserId) return;

    try {
      const prev = await WorkoutService.getPreviousWorkoutToRepeat(effectiveUserId, workout.id, workout.title);
      if (!prev || !prev.exercises || prev.exercises.length === 0) {
        Alert.alert(
          'Немає тренувань',
          'Попередніх тренувань з вправами для повторення не знайдено.'
        );
        return;
      }

      Alert.alert(
        'Повторити тренування?',
        `Завантажити вправи з «${prev.title}» (${prev.scheduledDate}) із попередніми вагою та повтореннями?`,
        [
          { text: 'Скасувати', style: 'cancel' },
          {
            text: 'Повторити',
            style: 'default',
            onPress: () => {
              const newExercises: WorkoutExercise[] = prev.exercises.map((pe, exIdx) => {
                const weId = `we_${Date.now()}_${exIdx}_${Math.random().toString(36).substring(2, 6)}`;
                const newSets: WorkoutSet[] = (pe.sets || []).map((ps, sIdx) => ({
                  id: `set_${Date.now()}_${exIdx}_${sIdx}_${Math.random().toString(36).substring(2, 5)}`,
                  workoutExerciseId: weId,
                  setNumber: sIdx + 1,
                  targetRepsRange: ps.targetRepsRange || '8-12',
                  weight: Number(ps.weight) || 20,
                  actualReps: ps.actualReps !== null && ps.actualReps !== undefined ? Number(ps.actualReps) : 10,
                  completedAt: null,
                  isWarmup: Boolean(ps.isWarmup),
                }));

                return {
                  id: weId,
                  workoutPlanId: workout.id,
                  exerciseId: pe.exerciseId,
                  exerciseName: pe.exerciseName,
                  muscleGroup: pe.muscleGroup,
                  order: exIdx + 1,
                  targetRepsRange: pe.targetRepsRange || '8-12',
                  setCount: newSets.length,
                  supersetGroupId: pe.supersetGroupId || null,
                  sets: newSets,
                };
              });

              const updated: WorkoutPlan = {
                ...workout,
                exercises: newExercises,
              };

              updateAndSave(updated, true);
              loadPerformancesForWorkout(updated);
              setSaveNoticeMsg('Тренування заповнено з попереднього!');
              setSaveSuccessNotice(true);
              setTimeout(() => setSaveSuccessNotice(false), 3000);
            },
          },
        ]
      );
    } catch (e) {
      console.warn('Error repeating previous workout:', e);
    }
  };

  // Explicit Save
  const handleSaveWorkout = async () => {
    if (!workout) return;
    setIsSaving(true);
    try {
      const ok = await WorkoutService.saveWorkout(workout);
      if (ok) {
        setSaveNoticeMsg('Зміни успішно збережено!');
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 2500);
      } else {
        Alert.alert('Помилка', 'Не вдалося зберегти тренування');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Completed status
  const handleToggleStatus = async () => {
    if (!workout) return;
    const isNowDone = workout.status !== 'completed';
    const updated: WorkoutPlan = {
      ...workout,
      status: isNowDone ? 'completed' : 'in_progress',
      completedAt: isNowDone ? new Date().toISOString() : null,
    };
    updateAndSave(updated, true);
  };

  // Delete workout
  const handleDeleteWorkout = () => {
    if (!workout || !user) return;

    Alert.alert(
      'Видалити тренування?',
      `Ви впевнені, що хочете видалити «${workout.title || 'це тренування'}»?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
              }
              const effectiveUserId = workout.userId || targetUserId;
              const ok = await WorkoutService.deleteWorkout(
                effectiveUserId,
                workout.id,
                user?.id
              );
              if (ok) {
                router.back();
              } else {
                Alert.alert('Помилка', 'Не вдалося видалити тренування');
              }
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
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
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fafafa' : '#09090b'} />
          </TouchableOpacity>
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={[styles.errorTitle, isDark ? styles.textDark : styles.textLight]}>
            Тренування не знайдено
          </Text>
          <Button title="Назад" variant="outline" onPress={() => router.back()} style={{ marginTop: 12 }} />
        </View>
      </SafeAreaView>
    );
  }

  const exercises = workout.exercises || [];
  const isCompleted = workout.status === 'completed';
  const totalSets = exercises.reduce((acc, ex) => acc + (ex.sets ? ex.sets.length : 0), 0);
  const completedSets = exercises.reduce(
    (acc, ex) => acc + (ex.sets || []).filter((s) => Boolean(s.completedAt)).length,
    0
  );

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
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={isDark ? '#fafafa' : '#09090b'} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={[styles.topBarTitle, isDark ? styles.textDark : styles.textLight]}>
            {workout.title || 'Тренування'}
          </Text>
          <Text style={[styles.topBarSub, isDark ? styles.subDark : styles.subLight]}>
            {workout.scheduledDate} • {isCompleted ? 'Виконано ✓' : 'В процесі ⚡'} ({completedSets}/{totalSets} підходів)
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.iconBtn}
            disabled={isDeleting}
            onPress={handleDeleteWorkout}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.contentScroll,
            { paddingBottom: 40 + Math.max(insets.bottom, 16) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Workout Metadata Card */}
          <Card style={styles.metaCard}>
            <View style={styles.metaHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.labelSmall, isDark ? styles.subDark : styles.subLight]}>
                  Назва тренування
                </Text>
                <TextInput
                  style={[styles.titleInput, isDark ? styles.textDark : styles.textLight]}
                  value={workout.title}
                  onChangeText={handleUpdateTitle}
                  placeholder="Введіть назву..."
                  placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                  returnKeyType="done"
                />
              </View>

              <View style={{ width: 120 }}>
                <Text style={[styles.labelSmall, isDark ? styles.subDark : styles.subLight]}>
                  Дата
                </Text>
                <TextInput
                  style={[styles.dateInput, isDark ? styles.textDark : styles.textLight]}
                  value={workout.scheduledDate}
                  onChangeText={handleUpdateDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                  returnKeyType="done"
                />
              </View>
            </View>

            {/* Title Presets Horizontal Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsList}>
              {TITLE_PRESETS.map((preset) => {
                const isSelected = workout.title === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    activeOpacity={0.7}
                    onPress={() => handleUpdateTitle(preset)}
                    style={[
                      styles.presetChip,
                      isSelected
                        ? (isDark ? styles.presetChipActiveDark : styles.presetChipActiveLight)
                        : (isDark ? styles.presetChipDark : styles.presetChipLight),
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        isSelected
                          ? (isDark ? styles.presetChipTextActiveDark : styles.presetChipTextActiveLight)
                          : (isDark ? styles.subDark : styles.subLight),
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Quick Metrics Bar */}
            <View style={[styles.metaDivider, isDark ? styles.borderDark : styles.borderLight]} />
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, isDark ? styles.textDark : styles.textLight]}>
                  {exercises.length}
                </Text>
                <Text style={[styles.metricLbl, isDark ? styles.subDark : styles.subLight]}>
                  вправ
                </Text>
              </View>

              <View style={[styles.metricDivider, isDark ? styles.borderDark : styles.borderLight]} />

              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, isDark ? styles.textDark : styles.textLight]}>
                  {completedSets}/{totalSets}
                </Text>
                <Text style={[styles.metricLbl, isDark ? styles.subDark : styles.subLight]}>
                  підходів
                </Text>
              </View>

              <View style={[styles.metricDivider, isDark ? styles.borderDark : styles.borderLight]} />

              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, isDark ? styles.textDark : styles.textLight]}>
                  {totalVolume > 0 ? `${totalVolume} кг` : '—'}
                </Text>
                <Text style={[styles.metricLbl, isDark ? styles.subDark : styles.subLight]}>
                  тоннаж
                </Text>
              </View>
            </View>
          </Card>

          {/* Empty Prompt if empty */}
          {exercises.length === 0 && (
            <Card style={styles.emptyPromptCard}>
              <Ionicons name="barbell-outline" size={36} color={isDark ? '#71717a' : '#a1a1aa'} />
              <Text style={[styles.emptyPromptTitle, isDark ? styles.textDark : styles.textLight]}>
                У цьому тренуванні ще немає вправ
              </Text>
              <Text style={[styles.emptyPromptSub, isDark ? styles.subDark : styles.subLight]}>
                Додайте вправи з каталогу нижче, щоб розпочати тренування.
              </Text>
            </Card>
          )}

          {/* Exercises List */}
          {exercises.map((ex, exIndex) => {
            const muscle = MUSCLE_GROUPS[ex.muscleGroup || 'other'] || MUSCLE_GROUPS.other;
            const isSuperset = Boolean(ex.supersetGroupId);
            const palette = ex.supersetGroupId ? supersetColorMap.get(ex.supersetGroupId) : null;
            const pastPerf = lastPerformances[ex.exerciseId];
            const isExpanded = expandedExerciseId === ex.id;

            return (
              <View
                key={ex.id || `ex_${exIndex}`}
                onLayout={(e) => {
                  exerciseLayoutsRef.current[ex.id] = e.nativeEvent.layout.y;
                }}
                style={[
                  styles.exerciseCardWrap,
                  isSuperset && palette && { borderLeftColor: palette.borderColor, borderLeftWidth: 4 },
                ]}
              >
                <SwipeableExerciseCard
                  onDelete={() => handleRemoveExercise(ex.id)}
                  onChangeExercise={() => handleChangeExercise(ex.id)}
                  isDark={isDark}
                >
                  <Card style={styles.exerciseCard}>
                    {/* Exercise Card Header */}
                    <View style={[styles.exHeader, isExpanded && (isDark ? styles.borderBottomDark : styles.borderBottomLight)]}>
                      {/* Index/Reorder, Name & Collapsed Summary */}
                      <View style={styles.exHeaderTitleRow}>
                        {/* Vertical Reorder Stepper (Up/Down) */}
                        <View style={styles.reorderColumn}>
                          <TouchableOpacity
                            activeOpacity={0.6}
                            disabled={exIndex === 0}
                            onPress={() => handleMoveExercise(exIndex, 'up')}
                            style={[styles.reorderBtn, exIndex === 0 && { opacity: 0.25 }]}
                            hitSlop={{ top: 8, bottom: 2, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name="chevron-up"
                              size={16}
                              color={exIndex === 0 ? (isDark ? '#52525b' : '#94a3b8') : (isDark ? '#e4e4e7' : '#334155')}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.6}
                            disabled={exIndex === exercises.length - 1}
                            onPress={() => handleMoveExercise(exIndex, 'down')}
                            style={[styles.reorderBtn, exIndex === exercises.length - 1 && { opacity: 0.25 }]}
                            hitSlop={{ top: 2, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name="chevron-down"
                              size={16}
                              color={exIndex === exercises.length - 1 ? (isDark ? '#52525b' : '#94a3b8') : (isDark ? '#e4e4e7' : '#334155')}
                            />
                          </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleToggleExpand(ex.id)}
                          style={styles.exHeaderLeftTouchable}
                        >
                          <View style={styles.exTitleContainer}>
                            <Text
                              numberOfLines={2}
                              style={[styles.exTitleText, isDark ? styles.textDark : styles.textLight]}
                            >
                              {ex.exerciseName || 'Вправа'}
                            </Text>
                            {isSuperset && palette && (
                              <View style={styles.exBadgeRow}>
                                <View
                                  style={[
                                    styles.supersetBadge,
                                    { backgroundColor: palette.badgeBg, borderColor: palette.badgeBorder },
                                  ]}
                                >
                                  <Ionicons name="link" size={10} color={palette.badgeText} />
                                  <Text style={[styles.supersetBadgeText, { color: palette.badgeText }]}>
                                    Суперсет
                                  </Text>
                                </View>
                              </View>
                            )}
                            {!isExpanded && (
                              <View style={styles.collapsedSummaryRow}>
                                <Text style={[styles.collapsedSummaryText, isDark ? styles.subDark : styles.subLight]}>
                                  {(ex.sets || []).length} підходи • {ex.targetRepsRange || ex.sets?.[0]?.targetRepsRange || '8-12'} повт.
                                </Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>

                        {/* Action buttons (Delete, Superset & Toggle) */}
                        <View style={styles.exCardActions}>
                          {exercises.length > 1 && (
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => handleToggleSuperset(exIndex)}
                              style={[
                                styles.supersetToggleBtn,
                                isSuperset && palette
                                  ? { backgroundColor: palette.buttonActiveBg, borderColor: palette.buttonActiveBorder }
                                  : (isDark ? styles.actionBtnDark : styles.actionBtnLight),
                              ]}
                              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            >
                              <Ionicons
                                name={isSuperset ? 'unlink' : 'link'}
                                size={15}
                                color={isSuperset && palette ? palette.buttonActiveText : (isDark ? '#a1a1aa' : '#71717a')}
                              />
                            </TouchableOpacity>
                          )}

                          <ExerciseProgressRing
                            completed={(ex.sets || []).filter((s) => Boolean(s.completedAt)).length}
                            total={(ex.sets || []).length}
                            size={30}
                            isDark={isDark}
                          />
                        </View>
                      </View>
                    </View>

                    {isExpanded && (
                      <>
                        {/* Target Rep Range Dropdown Bar (Sets count row deleted) */}
                        <View style={[styles.quickSelectorsRow, isDark ? styles.quickSelectorsRowDark : styles.quickSelectorsRowLight]}>
                          <View style={styles.repsDropdownRow}>
                            <Text style={[styles.selectorLabel, isDark ? styles.subDark : styles.subLight]}>
                              Діапазон повторень:
                            </Text>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => setActiveRepsPickerWeId(ex.id)}
                              style={[
                                styles.repsDropdownBtn,
                                isDark ? styles.repsDropdownBtnDark : styles.repsDropdownBtnLight,
                              ]}
                            >
                              <Text style={[styles.repsDropdownBtnText, isDark ? styles.textDark : styles.textLight]}>
                                {ex.targetRepsRange || ex.sets?.[0]?.targetRepsRange || '8-12'}
                              </Text>
                              <Ionicons name="chevron-down" size={13} color={isDark ? '#a1a1aa' : '#71717a'} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Sets Table */}
                        <View style={styles.setsTable}>
                          {/* Table Header */}
                          <View style={[styles.tableHeaderRow, isDark ? styles.borderDark : styles.borderLight]}>
                            <Text style={[styles.thCell, styles.thSet, isDark ? styles.subDark : styles.subLight]}>
                              Сет
                            </Text>
                            <Text style={[styles.thCell, styles.thWeight, isDark ? styles.subDark : styles.subLight]}>
                              Вага (кг)
                            </Text>
                            <Text style={[styles.thCell, styles.thReps, isDark ? styles.subDark : styles.subLight]}>
                              Повторення
                            </Text>
                            <Text style={[styles.thCell, styles.thAction, isDark ? styles.subDark : styles.subLight]}>
                            </Text>
                          </View>

                          {/* Table Rows */}
                          {(ex.sets || []).map((s, sIndex) => {
                            const isDone = Boolean(s.completedAt);
                            return (
                              <View
                                key={s.id || `s_${sIndex}`}
                                style={[
                                  styles.setTableRow,
                                  isDone && (isDark ? styles.setRowDoneDark : styles.setRowDoneLight),
                                  sIndex > 0 && [styles.setRowDivider, isDark ? styles.borderDark : styles.borderLight],
                                ]}
                              >
                                {/* Set number */}
                                <TouchableOpacity
                                  activeOpacity={0.7}
                                  onPress={() => handleToggleWarmup(ex.id, s.id)}
                                  style={styles.tdSet}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Text
                                    style={[
                                      styles.setNumberText,
                                      s.isWarmup ? styles.warmupText : (isDark ? styles.textDark : styles.textLight),
                                    ]}
                                  >
                                    {s.setNumber || sIndex + 1}
                                    {s.isWarmup ? ' (Р)' : ''}
                                  </Text>
                                </TouchableOpacity>

                                {/* Weight numeric input + steppers */}
                                <View style={styles.tdWeight}>
                                  <View style={styles.stepperContainer}>
                                    <TouchableOpacity
                                      activeOpacity={0.6}
                                      onPress={() => handleStepAdjust(ex.id, s.id, 'weight', -1)}
                                      style={[styles.stepBtn, isDark ? styles.stepBtnDark : styles.stepBtnLight]}
                                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                    >
                                      <Text style={[styles.stepBtnText, isDark ? styles.textDark : styles.textLight]}>
                                        -
                                      </Text>
                                    </TouchableOpacity>

                                    <TextInput
                                      style={[styles.numberInput, isDark ? styles.inputDark : styles.inputLight]}
                                      keyboardType="decimal-pad"
                                      inputMode="decimal"
                                      value={s.weight !== null && s.weight !== undefined ? String(s.weight) : ''}
                                      onChangeText={(val) => {
                                        const clean = val.replace(',', '.');
                                        const parsed = parseFloat(clean);
                                        handleUpdateSet(ex.id, s.id, 'weight', isNaN(parsed) ? 0 : parsed);
                                      }}
                                      selectTextOnFocus
                                    />

                                    <TouchableOpacity
                                      activeOpacity={0.6}
                                      onPress={() => handleStepAdjust(ex.id, s.id, 'weight', 1)}
                                      style={[styles.stepBtn, isDark ? styles.stepBtnDark : styles.stepBtnLight]}
                                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                    >
                                      <Text style={[styles.stepBtnText, isDark ? styles.textDark : styles.textLight]}>
                                        +
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>

                                {/* Actual Reps numeric input + steppers */}
                                <View style={styles.tdReps}>
                                  <View style={styles.stepperContainer}>
                                    <TouchableOpacity
                                      activeOpacity={0.6}
                                      onPress={() => handleStepAdjust(ex.id, s.id, 'actualReps', -1)}
                                      style={[styles.stepBtn, isDark ? styles.stepBtnDark : styles.stepBtnLight]}
                                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                    >
                                      <Text style={[styles.stepBtnText, isDark ? styles.textDark : styles.textLight]}>
                                        -
                                      </Text>
                                    </TouchableOpacity>

                                    <TextInput
                                      style={[styles.numberInput, isDark ? styles.inputDark : styles.inputLight]}
                                      keyboardType="number-pad"
                                      inputMode="numeric"
                                      value={s.actualReps !== null && s.actualReps !== undefined ? String(s.actualReps) : ''}
                                      onChangeText={(val) => {
                                        const parsed = parseInt(val, 10);
                                        handleUpdateSet(ex.id, s.id, 'actualReps', isNaN(parsed) ? 0 : parsed);
                                      }}
                                      selectTextOnFocus
                                    />

                                    <TouchableOpacity
                                      activeOpacity={0.6}
                                      onPress={() => handleStepAdjust(ex.id, s.id, 'actualReps', 1)}
                                      style={[styles.stepBtn, isDark ? styles.stepBtnDark : styles.stepBtnLight]}
                                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                    >
                                      <Text style={[styles.stepBtnText, isDark ? styles.textDark : styles.textLight]}>
                                        +
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>

                                {/* Completed toggle */}
                                <TouchableOpacity
                                  activeOpacity={0.7}
                                  onPress={() => handleToggleCompleteSet(ex.id, s)}
                                  style={styles.tdDone}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Ionicons
                                    name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={26}
                                    color={isDone ? '#10b981' : (isDark ? '#52525b' : '#d4d4d8')}
                                  />
                                </TouchableOpacity>

                                {/* Remove set */}
                                <TouchableOpacity
                                  activeOpacity={0.7}
                                  onPress={() => handleRemoveSet(ex.id, s.id)}
                                  style={styles.tdAction}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Ionicons name="close" size={18} color={isDark ? '#71717a' : '#a1a1aa'} />
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>

                        {/* Add set button */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleAddSet(ex.id)}
                          style={[styles.addSetBtn, isDark ? styles.borderDark : styles.borderLight]}
                        >
                          <Ionicons name="add" size={16} color={isDark ? '#fafafa' : '#09090b'} />
                          <Text style={[styles.addSetBtnText, isDark ? styles.textDark : styles.textLight]}>
                            Додати підхід
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </Card>
                </SwipeableExerciseCard>
              </View>
            );
          })}

          {/* Add Exercise Big Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsSelectorOpen(true)}
            style={[styles.bigAddExerciseBtn, isDark ? styles.borderDark : styles.borderLight]}
          >
            <Ionicons name="add" size={20} color={isDark ? '#fafafa' : '#09090b'} />
            <Text style={[styles.bigAddExerciseText, isDark ? styles.textDark : styles.textLight]}>
              Додати вправу з каталогу
            </Text>
          </TouchableOpacity>

          {/* Delete Workout Secondary Option at Bottom */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleDeleteWorkout}
            style={[
              styles.deleteWorkoutBottomBtn,
              isDark ? styles.deleteWorkoutBottomBtnDark : styles.deleteWorkoutBottomBtnLight,
            ]}
          >
            <Ionicons name="trash-outline" size={17} color="#ef4444" />
            <Text style={styles.deleteWorkoutBottomBtnText}>Видалити тренування</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Exercise Selector Modal */}
      <ExerciseSelectorModal
        visible={isSelectorOpen}
        userId={(workout?.userId || traineeId || user?.id)}
        onClose={() => {
          setIsSelectorOpen(false);
          setExerciseToReplaceId(null);
        }}
        onSelectExercise={handleSelectExercise}
      />

      {/* Reps Range Picker Modal */}
      <Modal
        visible={Boolean(activeRepsPickerWeId)}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveRepsPickerWeId(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setActiveRepsPickerWeId(null)}
          style={styles.repsModalOverlay}
        >
          <View
            style={[
              styles.repsModalContent,
              isDark ? styles.repsModalDark : styles.repsModalLight,
            ]}
          >
            <View style={styles.repsModalHeader}>
              <Text style={[styles.repsModalTitle, isDark ? styles.textDark : styles.textLight]}>
                Повторити:
              </Text>
              <TouchableOpacity
                onPress={() => setActiveRepsPickerWeId(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={isDark ? '#a1a1aa' : '#71717a'} />
              </TouchableOpacity>
            </View>

            <View style={styles.repsModalList}>
              {REPS_RANGES.map((rng) => {
                const currentEx = exercises.find((e) => e.id === activeRepsPickerWeId);
                const isSelected = (currentEx?.targetRepsRange || currentEx?.sets?.[0]?.targetRepsRange || '8-12') === rng;

                return (
                  <TouchableOpacity
                    key={rng}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (activeRepsPickerWeId) {
                        handleTargetRepsRangeChange(activeRepsPickerWeId, rng);
                      }
                      setActiveRepsPickerWeId(null);
                    }}
                    style={[
                      styles.repsModalItem,
                      isSelected && (isDark ? styles.repsModalItemActiveDark : styles.repsModalItemActiveLight),
                    ]}
                  >
                    <Text
                      style={[
                        styles.repsModalItemText,
                        isSelected
                          ? (isDark ? styles.repsModalItemTextActiveDark : styles.repsModalItemTextActiveLight)
                          : (isDark ? styles.textDark : styles.textLight),
                      ]}
                    >
                      {rng}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={isDark ? '#fafafa' : '#18181b'}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    backgroundColor: '#09090b',
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
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  saveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  saveBannerText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  contentScroll: {
    padding: 14,
    gap: 14,
    paddingBottom: 110,
  },
  metaCard: {
    padding: 14,
    gap: 12,
  },
  metaHeaderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  titleInput: {
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 4,
  },
  dateInput: {
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 4,
  },
  presetsList: {
    gap: 6,
    paddingVertical: 4,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetChipLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  presetChipDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  presetChipActiveLight: {
    backgroundColor: '#18181b',
    borderColor: '#18181b',
  },
  presetChipActiveDark: {
    backgroundColor: '#f4f4f5',
    borderColor: '#f4f4f5',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  presetChipTextActiveLight: {
    color: '#ffffff',
  },
  presetChipTextActiveDark: {
    color: '#09090b',
  },
  metaDivider: {
    height: 1,
    borderTopWidth: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 2,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '700',
  },
  metricLbl: {
    fontSize: 10,
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 20,
    borderRightWidth: 1,
  },
  emptyPromptCard: {
    alignItems: 'center',
    padding: 24,
    gap: 10,
    borderStyle: 'dashed',
  },
  emptyPromptTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyPromptSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyPromptButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    width: '100%',
  },
  exerciseCardWrap: {
    borderRadius: 12,
  },
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
  },
  swipeActionsBg: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 152,
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 1,
  },
  swipeChangeBtn: {
    width: 76,
    height: '100%',
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeChangeBtnText: {
    color: '#09090b',
    fontSize: 11,
    fontWeight: '700',
  },
  swipeDeleteBtn: {
    width: 76,
    height: '100%',
    backgroundColor: '#ef4444',
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
    borderRadius: 12,
    zIndex: 2,
  },
  exerciseCard: {
    padding: 12,
    gap: 10,
  },
  exHeader: {
    gap: 6,
  },
  borderBottomLight: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  borderBottomDark: {
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingBottom: 8,
  },
  exHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reorderColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
    marginTop: -2,
  },
  reorderBtn: {
    paddingVertical: 0,
    paddingHorizontal: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exHeaderLeftTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  collapsedSummaryRow: {
    marginTop: 3,
  },
  collapsedSummaryText: {
    fontSize: 11,
    fontWeight: '500',
  },
  exIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1,
  },
  exIndexLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  exIndexDark: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
  },
  exIndexText: {
    fontSize: 11,
    fontWeight: '700',
  },
  exTitleContainer: {
    flex: 1,
  },
  exTitleText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  exBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  muscleTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  muscleTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  supersetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  supersetBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  exCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    padding: 7,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  actionBtnDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  supersetToggleBtn: {
    padding: 7,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  pastPerfBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pastPerfLight: {
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
  },
  pastPerfDark: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
  },
  pastPerfText: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '500',
  },
  pastPerfApply: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '700',
  },
  quickSelectorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickSelectorsRowLight: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  quickSelectorsRowDark: {
    backgroundColor: '#18181b',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  repsDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectorLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  repsDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  repsDropdownBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  repsDropdownBtnDark: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
  },
  repsDropdownBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  repsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  repsModalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  repsModalLight: {
    backgroundColor: '#ffffff',
  },
  repsModalDark: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  repsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  repsModalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  repsModalList: {
    gap: 4,
  },
  repsModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  repsModalItemActiveLight: {
    backgroundColor: '#f1f5f9',
  },
  repsModalItemActiveDark: {
    backgroundColor: '#27272a',
  },
  repsModalItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  repsModalItemTextActiveLight: {
    fontWeight: '700',
    color: '#09090b',
  },
  repsModalItemTextActiveDark: {
    fontWeight: '700',
    color: '#fafafa',
  },
  setsTable: {
    marginTop: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  thCell: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  thSet: {
    width: 32,
    textAlign: 'center',
  },
  thWeight: {
    flex: 1,
    textAlign: 'center',
  },
  thReps: {
    flex: 1,
    textAlign: 'center',
  },
  thDone: {
    width: 40,
    textAlign: 'center',
  },
  thAction: {
    width: 24,
  },
  setTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  setRowDivider: {
    borderTopWidth: 1,
  },
  setRowDoneLight: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  setRowDoneDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  tdSet: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberText: {
    fontSize: 12,
    fontWeight: '700',
  },
  warmupText: {
    color: '#f59e0b',
  },
  tdWeight: {
    flex: 1,
    paddingHorizontal: 4,
  },
  tdReps: {
    flex: 1,
    paddingHorizontal: 4,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  stepBtn: {
    width: 28,
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnLight: {
    backgroundColor: '#e2e8f0',
  },
  stepBtnDark: {
    backgroundColor: '#27272a',
  },
  stepBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  numberInput: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 1,
    paddingHorizontal: 2,
  },
  inputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    color: '#09090b',
  },
  inputDark: {
    backgroundColor: '#18181b',
    borderColor: '#3f3f46',
    color: '#fafafa',
  },
  tdDone: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tdAction: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addSetBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bigAddExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  bigAddExerciseText: {
    fontSize: 13,
    fontWeight: '600',
  },
  finishWorkoutBtn: {
    marginTop: 12,
    marginBottom: 6,
  },
  deleteWorkoutBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 16,
  },
  deleteWorkoutBottomBtnLight: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  deleteWorkoutBottomBtnDark: {
    backgroundColor: '#3f1218',
    borderColor: '#7f1d1d',
  },
  deleteWorkoutBottomBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  bottomLight: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e8f0',
  },
  bottomDark: {
    backgroundColor: '#09090b',
    borderTopColor: '#27272a',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: 12,
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
    borderColor: '#e2e8f0',
  },
  borderDark: {
    borderColor: '#27272a',
  },
});
