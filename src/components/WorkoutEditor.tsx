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
} from 'lucide-react';

interface WorkoutEditorProps {
  workout: WorkoutPlan;
  userId: string;
  onSave: (savedWorkout: WorkoutPlan) => void;
  onTriggerRestTimer: () => void;
  onDeleteWorkout?: (workoutId: string) => void;
  onBack?: () => void;
  autoOpenExerciseSelector?: boolean;
}

export const WorkoutEditor: React.FC<WorkoutEditorProps> = ({
  workout: initialWorkout,
  userId,
  onSave,
  onTriggerRestTimer,
  onDeleteWorkout,
  onBack,
  autoOpenExerciseSelector = false,
}) => {
  const [workout, setWorkout] = useState<WorkoutPlan>(initialWorkout);
  const [isSelectorOpen, setIsSelectorOpen] = useState(
    Boolean(autoOpenExerciseSelector || initialWorkout.exercises.length === 0)
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [historyModalExercise, setHistoryModalExercise] = useState<Exercise | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sync state if initialWorkout changes (e.g. user selected another workout)
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
        actualReps: ps.actualReps, // automatically record previous reps!
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

  // Change target reps range once for the exercise (4-6, 6-8, 8-12, 10-15)
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

  // Set count change (2 to 5)
  const handleSetCountChange = (weId: string, count: number) => {
    if (count < 2 || count > 5) return;
    const targetWe = workout.exercises.find((e) => e.id === weId);
    const lastPerf = targetWe ? StorageService.getLastExercisePerformance(userId, targetWe.exerciseId, workout.id) : null;

    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        const currentSets = e.sets;
        const targetRange = e.targetRepsRange || currentSets[0]?.targetRepsRange || '8-12';
        const lastWeight = currentSets[currentSets.length - 1]?.weight || 20;
        const lastReps = currentSets[currentSets.length - 1]?.actualReps ?? 10;

        let newSets: WorkoutSet[] = [];
        if (count > currentSets.length) {
          newSets = [...currentSets];
          for (let i = currentSets.length + 1; i <= count; i++) {
            const pastSet = lastPerf?.sets[i - 1];
            newSets.push({
              id: generateId('set'),
              workoutExerciseId: weId,
              setNumber: i,
              targetRepsRange: targetRange,
              weight: pastSet?.weight ?? lastWeight,
              actualReps: pastSet?.actualReps ?? lastReps,
              completedAt: null,
            });
          }
        } else {
          newSets = currentSets.slice(0, count).map((s, idx) => ({
            ...s,
            setNumber: idx + 1,
          }));
        }
        return {
          ...e,
          setCount: count,
          targetRepsRange: targetRange,
          sets: newSets,
        };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Add Set to Exercise
  const handleAddSet = (weId: string) => {
    const targetWe = workout.exercises.find((e) => e.id === weId);
    if (!targetWe) return;

    const lastSet = targetWe.sets[targetWe.sets.length - 1];
    const newSetNumber = targetWe.sets.length + 1;

    const newSet: WorkoutSet = {
      id: generateId('set'),
      workoutExerciseId: weId,
      setNumber: newSetNumber,
      targetRepsRange: lastSet?.targetRepsRange || '8-12',
      weight: lastSet?.weight || 20,
      actualReps: null,
      completedAt: null,
    };

    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        return {
          ...e,
          sets: [...e.sets, newSet],
        };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Remove Set
  const handleRemoveSet = (weId: string, setId: string) => {
    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        const remaining = e.sets.filter((s) => s.id !== setId);
        return {
          ...e,
          sets: remaining.map((s, idx) => ({ ...s, setNumber: idx + 1 })),
        };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Update Set details (Weight, Reps, TargetRange)
  const handleUpdateSet = (
    weId: string,
    setId: string,
    field: keyof WorkoutSet,
    val: any
  ) => {
    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        return {
          ...e,
          sets: e.sets.map((s) => {
            if (s.id === setId) {
              return { ...s, [field]: val };
            }
            return s;
          }),
        };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Toggle Complete Set
  const handleToggleCompleteSet = (weId: string, setItem: WorkoutSet) => {
    const isNowCompleted = !setItem.completedAt;

    let newActualReps = setItem.actualReps;
    if (isNowCompleted && (newActualReps === null || newActualReps === 0)) {
      // Parse target reps range default (e.g. "8-12" -> 10, "10" -> 10)
      const rangeParts = setItem.targetRepsRange.split('-').map((n) => parseInt(n.trim(), 10));
      if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
        newActualReps = rangeParts[0]; // lower bound of target
      } else if (rangeParts.length === 1 && !isNaN(rangeParts[0])) {
        newActualReps = rangeParts[0];
      } else {
        newActualReps = 10;
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
                actualReps: newActualReps,
                completedAt: isNowCompleted ? new Date().toISOString() : null,
              };
            }
            return s;
          }),
        };
      }
      return e;
    });

    const updatedWorkout: WorkoutPlan = {
      ...workout,
      status: 'in_progress',
      exercises: updatedExercises,
    };

    updateAndSave(updatedWorkout);

    if (isNowCompleted) {
      playSuccessChime();
      onTriggerRestTimer();
    } else {
      playBeep(400, 0.1);
    }
  };

  // Copy past performance sets into current exercise sets
  const handleApplyPastPerformance = (weId: string, pastPerf: PastExercisePerformance) => {
    const updatedExercises = workout.exercises.map((e) => {
      if (e.id === weId) {
        const updatedSets = e.sets.map((currentSet) => {
          const matchingPast =
            pastPerf.sets.find((p) => p.setNumber === currentSet.setNumber) ||
            pastPerf.sets[pastPerf.sets.length - 1];

          if (matchingPast) {
            return {
              ...currentSet,
              weight: matchingPast.weight,
              targetRepsRange: matchingPast.targetRepsRange || currentSet.targetRepsRange,
            };
          }
          return currentSet;
        });

        return { ...e, sets: updatedSets };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Complete entire workout
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
            className="inline-flex items-center space-x-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white hover:border-amber-500/50 hover:bg-slate-850 transition shadow-sm"
          >
            <ArrowLeft className="h-4 w-4 text-amber-400" />
            <span>До списку тренувань</span>
          </button>
        </div>
      )}

      {/* Top Banner / Status Alert */}
      {saveSuccessNotice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/80 p-3 flex items-center space-x-2 text-emerald-300 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Тренування збережено як завершене! Результати зафіксовані в базі.</span>
        </div>
      )}

      {/* Workout Metadata Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 shadow-xl backdrop-blur-sm">
        {/* Title & Status Header */}
        <div className="flex flex-col gap-3 border-b border-slate-800 pb-3.5 mb-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Програма тренування
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  workout.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : workout.status === 'in_progress'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {workout.status === 'completed'
                  ? 'Завершено ✓'
                  : workout.status === 'in_progress'
                  ? 'У процесі ⚡'
                  : 'Заплановано'}
              </span>
              {workout.assignedByCoachId && (
                <span className="inline-flex items-center space-x-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                  <Award className="h-3 w-3" />
                  <span>Призначено тренером</span>
                </span>
              )}
            </div>

            {/* Action buttons (Finish / Restore & Delete) */}
            <div className="flex items-center space-x-1.5">
              {workout.status !== 'completed' ? (
                <button
                  onClick={handleFinishWorkout}
                  className="flex items-center space-x-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 transition"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Завершити</span>
                  <span className="sm:hidden">Готово</span>
                </button>
              ) : (
                <button
                  onClick={() => updateAndSave({ ...workout, status: 'in_progress' })}
                  className="flex items-center space-x-1 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
                >
                  <span>Відновити</span>
                </button>
              )}

              {/* Delete workout button */}
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-1.5 sm:p-2 text-rose-400 hover:bg-rose-500/25 transition"
                title="Видалити це тренування"
                aria-label="Видалити тренування"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>

          {/* Title input */}
          <div className="space-y-1">
            <input
              type="text"
              value={workout.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Назва тренування"
              required
              className="w-full font-bold text-lg sm:text-2xl text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-500 focus:outline-none transition py-0.5"
            />
            {!workout.title.trim() && (
              <p className="text-[11px] text-rose-400">Назва тренування обов'язкова до заповнення</p>
            )}
          </div>

          {/* Date Picker row */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              <input
                type="date"
                value={workout.scheduledDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-transparent text-white focus:outline-none cursor-pointer text-xs"
              />
            </div>
          </div>
        </div>

        {/* Quick Title Presets */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[10px] sm:text-[11px] text-slate-500 whitespace-nowrap">Швидкі назви:</span>
          {titlePresets.map((t) => (
            <button
              key={t}
              onClick={() => handleTitleChange(t)}
              className={`rounded-lg px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] whitespace-nowrap transition ${
                workout.title === t
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
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
            className="w-full text-xs text-slate-300 bg-slate-800/40 rounded-xl px-3 py-2 border border-slate-800 placeholder-slate-500 focus:outline-none focus:border-slate-700"
          />
        </div>
      </div>

      {/* Exercises List */}
      <div className="space-y-4">
        {workout.exercises.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 sm:p-12 text-center">
            <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-3">
              <Dumbbell className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-1">Тренування порожнє</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              Додайте вправи до сьогоднішньої програми. Застосунок автоматично підтягне попередні результати!
            </p>
            <button
              onClick={() => setIsSelectorOpen(true)}
              className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition"
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

            // KEY LOGIC: Retrieve last completed performance for this exercise from previous workouts!
            const lastPerformance = StorageService.getLastExercisePerformance(
              userId,
              weItem.exerciseId,
              workout.id
            );

            const isDragged = draggedIndex === weIndex;

            return (
              <div
                key={weItem.id}
                draggable
                onDragStart={() => handleDragStart(weIndex)}
                onDragOver={(e) => handleDragOver(e, weIndex)}
                onDragEnd={handleDragEnd}
                className={`rounded-2xl border bg-slate-900/90 shadow-xl overflow-hidden backdrop-blur-sm transition ${
                  isDragged
                    ? 'border-amber-400 bg-amber-500/10 opacity-70 scale-[0.99]'
                    : 'border-slate-800'
                }`}
              >
                {/* Exercise Header */}
                <div className="p-3 sm:p-4 bg-slate-850/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    {/* Drag Handle */}
                    <div
                      className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-amber-400 transition hidden sm:flex items-center"
                      title="Перетягніть картку вправи для зміни порядку"
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <span className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-amber-400 border border-slate-700 font-mono">
                      #{weIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h4 className="text-sm sm:text-base font-bold text-white break-words leading-snug">
                          {exercise?.name || 'Вправа'}
                        </h4>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold ${muscleInfo.badgeBg} border ${muscleInfo.badgeBorder}`}
                        >
                          {muscleInfo.nameUk}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Exercise Action Buttons */}
                  <div className="flex items-center space-x-1.5 shrink-0 flex-wrap gap-y-1">
                    <button
                      onClick={() => handleMoveExercise(weIndex, 'up')}
                      disabled={weIndex === 0}
                      className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
                      title="Вгору"
                    >
                      <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                    <button
                      onClick={() => handleMoveExercise(weIndex, 'down')}
                      disabled={weIndex === workout.exercises.length - 1}
                      className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition"
                      title="Вниз"
                    >
                      <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>

                    <button
                      onClick={() => handleRemoveExercise(weItem.id)}
                      className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
                      title="Видалити вправу"
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </div>

                {/* EXERCISE CONFIG BAR: Balanced and aligned for 320-430px mobile & desktop */}
                <div className="bg-slate-850/80 border-b border-slate-800 p-2.5 sm:px-4 sm:py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {/* Target Rep Range (4-6, 6-8, 8-12, 10-15) */}
                  <div className="flex items-center justify-between gap-2 bg-slate-900/60 rounded-xl p-2 border border-slate-800/80">
                    <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">
                      Діапазон:
                    </span>
                    <div className="flex items-center space-x-1 rounded-lg border border-slate-700/80 bg-slate-950 p-1">
                      {(['4-6', '6-8', '8-12', '10-15'] as const).map((range) => {
                        const isSelected = (weItem.targetRepsRange || weItem.sets[0]?.targetRepsRange || '8-12') === range;
                        return (
                          <button
                            key={range}
                            type="button"
                            onClick={() => handleTargetRepsRangeChange(weItem.id, range)}
                            className={`px-2 py-1 rounded-md text-[11px] sm:text-xs font-bold transition ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {range}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fast Set Count selector (2, 3, 4, 5) */}
                  <div className="flex items-center justify-between gap-2 bg-slate-900/60 rounded-xl p-2 border border-slate-800/80">
                    <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">
                      Підходи:
                    </span>
                    <div className="flex items-center space-x-1 rounded-lg border border-slate-700/80 bg-slate-950 p-1">
                      {[2, 3, 4, 5].map((cnt) => {
                        const active = (weItem.setCount || weItem.sets.length) === cnt;
                        return (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => handleSetCountChange(weItem.id, cnt)}
                            className={`h-6 w-6 sm:h-7 sm:w-7 rounded-md text-[11px] sm:text-xs font-bold transition flex items-center justify-center ${
                              active
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
                        className={`rounded-xl border p-2.5 transition ${
                          isDone
                            ? 'bg-emerald-950/20 border-emerald-500/40'
                            : 'bg-slate-850/60 border-slate-800'
                        }`}
                      >
                        {/* Mobile Set Header */}
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`inline-flex h-5 w-5 items-center justify-center rounded font-mono text-[11px] font-bold ${
                                isDone
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              #{setItem.setNumber}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {setItem.targetRepsRange} повт.
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveSet(weItem.id, setItem.id)}
                            className="p-1 text-slate-500 hover:text-rose-400"
                            title="Видалити підхід"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Mobile Inputs row (Weight + Reps + Checkmark) */}
                        <div className="grid grid-cols-12 gap-1.5 items-center">
                          {/* Weight Stepper: 5 cols */}
                          <div className="col-span-5 flex items-center bg-slate-800 rounded-lg border border-slate-700 px-1 py-1">
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
                              className="px-1 text-[11px] font-bold text-slate-400 hover:text-white active:scale-95"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="0.5"
                              value={setItem.weight === 0 ? '' : setItem.weight}
                              onChange={(e) =>
                                handleUpdateSet(
                                  weItem.id,
                                  setItem.id,
                                  'weight',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full text-center bg-transparent font-mono text-xs font-bold text-amber-400 focus:outline-none"
                            />
                            <span className="text-[10px] text-slate-500 pr-1">кг</span>
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
                              className="px-1 text-[11px] font-bold text-slate-400 hover:text-white active:scale-95"
                            >
                              +
                            </button>
                          </div>

                          {/* Reps Stepper: 4 cols */}
                          <div className="col-span-4 flex items-center bg-slate-800 rounded-lg border border-slate-700 px-1 py-1">
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
                              className="px-1 text-[11px] font-bold text-slate-400 hover:text-white active:scale-95"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={setItem.actualReps === null ? '' : setItem.actualReps}
                              onChange={(e) =>
                                handleUpdateSet(
                                  weItem.id,
                                  setItem.id,
                                  'actualReps',
                                  e.target.value === '' ? null : parseInt(e.target.value, 10)
                                )
                              }
                              className="w-full text-center bg-transparent font-mono text-xs font-bold text-white focus:outline-none"
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
                              className="px-1 text-[11px] font-bold text-slate-400 hover:text-white active:scale-95"
                            >
                              +
                            </button>
                          </div>

                          {/* Completion Checkmark: 3 cols */}
                          <div className="col-span-3">
                            <button
                              type="button"
                              onClick={() => handleToggleCompleteSet(weItem.id, setItem)}
                              className={`w-full h-8 flex items-center justify-center rounded-lg transition font-bold text-xs ${
                                isDone
                                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                                  : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
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

                {/* DESKTOP VIEW FOR SETS (Clean tabular layout for tablet & PC) */}
                <div className="hidden sm:block p-4 overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[500px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
                            className={`group transition ${
                              isDone ? 'bg-emerald-950/20' : 'hover:bg-slate-850/40'
                            }`}
                          >
                            {/* Set # */}
                            <td className="py-2.5 text-center">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-bold ${
                                  isDone
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                    : 'bg-slate-800 text-slate-400'
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
                                  className="h-8 w-8 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center font-bold text-sm"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
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
                                  className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 font-mono text-center text-xs font-bold text-amber-400 focus:border-amber-500 focus:outline-none"
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
                                  className="h-8 w-8 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center font-bold text-sm"
                                >
                                  +
                                </button>
                                <span className="text-slate-400 text-xs">кг</span>
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
                                  className="h-8 w-8 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center font-bold text-sm"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
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
                                  className={`w-16 rounded-lg border px-2 py-1.5 font-mono text-center text-xs font-bold focus:outline-none ${
                                    isDone
                                      ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
                                      : 'border-slate-700 bg-slate-800 text-white focus:border-amber-500'
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
                                  className="h-8 w-8 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center font-bold text-sm"
                                >
                                  +
                                </button>
                                <span className="text-slate-400 text-xs">повт</span>
                              </div>
                            </td>

                            {/* Completion Checkmark */}
                            <td className="py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleCompleteSet(weItem.id, setItem)}
                                className={`inline-flex items-center justify-center h-8 w-8 rounded-lg transition ${
                                  isDone
                                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400'
                                    : 'border border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:border-slate-600'
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
                            <td className="py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSet(weItem.id, setItem.id)}
                                className="text-slate-500 hover:text-rose-400 p-1 rounded transition opacity-50 group-hover:opacity-100"
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
                <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between border-t border-slate-850 bg-slate-900/40">
                  <button
                    type="button"
                    onClick={() => handleAddSet(weItem.id)}
                    className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
                  >
                    <Plus className="h-3.5 w-3.5 text-amber-400" />
                    <span>Додати підхід</span>
                  </button>

                  <div className="text-[11px] text-slate-500">
                    Підходів: <strong className="text-slate-300">{weItem.sets.length}</strong>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating / Bottom Action Bar (Fully responsive for mobile) */}
      <div className="fixed sm:sticky bottom-14 sm:bottom-4 left-0 right-0 z-30 sm:rounded-2xl border-t sm:border border-slate-700 bg-slate-950/95 sm:bg-slate-900/95 p-3 sm:p-4 shadow-2xl backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Workout quick stats */}
          <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 text-xs border-b sm:border-b-0 border-slate-850 pb-2 sm:pb-0">
            <div className="flex items-center space-x-1">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-slate-400 text-[11px]">Вправ:</span>
              <strong className="text-white font-mono text-xs">{workout.exercises.length}</strong>
            </div>

            <div className="flex items-center space-x-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-slate-400 text-[11px]">Підходи:</span>
              <strong className="text-white font-mono text-xs">
                {completedSets} / {totalSets}
              </strong>
            </div>

            <div className="flex items-center space-x-1">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-slate-400 text-[11px]">Тоннаж:</span>
              <strong className="text-amber-400 font-mono text-xs">{totalVolumeKg} кг</strong>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsSelectorOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-700 hover:border-amber-500/50 transition shadow"
            >
              <Plus className="h-3.5 w-3.5 text-amber-400" />
              <span>+ Вправа</span>
            </button>

            <button
              onClick={handleFinishWorkout}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Зберегти</span>
            </button>

            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500/25 transition shrink-0"
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
