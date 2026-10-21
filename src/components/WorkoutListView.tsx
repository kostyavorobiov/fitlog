import React, { useState } from 'react';
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
} from 'lucide-react';

import { useSwipeGesture } from '../utils/useSwipeGesture';

export function formatDateDDMMYY(dateStr?: string): string {
  if (!dateStr) return '';
  const dateOnly = dateStr.split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const shortYear = year.length === 4 ? year.slice(2) : year;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${shortYear}`;
  }
  return dateStr;
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'completed'>('in_progress');
  const [workouts, setWorkouts] = useState<WorkoutPlan[]>(() => StorageService.getWorkouts(userId));

  const filterTabs: ('all' | 'in_progress' | 'completed')[] = ['all', 'in_progress', 'completed'];

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

  React.useEffect(() => {
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

  const inProgressCount = workouts.filter(
    (w) => w.status === 'in_progress' || w.status === 'planned'
  ).length;
  const completedCount = workouts.filter((w) => w.status === 'completed').length;

  const filteredWorkouts = workouts.filter((w) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'in_progress') return w.status === 'in_progress' || w.status === 'planned';
    if (filterStatus === 'completed') return w.status === 'completed';
    return true;
  });

  return (
    <div
      ref={swipeRef}
      className="space-y-3.5 max-w-xl mx-auto animate-fade-in pb-12 touch-pan-y"
    >
      {/* Top Action Button: "+ Нове тренування" */}
      <button
        type="button"
        onClick={handleCreateNewDirectly}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[#0f172a] dark:bg-zinc-100 hover:bg-[#1e293b] dark:hover:bg-white active:scale-[0.99] text-white dark:text-zinc-950 font-bold text-sm sm:text-base shadow-sm transition-all cursor-pointer"
      >
        <Plus className="h-4 w-4 stroke-[3]" />
        <span>Нове тренування</span>
      </button>

      {/* Filter Tabs - Full-width modern segmented pill bar */}
      <div className="w-full bg-[#eef2f6] dark:bg-zinc-800/80 p-1 rounded-2xl flex items-center gap-1">
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`flex-1 py-2 px-2 text-center text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${filterStatus === 'all'
            ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold shadow-sm'
            : 'text-slate-500 dark:text-zinc-400 font-medium hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
        >
          Всі ({workouts.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('in_progress')}
          className={`flex-1 py-2 px-2 text-center text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${filterStatus === 'in_progress'
            ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold shadow-sm'
            : 'text-slate-500 dark:text-zinc-400 font-medium hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
        >
          У процесі ({inProgressCount})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('completed')}
          className={`flex-1 py-2 px-2 text-center text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${filterStatus === 'completed'
            ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold shadow-sm'
            : 'text-slate-500 dark:text-zinc-400 font-medium hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
        >
          Завершено ({completedCount})
        </button>
      </div>

      {/* Workouts List or Empty State */}
      {filteredWorkouts.length === 0 ? (
        <div className="w-full rounded-[28px] border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 py-16 px-6 flex flex-col items-center justify-center text-center shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div className="w-14 h-14 rounded-2xl bg-[#eef2f8] dark:bg-zinc-800 flex items-center justify-center">
            <Clock className="w-6 h-6 text-slate-400 dark:text-zinc-400 stroke-[1.75]" />
          </div>
          <h3 className="mt-5 font-bold text-base sm:text-lg text-[#0f172a] dark:text-zinc-100 max-w-xs leading-snug">
            {workouts.length === 0
              ? 'Тренувань ще немає'
              : `Немає тренувань зі статусом «${filterStatus === 'in_progress' ? 'У процесі' : filterStatus === 'completed' ? 'Завершено' : 'Всі'}».`}
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-[#94a3b8] dark:text-zinc-400 max-w-xs leading-relaxed">
            {workouts.length === 0
              ? 'Створіть своє перше тренування для відстеження підходів, ваги та прогресу.'
              : 'Свайпніть вліво або вправо для перемикання фільтрів.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredWorkouts.map((w) => {
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
                  className="group bg-white dark:bg-zinc-900 px-4 py-3.5 transition-colors cursor-pointer space-y-1.5"
                >
                  {/* Row 1: Status & Coach info */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs min-w-0 flex-wrap">
                      <span
                        className={`font-semibold ${isCompleted
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : w.status === 'in_progress'
                            ? 'text-amber-500 dark:text-amber-400'
                            : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                      >
                        {isCompleted ? 'Завершено' : w.status === 'in_progress' ? 'У процесі' : 'Заплановано'}
                      </span>
                      {w.assignedByCoachId && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-700">·</span>
                          <span className="text-indigo-500 dark:text-indigo-400 font-medium">Від тренера</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Title */}
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                    {w.title || 'Тренування без назви'}
                  </h3>

                  {/* Row 3: Stats - Date before exercises count, dd/mm/yy format, no kg sum */}
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1 font-mono text-zinc-600 dark:text-zinc-400">
                      <Calendar className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <span>{formatDateDDMMYY(w.scheduledDate)}</span>
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{(w.exercises || []).length}</span>
                      <span>вправ</span>
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                    <span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{totalSets}</span>
                      {' підходів'}
                    </span>
                  </div>
                </div>
              </MobileSwipeableWorkoutCard>
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
