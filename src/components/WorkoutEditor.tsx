import React, { useState, useEffect } from 'react';
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
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Dumbbell,
  Sparkles,
  History,
  Save,
  Check,
  ChevronUp,
  ChevronDown,
  Layers,
  ArrowRight,
  Flame,
  Info,
  GripVertical,
  Award,
  ArrowLeft,
  TrendingUp,
  Link,
  Unlink,
} from 'lucide-react';

interface WorkoutEditorProps {
  workout: WorkoutPlan;
  userId: string;
  onSave: (savedWorkout: WorkoutPlan) => void;
  onTriggerRestTimer: () => void;
  onDeleteWorkout?: (workoutId: string) => void;
  onBack?: () => void;
  autoOpenExerciseSelector?: boolean;
  traineeName?: string;
}

interface WeightInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
}

const WeightInput: React.FC<WeightInputProps> = ({ value, onChange, className }) => {
  const [localVal, setLocalVal] = useState<string>(value === 0 ? '' : String(value));
  const isFocusedRef = React.useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalVal(value === 0 ? '' : String(value));
    }
  }, [value]);

  return (
    <input
      type="number"
      step="any"
      min="0"
      inputMode="decimal"
      value={localVal}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        const normalized = localVal.replace(',', '.');
        const parsed = parseFloat(normalized);
        const finalVal = isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed * 100) / 100);
        setLocalVal(finalVal === 0 ? '' : String(finalVal));
        onChange(finalVal);
      }}
      onChange={(e) => {
        const str = e.target.value;
        setLocalVal(str);
        const normalized = str.replace(',', '.');
        const parsed = parseFloat(normalized);
        onChange(isNaN(parsed) ? 0 : Math.max(0, parsed));
      }}
      className={className}
      placeholder="0"
      title="Вага (підтримує десяткові: 10, 12.5, 20.5)"
    />
  );
};

interface RepsInputProps {
  value: number | null;
  onChange: (val: number | null) => void;
  className?: string;
}

const RepsInput: React.FC<RepsInputProps> = ({ value, onChange, className }) => {
  const [localVal, setLocalVal] = useState<string>(value === null || value === undefined ? '' : String(value));
  const isFocusedRef = React.useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalVal(value === null || value === undefined ? '' : String(value));
    }
  }, [value]);

  return (
    <input
      type="number"
      step="1"
      min="0"
      max="999"
      inputMode="numeric"
      pattern="[0-9]*"
      value={localVal}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        if (localVal.trim() === '') {
          setLocalVal('');
          onChange(null);
        } else {
          const parsed = parseInt(localVal, 10);
          const finalVal = isNaN(parsed) ? null : Math.max(0, parsed);
          setLocalVal(finalVal === null ? '' : String(finalVal));
          onChange(finalVal);
        }
      }}
      onChange={(e) => {
        const str = e.target.value;
        setLocalVal(str);
        if (str === '') {
          onChange(null);
        } else {
          const parsed = parseInt(str, 10);
          onChange(isNaN(parsed) ? null : Math.max(0, parsed));
        }
      }}
      className={className}
      placeholder="—"
      title="Кількість повторень (ціле число)"
    />
  );
};

