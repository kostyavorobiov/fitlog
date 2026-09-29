import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ExerciseSelectorModal } from '../components/ExerciseSelectorModal';
import { useAuth } from '../context/AuthContext';
import { WorkoutService } from '../services/workoutService';
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

const TITLE_PRESETS = [
  'Груди та Тріцепс',
  'Спина та Біцепс',
  'День ніг',
  'Плечі та Прес',
  'Full Body',
  'Кардіо + Кор',
];

export const WorkoutEditorScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);
  const [saveNoticeMsg, setSaveNoticeMsg] = useState<string>('Збережено ✓');
  const [isTitleModalOpen, setIsTitleModalOpen] = useState<boolean>(false);
  const [lastPerformances, setLastPerformances] = useState<Record<string, PastExercisePerformance | null>>({});

  const workoutRef = useRef<WorkoutPlan | null>(null);
  workoutRef.current = workout;

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load workout details
  const loadWorkout = useCallback(async () => {
    if (!user || !id) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await WorkoutService.getWorkoutById(user.id, id);
      if (data) {
        setWorkout(data);
        workoutRef.current = data;
        loadPerformancesForWorkout(data);
      }
    } catch (e) {
      console.warn('[WorkoutEditorScreen.loadWorkout] Error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user, id]);

  const loadPerformancesForWorkout = async (w: WorkoutPlan) => {
    if (!user || !w.exercises) return;
    const perfs: Record<string, PastExercisePerformance | null> = {};
    for (const ex of w.exercises) {
      try {
        const perf = await WorkoutService.getLastExercisePerformance(user.id, ex.exerciseId, w.id);
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
      }
    };
  }, []);

  // Central update & persist helper
  const updateAndSave = (updated: WorkoutPlan, immediateSave: boolean = false) => {
    setWorkout(updated);
    workoutRef.current = updated;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    if (immediateSave) {
      WorkoutService.saveWorkout(updated);
    } else {
      autoSaveTimerRef.current = setTimeout(() => {
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

    // Check if exercise has previous performance
    let lastPerf: PastExercisePerformance | null = null;
    try {
      lastPerf = await WorkoutService.getLastExercisePerformance(user.id, exercise.id, workout.id);
      setLastPerformances((prev) => ({ ...prev, [exercise.id]: lastPerf }));
    } catch (e) {
      console.warn('Error getting last exercise performance:', e);
    }

    const targetRange = (lastPerf?.sets?.[0]?.targetRepsRange || '8-12') as string;
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
  };

  // Remove exercise
  const handleRemoveExercise = (weId: string) => {
    if (!workout) return;
    const currentExercises = workout.exercises || [];
    const exerciseToRemove = currentExercises.find((e) => e.id === weId);

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

    updateAndSave({ ...workout, exercises: updatedExercises }, true);
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

  // Step adjust weight (+/- 2.5) or reps (+/- 1)
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
      status: workout.status === 'planned' ? 'in_progress' : workout.status,
      exercises: updatedExercises,
    };

    updateAndSave(updatedWorkout, true);
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
    if (!workout || !user) return;

    try {
      const prev = await WorkoutService.getPreviousWorkoutToRepeat(user.id, workout.id, workout.title);
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
              const ok = await WorkoutService.deleteWorkout(user.id, workout.id);
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
          <ActivityIndicator size="small" color="#0284c7" />
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
            {workout.scheduledDate} • {isCompleted ? 'Завершено' : `${completedSets}/${totalSets} підходів`}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.iconBtn}
            onPress={handleRepeatPreviousWorkout}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh-circle-outline" size={22} color="#0284c7" />
          </TouchableOpacity>

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

      {/* Floating Save Success Banner */}
      {saveSuccessNotice && (
        <View style={styles.saveBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          <Text style={styles.saveBannerText}>{saveNoticeMsg}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.contentScroll}
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
                      isSelected ? styles.presetChipActive : (isDark ? styles.presetChipDark : styles.presetChipLight),
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        isSelected ? styles.presetChipTextActive : (isDark ? styles.subDark : styles.subLight),
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

          {/* Repeat Previous Workout Prompt if empty */}
          {exercises.length === 0 && (
            <Card style={styles.emptyPromptCard}>
              <Ionicons name="barbell-outline" size={36} color="#0284c7" />
              <Text style={[styles.emptyPromptTitle, isDark ? styles.textDark : styles.textLight]}>
                У цьому тренуванні ще немає вправ
              </Text>
              <Text style={[styles.emptyPromptSub, isDark ? styles.subDark : styles.subLight]}>
                Ви можете повторити попереднє тренування або додати вправи з каталогу.
              </Text>

              <View style={styles.emptyPromptButtons}>
                <Button
                  title="Повторити попереднє"
                  variant="outline"
                  onPress={handleRepeatPreviousWorkout}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Додати вправу"
                  variant="primary"
                  onPress={() => setIsSelectorOpen(true)}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          )}

          {/* Exercises List */}
          {exercises.map((ex, exIndex) => {
            const muscle = MUSCLE_GROUPS[ex.muscleGroup || 'other'] || MUSCLE_GROUPS.other;
            const isSuperset = Boolean(ex.supersetGroupId);
            const palette = ex.supersetGroupId ? supersetColorMap.get(ex.supersetGroupId) : null;
            const pastPerf = lastPerformances[ex.exerciseId];

            return (
              <View
                key={ex.id || `ex_${exIndex}`}
                style={[
                  styles.exerciseCardWrap,
                  isSuperset && palette && { borderLeftColor: palette.borderColor, borderLeftWidth: 4 },
                ]}
              >
                <Card style={styles.exerciseCard}>
                  {/* Exercise Card Header */}
                  <View style={styles.exHeader}>
                    {/* Index & Name */}
                    <View style={styles.exHeaderTitleRow}>
                      <View
                        style={[
                          styles.exIndexBadge,
                          isSuperset && palette
                            ? { backgroundColor: palette.badgeBg, borderColor: palette.badgeBorder }
                            : (isDark ? styles.exIndexDark : styles.exIndexLight),
                        ]}
                      >
                        <Text
                          style={[
                            styles.exIndexText,
                            isSuperset && palette ? { color: palette.badgeText } : (isDark ? styles.textDark : styles.textLight),
                          ]}
                        >
                          #{exIndex + 1}
                        </Text>
                      </View>

                      <View style={styles.exTitleContainer}>
                        <Text
                          numberOfLines={2}
                          style={[styles.exTitleText, isDark ? styles.textDark : styles.textLight]}
                        >
                          {ex.exerciseName || 'Вправа'}
                        </Text>
                        <View style={styles.exBadgeRow}>
                          <View
                            style={[
                              styles.muscleTag,
                              { backgroundColor: muscle.badgeBg, borderColor: muscle.badgeBorder },
                            ]}
                          >
                            <Text style={[styles.muscleTagText, { color: muscle.color }]}>
                              {muscle.nameUk}
                            </Text>
                          </View>

                          {isSuperset && palette && (
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
                          )}
                        </View>
                      </View>

                      {/* Move Up/Down & Delete */}
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
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons
                              name={isSuperset ? 'unlink' : 'link'}
                              size={15}
                              color={isSuperset && palette ? palette.buttonActiveText : (isDark ? '#a1a1aa' : '#71717a')}
                            />
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          activeOpacity={0.7}
                          disabled={exIndex === 0}
                          onPress={() => handleMoveExercise(exIndex, 'up')}
                          style={[styles.actionBtn, exIndex === 0 && { opacity: 0.25 }, isDark ? styles.actionBtnDark : styles.actionBtnLight]}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="chevron-up" size={15} color={isDark ? '#e4e4e7' : '#3f3f46'} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          disabled={exIndex === exercises.length - 1}
                          onPress={() => handleMoveExercise(exIndex, 'down')}
                          style={[styles.actionBtn, exIndex === exercises.length - 1 && { opacity: 0.25 }, isDark ? styles.actionBtnDark : styles.actionBtnLight]}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="chevron-down" size={15} color={isDark ? '#e4e4e7' : '#3f3f46'} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleRemoveExercise(ex.id)}
                          style={[styles.actionBtn, isDark ? styles.actionBtnDark : styles.actionBtnLight]}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="trash-outline" size={15} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Previous performance indicator & fast fill button */}
                  {pastPerf && pastPerf.sets && pastPerf.sets.length > 0 && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleApplyPreviousPerformance(ex.id, ex.exerciseId)}
                      style={[styles.pastPerfBanner, isDark ? styles.pastPerfDark : styles.pastPerfLight]}
                    >
                      <Ionicons name="time-outline" size={13} color="#0284c7" />
                      <Text style={styles.pastPerfText}>
                        Останнє: {pastPerf.maxWeight} кг ({pastPerf.sets.map((s) => s.actualReps).join('-')} повт.)
                      </Text>
                      <Text style={styles.pastPerfApply}>Повторити ↺</Text>
                    </TouchableOpacity>
                  )}

                  {/* Target Rep Range & Set Count Quick Bar */}
                  <View style={styles.quickSelectorsRow}>
                    {/* Rep Range Selector */}
                    <View style={styles.repsSelector}>
                      <Text style={[styles.selectorLabel, isDark ? styles.subDark : styles.subLight]}>
                        Повторення:
                      </Text>
                      <View style={styles.chipsRow}>
                        {REPS_RANGES.map((rng) => {
                          const isSel = (ex.targetRepsRange || '8-12') === rng;
                          return (
                            <TouchableOpacity
                              key={rng}
                              onPress={() => handleTargetRepsRangeChange(ex.id, rng)}
                              style={[
                                styles.rangeChip,
                                isSel ? styles.rangeChipActive : (isDark ? styles.chipDark : styles.chipLight),
                              ]}
                            >
                              <Text
                                style={[
                                  styles.rangeChipText,
                                  isSel ? styles.rangeChipTextActive : (isDark ? styles.subDark : styles.subLight),
                                ]}
                              >
                                {rng}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Set Count Fast Selector */}
                    <View style={styles.setsCountSelector}>
                      <Text style={[styles.selectorLabel, isDark ? styles.subDark : styles.subLight]}>
                        Сетів:
                      </Text>
                      <View style={styles.chipsRow}>
                        {[2, 3, 4, 5].map((cnt) => {
                          const isSel = (ex.sets || []).length === cnt;
                          return (
                            <TouchableOpacity
                              key={cnt}
                              onPress={() => handleSetCountChange(ex.id, cnt)}
                              style={[
                                styles.setCountChip,
                                isSel ? styles.rangeChipActive : (isDark ? styles.chipDark : styles.chipLight),
                              ]}
                            >
                              <Text
                                style={[
                                  styles.rangeChipText,
                                  isSel ? styles.rangeChipTextActive : (isDark ? styles.subDark : styles.subLight),
                                ]}
                              >
                                {cnt}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
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
                      <Text style={[styles.thCell, styles.thDone, isDark ? styles.subDark : styles.subLight]}>
                        Статус
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
                                onPress={() => handleStepAdjust(ex.id, s.id, 'weight', -2.5)}
                                style={[styles.stepBtn, isDark ? styles.stepBtnDark : styles.stepBtnLight]}
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
                                onPress={() => handleStepAdjust(ex.id, s.id, 'weight', 2.5)}
                                style={[styles.stepBtn, isDark ? styles.stepBtnDark : styles.stepBtnLight]}
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
                    <Ionicons name="add" size={16} color="#0284c7" />
                    <Text style={styles.addSetBtnText}>Додати підхід</Text>
                  </TouchableOpacity>
                </Card>
              </View>
            );
          })}

          {/* Add Exercise Big Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsSelectorOpen(true)}
            style={[styles.bigAddExerciseBtn, isDark ? styles.borderDark : styles.borderLight]}
          >
            <Ionicons name="add-circle" size={22} color="#0284c7" />
            <Text style={styles.bigAddExerciseText}>Додати вправу з каталогу</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Bottom Action Bar */}
      <View style={[styles.bottomActionBar, isDark ? styles.bottomDark : styles.bottomLight]}>
        <View style={styles.bottomButtonsRow}>
          <Button
            title={isCompleted ? 'Відновити' : 'Завершити'}
            variant={isCompleted ? 'outline' : 'primary'}
            onPress={handleToggleStatus}
            style={{ flex: 1 }}
          />

          <Button
            title="Зберегти"
            variant="secondary"
            loading={isSaving}
            onPress={handleSaveWorkout}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      {/* Exercise Selector Modal */}
      <ExerciseSelectorModal
        visible={isSelectorOpen}
        userId={user?.id}
        onClose={() => setIsSelectorOpen(false)}
        onSelectExercise={handleSelectExercise}
      />
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
  presetChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#ffffff',
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
  exerciseCard: {
    padding: 12,
    gap: 10,
  },
  exHeader: {
    gap: 6,
  },
  exHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
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
    gap: 4,
  },
  actionBtn: {
    padding: 5,
    borderRadius: 6,
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
    padding: 5,
    borderRadius: 6,
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
    justifyContent: 'space-between',
    gap: 8,
  },
  repsSelector: {
    flex: 1,
    gap: 4,
  },
  setsCountSelector: {
    gap: 4,
  },
  selectorLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  rangeChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  setCountChip: {
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  chipLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  chipDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  rangeChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  rangeChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  rangeChipTextActive: {
    color: '#ffffff',
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
    gap: 2,
  },
  stepBtn: {
    width: 24,
    height: 32,
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
    fontSize: 14,
    fontWeight: '700',
  },
  numberInput: {
    flex: 1,
    height: 32,
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
    color: '#0284c7',
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
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
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
