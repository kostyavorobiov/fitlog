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
import { MobileSwipeableExerciseCard } from './MobileSwipeableExerciseCard';
import { playSuccessChime, playBeep } from '../utils/audio';
import { getExercise1RM, format1RM, getMinRepsFromRange } from '../utils/workout';
import { formatDateDDMMYYYY } from './WorkoutListView';
import { TemplateService } from '../services/templateService';
import {
  Calendar,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Circle,
  Dumbbell,
  Check,
  ChevronUp,
  ChevronDown,
  Layers,
  Flame,
  GripVertical,
  Award,
  ArrowLeft,
  ArrowLeftRight,
  Link,
  Unlink,
  X,
  Bookmark,
  Pencil,
} from 'lucide-react';

const computeWorkoutStatus = (exercises: WorkoutExercise[]): 'completed' | 'in_progress' => {
  if (!exercises || exercises.length === 0) return 'in_progress';
  let totalSets = 0;
  let completedSets = 0;
  for (const ex of exercises) {
    const sets = ex.sets || [];
    if (sets.length === 0) return 'in_progress';
    for (const s of sets) {
      totalSets++;
      if (s.completedAt) completedSets++;
    }
  }
  return totalSets > 0 && completedSets === totalSets ? 'completed' : 'in_progress';
};

const SUPERSET_PALETTES = [
  {
    hex: '#10b981',
    border: 'border-emerald-500/50',
    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    buttonActive: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25',
    nameUk: 'Смарагдовий',
  },
  {
    hex: '#f59e0b',
    border: 'border-amber-500/50',
    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    buttonActive: 'border-amber-500/60 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25',
    nameUk: 'Бурштиновий',
  },
  {
    hex: '#6366f1',
    border: 'border-indigo-500/50',
    badge: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
    buttonActive: 'border-indigo-500/60 bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25',
    nameUk: 'Індиго',
  },
  {
    hex: '#f43f5e',
    border: 'border-rose-500/50',
    badge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    buttonActive: 'border-rose-500/60 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25',
    nameUk: 'Рожевий',
  },
  {
    hex: '#06b6d4',
    border: 'border-cyan-500/50',
    badge: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    buttonActive: 'border-cyan-500/60 bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25',
    nameUk: 'Блакитний',
  },
  {
    hex: '#a855f7',
    border: 'border-purple-500/50',
    badge: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    buttonActive: 'border-purple-500/60 bg-purple-500/15 text-purple-400 hover:bg-purple-500/25',
    nameUk: 'Фіолетовий',
  },
];

