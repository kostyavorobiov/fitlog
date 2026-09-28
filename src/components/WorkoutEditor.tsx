import React, { useState, useEffect, useMemo } from 'react';
import {
  WorkoutPlan,
  WorkoutExercise,
  WorkoutSet,
  Exercise,
  MUSCLE_GROUPS,
  PastExercisePerformance,
} from '../types/workout';
import { StorageService, generateId } from '../services/storageService';
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
  Sparkles,
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
  const [workout, setWorkout] = useState<WorkoutPlan>(initialWorkout);

  const supersetColorMap = useMemo(() => {
    const map = new Map<string, (typeof SUPERSET_PALETTES)[0]>();
    const uniqueGroups: string[] = [];
    (workout.exercises || []).forEach((e) => {
      if (e.supersetGroupId && !uniqueGroups.includes(e.supersetGroupId)) {
        uniqueGroups.push(e.supersetGroupId);
      }
    });
    uniqueGroups.forEach((groupId, idx) => {
      map.set(groupId, SUPERSET_PALETTES[idx % SUPERSET_PALETTES.length]);
    });
    return map;
  }, [workout.exercises]);

  // Strictly respect requirement 6: Do NOT auto open exercise selector modal; show workout form directly!
  const [isSelectorOpen, setIsSelectorOpen] = useState(Boolean(autoOpenExerciseSelector));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [historyModalExercise, setHistoryModalExercise] = useState<Exercise | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [saveNoticeMessage, setSaveNoticeMessage] = useState('Зміни в тренуванні успішно збережено!');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sync state if initialWorkout changes (e.g. user selected another workout)
  useEffect(() => {
    setWorkout(initialWorkout);
  }, [initialWorkout.id]);

  // Auto-save helper
  const updateAndSave = (updated: WorkoutPlan) => {
    const enrichedExercises = updated.exercises.map((we) => {
      if (!we.exerciseName || !we.muscleGroup) {
        const ex = StorageService.getExerciseById(we.exerciseId);
        return {
          ...we,
          exerciseName: we.exerciseName || ex?.name,
          muscleGroup: we.muscleGroup || ex?.muscleGroup || 'full_body',
        };
      }
      return we;
    });
    const enriched = { ...updated, exercises: enrichedExercises };
    setWorkout(enriched);
    StorageService.saveWorkout(enriched);
    onSave(enriched);
  };

  // Workout Title & Metadata
  const handleTitleChange = (title: string) => {
    updateAndSave({ ...workout, title });
  };

  const handleDateChange = (scheduledDate: string) => {
    updateAndSave({ ...workout, scheduledDate });
  };

  const handleNotesChange = (notes: string) => {
    updateAndSave({ ...workout, notes });
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

  // Add Exercise to Workout
  const handleSelectExercise = (exercise: Exercise) => {
    // Check if exercise has previous performance
    const lastPerf = StorageService.getLastExercisePerformance(userId, exercise.id, workout.id);

    // Initial sets: automatically pre-fill previous weights and reps from past workout
    let initialSets: WorkoutSet[] = [];
    const targetRange = (lastPerf?.sets[0]?.targetRepsRange || '8-12') as string;

    if (lastPerf && lastPerf.sets.length > 0) {
      initialSets = lastPerf.sets.map((ps, idx) => ({
        id: generateId('set'),
        workoutExerciseId: '',
        setNumber: idx + 1,
        targetRepsRange: ps.targetRepsRange || targetRange,
        weight: ps.weight,
        actualReps: ps.actualReps,
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
    const newWorkoutExercise: WorkoutExercise = {
      id: weId,
      workoutPlanId: workout.id,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      order: workout.exercises.length + 1,
      targetRepsRange: targetRange,
      setCount: initialSets.length,
      sets: initialSets.map((s) => ({ ...s, workoutExerciseId: weId })),
    };

    const updated = {
      ...workout,
      exercises: [...workout.exercises, newWorkoutExercise],
    };

    updateAndSave(updated);
    setIsSelectorOpen(false);
  };

  // Reorder exercise drag & drop
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const items = Array.from(workout.exercises);
    const [reorderedItem] = items.splice(draggedIndex, 1);
    items.splice(index, 0, reorderedItem);

    const renumbered = items.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    setDraggedIndex(index);
    updateAndSave({ ...workout, exercises: renumbered });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Move Exercise Up/Down manually
  const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= workout.exercises.length) return;

    const items = [...workout.exercises];
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    const renumbered = items.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    updateAndSave({ ...workout, exercises: renumbered });
  };

  // Delete exercise
  const handleRemoveExercise = (weId: string) => {
    const updatedExercises = workout.exercises
      .filter((e) => e.id !== weId)
      .map((e, idx) => ({ ...e, order: idx + 1 }));

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Target Rep Range change (e.g. '8-12' -> '6-8')
  const handleTargetRepsRangeChange = (weId: string, range: string) => {
    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        const updatedSets = e.sets.map((s) => ({ ...s, targetRepsRange: range }));
        return { ...e, targetRepsRange: range, sets: updatedSets };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Fast set count selector (2, 3, 4, 5)
  const handleSetCountChange = (weId: string, count: number) => {
    const updatedExercises = workout.exercises.map((e) => {
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

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Add individual set
  const handleAddSet = (weId: string) => {
    const updatedExercises = workout.exercises.map((e) => {
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

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Remove individual set
  const handleRemoveSet = (weId: string, setId: string) => {
    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        const filtered = e.sets.filter((s) => s.id !== setId);
        const renumbered = filtered.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
        return { ...e, setCount: renumbered.length, sets: renumbered };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Update set weight / actual reps
  const handleUpdateSet = (
    weId: string,
    setId: string,
    field: 'weight' | 'actualReps',
    value: number | null
  ) => {
    const updatedExercises = workout.exercises.map((e) => {
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

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Toggle complete set
  const handleToggleCompleteSet = (weId: string, setItem: WorkoutSet) => {
    const isNowCompleted = !setItem.completedAt;
    const completedAt = isNowCompleted ? new Date().toISOString() : null;

    const updatedExercises = workout.exercises.map((e) => {
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
      ...workout,
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
    const current = workout.exercises[weIndex];
    if (!current) return;

    if (current.supersetGroupId) {
      // Unlink current exercise from superset
      const oldGroup = current.supersetGroupId;
      const updated = workout.exercises.map((e) => {
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
      updateAndSave({ ...workout, exercises: updated });
    } else {
      // Pair with next exercise, or with previous if at the end of the list
      const next = workout.exercises[weIndex + 1];
      const prev = workout.exercises[weIndex - 1];

      if (next) {
        const newGroupId = next.supersetGroupId || `SS-${generateId('grp').slice(0, 4)}`;
        const updated = workout.exercises.map((e, idx) => {
          if (idx === weIndex || idx === weIndex + 1) {
            return { ...e, supersetGroupId: newGroupId };
          }
          return e;
        });
        updateAndSave({ ...workout, exercises: updated });
      } else if (prev) {
        const newGroupId = prev.supersetGroupId || `SS-${generateId('grp').slice(0, 4)}`;
        const updated = workout.exercises.map((e, idx) => {
          if (idx === weIndex || idx === weIndex - 1) {
            return { ...e, supersetGroupId: newGroupId };
          }
          return e;
        });
        updateAndSave({ ...workout, exercises: updated });
      }
    }
  };

  // Explicitly save workout changes without completing
  const handleSaveWorkout = () => {
    updateAndSave(workout);
    onSave(workout);
    setSaveNoticeMessage('Зміни в тренуванні успішно збережено!');
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  // Complete entire workout (marks status as 'completed')
  const handleFinishWorkout = () => {
    const completedAt = new Date().toISOString();
    const updated: WorkoutPlan = {
      ...workout,
      status: 'completed',
      completedAt,
      durationMinutes: workout.durationMinutes || 60,
    };
    updateAndSave(updated);
    playSuccessChime();
    setSaveNoticeMessage('Тренування успішно виконано! Результати зафіксовані.');
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3500);
  };

  // Restore workout to in_progress status
  const handleRestoreWorkout = () => {
    const updated: WorkoutPlan = {
      ...workout,
      status: 'in_progress',
      completedAt: null,
    };
    updateAndSave(updated);
    setSaveNoticeMessage('Тренування відновлено в процесі');
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  // Delete current workout
  const handleDeleteCurrentWorkout = () => {
    StorageService.deleteWorkout(workout.id);
    if (onDeleteWorkout) {
      onDeleteWorkout(workout.id);
    }
  };

  // Stats calculation
  const totalSets = workout.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const completedSets = workout.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.completedAt !== null).length,
    0
  );
  const totalVolumeKg = workout.exercises.reduce((acc, e) => {
    return (
      acc +
      e.sets.reduce((sAcc, s) => {
        if (s.actualReps && s.weight) {
          return sAcc + s.weight * s.actualReps;
        }
        return sAcc;
      }, 0)
    );
  }, 0);

  return (
    <div className="space-y-4 sm:space-y-6 pb-36 sm:pb-28 animate-fade-in max-w-5xl mx-auto">
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
        {workout.exercises.length === 0 ? (
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
          workout.exercises.map((weItem, weIndex) => {
            const exercise = StorageService.getExerciseById(weItem.exerciseId);
            const exerciseName = exercise?.name || weItem.exerciseName || 'Вправа';
            const muscleGroupKey = exercise?.muscleGroup || weItem.muscleGroup || 'full_body';
            const muscleInfo = MUSCLE_GROUPS[muscleGroupKey] || MUSCLE_GROUPS.full_body;

            const isDragged = draggedIndex === weIndex;
            const isSuperset = Boolean(weItem.supersetGroupId);
            const supersetPalette = weItem.supersetGroupId ? supersetColorMap.get(weItem.supersetGroupId) : null;

            return (
              <div
                key={weItem.id}
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
                {/* Exercise Header */}
                <div className="p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    {/* Drag Handle */}
                    <div
                      className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors hidden sm:flex items-center"
                      title="Перетягніть картку вправи для зміни порядку"
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <span className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 font-mono border border-zinc-200 dark:border-zinc-700">
                      #{weIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 break-words leading-snug">
                          {exerciseName}
                        </h4>
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold ${muscleInfo.badgeBg} border ${muscleInfo.badgeBorder}`}
                        >
                          {muscleInfo.nameUk}
                        </span>
                        {isSuperset && (
                          <span
                            className={`inline-flex items-center space-x-1 rounded-md px-2 py-0.5 text-[9px] sm:text-[10px] font-bold ${supersetPalette ? supersetPalette.badge : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30'}`}
                          >
                            <Link className="h-3 w-3" />
                            <span>Суперсет</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Exercise Action Buttons */}
                  <div className="flex items-center space-x-1.5 shrink-0 flex-wrap gap-y-1">
                    {/* Superset toggle button on EVERY exercise if workout has > 1 exercises */}
                    {workout.exercises.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleToggleSuperset(weIndex)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer inline-flex items-center space-x-1 text-xs font-semibold ${isSuperset && supersetPalette
                          ? supersetPalette.buttonActive
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20'
                          }`}
                        title={
                          isSuperset
                            ? "Роз'єднати суперсет"
                            : weIndex === workout.exercises.length - 1
                            ? 'Обʼєднати з попередньою вправою в суперсет'
                            : 'Обʼєднати в суперсет'
                        }
                      >
                        {isSuperset ? <Unlink className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Link className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                        <span className="hidden md:inline">{isSuperset ? "Роз'єднати" : 'Суперсет'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(weIndex, 'up')}
                      disabled={weIndex === 0}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Вгору"
                    >
                      <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(weIndex, 'down')}
                      disabled={weIndex === workout.exercises.length - 1}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Вниз"
                    >
                      <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(weItem.id)}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer"
                      title="Видалити вправу"
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </div>

                {/* EXERCISE CONFIG BAR: Balanced and aligned for 320-430px mobile & desktop */}
                <div className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-2.5 sm:px-4 sm:py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {/* Target Rep Range (4-6, 6-8, 8-12, 10-15) */}
                  <div className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 rounded-lg p-2 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      Діапазон:
                    </span>
                    <div className="flex items-center space-x-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-950 p-0.5">
                      {(['4-6', '6-8', '8-12', '10-15'] as const).map((range) => {
                        const isSelected = (weItem.targetRepsRange || weItem.sets[0]?.targetRepsRange || '8-12') === range;
                        return (
                          <button
                            key={range}
                            type="button"
                            onClick={() => handleTargetRepsRangeChange(weItem.id, range)}
                            className={`px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer ${isSelected
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                              }`}
                          >
                            {range}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fast Set Count selector (2, 3, 4, 5) */}
                  <div className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 rounded-lg p-2 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      Підходи:
                    </span>
                    <div className="flex items-center space-x-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-950 p-0.5">
                      {[2, 3, 4, 5].map((cnt) => {
                        const active = (weItem.setCount || weItem.sets.length) === cnt;
                        return (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => handleSetCountChange(weItem.id, cnt)}
                            className={`h-6 w-6 sm:h-6 sm:w-7 rounded text-[11px] sm:text-xs font-semibold transition-colors flex items-center justify-center cursor-pointer ${active
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                              }`}
                            title={`Встановити ${cnt} підходи`}
                          >
                            {cnt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* MOBILE VIEW FOR SETS (No horizontal scrolling required!) */}
                <div className="block sm:hidden p-3 space-y-2.5">
                  {weItem.sets.map((setItem) => {
                    const isDone = Boolean(setItem.completedAt);

                    return (
                      <div
                        key={setItem.id}
                        className={`rounded-lg border p-2.5 transition-colors ${isDone
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                          }`}
                      >
                        {/* Mobile Set Header */}
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`inline-flex h-5 w-5 items-center justify-center rounded font-mono text-[11px] font-bold ${isDone
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
                                }`}
                            >
                              #{setItem.setNumber}
                            </span>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                              {setItem.targetRepsRange} повт.
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveSet(weItem.id, setItem.id)}
                            className="p-1 text-zinc-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 cursor-pointer"
                            title="Видалити підхід"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Mobile Inputs row (Weight + Reps + Checkmark) */}
                        <div className="grid grid-cols-12 gap-1.5 items-center">
                          {/* Weight Stepper: 5 cols */}
                          <div className="col-span-5 flex items-center justify-between bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSet(
                                  weItem.id,
                                  setItem.id,
                                  'weight',
                                  Math.max(0, (setItem.weight || 0) - 2.5)
                                )
                              }
                              className="h-7 w-7 rounded bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-700 dark:text-zinc-200 cursor-pointer active:scale-95 transition-all shrink-0"
                              title="Зменшити вагу на 2.5 кг"
                            >
                              <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
                            </button>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min="0"
                              value={setItem.weight === 0 ? '' : setItem.weight}
                              onChange={(e) =>
                                handleUpdateSet(
                                  weItem.id,
                                  setItem.id,
                                  'weight',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full text-center bg-transparent font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none px-0.5"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSet(
                                  weItem.id,
                                  setItem.id,
                                  'weight',
                                  (setItem.weight || 0) + 2.5
                                )
                              }
                              className="h-7 w-7 rounded bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-700 dark:text-zinc-200 cursor-pointer active:scale-95 transition-all shrink-0"
                              title="Збільшити вагу на 2.5 кг"
                            >
                              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                            </button>
                          </div>

                          {/* Reps Stepper: 4 cols */}
                          <div className="col-span-4 flex items-center justify-between bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSet(
                                  weItem.id,
                                  setItem.id,
                                  'actualReps',
                                  Math.max(0, (setItem.actualReps || 0) - 1)
                                )
                              }
                              className="h-7 w-7 rounded bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-700 dark:text-zinc-200 cursor-pointer active:scale-95 transition-all shrink-0"
                              title="Зменшити повторення"
                            >
                              <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="200"
                              value={setItem.actualReps === null ? '' : setItem.actualReps}
                              onChange={(e) =>
                                handleUpdateSet(
                                  weItem.id,
                                  setItem.id,
                                  'actualReps',
                                  e.target.value === '' ? null : parseInt(e.target.value, 10)
                                )
                              }
                              className="w-full text-center bg-transparent font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none px-0.5"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSet(
                                  weItem.id,
                                  setItem.id,
                                  'actualReps',
                                  (setItem.actualReps || 0) + 1
                                )
                              }
                              className="h-7 w-7 rounded bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 flex items-center justify-center text-zinc-700 dark:text-zinc-200 cursor-pointer active:scale-95 transition-all shrink-0"
                              title="Збільшити повторення"
                            >
                              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                            </button>
                          </div>

                          {/* Completion Checkmark: 3 cols */}
                          <div className="col-span-3">
                            <button
                              type="button"
                              onClick={() => handleToggleCompleteSet(weItem.id, setItem)}
                              className={`w-full h-8 flex items-center justify-center rounded-lg transition-colors font-bold text-xs cursor-pointer ${isDone
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white'
                                }`}
                            >
                              {isDone ? (
                                <Check className="h-4 w-4 stroke-[2.5]" />
                              ) : (
                                <Circle className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP VIEW FOR SETS (Clean tabular layout for tablet & PC) */}
                <div className="hidden sm:block p-4 overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[500px]">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        <th className="pb-2.5 w-14 text-center">№</th>
                        <th className="pb-2.5">Вага (кг)</th>
                        <th className="pb-2.5">Повторення (повт.)</th>
                        <th className="pb-2.5 w-28 text-center">Завершено</th>
                        <th className="pb-2.5 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {weItem.sets.map((setItem) => {
                        const isDone = Boolean(setItem.completedAt);

                        return (
                          <tr
                            key={setItem.id}
                            className={`group transition-colors ${isDone ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                              }`}
                          >
                            {/* Set # */}
                            <td className="py-2.5 text-center">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded font-mono text-xs font-bold ${isDone
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                  }`}
                              >
                                {setItem.setNumber}
                              </span>
                            </td>

                            {/* Weight (kg) */}
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center space-x-1.5 max-w-[170px]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSet(
                                      weItem.id,
                                      setItem.id,
                                      'weight',
                                      Math.max(0, (setItem.weight || 0) - 2.5)
                                    )
                                  }
                                  className="h-8 w-8 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                                  title="Зменшити вагу на 2.5 кг"
                                >
                                  <Minus className="h-4 w-4 stroke-[2.5]" />
                                </button>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.5"
                                  min="0"
                                  value={setItem.weight === 0 ? '' : setItem.weight}
                                  onChange={(e) =>
                                    handleUpdateSet(
                                      weItem.id,
                                      setItem.id,
                                      'weight',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-20 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 font-mono text-center text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSet(
                                      weItem.id,
                                      setItem.id,
                                      'weight',
                                      (setItem.weight || 0) + 2.5
                                    )
                                  }
                                  className="h-8 w-8 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                                  title="Збільшити вагу на 2.5 кг"
                                >
                                  <Plus className="h-4 w-4 stroke-[2.5]" />
                                </button>
                                <span className="text-zinc-500 dark:text-zinc-400 text-xs font-medium">кг</span>
                              </div>
                            </td>

                            {/* Actual Reps */}
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center space-x-1.5 max-w-[170px]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSet(
                                      weItem.id,
                                      setItem.id,
                                      'actualReps',
                                      Math.max(0, (setItem.actualReps || 0) - 1)
                                    )
                                  }
                                  className="h-8 w-8 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                                  title="Зменшити повторення"
                                >
                                  <Minus className="h-4 w-4 stroke-[2.5]" />
                                </button>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  max="200"
                                  value={setItem.actualReps === null ? '' : setItem.actualReps}
                                  onChange={(e) =>
                                    handleUpdateSet(
                                      weItem.id,
                                      setItem.id,
                                      'actualReps',
                                      e.target.value === '' ? null : parseInt(e.target.value, 10)
                                    )
                                  }
                                  className={`w-16 rounded-lg border px-2 py-1.5 font-mono text-center text-xs font-bold focus:outline-none ${isDone
                                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                                    : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:border-zinc-900 dark:focus:border-zinc-100'
                                    }`}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSet(
                                      weItem.id,
                                      setItem.id,
                                      'actualReps',
                                      (setItem.actualReps || 0) + 1
                                    )
                                  }
                                  className="h-8 w-8 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                                  title="Збільшити повторення"
                                >
                                  <Plus className="h-4 w-4 stroke-[2.5]" />
                                </button>
                                <span className="text-zinc-500 dark:text-zinc-400 text-xs font-medium">повт</span>
                              </div>
                            </td>

                            {/* Completion Checkmark */}
                            <td className="py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleCompleteSet(weItem.id, setItem)}
                                className={`inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors cursor-pointer ${isDone
                                  ? 'bg-emerald-600 text-white'
                                  : 'border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white'
                                  }`}
                                title={isDone ? 'Позначити як незавершений' : 'Завершити підхід'}
                              >
                                {isDone ? (
                                  <Check className="h-4 w-4 stroke-[2.5]" />
                                ) : (
                                  <Circle className="h-4 w-4" />
                                )}
                              </button>
                            </td>

                            {/* Delete set */}
                            <td className="py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSet(weItem.id, setItem.id)}
                                className="text-zinc-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 p-1 rounded transition-colors opacity-60 group-hover:opacity-100 cursor-pointer"
                                title="Видалити підхід"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add Set Button */}
                <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                  <button
                    type="button"
                    onClick={() => handleAddSet(weItem.id)}
                    className="inline-flex items-center space-x-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span>Додати підхід</span>
                  </button>

                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Підходів: <strong className="text-zinc-800 dark:text-zinc-200">{weItem.sets.length}</strong>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating / Bottom Action Bar (Fully responsive for mobile) */}
      <div className="fixed sm:sticky bottom-14 sm:bottom-4 left-0 right-0 z-30 sm:rounded-xl border-t sm:border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-3 sm:p-4 shadow-lg backdrop-blur-xs transition-colors">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Workout quick stats */}
          <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 text-xs border-b sm:border-b-0 border-zinc-100 dark:border-zinc-800 pb-2 sm:pb-0">
            <div className="flex items-center space-x-1">
              <Layers className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">Вправ:</span>
              <strong className="text-zinc-800 dark:text-zinc-100 font-mono text-xs">{workout.exercises.length}</strong>
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

          {/* Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsSelectorOpen(true)}
              className="flex items-center justify-center space-x-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Додати вправу до тренування"
            >
              <Plus className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              <span className="hidden sm:inline">Вправа</span>
            </button>

            <button
              type="button"
              onClick={handleSaveWorkout}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white px-4 py-2 text-xs font-semibold transition-colors cursor-pointer active:scale-[0.98]"
              title="Зберегти поточний стан тренування"
            >
              <Save className="h-4 w-4" />
              <span>Зберегти</span>
            </button>

            {workout.status !== 'completed' ? (
              <button
                type="button"
                onClick={handleFinishWorkout}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-semibold transition-colors cursor-pointer active:scale-[0.98]"
                title="Позначити тренування як виконане"
              >
                <Check className="h-4 w-4 stroke-[2.5]" />
                <span>Виконано</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestoreWorkout}
                className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-xs font-semibold transition-colors cursor-pointer active:scale-[0.98]"
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
        userId={userId}
        onClose={() => setIsSelectorOpen(false)}
        onSelect={handleSelectExercise}
        onOpenCreateModal={() => setIsCreateOpen(true)}
      />

      <CreateExerciseModal
        isOpen={isCreateOpen}
        userId={userId}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(newEx) => {
          handleSelectExercise(newEx);
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