export const WorkoutEditor: React.FC<WorkoutEditorProps> = ({
  workout: initialWorkout,
  userId,
  onSave,
  onTriggerRestTimer,
  onDeleteWorkout,
  onBack,
  autoOpenExerciseSelector = false,
  traineeName,
}) => {
  const [workout, setWorkout] = useState<WorkoutPlan>(initialWorkout);
  // Important UX: Do NOT open selector automatically on blank workouts. User lands in the form first!
  const [isSelectorOpen, setIsSelectorOpen] = useState(Boolean(autoOpenExerciseSelector));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [historyModalExercise, setHistoryModalExercise] = useState<Exercise | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sync state if initialWorkout changes
  useEffect(() => {
    setWorkout(initialWorkout);
  }, [initialWorkout.id]);

  // Auto-save helper
  const updateAndSave = (updated: WorkoutPlan) => {
    setWorkout(updated);
    StorageService.saveWorkout(updated);
    onSave(updated);
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
    const lastPerf = StorageService.getLastExercisePerformance(userId, exercise.id, workout.id);

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
      order: workout.exercises.length + 1,
      setCount: initialSets.length,
      targetRepsRange: targetRange,
      sets: initialSets.map((s) => ({ ...s, workoutExerciseId: weId, targetRepsRange: targetRange })),
    };

    const updated = {
      ...workout,
      status: workout.status === 'planned' ? ('in_progress' as const) : workout.status,
      exercises: [...workout.exercises, newWorkoutExercise],
    };
    updateAndSave(updated);
  };

  // Remove exercise from workout
  const handleRemoveExercise = (weId: string) => {
    const updated = {
      ...workout,
      exercises: workout.exercises
        .filter((e) => e.id !== weId)
        .map((e, idx) => ({ ...e, order: idx + 1 })),
    };
    updateAndSave(updated);
  };

  // Reorder exercise
  const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= workout.exercises.length) return;

    const list = [...workout.exercises];
    const temp = list[index];
    list[index] = list[newIndex];
    list[newIndex] = temp;

    const updated = {
      ...workout,
      exercises: list.map((e, idx) => ({ ...e, order: idx + 1 })),
    };
    updateAndSave(updated);
  };

  // Drag and drop reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const reordered = [...workout.exercises];
    const item = reordered.splice(draggedIndex, 1)[0];
    reordered.splice(index, 0, item);
    const updated = reordered.map((ex, idx) => ({ ...ex, order: idx + 1 }));
    setWorkout({ ...workout, exercises: updated });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    updateAndSave(workout);
  };

  // Target reps range change
  const handleTargetRepsRangeChange = (weId: string, range: string) => {
    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        return {
          ...e,
          targetRepsRange: range,
          sets: e.sets.map((s) => ({
            ...s,
            targetRepsRange: range,
          })),
        };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Set count change (supports 1 to 20 sets)
  const handleSetCountChange = (weId: string, count: number) => {
    if (count < 1 || count > 20) return;
    const targetWe = workout.exercises.find((e) => e.id === weId);
    const lastPerf = targetWe ? StorageService.getLastExercisePerformance(userId, targetWe.exerciseId, workout.id) : null;

    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        const currentSets = e.sets;
        let newSets: WorkoutSet[] = [];

        if (count > currentSets.length) {
          newSets = [...currentSets];
          for (let i = currentSets.length + 1; i <= count; i++) {
            const lastSet = currentSets[currentSets.length - 1];
            const pastSetMatch = lastPerf?.sets.find((ps) => ps.setNumber === i);

            newSets.push({
              id: generateId('set'),
              workoutExerciseId: weId,
              setNumber: i,
              targetRepsRange: e.targetRepsRange || '8-12',
              weight: pastSetMatch ? pastSetMatch.weight : lastSet ? lastSet.weight : 20,
              actualReps: pastSetMatch ? pastSetMatch.actualReps : lastSet ? lastSet.actualReps : 10,
              completedAt: null,
            });
          }
        } else {
          newSets = currentSets.slice(0, count);
        }

        return {
          ...e,
          setCount: count,
          sets: newSets,
        };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Add individual set to exercise
  const handleAddSet = (weId: string) => {
    const targetWe = workout.exercises.find((e) => e.id === weId);
    if (!targetWe) return;

    const nextSetNumber = targetWe.sets.length + 1;
    const lastSet = targetWe.sets[targetWe.sets.length - 1];
    const lastPerf = StorageService.getLastExercisePerformance(userId, targetWe.exerciseId, workout.id);
    const pastSetMatch = lastPerf?.sets.find((ps) => ps.setNumber === nextSetNumber);

    const newSet: WorkoutSet = {
      id: generateId('set'),
      workoutExerciseId: weId,
      setNumber: nextSetNumber,
      targetRepsRange: targetWe.targetRepsRange || '8-12',
      weight: pastSetMatch ? pastSetMatch.weight : lastSet ? lastSet.weight : 20,
      actualReps: pastSetMatch ? pastSetMatch.actualReps : lastSet ? lastSet.actualReps : 10,
      completedAt: null,
    };

    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        return {
          ...e,
          setCount: e.sets.length + 1,
          sets: [...e.sets, newSet],
        };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Remove individual set
  const handleRemoveSet = (weId: string, setId: string) => {
    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        const remaining = e.sets.filter((s) => s.id !== setId);
        const renumbered = remaining.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
        return {
          ...e,
          setCount: renumbered.length,
          sets: renumbered,
        };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Update set weight / reps / target
  const handleUpdateSet = (
    weId: string,
    setId: string,
    field: 'weight' | 'actualReps' | 'targetRepsRange',
    value: any
  ) => {
    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        return {
          ...e,
          sets: e.sets.map((s) => {
            if (s.id === setId) {
              return { ...s, [field]: value };
            }
            return s;
          }),
        };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Toggle set completion
  const handleToggleCompleteSet = (weId: string, setItem: WorkoutSet) => {
    const nowDone = !setItem.completedAt;
    const completedAt = nowDone ? new Date().toISOString() : null;

    let autoReps = setItem.actualReps;
    if (nowDone && (autoReps === null || autoReps === undefined || autoReps === 0)) {
      if (setItem.targetRepsRange && setItem.targetRepsRange.includes('-')) {
        const parts = setItem.targetRepsRange.split('-');
        autoReps = parseInt(parts[0], 10) || 10;
      } else {
        autoReps = 10;
      }
    }

    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        return {
          ...e,
          sets: e.sets.map((s) => {
            if (s.id === setItem.id) {
              return {
                ...s,
                actualReps: autoReps,
                completedAt,
              };
            }
            return s;
          }),
        };
      }
      return e;
    });

    const updated = {
      ...workout,
      status: 'in_progress' as const,
      exercises: updatedExercises,
    };
    updateAndSave(updated);

    if (nowDone) {
      playBeep(523.25, 0.08);
      onTriggerRestTimer();
    }
  };

  // Toggle superset grouping between exercise and next exercise
  const handleToggleSuperset = (weIndex: number) => {
    const current = workout.exercises[weIndex];
    const next = workout.exercises[weIndex + 1];
    if (!current) return;

    if (current.supersetGroupId) {
      // Unlink current from superset
      const groupId = current.supersetGroupId;
      const updated = workout.exercises.map((e) => {
        if (e.id === current.id) {
          return { ...e, supersetGroupId: null };
        }
        return e;
      });
      // If only 1 remains in this group, clear it too
      const remainingInGroup = updated.filter((e) => e.supersetGroupId === groupId);
      if (remainingInGroup.length <= 1) {
        updated.forEach((e) => {
          if (e.supersetGroupId === groupId) {
            e.supersetGroupId = null;
          }
        });
      }
      updateAndSave({ ...workout, exercises: updated });
    } else if (next) {
      // Link with next exercise
      const newGroupId = `SS-${generateId('grp').slice(0, 4)}`;
      const updated = workout.exercises.map((e, idx) => {
        if (idx === weIndex || idx === weIndex + 1) {
          return { ...e, supersetGroupId: newGroupId };
        }
        return e;
      });
      updateAndSave({ ...workout, exercises: updated });
    }
  };

  // Finish Workout
  const handleFinishWorkout = () => {
    const isNowComplete = workout.status !== 'completed';
    const updated: WorkoutPlan = {
      ...workout,
      status: isNowComplete ? 'completed' : 'in_progress',
      completedAt: isNowComplete ? new Date().toISOString() : null,
    };
    updateAndSave(updated);

    if (isNowComplete) {
      playSuccessChime();
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3500);
    }
  };

  // Delete workout
  const handleDeleteCurrentWorkout = () => {
    setIsDeleteModalOpen(false);
    if (onDeleteWorkout) {
      onDeleteWorkout(workout.id);
    }
  };

  // Stats calculation
  let totalVolumeKg = 0;
  let totalSets = 0;
  let completedSets = 0;

  workout.exercises.forEach((we) => {
    we.sets.forEach((s) => {
      totalSets += 1;
      if (s.completedAt) {
        completedSets += 1;
        if (s.weight && s.actualReps) {
          totalVolumeKg += s.weight * s.actualReps;
        }
      }
    });
  });

  return (
    <div data-no-swipe="true" className="space-y-4 max-w-5xl mx-auto animate-fade-in pb-28">
      {/* Trainee Plan Notice Banner */}
      {traineeName && (
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <Award className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-semibold text-indigo-900 dark:text-indigo-200">
              Режим тренера: План для підопічного: <span className="underline">{traineeName}</span>
            </span>
          </div>
          <span className="text-[11px] text-indigo-700 dark:text-indigo-400 font-mono">
            Збереження в профіль підопічного
          </span>
        </div>
      )}

      {/* Top Navigation & Status Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center space-x-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Назад</span>
            </button>
          )}

          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold border ${
              workout.status === 'completed'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : workout.status === 'in_progress'
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
            }`}
          >
            {workout.status === 'completed'
              ? 'Завершено'
              : workout.status === 'in_progress'
              ? 'У процесі'
              : 'Заплановано'}
          </span>
        </div>

        {/* Action buttons (Finish / Save / Delete) */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleFinishWorkout}
            className={`inline-flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              workout.status === 'completed'
                ? 'border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            <span>{workout.status === 'completed' ? 'Відновити' : 'Завершити'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              StorageService.saveWorkout(workout);
              onSave(workout);
              setSaveSuccessNotice(true);
              setTimeout(() => setSaveSuccessNotice(false), 2000);
            }}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Зберегти</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Видалити тренування"
            aria-label="Видалити тренування"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Success notification */}
      {saveSuccessNotice && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Тренування збережено!</span>
        </div>
      )}

      {/* Workout Metadata Card - Minimal Flat */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Title input */}
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Назва тренування
            </label>
            <input
              type="text"
              value={workout.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Наприклад: Груди та Тріцепс"
              className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-base sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition"
            />
          </div>

          {/* Date Picker */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Дата
            </label>
            <div className="relative">
              <input
                type="date"
                value={workout.scheduledDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-base sm:text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Quick Title Presets */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">Швидкі назви:</span>
          {titlePresets.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTitleChange(t)}
              className={`rounded border px-2 py-0.5 text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                workout.title === t
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 font-semibold'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Workout notes */}
        <div>
          <input
            type="text"
            placeholder="Загальні примітки до тренування (необов'язково)..."
            value={workout.notes || ''}
            onChange={(e) => handleNotesChange(e.target.value)}
            className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-base sm:text-xs text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          />
        </div>
      </div>

      {/* Exercises Section */}
      <div className="space-y-3">
        {workout.exercises.length === 0 ? (
          /* Empty state inside the creation form: directly accessible add button */
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-8 sm:p-12 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                У тренуванні ще немає вправ
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-1">
                Натисніть кнопку нижче, щоб вибрати вправи з каталогу або створити нову вправу.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSelectorOpen(true)}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-4 py-2 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Додати першу вправу</span>
            </button>
          </div>
        ) : (
          workout.exercises.map((weItem, weIndex) => {
            const exercise = StorageService.getExerciseById(weItem.exerciseId);
            const muscleInfo = exercise
              ? MUSCLE_GROUPS[exercise.muscleGroup] || MUSCLE_GROUPS.full_body
              : MUSCLE_GROUPS.full_body;

            const lastPerformance = StorageService.getLastExercisePerformance(
              userId,
              weItem.exerciseId,
              workout.id
            );

            const isDragged = draggedIndex === weIndex;
            const isSuperset = Boolean(weItem.supersetGroupId);

            return (
              <div
                key={weItem.id}
                draggable
                onDragStart={() => handleDragStart(weIndex)}
                onDragOver={(e) => handleDragOver(e, weIndex)}
                onDragEnd={handleDragEnd}
                className={`rounded-lg border bg-white dark:bg-zinc-900 transition-colors ${
                  isDragged
                    ? 'border-zinc-400 dark:border-zinc-500 opacity-60'
                    : isSuperset
                    ? 'border-l-4 border-l-indigo-500 border-zinc-200 dark:border-zinc-800'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {/* Exercise Header */}
                <div className="p-3 sm:px-4 sm:py-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    {/* Drag Handle */}
                    <div
                      className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hidden sm:flex items-center"
                      title="Перетягніть для зміни порядку"
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {weIndex + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {exercise?.name || 'Вправа'}
                        </h4>
                        <span className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                          {muscleInfo.nameUk}
                        </span>
                        {isSuperset && (
                          <span className="rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-400">
                            Суперсет
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Exercise Controls */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    {/* View History / PR button */}
                    {exercise && (
                      <button
                        type="button"
                        onClick={() => setHistoryModalExercise(exercise)}
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Історія та рекорди"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Superset Toggle button */}
                    <button
                      type="button"
                      onClick={() => handleToggleSuperset(weIndex)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isSuperset
                          ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                      title={isSuperset ? 'Розʼєднати суперсет' : 'Обʼєднати з наступною вправою у суперсет'}
                    >
                      {isSuperset ? <Unlink className="h-3.5 w-3.5" /> : <Link className="h-3.5 w-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMoveExercise(weIndex, 'up')}
                      disabled={weIndex === 0}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Вгору"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMoveExercise(weIndex, 'down')}
                      disabled={weIndex === workout.exercises.length - 1}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Вниз"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(weItem.id)}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Видалити вправу"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Exercise Config Bar: Reps Range & Fast Set Count */}
                <div className="p-2.5 sm:px-4 sm:py-2 bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Target Rep Range */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Діапазон:</span>
                    <div className="inline-flex items-center rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5">
                      {(['4-6', '6-8', '8-12', '10-15'] as const).map((range) => {
                        const isSelected = (weItem.targetRepsRange || weItem.sets[0]?.targetRepsRange || '8-12') === range;
                        return (
                          <button
                            key={range}
                            type="button"
                            onClick={() => handleTargetRepsRangeChange(weItem.id, range)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                            }`}
                          >
                            {range}
                          </button>
                        );
                      })}
                      <input
                        type="text"
                        placeholder="інший"
                        inputMode="numeric"
                        value={['4-6', '6-8', '8-12', '10-15'].includes(weItem.targetRepsRange || '') ? '' : (weItem.targetRepsRange || '')}
                        onChange={(e) => handleTargetRepsRangeChange(weItem.id, e.target.value)}
                        className="w-12 px-1 text-center text-[10px] font-mono border-l border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none"
                        title="Власний діапазон повторень (наприклад: 5-8 або 12)"
                      />
                    </div>
                  </div>

                  {/* Fast Set Count selector (2, 3, 4, 5) + numeric input */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Підходи:</span>
                    <div className="inline-flex items-center rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5">
                      {[2, 3, 4, 5].map((cnt) => {
                        const active = (weItem.setCount || weItem.sets.length) === cnt;
                        return (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => handleSetCountChange(weItem.id, cnt)}
                            className={`h-5 w-5 rounded text-[10px] font-semibold transition-colors flex items-center justify-center cursor-pointer ${
                              active
                                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                            }`}
                          >
                            {cnt}
                          </button>
                        );
                      })}
                      <input
                        type="number"
                        min="1"
                        max="20"
                        step="1"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={weItem.setCount || weItem.sets.length}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 1 && val <= 20) {
                            handleSetCountChange(weItem.id, val);
                          }
                        }}
                        className="w-8 h-5 text-center text-[10px] font-mono font-bold bg-transparent text-zinc-900 dark:text-zinc-100 border-l border-zinc-200 dark:border-zinc-800 focus:outline-none"
                        title="Вказати кількість підходів (1-20)"
                      />
                    </div>
                  </div>
                </div>

                {/* MOBILE VIEW FOR SETS (320px - 430px) */}
                <div className="block sm:hidden p-3 space-y-2">
                  {weItem.sets.map((setItem) => {
                    const isDone = Boolean(setItem.completedAt);

                    return (
                      <div
                        key={setItem.id}
                        className={`rounded-lg border p-2 transition-colors ${
                          isDone
                            ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40'
                        }`}
                      >
                        {/* Mobile Set Header */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded font-mono text-[11px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                              #{setItem.setNumber}
                            </span>
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                              {setItem.targetRepsRange} повт.
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveSet(weItem.id, setItem.id)}
                            className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                            title="Видалити підхід"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Mobile Steppers Row */}
                        <div className="grid grid-cols-12 gap-1.5 items-center">
                          {/* Weight Stepper: 5 cols */}
                          <div className="col-span-5 flex items-center bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 px-1 py-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSet(
                                  weItem.id,
                                  setItem.id,
                                  'weight',
                                  Math.max(0, Math.round(((setItem.weight || 0) - 2.5) * 100) / 100)
                                )
                              }
                              className="px-1 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                            >
                              -
                            </button>
                            <WeightInput
                              value={setItem.weight}
                              onChange={(val) => handleUpdateSet(weItem.id, setItem.id, 'weight', val)}
                              className="w-full text-center bg-transparent font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                            />
                            <span className="text-[10px] text-zinc-400 pr-1">кг</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSet(
                                  weItem.id,
                                  setItem.id,
                                  'weight',
                                  Math.round(((setItem.weight || 0) + 2.5) * 100) / 100
                                )
                              }
                              className="px-1 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          {/* Reps Stepper: 4 cols */}
                          <div className="col-span-4 flex items-center bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 px-1 py-0.5">
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
                              className="px-1 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                            >
                              -
                            </button>
                            <RepsInput
                              value={setItem.actualReps}
                              onChange={(val) => handleUpdateSet(weItem.id, setItem.id, 'actualReps', val)}
                              className="w-full text-center bg-transparent font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none"
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
                              className="px-1 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          {/* Completion Checkmark: 3 cols */}
                          <div className="col-span-3">
                            <button
                              type="button"
                              onClick={() => handleToggleCompleteSet(weItem.id, setItem)}
                              className={`w-full h-8 flex items-center justify-center rounded transition-colors font-bold text-xs cursor-pointer ${
                                isDone
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                              }`}
                            >
                              {isDone ? (
                                <Check className="h-4 w-4 stroke-[3]" />
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

                {/* DESKTOP VIEW FOR SETS (Table Layout) */}
                <div className="hidden sm:block p-3 sm:p-4 overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[480px]">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        <th className="pb-2 w-12 text-center">№</th>
                        <th className="pb-2">Вага (кг)</th>
                        <th className="pb-2">Повторення</th>
                        <th className="pb-2 w-28 text-center">Завершено</th>
                        <th className="pb-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {weItem.sets.map((setItem) => {
                        const isDone = Boolean(setItem.completedAt);

                        return (
                          <tr
                            key={setItem.id}
                            className={`border-b border-zinc-50 dark:border-zinc-800/40 transition-colors ${
                              isDone ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                            }`}
                          >
                            {/* Set # */}
                            <td className="py-2 text-center">
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded font-mono text-[11px] font-bold ${
                                  isDone
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                }`}
                              >
                                {setItem.setNumber}
                              </span>
                            </td>

                            {/* Weight (kg) */}
                            <td className="py-2 pr-4">
                              <div className="flex items-center space-x-1 max-w-[150px]">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSet(
                                      weItem.id,
                                      setItem.id,
                                      'weight',
                                      Math.max(0, Math.round(((setItem.weight || 0) - 2.5) * 100) / 100)
                                    )
                                  }
                                  className="h-7 w-7 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center font-bold text-xs cursor-pointer"
                                >
                                  -
                                </button>
                                <WeightInput
                                  value={setItem.weight}
                                  onChange={(val) => handleUpdateSet(weItem.id, setItem.id, 'weight', val)}
                                  className="w-16 h-7 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-1 font-mono text-center text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSet(
                                      weItem.id,
                                      setItem.id,
                                      'weight',
                                      Math.round(((setItem.weight || 0) + 2.5) * 100) / 100
                                    )
                                  }
                                  className="h-7 w-7 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center font-bold text-xs cursor-pointer"
                                >
                                  +
                                </button>
                                <span className="text-zinc-400 text-[11px]">кг</span>
                              </div>
                            </td>

                            {/* Actual Reps */}
                            <td className="py-2 pr-4">
                              <div className="flex items-center space-x-1 max-w-[150px]">
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
                                  className="h-7 w-7 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center font-bold text-xs cursor-pointer"
                                >
                                  -
                                </button>
                                <RepsInput
                                  value={setItem.actualReps}
                                  onChange={(val) => handleUpdateSet(weItem.id, setItem.id, 'actualReps', val)}
                                  className="w-14 h-7 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-1 font-mono text-center text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
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
                                  className="h-7 w-7 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center font-bold text-xs cursor-pointer"
                                >
                                  +
                                </button>
                                <span className="text-zinc-400 text-[11px]">повт</span>
                              </div>
                            </td>

                            {/* Completion Checkmark */}
                            <td className="py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleCompleteSet(weItem.id, setItem)}
                                className={`inline-flex items-center justify-center h-7 w-7 rounded transition-colors cursor-pointer ${
                                  isDone
                                    ? 'bg-emerald-600 text-white'
                                    : 'border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                }`}
                                title={isDone ? 'Позначити як незавершений' : 'Завершити підхід'}
                              >
                                {isDone ? (
                                  <Check className="h-4 w-4 stroke-[3]" />
                                ) : (
                                  <Circle className="h-4 w-4" />
                                )}
                              </button>
                            </td>

                            {/* Delete set */}
                            <td className="py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSet(weItem.id, setItem.id)}
                                className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
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
                <div className="p-2.5 sm:px-4 sm:py-2.5 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40">
                  <button
                    type="button"
                    onClick={() => handleAddSet(weItem.id)}
                    className="inline-flex items-center space-x-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
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

      {/* Floating Bottom Action Bar */}
      <div className="fixed sm:sticky bottom-16 sm:bottom-4 left-0 right-0 z-30 sm:rounded-lg border-t sm:border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-3 sm:p-3.5 shadow-lg backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Workout quick stats */}
          <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 text-xs border-b sm:border-b-0 border-zinc-100 dark:border-zinc-800 pb-2 sm:pb-0">
            <div className="flex items-center space-x-1">
              <Layers className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">Вправ:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 font-mono text-xs">{workout.exercises.length}</strong>
            </div>

            <div className="flex items-center space-x-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">Підходи:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 font-mono text-xs">
                {completedSets} / {totalSets}
              </strong>
            </div>

            <div className="flex items-center space-x-1">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">Тоннаж:</span>
              <strong className="text-zinc-900 dark:text-zinc-100 font-mono text-xs">{totalVolumeKg} кг</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsSelectorOpen(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Вправа</span>
            </button>

            <button
              type="button"
              onClick={handleFinishWorkout}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-4 py-2 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{workout.status === 'completed' ? 'Зберегти зміни' : 'Завершити тренування'}</span>
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
