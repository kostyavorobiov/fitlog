import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  WorkoutPlan,
  WorkoutExercise,
  WorkoutSet,
  Exercise,
  MUSCLE_GROUPS,
  PastExercisePerformance,
} from '../types/workout';
import { StorageService, generateId } from '../services/storageService';
import { CloudStorageService } from '../services/cloudStorageService';
import { ExerciseSelectorModal } from './ExerciseSelectorModal';
import { CreateExerciseModal } from './CreateExerciseModal';
import { ExerciseHistoryModal } from './ExerciseHistoryModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { playSuccessChime, playBeep } from '../utils/audio';
import {
  Calendar,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Circle,
  Dumbbell,
  Save,
  Check,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Layers,
  Flame,
  GripVertical,
  Award,
  ArrowLeft,
  Link,
  Unlink,
  X,
} from 'lucide-react';

const SUPERSET_PALETTES = [
  {
    border: 'border-l-4 border-l-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30',
    buttonActive: 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60',
    nameUk: 'Смарагдовий',
  },
  {
    border: 'border-l-4 border-l-amber-500',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30',
    buttonActive: 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60',
    nameUk: 'Бурштиновий',
  },
  {
    border: 'border-l-4 border-l-indigo-500',
    badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30',
    buttonActive: 'border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60',
    nameUk: 'Індиго',
  },
  {
    border: 'border-l-4 border-l-rose-500',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30',
    buttonActive: 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60',
    nameUk: 'Рожевий',
  },
  {
    border: 'border-l-4 border-l-cyan-500',
    badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30',
    buttonActive: 'border-cyan-300 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/60',
    nameUk: 'Блакитний',
  },
  {
    border: 'border-l-4 border-l-purple-500',
    badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30',
    buttonActive: 'border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60',
    nameUk: 'Фіолетовий',
  },
];

interface WorkoutEditorProps {
  workout: WorkoutPlan;
  userId: string;
  onSave: (savedWorkout: WorkoutPlan) => void;
  onDeleteWorkout?: (workoutId: string) => void;
  onBack?: () => void;
  autoOpenExerciseSelector?: boolean;
  traineeName?: string;
}