const ExerciseProgressRing: React.FC<{
  completed: number;
  total: number;
  size?: number;
}> = ({ completed, total, size = 30 }) => {
  const isAllDone = total > 0 && completed >= total;
  const progress = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;
  const strokeWidth = size >= 32 ? 3 : 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className="relative flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
      title={
        isAllDone
          ? 'Всі підходи виконано!'
          : `Прогрес: ${completed}/${total} підходів`
      }
    >
      {isAllDone ? (
        <div className="w-full h-full rounded-full border-2 border-emerald-500 bg-emerald-500/15 flex items-center justify-center text-emerald-400 shadow-xs">
          <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
        </div>
      ) : (
        <>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="transform -rotate-90 pointer-events-none"
          >
            {/* Track circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill={progress > 0 ? 'rgba(96, 165, 250, 0.08)' : 'none'}
              className="stroke-[#e2e8f0] dark:stroke-[#334155]"
              strokeWidth={strokeWidth}
            />
            {/* Progress arc */}
            {progress > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#60a5fa"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 ease-out"
              />
            )}
          </svg>
          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className={`font-mono text-[9px] font-bold leading-none ${progress > 0
                ? 'text-[#2563eb] dark:text-[#60a5fa]'
                : 'text-[#64748b] dark:text-[#94a3b8]'
                }`}
            >
              {total > 0 ? `${completed}/${total}` : '0'}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

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
  const [workout, setWorkout] = useState<WorkoutPlan>(() => {
    const rawExercises = Array.isArray(initialWorkout?.exercises) ? initialWorkout.exercises : [];
    const normalizedExercises = rawExercises.map((e) => ({
      ...e,
      sets: Array.isArray(e.sets) ? e.sets : [],
    }));
    return {
      ...initialWorkout,
      exercises: normalizedExercises,
    };
  });
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
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeInputText, setActiveInputText] = useState<Record<string, string>>({});
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [exerciseToReplaceId, setExerciseToReplaceId] = useState<string | null>(null);
  const exerciseToReplaceIdRef = useRef<string | null>(null);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  const [isEditTitleModalOpen, setIsEditTitleModalOpen] = useState(false);
  const [newTitleInput, setNewTitleInput] = useState('');

  const handleSaveAsTemplate = async () => {
    const effectiveUserId = workout.userId || userId;
    if (!effectiveUserId || !templateNameInput.trim()) return;
    setIsSavingTemplate(true);
    try {
      const ok = await TemplateService.saveTemplate({
        id: `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: effectiveUserId,
        title: templateNameInput.trim(),
        notes: workout.notes || '',
        exercises: workout.exercises || [],
        createdAt: new Date().toISOString(),
      });
      if (ok) {
        setIsTemplateModalOpen(false);
        setTemplateNotice('Шаблон тренування збережено!');
        setTimeout(() => setTemplateNotice(null), 3000);
      } else {
        alert('Не вдалося зберегти шаблон');
      }
    } catch (e: any) {
      alert(e?.message || 'Помилка при збереженні шаблону');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleSaveEditedTitle = () => {
    const clean = newTitleInput.trim() || 'Тренування';
    handleTitleChange(clean);
    setIsEditTitleModalOpen(false);
  };

  const get1RMForExercise = (we: WorkoutExercise) => {
    const effectiveUserId = workout.userId || userId;
    let lastPerf = null;
    try {
      lastPerf = StorageService.getLastExercisePerformance(effectiveUserId, we.exerciseId, workout.id);
    } catch {}
    return format1RM(getExercise1RM(we.sets, lastPerf));
  };

  const handleChangeExercise = (workoutExerciseId: string) => {
    exerciseToReplaceIdRef.current = workoutExerciseId;
    setExerciseToReplaceId(workoutExerciseId);
    setIsSelectorOpen(true);
  };

  const handleToggleExpand = (exerciseId: string) => {
    setExpandedExerciseId((prev) => (prev === exerciseId ? null : exerciseId));
  };

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
    const rawExercises = Array.isArray(initialWorkout?.exercises) ? initialWorkout.exercises : [];
    const normalizedExercises = rawExercises.map((e) => ({
      ...e,
      sets: Array.isArray(e.sets) ? e.sets : [],
    }));
    const normalized: WorkoutPlan = {
      ...initialWorkout,
      exercises: normalizedExercises,
    };
    setWorkout(normalized);
    workoutRef.current = normalized;
  }, [initialWorkout?.id]);

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
      const autoStatus = computeWorkoutStatus(enrichedExercises);
      const completedAt = autoStatus === 'completed'
        ? (updated.completedAt || new Date().toISOString())
        : null;

      const enriched: WorkoutPlan = {
        ...updated,
        exercises: enrichedExercises,
        status: autoStatus,
        completedAt,
      };
      workoutRef.current = enriched;
      setWorkout(enriched);
      const savePromise = StorageService.saveWorkout(enriched);
      onSave(enriched);

      // Visual feedback: real-time autosave indicator
      setAutoSaveStatus('saving');
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      void savePromise.then((success) => {
        if (workoutRef.current !== enriched) return;
        setAutoSaveStatus(success ? 'saved' : 'error');
        if (success) autoSaveTimerRef.current = setTimeout(() => setAutoSaveStatus('idle'), 2000);
      });
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

  // All exercises are now user-owned, no origin badge needed
  function getExerciseOriginBadge(_ex: Exercise | undefined): { text: string; className: string; } | null {
    return null;
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

  // Add or Replace Exercise in Workout
  const handleSelectExercise = (exercise: Exercise) => {
    try {
      const currentWorkout = workoutRef.current || workout;
      if (!currentWorkout) return;

      const effectiveTraineeId = currentWorkout.userId || userId;

      const replaceId = exerciseToReplaceIdRef.current || exerciseToReplaceId;

      // Handle replacing existing exercise
      if (replaceId) {
        const currentExercises = Array.isArray(currentWorkout.exercises) ? currentWorkout.exercises : [];
        const exIndex = currentExercises.findIndex((e) => e.id === replaceId || (e.exerciseId && e.exerciseId === replaceId));
        if (exIndex === -1) {
          exerciseToReplaceIdRef.current = null;
          setExerciseToReplaceId(null);
          setIsSelectorOpen(false);
          return;
        }

        const existingWe = currentExercises[exIndex];

        let lastPerf: PastExercisePerformance | null = null;
        try {
          lastPerf = StorageService.getLastExercisePerformance(effectiveTraineeId, exercise.id, currentWorkout.id);
        } catch (e) {
          console.warn('Error getting last exercise performance:', e);
        }

        const targetRange = (lastPerf?.sets?.[0]?.targetRepsRange || existingWe.targetRepsRange || '8-12') as string;
        const hasCompletedSets = (existingWe.sets || []).some((s) => Boolean(s.completedAt));
        let updatedSets = existingWe.sets || [];

        if (!hasCompletedSets) {
          if (lastPerf && Array.isArray(lastPerf.sets) && lastPerf.sets.length > 0) {
            updatedSets = lastPerf.sets.map((ps, idx) => ({
              id: (existingWe.sets && existingWe.sets[idx]) ? existingWe.sets[idx].id : generateId('set'),
              workoutExerciseId: existingWe.id,
              setNumber: idx + 1,
              targetRepsRange: ps.targetRepsRange || targetRange,
              weight: ps.weight !== null && ps.weight !== undefined && !isNaN(Number(ps.weight)) ? Number(ps.weight) : 0,
              actualReps: ps.actualReps !== null && ps.actualReps !== undefined ? Number(ps.actualReps) : getMinRepsFromRange(ps.targetRepsRange || targetRange),
              completedAt: null,
            }));
          } else {
            const minReps = getMinRepsFromRange(targetRange);
            updatedSets = updatedSets.map((s) => ({
              ...s,
              targetRepsRange: targetRange,
              weight: 0,
              actualReps: minReps,
            }));
          }
        }

        // If coach is creating/adding exercise for trainee, automatically copy it into trainee's custom catalog
        const activeUserId = StorageService.getActiveUserId();
        const isTraineeWorkout = Boolean(
          currentWorkout.assignedByCoachId ||
          (currentWorkout.userId && currentWorkout.userId !== activeUserId)
        );

        if (isTraineeWorkout && effectiveTraineeId && exercise.userId !== effectiveTraineeId) {
          try {
            const traineeExercises = StorageService.getExercises(effectiveTraineeId);
            const exists = traineeExercises.some(
              (e) => e.name.toLowerCase().trim() === exercise.name.toLowerCase().trim()
            );
            if (!exists) {
              const cloned: Exercise = {
                ...exercise,
                id: generateId('custom_ex'),
                userId: effectiveTraineeId,
                isDefault: false,
                createdAt: new Date().toISOString(),
              };
              StorageService.saveExercise(cloned);
              CloudStorageService.saveExercise(cloned).catch((err) => {
                console.warn('Failed to save exercise to trainee cloud:', err);
              });
            }
          } catch (err) {
            console.warn('Failed to add exercise to trainee library:', err);
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

        const updatedWorkout: WorkoutPlan = {
          ...currentWorkout,
          exercises: updatedExercises,
        };

        exerciseToReplaceIdRef.current = null;
        setExerciseToReplaceId(null);
        setIsSelectorOpen(false);
        updateAndSave(updatedWorkout);
        return;
      }

      // Check if exercise has previous performance
      let lastPerf: PastExercisePerformance | null = null;
      try {
        lastPerf = StorageService.getLastExercisePerformance(effectiveTraineeId, exercise.id, currentWorkout.id);
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
          weight: ps.weight !== null && ps.weight !== undefined && !isNaN(Number(ps.weight)) ? Number(ps.weight) : 0,
          actualReps: ps.actualReps !== null && ps.actualReps !== undefined ? Number(ps.actualReps) : getMinRepsFromRange(ps.targetRepsRange || targetRange),
          completedAt: null,
        }));
      } else {
        const minReps = getMinRepsFromRange(targetRange);
        initialSets = [
          {
            id: generateId('set'),
            workoutExerciseId: '',
            setNumber: 1,
            targetRepsRange: targetRange,
            weight: 0,
            actualReps: minReps,
            completedAt: null,
          },
          {
            id: generateId('set'),
            workoutExerciseId: '',
            setNumber: 2,
            targetRepsRange: targetRange,
            weight: 0,
            actualReps: minReps,
            completedAt: null,
          },
          {
            id: generateId('set'),
            workoutExerciseId: '',
            setNumber: 3,
            targetRepsRange: targetRange,
            weight: 0,
            actualReps: minReps,
            completedAt: null,
          },
        ];
      }

      // If coach is creating/adding exercise for trainee, automatically copy it into trainee's custom catalog
      const activeUserId = StorageService.getActiveUserId();
      const isTraineeWorkout = Boolean(
        currentWorkout.assignedByCoachId ||
        (currentWorkout.userId && currentWorkout.userId !== activeUserId)
      );

      if (isTraineeWorkout && effectiveTraineeId && exercise.userId !== effectiveTraineeId) {
        try {
          const traineeExercises = StorageService.getExercises(effectiveTraineeId);
          const exists = traineeExercises.some(
            (e) => e.name.toLowerCase().trim() === exercise.name.toLowerCase().trim()
          );
          if (!exists) {
            const cloned: Exercise = {
              ...exercise,
              id: generateId('custom_ex'),
              userId: effectiveTraineeId,
              isDefault: false,
              createdAt: new Date().toISOString(),
            };
            StorageService.saveExercise(cloned);
            CloudStorageService.saveExercise(cloned).catch((err) => {
              console.warn('Failed to save exercise to trainee cloud:', err);
            });
          }
        } catch (err) {
          console.warn('Failed to add exercise to trainee library:', err);
        }
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

      // Auto-expand newly added exercise card and scroll to it
      setExpandedExerciseId(weId);
      scrollToExerciseCard(weId);
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

    if (expandedExerciseId === weId) {
      setExpandedExerciseId(null);
    }

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
          const minReps = getMinRepsFromRange(e.targetRepsRange || lastSet?.targetRepsRange || '8-12');
          for (let i = sets.length; i < count; i++) {
            sets.push({
              id: generateId('set'),
              workoutExerciseId: weId,
              setNumber: i + 1,
              targetRepsRange: e.targetRepsRange || lastSet?.targetRepsRange || '8-12',
              weight: lastSet?.weight ?? 0,
              actualReps: lastSet?.actualReps ?? minReps,
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
        const minReps = getMinRepsFromRange(e.targetRepsRange || lastSet?.targetRepsRange || '8-12');
        const newSet: WorkoutSet = {
          id: generateId('set'),
          workoutExerciseId: weId,
          setNumber: e.sets.length + 1,
          targetRepsRange: e.targetRepsRange || lastSet?.targetRepsRange || '8-12',
          weight: lastSet?.weight ?? 0,
          actualReps: lastSet?.actualReps ?? minReps,
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
    const targetExercise = currentWorkout.exercises.find((e) => e.id === weId);
    const currentSet = targetExercise?.sets.find((s) => s.id === setId);

    let shouldResetReps = false;
    let newReps: number | null = null;

    if (field === 'weight' && currentSet) {
      const currentWeight = currentSet.weight ?? 0;
      const targetWeight = value ?? 0;
      if (currentWeight !== targetWeight) {
        shouldResetReps = true;
        const range = currentSet.targetRepsRange || targetExercise?.targetRepsRange || '8-12';
        newReps = getMinRepsFromRange(range);
      }
    }

    if (shouldResetReps) {
      setActiveInputText((prev) => {
        if (`${setId}_actualReps` in prev) {
          const next = { ...prev };
          delete next[`${setId}_actualReps`];
          return next;
        }
        return prev;
      });
    }

    const updatedExercises = currentWorkout.exercises.map((e) => {
      if (e.id === weId) {
        const updatedSets = e.sets.map((s) => {
          if (s.id === setId) {
            if (shouldResetReps) {
              return { ...s, weight: value ?? 0, actualReps: newReps };
            }
            if (field === 'weight') {
              return { ...s, weight: value ?? 0 };
            }
            return { ...s, actualReps: value };
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
      exercises: updatedExercises,
    };

    updateAndSave(updatedWorkout);

    if (isNowCompleted) {
      playSuccessChime();

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
      {autoSaveStatus === 'error' && (
        <div role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          Не вдалося зберегти зміни. Перевірте з’єднання.
          <button type="button" className="ml-2 underline cursor-pointer" onClick={() => updateAndSave(workoutRef.current)}>Повторити</button>
        </div>
      )}
      {/* Top Bar matching Mobile React Native */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
        {/* Back Button */}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-1 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            title="Назад"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Center: Title (tap to edit) & Date (tap to pick without calendar icon) */}
        <div className="flex-1 min-w-0 flex flex-col items-center text-center">
          <button
            type="button"
            onClick={() => {
              setNewTitleInput(workout.title || 'Тренування');
              setIsEditTitleModalOpen(true);
            }}
            className="group inline-flex items-center gap-1.5 max-w-full cursor-pointer hover:opacity-80 transition-opacity"
            title="Редагувати назву"
          >
            <span className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 truncate">
              {workout.title || 'Тренування'}
            </span>
            <Pencil className="h-3.5 w-3.5 text-zinc-400 group-hover:text-blue-600 transition-colors shrink-0" />
          </button>

          <label className="relative inline-flex items-center cursor-pointer text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mt-0.5">
            <span>{workout.scheduledDate ? formatDateDDMMYYYY(workout.scheduledDate) : 'Виберіть дату'}</span>
            <input
              type="date"
              value={workout.scheduledDate ? workout.scheduledDate.split('T')[0] : ''}
              onChange={(e) => handleDateChange(e.target.value)}
              onClick={(e) => {
                try {
                  (e.target as any).showPicker?.();
                } catch {}
              }}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              tabIndex={-1}
            />
          </label>
        </div>

        {/* Right: Save as Template button */}
        <button
          type="button"
          onClick={() => {
            setTemplateNameInput(workout.title || 'Моє тренування');
            setIsTemplateModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer shrink-0"
          title="Зберегти як шаблон"
        >
          <Bookmark className="h-3.5 w-3.5" />
          <span>Шаблон</span>
        </button>
      </div>

      {templateNotice && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{templateNotice}</span>
          <button type="button" onClick={() => setTemplateNotice(null)} className="cursor-pointer ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Exercises List */}
      <div className="space-y-4">
        {currentExList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#1d2939]/40 p-8 sm:p-12 text-center">
            <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-[#f1f5f9] dark:bg-[#263140] border border-[#e2e8f0] dark:border-[#334155] text-[#2563eb] dark:text-[#60a5fa] mb-3">
              <Dumbbell className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#0f172a] dark:text-[#f8fafc] mb-1">Тренування порожнє</h3>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] max-w-sm mx-auto mb-4">
              Додайте вправи до сьогоднішньої програми. Застосунок автоматично підтягне попередні робочі ваги та повторення!
            </p>
            <button
              type="button"
              onClick={() => setIsSelectorOpen(true)}
              className="inline-flex items-center space-x-2 rounded-xl bg-[#2563eb] text-white hover:bg-[#1d4ed8] px-5 py-2.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer active:scale-[0.98]"
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
            const isExpanded = expandedExerciseId === weItem.id;

            return (
              <div
                key={weItem.id}
                id={`exercise-card-${weItem.id}`}
                draggable
                onDragStart={() => handleDragStart(weIndex)}
                onDragOver={(e) => handleDragOver(e, weIndex)}
                onDragEnd={handleDragEnd}
                className={`rounded-2xl border bg-white dark:bg-[#1D2939] shadow-xs overflow-hidden transition-colors ${isDragged
                  ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 opacity-70'
                  : 'border-zinc-200 dark:border-[#334155]'
                  }`}
              >
                {/* Superset stripe across full width of card */}
                {isSuperset && (
                  <div
                    className="h-1 w-full"
                    style={{
                      backgroundColor: supersetPalette ? supersetPalette.hex : '#10b981',
                    }}
                  />
                )}

                {/* ================= MOBILE VIEW (sm:hidden) ================= */}
                <div className="block sm:hidden">
                  <MobileSwipeableExerciseCard
                    exerciseId={weItem.id}
                    onDelete={() => handleRemoveExercise(weItem.id)}
                    onChangeExercise={() => handleChangeExercise(weItem.id)}
                  >

                    {/* Mobile Exercise Header */}
                    <div
                      className={`flex items-center justify-between gap-2.5 px-3.5 py-3 ${isExpanded ? 'border-b border-zinc-100 dark:border-[#334155]' : ''
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 select-none">
                        {/* Vertical Reorder Stepper (Up/Down) */}
                        <div
                          className="flex flex-col items-center justify-center shrink-0 -space-y-0.5 py-0.5 select-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleMoveExercise(weIndex, 'up')}
                            disabled={weIndex === 0}
                            className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Перемістити вгору"
                          >
                            <ChevronUp className="h-4 w-4 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveExercise(weIndex, 'down')}
                            disabled={weIndex === currentExList.length - 1}
                            className="p-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Перемістити вниз"
                          >
                            <ChevronDown className="h-4 w-4 stroke-[2.5]" />
                          </button>
                        </div>

                        {/* Exercise name + badges (Clickable to toggle expand) */}
                        <div
                          onClick={() => handleToggleExpand(weItem.id)}
                          className="min-w-0 flex-1 flex flex-col justify-center cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 leading-snug break-words">
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
                          </div>

                          {isSuperset && (
                            <div className="mt-1">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${supersetPalette ? supersetPalette.badge : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'}`}
                              >
                                <Link className="h-2.5 w-2.5" />
                                <span>Суперсет</span>
                              </span>
                            </div>
                          )}

                          {!isExpanded && (
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              <span>{weItem.sets?.length || 0} підходи</span>
                              <span>•</span>
                              <span>{weItem.targetRepsRange || weItem.sets?.[0]?.targetRepsRange || '8-12'} повт.</span>
                              <span>•</span>
                              <span>1RM: {get1RMForExercise(weItem)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {currentExList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleToggleSuperset(weIndex)}
                            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${isSuperset && supersetPalette
                              ? supersetPalette.buttonActive
                              : 'border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                              }`}
                            title={isSuperset ? "Роз'єднати суперсет" : 'Обʼєднати в суперсет'}
                          >
                            <Link className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <ExerciseProgressRing
                          completed={(weItem.sets || []).filter((s) => Boolean(s.completedAt)).length}
                          total={(weItem.sets || []).length}
                          size={32}
                        />
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        {/* Mobile Config Row: Reps Dropdown */}
                        <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                              Діапазон повторень:
                            </span>
                            <select
                              value={weItem.targetRepsRange || weItem.sets?.[0]?.targetRepsRange || '8-12'}
                              onChange={(e) => handleTargetRepsRangeChange(weItem.id, e.target.value)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 cursor-pointer"
                            >
                              {(['4-6', '6-8', '6-10', '8-10', '8-12', '10-15'] as const).map((range) => (
                                <option key={range} value={range}>
                                  {range}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                            1RM: <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{get1RMForExercise(weItem)}</span>
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
                            {(weItem.sets || []).map((setItem) => {
                              const isDone = Boolean(setItem.completedAt);
                              return (
                                <div
                                  key={setItem.id}
                                  className={`grid items-center gap-1 px-3 py-2 transition-colors ${isDone ? 'bg-[#22c55e]/10 dark:bg-[#22c55e]/15' : ''}`}
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
                                        handleUpdateSet(weItem.id, setItem.id, 'weight', Math.max(0, (setItem.weight || 0) - 1));
                                      }}
                                      className="h-8 w-8 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                                      title="−1 кг"
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
                                      className="w-10 h-8 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveInputText((prev) => {
                                          const copy = { ...prev };
                                          delete copy[`${setItem.id}_weight`];
                                          return copy;
                                        });
                                        handleUpdateSet(weItem.id, setItem.id, 'weight', (setItem.weight || 0) + 1);
                                      }}
                                      className="h-8 w-8 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                                      title="+1 кг"
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
                                      className="h-8 w-8 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
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
                                      className="w-10 h-8 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
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
                                      className="h-8 w-8 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
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
                                        ? 'bg-[#22c55e] text-white hover:bg-[#16a34a]'
                                        : 'border-2 border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1d2939] text-[#cbd5e1] dark:text-[#64748b]'
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
                                      className="text-zinc-300 dark:text-zinc-600 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded-xl transition-colors cursor-pointer"
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
                            className="flex w-full items-center justify-center gap-1.5 py-3 border-t border-dashed border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer rounded-b-2xl"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Додати підхід</span>
                          </button>
                        </div>
                      </>
                    )}
                  </MobileSwipeableExerciseCard>
                </div>

                {/* ================= DESKTOP VIEW (hidden sm:block) ================= */}

                {/* Desktop Exercise Header */}
                <div
                  className={`hidden sm:flex items-center justify-between gap-3 px-5 py-4 ${isExpanded ? 'border-b border-zinc-100 dark:border-zinc-800' : ''
                    }`}
                >
                  <div
                    onClick={() => handleToggleExpand(weItem.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
                  >
                    {/* Drag handle */}
                    <div
                      className="cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors shrink-0"
                      title="Перетягніть для зміни порядку"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>

                    {/* #N badge */}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-300 font-mono border border-zinc-200 dark:border-zinc-700">
                      #{weIndex + 1}
                    </span>

                    {/* Exercise name */}
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-2 flex-wrap">
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
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold ${supersetPalette ? supersetPalette.badge : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30'}`}
                          >
                            <Link className="h-3 w-3" />
                            <span>Суперсет</span>
                          </span>
                        )}
                      </div>
                      {!isExpanded && (
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>{weItem.sets?.length || 0} підходи</span>
                          <span>•</span>
                          <span>{weItem.targetRepsRange || weItem.sets?.[0]?.targetRepsRange || '8-12'} повт.</span>
                          <span>•</span>
                          <span>1RM: {get1RMForExercise(weItem)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {currentExList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleToggleSuperset(weIndex)}
                        className={`p-2 rounded-xl border transition-colors cursor-pointer ${isSuperset && supersetPalette
                          ? supersetPalette.buttonActive
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                          }`}
                        title={isSuperset ? "Роз'єднати суперсет" : weIndex === currentExList.length - 1 ? 'Обʼєднати з попередньою вправою в суперсет' : 'Обʼєднати в суперсет'}
                      >
                        {isSuperset ? <Unlink className="h-4 w-4" /> : <Link className="h-4 w-4" />}
                      </button>
                    )}
                    <ExerciseProgressRing
                      completed={(weItem.sets || []).filter((s) => Boolean(s.completedAt)).length}
                      total={(weItem.sets || []).length}
                      size={32}
                    />
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(weIndex, 'up')}
                      disabled={weIndex === 0}
                      className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Вгору"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveExercise(weIndex, 'down')}
                      disabled={weIndex === currentExList.length - 1}
                      className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Вниз"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeExercise(weItem.id)}
                      className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 hover:border-amber-300 dark:hover:border-amber-800 transition-colors cursor-pointer"
                      title="Змінити вправу"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveExercise(weItem.id)}
                      className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-rose-400 hover:text-rose-600 dark:text-rose-500 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer"
                      title="Видалити вправу"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <>
                    {/* Desktop Config Row: Reps Dropdown */}
                    <div className="hidden sm:flex px-5 py-3 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800 items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                          Діапазон повторень:
                        </span>
                        <select
                          value={weItem.targetRepsRange || weItem.sets?.[0]?.targetRepsRange || '8-12'}
                          onChange={(e) => handleTargetRepsRangeChange(weItem.id, e.target.value)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 cursor-pointer"
                        >
                          {(['4-6', '6-8', '6-10', '8-10', '8-12', '10-15'] as const).map((range) => (
                            <option key={range} value={range}>
                              {range}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        1RM: <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{get1RMForExercise(weItem)}</span>
                      </div>
                    </div>

                    {/* Desktop Sets Table */}
                    <div className="hidden sm:block">
                      {/* Table header */}
                      <div className="grid gap-2 px-5 py-2.5 bg-zinc-50/60 dark:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800"
                        style={{ gridTemplateColumns: '3rem 1fr 1fr 5rem 2.5rem' }}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 text-center">Підхід</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 text-center">Вага</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 text-center">Повторення</span>
                          <span />
                      </div>

                      {/* Table rows */}
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {(weItem.sets || []).map((setItem) => {
                          const isDone = Boolean(setItem.completedAt);
                          return (
                            <div
                              key={setItem.id}
                              className={`grid items-center gap-2 px-5 py-2.5 transition-colors ${isDone ? 'bg-[#22c55e]/10 dark:bg-[#22c55e]/15' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'}`}
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
                                    handleUpdateSet(weItem.id, setItem.id, 'weight', Math.max(0, (setItem.weight || 0) - 1));
                                  }}
                                  className="h-9 w-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0 text-sm font-bold"
                                  title="−1 кг"
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
                                  className="w-14 h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveInputText((prev) => {
                                      const copy = { ...prev };
                                      delete copy[`${setItem.id}_weight`];
                                      return copy;
                                    });
                                    handleUpdateSet(weItem.id, setItem.id, 'weight', (setItem.weight || 0) + 1);
                                  }}
                                  className="h-9 w-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                                  title="+1 кг"
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
                                  className="h-9 w-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
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
                                  className="w-14 h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-center font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
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
                                  className="h-9 w-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
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
                                    ? 'bg-[#22c55e] text-white hover:bg-[#16a34a]'
                                    : 'border-2 border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1d2939] text-[#cbd5e1] dark:text-[#64748b] hover:border-[#22c55e] hover:text-[#22c55e]'
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
                                  className="text-zinc-300 dark:text-zinc-600 hover:text-rose-500 dark:hover:text-rose-400 p-1.5 rounded-xl transition-colors cursor-pointer"
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
                        className="hidden sm:flex w-full items-center justify-center gap-2 py-3.5 border-t border-dashed border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer rounded-b-2xl"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Додати підхід</span>
                      </button>
                    </div>
                  </>
                )}
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
          className="w-full flex items-center justify-center space-x-2 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-3 px-4 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-600 active:scale-[0.99] transition-all cursor-pointer shadow-2xs"
          title="Додати вправу до тренування"
        >
          <Plus className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <span>Додати вправу</span>
        </button>

        {/* Видалити тренування */}
        <button
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          className="w-full flex items-center justify-center space-x-1.5 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 py-2.5 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-[0.99] transition-all cursor-pointer"
          title="Видалити це тренування"
        >
          <Trash2 className="h-4 w-4" />
          <span>Видалити тренування</span>
        </button>
      </div>

      {/* Desktop Sticky Action Bar (hidden on mobile) */}
      <div className="hidden sm:block sticky bottom-4 left-0 right-0 z-30 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-4 shadow-lg backdrop-blur-xs transition-colors">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2.5">
          {/* Workout quick stats */}
          <div className="flex items-center justify-start gap-4 text-xs">
            <div className="flex items-center space-x-1">
              <Layers className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">Вправ:</span>
              <strong className="text-zinc-800 dark:text-zinc-100 font-mono text-xs">{currentExList.length}</strong>
            </div>

            <div className="flex items-center space-x-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e]" />
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
              className="flex items-center justify-center space-x-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Додати вправу до тренування"
            >
              <Plus className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              <span>Вправа</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors shrink-0 cursor-pointer"
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
        traineeId={workout.userId && workout.userId !== (StorageService.getActiveUserId() || userId) ? workout.userId : undefined}
        onClose={() => {
          setIsSelectorOpen(false);
          setExerciseToReplaceId(null);
          exerciseToReplaceIdRef.current = null;
        }}
        onSelect={handleSelectExercise}
        onOpenCreateModal={(initialName) => {
          setCreateExerciseInitialName(initialName || '');
          setIsSelectorOpen(false);
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
          setExerciseToReplaceId(null);
          exerciseToReplaceIdRef.current = null;
        }}
        onCreated={(newEx) => {
          handleSelectExercise(newEx);
          setCreateExerciseInitialName('');
        }}
      />

      <ExerciseHistoryModal
        exercise={historyModalExercise}
        userId={workout.userId || userId}
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

      {/* Edit Title Modal */}
      {isEditTitleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Назва тренування
            </h3>
            <input
              type="text"
              autoFocus
              value={newTitleInput}
              onChange={(e) => setNewTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEditedTitle();
                if (e.key === 'Escape') setIsEditTitleModalOpen(false);
              }}
              placeholder="Введіть назву..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditTitleModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleSaveEditedTitle}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-xl space-y-4">
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Зберегти як шаблон
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Введіть назву для нового шаблону тренування
              </p>
            </div>
            <input
              type="text"
              autoFocus
              value={templateNameInput}
              onChange={(e) => setTemplateNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveAsTemplate();
                if (e.key === 'Escape' && !isSavingTemplate) setIsTemplateModalOpen(false);
              }}
              placeholder="Назва шаблону..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isSavingTemplate}
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={isSavingTemplate || !templateNameInput.trim()}
                onClick={handleSaveAsTemplate}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
              >
                {isSavingTemplate ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
