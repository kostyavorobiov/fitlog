import React, { useState, useMemo, useRef, useEffect } from 'react';
import { WorkoutPlan } from '../types/workout';
import { StorageService } from '../services/storageService';
import { CloudStorageService } from '../services/cloudStorageService';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { MobileSwipeableWorkoutCard } from './MobileSwipeableWorkoutCard';
import {
  Plus,
  Calendar,
  Layers,
  Clock,
  ChevronDown,
} from 'lucide-react';

import { useSwipeGesture } from '../utils/useSwipeGesture';

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed'>('all');
  const [workouts, setWorkouts] = useState<WorkoutPlan[]>(() => StorageService.getWorkouts(userId));

  const filterTabs: ('all' | 'completed')[] = ['all', 'completed'];

  const handleSwipeLeft = () => {
    const idx = filterTabs.indexOf(filterStatus);
    if (idx < filterTabs.length - 1) {
      setFilterStatus(filterTabs[idx + 1]);
    }
  };

  const handleSwipeRight = () => {
    const idx = filterTabs.indexOf(filterStatus);
    if (idx > 0) {
      setFilterStatus(filterTabs[idx - 1]);
    }
  };

  const swipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 30,
    disabled: Boolean(workoutToDelete),
  });

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

  const completedCount = useMemo(() => {
    return workouts.filter((w) => w.status === 'completed').length;
  }, [workouts]);

  // Filter workouts by selected tab ('all' or 'completed')
  const filteredWorkouts = useMemo(() => {
    return workouts.filter((w) => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'completed') return w.status === 'completed';
      return true;
    });
  }, [workouts, filterStatus]);

  // Sort workouts within each group from newest to oldest
  const sortedFilteredWorkouts = useMemo(() => {
    return [...filteredWorkouts].sort((a, b) => {
      const dateA = a.scheduledDate || a.createdAt || '';
      const dateB = b.scheduledDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
  }, [filteredWorkouts]);

  // Group workouts by calendar month (YYYY-MM), sorted newest to oldest
  const monthGroups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, { label: string; workouts: WorkoutPlan[] }>();
    for (const w of sortedFilteredWorkouts) {
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
  }, [sortedFilteredWorkouts]);

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
  const prevFilterRef = useRef(filterStatus);

  useEffect(() => {
    if (prevFilterRef.current !== filterStatus) {
      prevFilterRef.current = filterStatus;
      if (defaultOpenKey) {
        setOpenMonths({ [defaultOpenKey]: true });
      }
      return;
    }
    if (defaultOpenKey && Object.keys(openMonths).length === 0) {
      setOpenMonths({ [defaultOpenKey]: true });
    }
  }, [filterStatus, defaultOpenKey, openMonths]);

  const toggleMonth = (key: string) => {
    setOpenMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div
      ref={swipeRef}
      className="space-y-3.5 max-w-xl mx-auto animate-fade-in pb-12 touch-pan-y"
    >
      {/* Top Action Button: "+ Нове тренування" (hidden on mobile, handled by mobile bottom navbar central button) */}
      <button
        type="button"
        onClick={handleCreateNewDirectly}
        className="hidden md:flex w-full items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-sm transition-all cursor-pointer"
      >
        <Plus className="h-4 w-4 stroke-[3]" />
        <span>Нове тренування</span>
      </button>

      {/* Filter Tabs - Full-width modern segmented pill bar with 2 tabs: Всі and Завершені */}
      <div className="w-full bg-[#f1f5f9] dark:bg-[#1d2939] p-1 rounded-2xl flex items-center gap-1 border border-[#e2e8f0] dark:border-[#334155]">
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`flex-1 py-2 px-2 text-center text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${filterStatus === 'all'
            ? 'bg-[#2563eb] text-white font-bold shadow-sm'
            : 'text-[#64748b] dark:text-[#94a3b8] font-medium hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
            }`}
        >
          Всі ({workouts.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('completed')}
          className={`flex-1 py-2 px-2 text-center text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${filterStatus === 'completed'
            ? 'bg-[#2563eb] text-white font-bold shadow-sm'
            : 'text-[#64748b] dark:text-[#94a3b8] font-medium hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
            }`}
        >
          Завершені ({completedCount})
        </button>
      </div>

      {/* Workouts List or Empty State */}
      {filteredWorkouts.length === 0 ? (
        <div className="w-full rounded-[28px] border border-dashed border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1d2939]/50 py-16 px-6 flex flex-col items-center justify-center text-center shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div className="w-14 h-14 rounded-2xl bg-[#f1f5f9] dark:bg-[#263140] flex items-center justify-center">
            <Clock className="w-6 h-6 text-[#2563eb] dark:text-[#60a5fa] stroke-[1.75]" />
          </div>
          <h3 className="mt-5 font-bold text-base sm:text-lg text-[#0f172a] dark:text-[#f8fafc] max-w-xs leading-snug">
            {workouts.length === 0
              ? 'Тренувань ще немає'
              : 'Немає тренувань зі статусом «Завершені».'}
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] max-w-xs leading-relaxed">
            {workouts.length === 0
              ? 'Створіть своє перше тренування для відстеження підходів, ваги та прогресу.'
              : 'Свайпніть вліво або вправо для перемикання фільтрів.'}
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
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-[#f1f5f9] dark:bg-[#1d2939] hover:bg-[#e2e8f0] dark:hover:bg-[#263140] border border-[#e2e8f0] dark:border-[#334155] transition-colors cursor-pointer select-none"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-[#0f172a] dark:text-[#f8fafc]">
                      {group.label}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-[#263140] text-[#64748b] dark:text-[#94a3b8] shadow-xs">
                      {group.workouts.length}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[#64748b] dark:text-[#94a3b8] transition-transform duration-200 shrink-0 ${
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
                          onDelete={() => setWorkoutToDelete(w)}
                        >
                          <div
                            onClick={() => onSelectWorkout(w)}
                            className="group bg-white dark:bg-[#1d2939] px-4 py-3.5 transition-colors cursor-pointer space-y-1.5"
                          >
                            {/* Row 1: Status & Coach info */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs min-w-0 flex-wrap">
                                <span
                                  className={`font-semibold ${
                                    isCompleted
                                      ? 'text-[#22c55e]'
                                      : w.status === 'in_progress'
                                      ? 'text-[#60a5fa]'
                                      : 'text-[#64748b] dark:text-[#94a3b8]'
                                  }`}
                                >
                                  {isCompleted
                                    ? 'Завершено'
                                    : w.status === 'in_progress'
                                    ? 'У процесі'
                                    : 'Заплановано'}
                                </span>
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
                            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                              {w.title || 'Тренування без назви'}
                            </h3>

                            {/* Row 3: Stats */}
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                              <span className="flex items-center gap-1 font-mono text-zinc-600 dark:text-zinc-400">
                                <Calendar className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                                <span>{formatDateDDMMYY(w.scheduledDate)}</span>
                              </span>
                              <span className="text-zinc-300 dark:text-zinc-700">·</span>
                              <span className="flex items-center gap-1">
                                <Layers className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                  {(w.exercises || []).length}
                                </span>
                                <span>вправ</span>
                              </span>
                              <span className="text-zinc-300 dark:text-zinc-700">·</span>
                              <span>
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                  {totalSets}
                                </span>
                                {' підходів'}
                              </span>
                            </div>
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

      {/* Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(workoutToDelete)}
        title="Видалити тренування?"
        message="Ви впевнені, що хочете видалити це тренування? Всі збережені дані цього тренування будуть видалені."
        workoutTitle={workoutToDelete?.title}
        workoutDate={workoutToDelete?.scheduledDate}
        confirmLabel="Так, видалити"
        onConfirm={handleConfirmDelete}
        onClose={() => setWorkoutToDelete(null)}
      />
    </div>
  );
};