export const WorkoutEditor: React.FC<WorkoutEditorProps> = ({
  workout: initialWorkout,
  userId,
  onSave,
  onDeleteWorkout,
  onBack,
  autoOpenExerciseSelector = false,
  traineeName,
}) => {
  const [workout, setWorkout] = useState<WorkoutPlan>(() => ({
    ...initialWorkout,
    exercises: Array.isArray(initialWorkout?.exercises) ? initialWorkout.exercises : [],
  }));
  const workoutRef = useRef<WorkoutPlan>(workout);
  workoutRef.current = workout;

  const currentExList = useMemo(() => {
    return Array.isArray(workout.exercises) ? workout.exercises : [];
  }, [workout.exercises]);

  const supersetColorMap = useMemo(() => {
    const map = new Map<string, (typeof SUPERSET_PALETTES)[0]>();
    const uniqueGroups: string[] = [];
    currentExList.forEach((e) => {
      if (e.supersetGroupId && !uniqueGroups.includes(e.supersetGroupId)) {
        uniqueGroups.push(e.supersetGroupId);
      }
    });
    uniqueGroups.forEach((groupId, idx) => {
      map.set(groupId, SUPERSET_PALETTES[idx % SUPERSET_PALETTES.length]);
    });
    return map;
  }, [currentExList]);

  // Strictly respect requirement 6: Do NOT auto open exercise selector modal; show workout form directly!
  const [isSelectorOpen, setIsSelectorOpen] = useState(Boolean(autoOpenExerciseSelector));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createExerciseInitialName, setCreateExerciseInitialName] = useState('');
  const [historyModalExercise, setHistoryModalExercise] = useState<Exercise | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [saveNoticeMessage, setSaveNoticeMessage] = useState('Зміни в тренуванні успішно збережено!');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileDeleteWorkoutButtonRef = useRef<HTMLButtonElement>(null);
  const [activeInputText, setActiveInputText] = useState<Record<string, string>>({});

  const handleInputCursorToEnd = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const moveToEnd = () => {
      try {
        const len = input.value.length;
        input.setSelectionRange(len, len);
      } catch { }
    };
    moveToEnd();
    requestAnimationFrame(moveToEnd);
    setTimeout(moveToEnd, 15);
  };

  // Sync state if initialWorkout changes (e.g. user selected another workout)
  useEffect(() => {
    const normalized: WorkoutPlan = {
      ...initialWorkout,
      exercises: Array.isArray(initialWorkout?.exercises) ? initialWorkout.exercises : [],
    };
    setWorkout(normalized);
    workoutRef.current = normalized;
  }, [initialWorkout.id]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Auto-save helper: automatically persists changes immediately to memory and cloud
  const updateAndSave = (updated: WorkoutPlan) => {
    try {
      const rawExercises = Array.isArray(updated.exercises) ? updated.exercises : [];
      const enrichedExercises = rawExercises.map((we) => {
        if (!we.exerciseName || !we.muscleGroup || we.exerciseName === 'Вправа') {
          const ex = StorageService.getExerciseById(we.exerciseId);
          const resolvedName = (we.exerciseName && we.exerciseName !== 'Вправа')
            ? we.exerciseName
            : ((ex?.name && ex.name !== 'Вправа') ? ex.name : (we.exerciseName || 'Вправа'));
          return {
            ...we,
            exerciseName: resolvedName,
            muscleGroup: we.muscleGroup || ex?.muscleGroup || 'full_body',
          };
        }
        return we;
      });
      const enriched: WorkoutPlan = { ...updated, exercises: enrichedExercises };
      workoutRef.current = enriched;
      setWorkout(enriched);
      StorageService.saveWorkout(enriched);
      onSave(enriched);

      // Visual feedback: real-time autosave indicator
      setAutoSaveStatus('saving');
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        setAutoSaveStatus('saved');
        autoSaveTimerRef.current = setTimeout(() => {
          setAutoSaveStatus('idle');
        }, 2000);
      }, 400);
    } catch (err) {
      console.error('Error in updateAndSave:', err);
      setAutoSaveStatus('idle');
    }
  };

  // Workout Title & Metadata
  const handleTitleChange = (title: string) => {
    updateAndSave({ ...workoutRef.current, title });
  };

  const handleDateChange = (scheduledDate: string) => {
    updateAndSave({ ...workoutRef.current, scheduledDate });
  };

  const handleNotesChange = (notes: string) => {
    updateAndSave({ ...workoutRef.current, notes });
  };

  // Preset workout titles
  const titlePresets = [
    'Груди та Тріцепс',
    'Спина та Біцепс',
    'День ніг',
    'Плечі та Прес',
    'Full Body',
    'Тяга / Жим / Ноги',
  ];

  function getExerciseOriginBadge(ex: Exercise | undefined): { text: string; className: string; } | null {
    if (!ex || ex.isDefault || !ex.userId || ex.userId === 'null') return null;
    const activeId = StorageService.getActiveUserId() || userId;
    const currentUser = StorageService.getUserById(activeId);
    const isCoachEx = (workout.assignedByCoachId && ex.userId === workout.assignedByCoachId) ||
      (currentUser?.coachId && ex.userId === currentUser.coachId);
    const isTraineeEx = (workout.userId && ex.userId === workout.userId) ||
      (currentUser?.traineeIds && currentUser.traineeIds.includes(ex.userId));


  }

  // Position exercise card top edge slightly below the top navbar without smooth scrolling
  const scrollToExerciseCard = (exerciseId: string) => {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent('show-navbar'));

    const alignCard = () => {
      const cardEl = document.getElementById(`exercise-card-${exerciseId}`);
      if (cardEl) {
        const navHeader = document.querySelector('header');
        const navHeight = navHeader ? navHeader.offsetHeight : (window.innerWidth < 640 ? 56 : 64);
        const offset = window.innerWidth < 640 ? 10 : 14;
        const rect = cardEl.getBoundingClientRect();
        const targetScrollY = Math.max(0, window.scrollY + rect.top - navHeight - offset);

        window.scrollTo({
          top: targetScrollY,
          behavior: 'auto',
        });
        return true;
      }
      return false;
    };

    setTimeout(() => {
      if (!alignCard()) {
        setTimeout(alignCard, 100);
      }
    }, 60);
  };

  // Add Exercise to Workout
  const handleSelectExercise = (exercise: Exercise) => {
    try {
      const currentWorkout = workoutRef.current || workout;
      if (!currentWorkout) return;

      // Check if exercise has previous performance
      let lastPerf: PastExercisePerformance | null = null;
      try {
        lastPerf = StorageService.getLastExercisePerformance(userId, exercise.id, currentWorkout.id);
      } catch (e) {
        console.warn('Error getting last exercise performance:', e);
      }

      // Initial sets: automatically pre-fill previous weights and reps from past workout
      let initialSets: WorkoutSet[] = [];
      const targetRange = (lastPerf?.sets?.[0]?.targetRepsRange || '8-12') as string;

      if (lastPerf && Array.isArray(lastPerf.sets) && lastPerf.sets.length > 0) {
        initialSets = lastPerf.sets.map((ps, idx) => ({
          id: generateId('set'),
          workoutExerciseId: '',
          setNumber: idx + 1,
          targetRepsRange: ps.targetRepsRange || targetRange,
          weight: Number(ps.weight) || 20,
          actualReps: ps.actualReps !== null && ps.actualReps !== undefined ? Number(ps.actualReps) : 10,
          completedAt: null,
        }));
      } else {
        initialSets = [
          {
            id: generateId('set'),
            workoutExerciseId: '',
            setNumber: 1,
            targetRepsRange: targetRange,
            weight: 20,
            actualReps: 10,
            completedAt: null,
          },
          {
            id: generateId('set'),
            workoutExerciseId: '',
            setNumber: 2,
            targetRepsRange: targetRange,
            weight: 20,
            actualReps: 10,
            completedAt: null,
          },
          {
            id: generateId('set'),
            workoutExerciseId: '',
            setNumber: 3,
            targetRepsRange: targetRange,
            weight: 20,
            actualReps: 10,
            completedAt: null,
          },
        ];
      }

      const weId = generateId('we');
      const currentExercises = Array.isArray(currentWorkout.exercises) ? currentWorkout.exercises : [];
      const newWorkoutExercise: WorkoutExercise = {
        id: weId,
        workoutPlanId: currentWorkout.id,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        muscleGroup: exercise.muscleGroup,
        order: currentExercises.length + 1,
        targetRepsRange: targetRange,
        setCount: initialSets.length,
        sets: initialSets.map((s) => ({ ...s, workoutExerciseId: weId })),
      };

      const updated: WorkoutPlan = {
        ...currentWorkout,
        exercises: [...currentExercises, newWorkoutExercise],
      };

      updateAndSave(updated);
      setIsSelectorOpen(false);

      // On mobile: position newly added exercise slightly below the top navbar without smooth scroll
      if (typeof window !== 'undefined' && window.innerWidth < 640) {
        scrollToExerciseCard(weId);
      }
    } catch (err) {
      console.error('Failed to add exercise to workout:', err);
    }
  };

  // Reorder exercise drag & drop
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const currentWorkout = workoutRef.current;
    const items = Array.from(currentWorkout.exercises);
    const [reorderedItem] = items.splice(draggedIndex, 1);
    items.splice(index, 0, reorderedItem);

    const renumbered = items.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    setDraggedIndex(index);
    updateAndSave({ ...currentWorkout, exercises: renumbered });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Move Exercise Up/Down manually
  const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
    const currentWorkout = workoutRef.current;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentWorkout.exercises.length) return;

    const items = [...currentWorkout.exercises];
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    const renumbered = items.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    updateAndSave({ ...currentWorkout, exercises: renumbered });
  };

  // Delete exercise
  const handleRemoveExercise = (weId: string) => {
    const currentWorkout = workoutRef.current;
    const deletedIndex = currentWorkout.exercises.findIndex((e) => e.id === weId);
    const prevEx = deletedIndex > 0 ? currentWorkout.exercises[deletedIndex - 1] : null;

    // Фіксуємо точну позицію попередньої картки у вікні перегляду до видалення
    let prevCardTop: number | null = null;
    if (prevEx && typeof window !== 'undefined') {
      const prevEl = document.getElementById(`exercise-card-${prevEx.id}`);
      if (prevEl) {
        prevCardTop = prevEl.getBoundingClientRect().top;
      }
    }

    const updatedExercises = currentWorkout.exercises
      .filter((e) => e.id !== weId)
      .map((e, idx) => ({ ...e, order: idx + 1 }));

    updateAndSave({ ...currentWorkout, exercises: updatedExercises });

    // Після оновлення DOM гарантуємо, що попередня картка не стрибає,
    // а нижні кнопки підтягуються безпосередньо під попередню картку
    if (typeof window !== 'undefined') {
      const correctPosition = () => {
        if (prevEx && prevCardTop !== null) {
          const prevEl = document.getElementById(`exercise-card-${prevEx.id}`);
          if (prevEl) {
            const currentTop = prevEl.getBoundingClientRect().top;
            const diff = currentTop - prevCardTop;
            if (Math.abs(diff) > 0.5) {
              window.scrollBy({ top: diff, behavior: 'instant' });
            }
          }
        }
      };

      requestAnimationFrame(correctPosition);
      setTimeout(correctPosition, 30);
    }
  };

  // Target Rep Range change (e.g. '8-12' -> '6-8')
  const handleTargetRepsRangeChange = (weId: string, range: string) => {
    const currentWorkout = workoutRef.current;
    const updatedExercises = currentWorkout.exercises.map((e) => {
      if (e.id === weId) {
        const updatedSets = e.sets.map((s) => ({ ...s, targetRepsRange: range }));
        return { ...e, targetRepsRange: range, sets: updatedSets };
      }
      return e;
    });

    updateAndSave({ ...currentWorkout, exercises: updatedExercises });
  };

  // Fast set count selector (2, 3, 4, 5)
  const handleSetCountChange = (weId: string, count: number) => {
    const currentWorkout = workoutRef.current;
    const updatedExercises = currentWorkout.exercises.map((e) => {
      if (e.id === weId) {
        let sets = [...e.sets];
        if (count > sets.length) {
          const lastSet = sets[sets.length - 1];
          for (let i = sets.length; i < count; i++) {
            sets.push({
              id: generateId('set'),
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

    updateAndSave({ ...currentWorkout, exercises: updatedExercises });
  };

  // Add individual set
  const handleAddSet = (weId: string) => {
    const currentWorkout = workoutRef.current;
    const updatedExercises = currentWorkout.exercises.map((e) => {
      if (e.id === weId) {
        const lastSet = e.sets[e.sets.length - 1];
        const newSet: WorkoutSet = {
          id: generateId('set'),
          workoutExerciseId: weId,
          setNumber: e.sets.length + 1,
          targetRepsRange: e.targetRepsRange || lastSet?.targetRepsRange || '8-12',
          weight: lastSet?.weight || 20,
          actualReps: lastSet?.actualReps || 10,
          completedAt: null,
        };
        const newSets = [...e.sets, newSet];
        return { ...e, setCount: newSets.length, sets: newSets };
      }
      return e;
    });

    updateAndSave({ ...currentWorkout, exercises: updatedExercises });
  };

  // Remove individual set
  const handleRemoveSet = (weId: string, setId: string) => {
    const currentWorkout = workoutRef.current;
    const updatedExercises = currentWorkout.exercises.map((e) => {
      if (e.id === weId) {
        const filtered = e.sets.filter((s) => s.id !== setId);
        const renumbered = filtered.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
        return { ...e, setCount: renumbered.length, sets: renumbered };
      }
      return e;
    });

    updateAndSave({ ...currentWorkout, exercises: updatedExercises });
  };

  // Update set weight / actual reps
  const handleUpdateSet = (
    weId: string,
    setId: string,
    field: 'weight' | 'actualReps',
    value: number | null
  ) => {
    const currentWorkout = workoutRef.current;
    const updatedExercises = currentWorkout.exercises.map((e) => {
      if (e.id === weId) {
        const updatedSets = e.sets.map((s) => {
          if (s.id === setId) {
            return { ...s, [field]: value };
          }
          return s;
        });
        return { ...e, sets: updatedSets };
      }
      return e;
    });

    updateAndSave({ ...currentWorkout, exercises: updatedExercises });
  };

  // Toggle complete set
  const handleToggleCompleteSet = (weId: string, setItem: WorkoutSet) => {
    const currentWorkout = workoutRef.current;
    const isNowCompleted = !setItem.completedAt;
    const completedAt = isNowCompleted ? new Date().toISOString() : null;

    const updatedExercises = currentWorkout.exercises.map((e) => {
      if (e.id === weId) {
        const updatedSets = e.sets.map((s) => {
          if (s.id === setItem.id) {
            return { ...s, completedAt };
          }
          return s;
        });
        return { ...e, sets: updatedSets };
      }
      return e;
    });

    const updatedWorkout = {
      ...currentWorkout,
      status: 'in_progress' as const,
      exercises: updatedExercises,
    };

    updateAndSave(updatedWorkout);

    if (isNowCompleted) {
      playSuccessChime();
    } else {
      playBeep(400, 0.1);
    }
  };

  // Group exercise into superset or unlink
  const handleToggleSuperset = (weIndex: number) => {
    const currentWorkout = workoutRef.current;
    const current = currentWorkout.exercises[weIndex];
    if (!current) return;

    if (current.supersetGroupId) {
      // Unlink current exercise from superset
      const oldGroup = current.supersetGroupId;
      const updated = currentWorkout.exercises.map((e) => {
        if (e.id === current.id) {
          return { ...e, supersetGroupId: null };
        }
        return e;
      });
      // If only 1 exercise remains in that group, clear it too
      const remainingInGroup = updated.filter((e) => e.supersetGroupId === oldGroup);
      if (remainingInGroup.length <= 1) {
        updated.forEach((e) => {
          if (e.supersetGroupId === oldGroup) {
            e.supersetGroupId = null;
          }
        });
      }
      updateAndSave({ ...currentWorkout, exercises: updated });
    } else {
      // Pair with next exercise, or with previous if at the end of the list
      const next = currentWorkout.exercises[weIndex + 1];
      const prev = currentWorkout.exercises[weIndex - 1];

      if (next) {
        const newGroupId = next.supersetGroupId || `SS-${generateId('grp').slice(0, 4)}`;
        const updated = currentWorkout.exercises.map((e, idx) => {
          if (idx === weIndex || idx === weIndex + 1) {
            return { ...e, supersetGroupId: newGroupId };
          }
          return e;
        });
        updateAndSave({ ...currentWorkout, exercises: updated });
      } else if (prev) {
        const newGroupId = prev.supersetGroupId || `SS-${generateId('grp').slice(0, 4)}`;
        const updated = currentWorkout.exercises.map((e, idx) => {
          if (idx === weIndex || idx === weIndex - 1) {
            return { ...e, supersetGroupId: newGroupId };
          }
          return e;
        });
        updateAndSave({ ...currentWorkout, exercises: updated });
      }
    }
  };

  // Explicitly save workout changes without completing
  const handleSaveWorkout = async () => {
    updateAndSave(workoutRef.current);
    onSave(workoutRef.current);
    await CloudStorageService.saveWorkout(workoutRef.current);
    setSaveNoticeMessage('Зміни в тренуванні успішно збережено!');
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  // Complete entire workout (marks status as 'completed')
  const handleFinishWorkout = async () => {
    const completedAt = new Date().toISOString();
    const updated: WorkoutPlan = {
      ...workoutRef.current,
      status: 'completed',
      completedAt,
      durationMinutes: workoutRef.current.durationMinutes || 60,
    };
    updateAndSave(updated);
    await CloudStorageService.saveWorkout(updated);
    playSuccessChime();
    setSaveNoticeMessage('Тренування успішно виконано! Результати зафіксовані.');
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3500);
  };

  // Restore workout to in_progress status
  const handleRestoreWorkout = async () => {
    const updated: WorkoutPlan = {
      ...workoutRef.current,
      status: 'in_progress',
      completedAt: null,
    };
    updateAndSave(updated);
    await CloudStorageService.saveWorkout(updated);
    setSaveNoticeMessage('Тренування відновлено в процесі');
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  // Delete current workout
  const handleDeleteCurrentWorkout = async () => {
    StorageService.deleteWorkout(workout.id);
    await CloudStorageService.deleteWorkout(workout.id);
    if (onDeleteWorkout) {
      onDeleteWorkout(workout.id);
    }
  };

  // Stats calculation
  const totalSets = currentExList.reduce((acc, e) => acc + (e.sets || []).length, 0);
  const completedSets = currentExList.reduce(
    (acc, e) => acc + (e.sets || []).filter((s) => s && s.completedAt !== null).length,
    0
  );
  const totalVolumeKg = currentExList.reduce((acc, e) => {
    return (
      acc +
      (e.sets || []).reduce((sAcc, s) => {
        if (s && s.actualReps && s.weight) {
          return sAcc + s.weight * s.actualReps;
        }
        return sAcc;
      }, 0)
    );
  }, 0);

  return (
    <div className="space-y-4 sm:space-y-6 pb-52 sm:pb-28 animate-fade-in max-w-5xl mx-auto">
      {/* Back button to return to workouts list */}
      {onBack && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center space-x-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <span>До списку тренувань</span>
          </button>
        </div>
      )}

      {/* Top Banner / Status Alert */}
      {saveSuccessNotice && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 p-3 flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{saveNoticeMessage}</span>
        </div>
      )}

      {/* Workout Metadata Card */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs">
        {/* Title & Status Header */}
        <div className="flex flex-col gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3.5 mb-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Програма тренування
              </span>
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border ${workout.status === 'completed'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : workout.status === 'in_progress'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                  }`}
              >
                {workout.status === 'completed'
                  ? 'Завершено ✓'
                  : workout.status === 'in_progress'
                    ? 'У процесі ⚡'
                    : 'Заплановано'}
              </span>
              {workout.assignedByCoachId && (
                <span className="inline-flex items-center space-x-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  <Award className="h-3 w-3" />
                  <span>Призначено тренером</span>
                </span>
              )}
            </div>

          </div>

          {/* Title input - Functional and non-blocking */}
          <div className="space-y-1">
            <input
              type="text"
              value={workout.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Назва тренування (напр. Груди та Тріцепс)"
              className="w-full font-bold text-lg sm:text-xl text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none transition py-1"
            />
          </div>

          {/* Date Picker row */}
          <div className="flex items-center space-x-2 pt-1">
            <div className="flex items-center space-x-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-300">
              <Calendar className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <input
                type="date"
                value={workout.scheduledDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer text-xs"
              />
            </div>
          </div>
        </div>

        {/* Quick Title Presets */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Швидкі назви:</span>
          {titlePresets.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTitleChange(t)}
              className={`rounded-md px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] whitespace-nowrap transition-colors cursor-pointer ${workout.title === t
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 border border-zinc-900 dark:border-zinc-100 font-semibold'
                : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Workout notes */}
        <div className="mt-3">
          <input
            type="text"
            placeholder="Загальні примітки до тренування..."
            value={workout.notes || ''}
            onChange={(e) => handleNotesChange(e.target.value)}
            className="w-full text-xs text-zinc-900 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-800 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
          />
        </div>
      </div>

      {/* Exercises List */}
      <div className="space-y-4">
        {currentExList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-8 sm:p-12 text-center">
            <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 mb-3">
              <Dumbbell className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">Тренування порожнє</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-4">
              Додайте вправи до сьогоднішньої програми. Застосунок автоматично підтягне попередні робочі ваги та повторення!
            </p>
            <button
              type="button"
              onClick={() => setIsSelectorOpen(true)}
              className="inline-flex items-center space-x-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Додати першу вправу</span>
            </button>
          </div>
        ) : (
          currentExList.map((weItem, weIndex) => {
            const exercise = StorageService.getExerciseById(weItem.exerciseId);
            const exerciseName = (weItem.exerciseName && weItem.exerciseName !== 'Вправа')
              ? weItem.exerciseName
              : ((exercise?.name && exercise.name !== 'Вправа') ? exercise.name : (weItem.exerciseName || 'Вправа'));
            const muscleGroupKey = exercise?.muscleGroup || weItem.muscleGroup || 'full_body';
            const muscleInfo = MUSCLE_GROUPS[muscleGroupKey] || MUSCLE_GROUPS.full_body;

            const isDragged = draggedIndex === weIndex;
            const isSuperset = Boolean(weItem.supersetGroupId);
            const supersetPalette = weItem.supersetGroupId ? supersetColorMap.get(weItem.supersetGroupId) : null;

            return (
              <div
                key={weItem.id}
                id={`exercise-card-${weItem.id}`}
                draggable
                onDragStart={() => handleDragStart(weIndex)}
                onDragOver={(e) => handleDragOver(e, weIndex)}
                onDragEnd={handleDragEnd}
                className={`rounded-xl border bg-white dark:bg-zinc-900 shadow-xs overflow-hidden transition-colors ${isDragged
                  ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 opacity-70'
                  : isSuperset && supersetPalette
                    ? `${supersetPalette.border} border-zinc-200 dark:border-zinc-800`
                    : 'border-zinc-200 dark:border-zinc-800'
                  }`}
              >
                {/* ================= MOBILE VIEW (sm:hidden) ================= */}
                <div className="block sm:hidden">

                  {/* Mobile Exercise Header */}
                  <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* #N badge */}
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 font-mono border border-zinc-200 dark:border-zinc-700">
                        #{weIndex + 1}
                      </span>
                      {/* Exercise name + badges */}
                      <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug break-words">
                          {exerciseName}
                        </h4>
                        {(() => {
                          const badge = getExerciseOriginBadge(exercise);
                          if (!badge) return null;
                          return (
                            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${badge.className}`}>
                              {badge.text}
                            </span>
                          );
                        })()}
                        {isSuperset && (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${supersetPalette ? supersetPalette.badge : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30'}`}
                          >
                            <Link className="h-2.5 w-2.5" />
                            <span>Суперсет</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {currentExList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleToggleSuperset(weIndex)}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${isSuperset && supersetPalette
                            ? supersetPalette.buttonActive
                            : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                            }`}
                          title={isSuperset ? "Роз'єднати суперсет" : 'Обʼєднати в суперсет'}
                        >
                          {isSuperset ? <Unlink className="h-3.5 w-3.5" /> : <Link className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleMoveExercise(weIndex, 'up')}
                        disabled={weIndex === 0}
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Вгору"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveExercise(weIndex, 'down')}
                        disabled={weIndex === currentExList.length - 1}
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Вниз"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(weItem.id)}
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-rose-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer"
                        title="Видалити вправу"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile Config Row */}
                  <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800 space-y-2">
                    {/* Reps Range */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest whitespace-nowrap">
                        Повторення:
                      </span>
                      <div className="flex items-center gap-1">
                        {(['4-6', '6-8', '8-10', '8-12', '10-15'] as const).map((range) => {
                          const isSelected = (weItem.targetRepsRange || weItem.sets[0]?.targetRepsRange || '8-12') === range;
                          return (
                            <button
                              key={range}
                              type="button"
                              onClick={() => handleTargetRepsRangeChange(weItem.id, range)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${isSelected
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-zinc-100'
                                : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                                }`}
                            >
                              {range}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sets Count */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest whitespace-nowrap">
                        Підходи:
                      </span>
                      <div className="flex items-center gap-1">
                        {[2, 3, 4, 5].map((cnt) => {
                          const active = (weItem.setCount || weItem.sets.length) === cnt;
                          return (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => handleSetCountChange(weItem.id, cnt)}
                              className={`h-8 w-8 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${active
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-zinc-100'
                                : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                                }`}
                              title={`${cnt} підходи`}
                            >
                              {cnt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Sets Section */}
                  <div>
                    {/* Column headers */}
                    <div
                      className="grid items-center gap-1 px-3 py-2 bg-zinc-50/60 dark:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800"
                      style={{ gridTemplateColumns: '1.75rem 1fr 1fr 2.25rem 1.75rem' }}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 text-center">Сет</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 text-center">Вага (кг)</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 text-center">Повт.</span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 text-center">✓</span>
                      <span />
                    </div>

                    {/* Set rows */}
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {weItem.sets.map((setItem) => {
                        const isDone = Boolean(setItem.completedAt);
                        return (
                          <div
                            key={setItem.id}
                            className={`grid items-center gap-1 px-3 py-2 transition-colors ${isDone ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : ''}`}
                            style={{ gridTemplateColumns: '1.75rem 1fr 1fr 2.25rem 1.75rem' }}
                          >
                            {/* Set number */}
                            <div className="text-center">
                              <span className="font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">
                                {setItem.setNumber}
                              </span>
                            </div>

                            {/* Weight stepper */}
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveInputText((prev) => {
                                    const copy = { ...prev };
                                    delete copy[`${setItem.id}_weight`];
                                    return copy;
                                  });
                                  handleUpdateSet(weItem.id, setItem.id, 'weight', Math.max(0, (setItem.weight || 0) - 2.5));
                                }}
                                className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                                title="−2.5 кг"
                              >
                                <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
                              </button>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  activeInputText[`${setItem.id}_weight`] !== undefined
                                    ? activeInputText[`${setItem.id}_weight`]
                                    : (setItem.weight === 0 ? '0' : setItem.weight)
                                }
                                onChange={(e) => {
                                  const rawVal = e.target.value.replace(',', '.');
                                  if (rawVal === '' || /^\d*\.?\d*$/.test(rawVal)) {
                                    const num = rawVal === '' ? 0 : parseFloat(rawVal) || 0;
                                    handleUpdateSet(weItem.id, setItem.id, 'weight', num);
                                    setActiveInputText((prev) => ({ ...prev, [`${setItem.id}_weight`]: rawVal }));
                                  }
                                }}
                                onFocus={handleInputCursorToEnd}
                                onClick={handleInputCursorToEnd}
                                onBlur={() => {
                                  setActiveInputText((prev) => {
                                    const copy = { ...prev };
                                    delete copy[`${setItem.id}_weight`];
                                    return copy;
                                  });
                                }}
                                className="w-10 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveInputText((prev) => {
                                    const copy = { ...prev };
                                    delete copy[`${setItem.id}_weight`];
                                    return copy;
                                  });
                                  handleUpdateSet(weItem.id, setItem.id, 'weight', (setItem.weight || 0) + 2.5);
                                }}
                                className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                                title="+2.5 кг"
                              >
                                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                              </button>
                            </div>

                            {/* Reps stepper */}
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveInputText((prev) => {
                                    const copy = { ...prev };
                                    delete copy[`${setItem.id}_actualReps`];
                                    return copy;
                                  });
                                  handleUpdateSet(weItem.id, setItem.id, 'actualReps', Math.max(0, (setItem.actualReps || 0) - 1));
                                }}
                                className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                                title="−1"
                              >
                                <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  activeInputText[`${setItem.id}_actualReps`] !== undefined
                                    ? activeInputText[`${setItem.id}_actualReps`]
                                    : (setItem.actualReps === null ? '' : setItem.actualReps)
                                }
                                onChange={(e) => {
                                  const rawVal = e.target.value;
                                  if (rawVal === '' || /^\d+$/.test(rawVal)) {
                                    const num = rawVal === '' ? null : parseInt(rawVal, 10);
                                    handleUpdateSet(weItem.id, setItem.id, 'actualReps', num);
                                    setActiveInputText((prev) => ({ ...prev, [`${setItem.id}_actualReps`]: rawVal }));
                                  }
                                }}
                                onFocus={handleInputCursorToEnd}
                                onClick={handleInputCursorToEnd}
                                onBlur={() => {
                                  setActiveInputText((prev) => {
                                    const copy = { ...prev };
                                    delete copy[`${setItem.id}_actualReps`];
                                    return copy;
                                  });
                                }}
                                className="w-10 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveInputText((prev) => {
                                    const copy = { ...prev };
                                    delete copy[`${setItem.id}_actualReps`];
                                    return copy;
                                  });
                                  handleUpdateSet(weItem.id, setItem.id, 'actualReps', (setItem.actualReps || 0) + 1);
                                }}
                                className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                                title="+1"
                              >
                                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                              </button>
                            </div>

                            {/* Status checkmark */}
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => handleToggleCompleteSet(weItem.id, setItem)}
                                className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isDone
                                  ? 'bg-emerald-500 text-white'
                                  : 'border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600'
                                  }`}
                                title={isDone ? 'Скасувати' : 'Виконано'}
                              >
                                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                              </button>
                            </div>

                            {/* Delete */}
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSet(weItem.id, setItem.id)}
                                className="text-zinc-300 dark:text-zinc-600 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded-lg transition-colors cursor-pointer"
                                title="Видалити підхід"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add Set — full width dashed footer */}
                    <button
                      type="button"
                      onClick={() => handleAddSet(weItem.id)}
                      className="flex w-full items-center justify-center gap-1.5 py-3 border-t border-dashed border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer rounded-b-xl"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Додати підхід</span>
                    </button>
                  </div>
                </div>

                {/* ================= DESKTOP VIEW (hidden sm:block) ================= */}

                {/* Desktop Exercise Header */}
                <div className="hidden sm:flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Drag handle */}
                    <div
                      className="cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors shrink-0"
                      title="Перетягніть для зміни порядку"
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>

                    {/* #N badge */}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-300 font-mono border border-zinc-200 dark:border-zinc-700">
                      #{weIndex + 1}
                    </span>

                    {/* Exercise name */}
                    <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                        {exerciseName}
                      </h4>
                      {(() => {
                        const badge = getExerciseOriginBadge(exercise);
                        if (!badge) return null;
                        return (
                          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${badge.className}`}>
                            {badge.text}
                          </span>
                        );
                      })()}
                      {isSuperset && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${supersetPalette ? supersetPalette.badge : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30'}`}
                        >
                          <Link className="h-3 w-3" />
                          <span>Суперсет</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {currentExList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleToggleSuperset(weIndex)}
                        className={`p-2 rounded-lg border transition-colors cursor-pointer ${isSuperset && supersetPalette
                          ? supersetPalette.buttonActive
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                          }`}
                        title={isSuperset ? "Роз'єднати суперсет" : weIndex === currentExList.length - 1 ? 'Обʼєднати з попередньою вправою в суперсет' : 'Обʼєднати в суперсет'}
                      >
                        {isSuperset ? <Unlink className="h-4 w-4" /> : <Link className="h-4 w-4" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(weIndex, 'up')}
                      disabled={weIndex === 0}
                      className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Вгору"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(weIndex, 'down')}
                      disabled={weIndex === currentExList.length - 1}
                      className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Вниз"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(weItem.id)}
                      className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-rose-400 hover:text-rose-600 dark:text-rose-500 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer"
                      title="Видалити вправу"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Desktop Config Row: Reps Range + Sets Count */}
                <div className="hidden sm:block px-5 py-3 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800 space-y-2">
                  {/* Reps Range */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest whitespace-nowrap">
                      Повторення:
                    </span>
                    <div className="flex items-center gap-1">
                      {(['4-6', '6-8', '8-10', '8-12', '10-15'] as const).map((range) => {
                        const isSelected = (weItem.targetRepsRange || weItem.sets[0]?.targetRepsRange || '8-12') === range;
                        return (
                          <button
                            key={range}
                            type="button"
                            onClick={() => handleTargetRepsRangeChange(weItem.id, range)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${isSelected
                              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-zinc-100'
                              : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-800 dark:hover:text-white'
                              }`}
                          >
                            {range}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sets Count */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest whitespace-nowrap">
                      Підходи:
                    </span>
                    <div className="flex items-center gap-1">
                      {[2, 3, 4, 5].map((cnt) => {
                        const active = (weItem.setCount || weItem.sets.length) === cnt;
                        return (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => handleSetCountChange(weItem.id, cnt)}
                            className={`h-8 w-8 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${active
                              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-zinc-100'
                              : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-800 dark:hover:text-white'
                              }`}
                            title={`${cnt} підходи`}
                          >
                            {cnt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Desktop Sets Table */}
                <div className="hidden sm:block">
                  {/* Table header */}
                  <div className="grid gap-2 px-5 py-2.5 bg-zinc-50/60 dark:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800"
                    style={{ gridTemplateColumns: '3rem 1fr 1fr 5rem 2.5rem' }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 text-center">Сет</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 text-center">Вага (кг)</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 text-center">Повторення</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 text-center">Статус</span>
                    <span />
                  </div>

                  {/* Table rows */}
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {weItem.sets.map((setItem) => {
                      const isDone = Boolean(setItem.completedAt);
                      return (
                        <div
                          key={setItem.id}
                          className={`grid items-center gap-2 px-5 py-2.5 transition-colors ${isDone ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'}`}
                          style={{ gridTemplateColumns: '3rem 1fr 1fr 5rem 2.5rem' }}
                        >
                          {/* Set number */}
                          <div className="text-center">
                            <span className="font-mono text-sm font-bold text-zinc-700 dark:text-zinc-300">
                              {setItem.setNumber}
                            </span>
                          </div>

                          {/* Weight stepper */}
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveInputText((prev) => {
                                  const copy = { ...prev };
                                  delete copy[`${setItem.id}_weight`];
                                  return copy;
                                });
                                handleUpdateSet(weItem.id, setItem.id, 'weight', Math.max(0, (setItem.weight || 0) - 2.5));
                              }}
                              className="h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0 text-sm font-bold"
                              title="−2.5 кг"
                            >
                              <Minus className="h-4 w-4 stroke-[2.5]" />
                            </button>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                activeInputText[`${setItem.id}_weight`] !== undefined
                                  ? activeInputText[`${setItem.id}_weight`]
                                  : (setItem.weight === 0 ? '0' : setItem.weight)
                              }
                              onChange={(e) => {
                                const rawVal = e.target.value.replace(',', '.');
                                if (rawVal === '' || /^\d*\.?\d*$/.test(rawVal)) {
                                  const num = rawVal === '' ? 0 : parseFloat(rawVal) || 0;
                                  handleUpdateSet(weItem.id, setItem.id, 'weight', num);
                                  setActiveInputText((prev) => ({ ...prev, [`${setItem.id}_weight`]: rawVal }));
                                }
                              }}
                              onFocus={handleInputCursorToEnd}
                              onClick={handleInputCursorToEnd}
                              onBlur={() => {
                                setActiveInputText((prev) => {
                                  const copy = { ...prev };
                                  delete copy[`${setItem.id}_weight`];
                                  return copy;
                                });
                              }}
                              className="w-14 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveInputText((prev) => {
                                  const copy = { ...prev };
                                  delete copy[`${setItem.id}_weight`];
                                  return copy;
                                });
                                handleUpdateSet(weItem.id, setItem.id, 'weight', (setItem.weight || 0) + 2.5);
                              }}
                              className="h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                              title="+2.5 кг"
                            >
                              <Plus className="h-4 w-4 stroke-[2.5]" />
                            </button>
                          </div>

                          {/* Reps stepper */}
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveInputText((prev) => {
                                  const copy = { ...prev };
                                  delete copy[`${setItem.id}_actualReps`];
                                  return copy;
                                });
                                handleUpdateSet(weItem.id, setItem.id, 'actualReps', Math.max(0, (setItem.actualReps || 0) - 1));
                              }}
                              className="h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                              title="−1 повторення"
                            >
                              <Minus className="h-4 w-4 stroke-[2.5]" />
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={
                                activeInputText[`${setItem.id}_actualReps`] !== undefined
                                  ? activeInputText[`${setItem.id}_actualReps`]
                                  : (setItem.actualReps === null ? '' : setItem.actualReps)
                              }
                              onChange={(e) => {
                                const rawVal = e.target.value;
                                if (rawVal === '' || /^\d+$/.test(rawVal)) {
                                  const num = rawVal === '' ? null : parseInt(rawVal, 10);
                                  handleUpdateSet(weItem.id, setItem.id, 'actualReps', num);
                                  setActiveInputText((prev) => ({ ...prev, [`${setItem.id}_actualReps`]: rawVal }));
                                }
                              }}
                              onFocus={handleInputCursorToEnd}
                              onClick={handleInputCursorToEnd}
                              onBlur={() => {
                                setActiveInputText((prev) => {
                                  const copy = { ...prev };
                                  delete copy[`${setItem.id}_actualReps`];
                                  return copy;
                                });
                              }}
                              className="w-14 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveInputText((prev) => {
                                  const copy = { ...prev };
                                  delete copy[`${setItem.id}_actualReps`];
                                  return copy;
                                });
                                handleUpdateSet(weItem.id, setItem.id, 'actualReps', (setItem.actualReps || 0) + 1);
                              }}
                              className="h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                              title="+1 повторення"
                            >
                              <Plus className="h-4 w-4 stroke-[2.5]" />
                            </button>
                          </div>

                          {/* Status (checkmark) */}
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => handleToggleCompleteSet(weItem.id, setItem)}
                              className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isDone
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600 hover:border-emerald-400 hover:text-emerald-400'
                                }`}
                              title={isDone ? 'Позначити як незавершений' : 'Завершити підхід'}
                            >
                              <Check className="h-4 w-4 stroke-[2.5]" />
                            </button>
                          </div>

                          {/* Delete set */}
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveSet(weItem.id, setItem.id)}
                              className="text-zinc-300 dark:text-zinc-600 hover:text-rose-500 dark:hover:text-rose-400 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Видалити підхід"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Set — full width dashed */}
                  <button
                    type="button"
                    onClick={() => handleAddSet(weItem.id)}
                    className="hidden sm:flex w-full items-center justify-center gap-2 py-3.5 border-t border-dashed border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer rounded-b-xl"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Додати підхід</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mobile Action Buttons (in document flow right after the exercises list) */}
      <div className="block sm:hidden mt-4 space-y-2.5 pb-6">
        {/* Додати вправу */}
        <button
          type="button"
          onClick={() => setIsSelectorOpen(true)}
          className="w-full flex items-center justify-center space-x-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-3 px-4 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-600 active:scale-[0.99] transition-all cursor-pointer shadow-2xs"
          title="Додати вправу до тренування"
        >
          <Plus className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <span>Додати вправу</span>
        </button>

        {/* Row: Зберегти + Виконано / Відновити */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleSaveWorkout}
            className="flex items-center justify-center space-x-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white py-2.5 px-3 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer shadow-xs"
            title="Зберегти поточний стан тренування"
          >
            <Save className="h-4 w-4" />
            <span>Зберегти</span>
          </button>

          {workout.status !== 'completed' ? (
            <button
              type="button"
              onClick={handleFinishWorkout}
              className="flex items-center justify-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-3 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer shadow-xs"
              title="Позначити тренування як виконане"
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
              <span>Виконано</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRestoreWorkout}
              className="flex items-center justify-center space-x-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white py-2.5 px-3 text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer shadow-xs"
              title="Відновити тренування (продовжити виконання)"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Відновити</span>
            </button>
          )}
        </div>

        {/* Видалити тренування */}
        <button
          ref={mobileDeleteWorkoutButtonRef}
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          className="w-full flex items-center justify-center space-x-1.5 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 py-2.5 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-[0.99] transition-all cursor-pointer"
          title="Видалити це тренування"
        >
          <Trash2 className="h-4 w-4" />
          <span>Видалити тренування</span>
        </button>
      </div>

      {/* Desktop Sticky Action Bar (hidden on mobile) */}
      <div className="hidden sm:block sticky bottom-4 left-0 right-0 z-30 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-4 shadow-lg backdrop-blur-xs transition-colors">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2.5">
          {/* Workout quick stats */}
          <div className="flex items-center justify-start gap-4 text-xs">
            <div className="flex items-center space-x-1">
              <Layers className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">Вправ:</span>
              <strong className="text-zinc-800 dark:text-zinc-100 font-mono text-xs">{currentExList.length}</strong>
            </div>

            <div className="flex items-center space-x-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">Підходи:</span>
              <strong className="text-zinc-800 dark:text-zinc-100 font-mono text-xs">
                {completedSets} / {totalSets}
              </strong>
            </div>

            <div className="flex items-center space-x-1">
              <Flame className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">Тоннаж:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 font-mono text-xs">{totalVolumeKg} кг</strong>
            </div>
          </div>

          {/* Desktop Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsSelectorOpen(true)}
              className="flex items-center justify-center space-x-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Додати вправу до тренування"
            >
              <Plus className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              <span>Вправа</span>
            </button>

            <button
              type="button"
              onClick={handleSaveWorkout}
              className="flex items-center justify-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white px-4 py-2 text-xs font-semibold transition-colors cursor-pointer active:scale-[0.98]"
              title="Зберегти поточний стан тренування"
            >
              <Save className="h-4 w-4" />
              <span>Зберегти</span>
            </button>

            {workout.status !== 'completed' ? (
              <button
                type="button"
                onClick={handleFinishWorkout}
                className="flex items-center justify-center space-x-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-semibold transition-colors cursor-pointer active:scale-[0.98]"
                title="Позначити тренування як виконане"
              >
                <Check className="h-4 w-4 stroke-[2.5]" />
                <span>Виконано</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestoreWorkout}
                className="flex items-center justify-center space-x-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-xs font-semibold transition-colors cursor-pointer active:scale-[0.98]"
                title="Відновити тренування (продовжити виконання)"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Відновити</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors shrink-0 cursor-pointer"
              title="Видалити це тренування"
              aria-label="Видалити тренування"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ExerciseSelectorModal
        isOpen={isSelectorOpen}
        userId={StorageService.getActiveUserId() || userId}
        onClose={() => setIsSelectorOpen(false)}
        onSelect={handleSelectExercise}
        onOpenCreateModal={(initialName) => {
          setCreateExerciseInitialName(initialName || '');
          setIsCreateOpen(true);
        }}
      />

      <CreateExerciseModal
        isOpen={isCreateOpen}
        userId={StorageService.getActiveUserId() || userId}
        initialName={createExerciseInitialName}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateExerciseInitialName('');
        }}
        onCreated={(newEx) => {
          handleSelectExercise(newEx);
          setCreateExerciseInitialName('');
        }}
      />

      <ExerciseHistoryModal
        exercise={historyModalExercise}
        userId={userId}
        isOpen={Boolean(historyModalExercise)}
        onClose={() => setHistoryModalExercise(null)}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        title="Видалити це тренування?"
        message="Ви впевнені, що хочете видалити поточне тренування? Його результати будуть повністю стерті з бази даних."
        workoutTitle={workout.title}
        workoutDate={workout.scheduledDate}
        isCompleted={workout.status === 'completed'}
        confirmLabel="Видалити тренування"
        onConfirm={handleDeleteCurrentWorkout}
        onClose={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
};
