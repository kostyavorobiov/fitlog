import React, { useState, useMemo, useRef, useEffect } from 'react';
import { WorkoutPlan, WorkoutExercise, WorkoutSet } from '../types/workout';
import { StorageService } from '../services/storageService';
import { CloudStorageService } from '../services/cloudStorageService';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { MobileSwipeableWorkoutCard } from './MobileSwipeableWorkoutCard';
import {
  Plus,
  Layers,
  Clock,
  ChevronDown,
} from 'lucide-react';

export function formatDateDDMMYYYY(dateStr?: string): string {
  if (!dateStr) return '';
  const dateOnly = dateStr.split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  return dateStr;
}

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

interface WorkoutListViewProps {
  userId: string;
  onSelectWorkout: (workout: WorkoutPlan) => void;
  onCreateWorkout: (title: string, scheduledDate: string) => void;
  onDeleteWorkout: (workoutId: string) => void;
}

export const WorkoutListView: React.FC<WorkoutListViewProps> = ({
  userId,
  onSelectWorkout,
  onCreateWorkout,
  onDeleteWorkout,
}) => {
  const [workoutToDelete, setWorkoutToDelete] = useState<WorkoutPlan | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutPlan[]>(() => StorageService.getWorkouts(userId));

  useEffect(() => {
    setWorkouts(StorageService.getWorkouts(userId));
    let isSubscribed = true;
    CloudStorageService.fetchWorkouts(userId).then((cloudWorkouts) => {
      if (!isSubscribed || cloudWorkouts === null) return;
      StorageService.setWorkoutsForUser(userId, cloudWorkouts);
      setWorkouts(StorageService.getWorkouts(userId));
    });

    return () => {
      isSubscribed = false;
    };
  }, [userId]);

  const handleConfirmDelete = () => {
    if (!workoutToDelete) return;
    StorageService.deleteWorkout(workoutToDelete.id);
    onDeleteWorkout(workoutToDelete.id);
    setWorkouts((prev) => prev.filter((w) => w.id !== workoutToDelete.id));
    setWorkoutToDelete(null);
  };

  const handleCreateNewDirectly = () => {
    const today = new Date().toISOString().split('T')[0];
    onCreateWorkout('', today);
  };

  const handleCopyWorkout = (source: WorkoutPlan) => {
    const today = new Date().toISOString().split('T')[0];
    const newWorkoutId = `wo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const clonedExercises: WorkoutExercise[] = (source.exercises || []).map((ex, exIdx) => {
      const weId = `we_${Date.now()}_${exIdx}_${Math.random().toString(36).substring(2, 6)}`;
      const clonedSets: WorkoutSet[] = (ex.sets || []).map((s, sIdx) => ({
        ...s,
        id: `set_${Date.now()}_${exIdx}_${sIdx}_${Math.random().toString(36).substring(2, 5)}`,
        workoutExerciseId: weId,
        completedAt: null,
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
      userId,
      title: `${source.title || 'Тренування'} (Копія)`,
      scheduledDate: today,
      status: 'planned',
      createdAt: new Date().toISOString(),
      completedAt: null,
      exercises: clonedExercises,
    };

    StorageService.saveWorkout(copied);
    CloudStorageService.saveWorkout(copied).catch(() => {});
    setWorkouts((prev) => [copied, ...prev]);
  };

  // Sort workouts within each group:
  // "В Процесі" (in_progress) sorted ascending by date (oldest first),
  // completed / other sorted descending by date (newest first, as is).
  // "В Процесі" are placed before completed.
  const sortedWorkouts = useMemo(() => {
    return [...workouts].sort((a, b) => {
      const isProgA = a.status === 'in_progress';
      const isProgB = b.status === 'in_progress';

      if (isProgA && !isProgB) return -1;
      if (!isProgA && isProgB) return 1;

      const dateA = a.scheduledDate || a.createdAt || '';
      const dateB = b.scheduledDate || b.createdAt || '';

      if (isProgA && isProgB) {
        return dateA.localeCompare(dateB);
      }

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
    setOpenMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const activeWorkout = useMemo(() => {
    return sortedWorkouts.find((w) => w.status === 'in_progress');
  }, [sortedWorkouts]);

  return (
    <div className="space-y-3.5 max-w-xl mx-auto animate-fade-in pb-12 touch-pan-y">
      {/* Top Action Button: "+ Нове тренування" (hidden on mobile, handled by mobile bottom navbar central button) */}
      <button
        type="button"
        onClick={handleCreateNewDirectly}
        className="hidden md:flex w-full items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-sm transition-all cursor-pointer"
      >
        <Plus className="h-4 w-4 stroke-[3]" />
        <span>Нове тренування</span>
      </button>

      {/* Hero Active Workout Banner if in_progress exists */}
      {activeWorkout && (() => {
        const exList = activeWorkout.exercises || [];
        const allSets = exList.flatMap((e) => e.sets || []);
        const doneSets = allSets.filter((s) => Boolean(s.completedAt)).length;
        const totalSets = allSets.length;
        const supersets = new Set(exList.map((e) => e.supersetGroupId).filter(Boolean)).size;

        let dateTag = 'СЬОГОДНІ';
        if (activeWorkout.scheduledDate) {
          const parts = activeWorkout.scheduledDate.split('T')[0].split('-');
          if (parts.length === 3) dateTag = `${parts[2]}/${parts[1]}`;
        }

        return (
          <div className="w-full rounded-[24px] bg-[#CCFF00] text-black p-5 sm:p-6 shadow-sm space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-black/80">
              У ПРОЦЕСІ · {dateTag}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black line-clamp-2">
              {activeWorkout.title || 'Тренування'}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-black/90">
              {exList.length} вправ · {doneSets} з {totalSets} підходів
              {supersets > 0 ? ` · ${supersets} суперсети` : ''}
            </p>
            <button
              type="button"
              onClick={() => onSelectWorkout(activeWorkout)}
              className="w-full py-3.5 px-4 rounded-xl bg-black text-[#CCFF00] font-bold text-sm sm:text-base hover:bg-black/90 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center"
            >
              Продовжити
            </button>
          </div>
        );
      })()}

      {/* Workouts List or Empty State */}
      {workouts.length === 0 ? (
        <div className="w-full rounded-[28px] border border-dashed border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1d2939]/50 py-16 px-6 flex flex-col items-center justify-center text-center shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div className="w-14 h-14 rounded-2xl bg-[#f1f5f9] dark:bg-[#263140] flex items-center justify-center">
            <Clock className="w-6 h-6 text-[#2563eb] dark:text-[#60a5fa] stroke-[1.75]" />
          </div>
          <h3 className="mt-5 font-bold text-base sm:text-lg text-[#0f172a] dark:text-[#f8fafc] max-w-xs leading-snug">
            Тренувань ще немає
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] max-w-xs leading-relaxed">
            Створіть своє перше тренування для відстеження підходів, ваги та прогресу.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {monthGroups.map((group) => {
            const isOpen = Boolean(openMonths[group.key]);

            return (
              <div key={group.key} className="space-y-2">
                {/* Accordion Month Header */}
                <button
                  type="button"
                  onClick={() => toggleMonth(group.key)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-[20px] bg-[#f1f5f9] dark:bg-[#212129] hover:bg-[#e2e8f0] dark:hover:bg-[#2a2b36] border border-[#e2e8f0] dark:border-[#2a2b36] transition-colors cursor-pointer select-none"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sm sm:text-base text-[#0f172a] dark:text-[#f8fafc]">
                      {group.label}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white dark:bg-[#16171c] text-[#64748b] dark:text-[#8e95a5] shadow-xs">
                      {group.workouts.length}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[#64748b] dark:text-[#8e95a5] transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Collapsible Month Workouts */}
                {isOpen && (
                  <div className="space-y-2.5 pt-0.5 animate-fade-in">
                    {group.workouts.map((w) => {
                      const isCompleted = w.status === 'completed';
                      const totalSets = (w.exercises || []).reduce(
                        (acc, ex) => acc + (ex.sets ? ex.sets.length : 0),
                        0
                      );

                      return (
                        <MobileSwipeableWorkoutCard
                          key={w.id}
                          workoutId={w.id}
                          onCopy={() => handleCopyWorkout(w)}
                          onDelete={() => setWorkoutToDelete(w)}
                        >
                          <div
                            onClick={() => onSelectWorkout(w)}
                            className="group bg-white dark:bg-[#16171c] px-4 py-3.5 transition-colors cursor-pointer space-y-1"
                          >
                            {/* Row 1: Status & Coach info */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs min-w-0 flex-wrap">
                                {w.status === 'in_progress' ? (
                                  <span className="font-bold text-[#0f172a] dark:text-[#ffffff] flex items-center gap-1">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" /> У процесі
                                  </span>
                                ) : isCompleted ? (
                                  <span className="font-medium text-[#64748b] dark:text-[#8e95a5]">
                                    Завершено
                                  </span>
                                ) : (
                                  <span className="font-medium text-[#94a3b8] dark:text-[#5c6375]">
                                    Заплановано
                                  </span>
                                )}
                                {w.assignedByCoachId && (
                                  <>
                                    <span className="text-[#cbd5e1] dark:text-[#334155]">·</span>
                                    <span className="text-[#2563eb] dark:text-[#60a5fa] font-medium">
                                      Від тренера
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Row 2: Title */}
                            <h3 className="font-bold text-base sm:text-lg text-[#0f172a] dark:text-[#ffffff] truncate">
                              {w.title || 'Тренування без назви'}
                            </h3>

                            {/* Row 3: Subtitle Details */}
                            <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#8e95a5] truncate">
                              {formatDateDDMMYY(w.scheduledDate)} · {w.exercises?.length || 0} вправ · {totalSets} підходів
                            </p>
                          </div>
                        </MobileSwipeableWorkoutCard>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {workoutToDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(workoutToDelete)}
          title="Видалити тренування?"
          message={`Ви впевнені, що хочете видалити тренування «${workoutToDelete.title || 'Без назви'}»? Цю дію неможливо скасувати.`}
          onConfirm={handleConfirmDelete}
          onClose={() => setWorkoutToDelete(null)}
        />
      )}
    </div>
  );
};
