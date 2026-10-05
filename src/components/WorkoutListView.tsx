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

  const filteredWorkouts = workouts.filter((w) => {
    if (filterStatus === 'all') return true;
    return w.status === filterStatus;
  });

  return (
    <div
      ref={swipeRef}
      className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12 touch-pan-y"
    >
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Тренування
          </h1>
        </div>

        <button
          type="button"
          onClick={handleCreateNewDirectly}
          className="inline-flex items-center justify-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-4 py-2 text-xs sm:text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-white active:bg-zinc-700 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Нове тренування</span>
        </button>
      </div>

      {/* Filter Tabs */}
      {workouts.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${filterStatus === 'all'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
            >
              Всі ({workouts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('in_progress')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${filterStatus === 'in_progress'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
            >
              У процесі ({workouts.filter((w) => w.status === 'in_progress').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('completed')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${filterStatus === 'completed'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
            >
              Завершено ({workouts.filter((w) => w.status === 'completed').length})
            </button>
          </div>
        </div>
      )}

      {/* Workouts List */}
      {workouts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-10 text-center space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Тренувань не знайдено</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            У вас ще немає збережених тренувань. Натисніть кнопку нижче, щоб відкрити форму створення та додати вправи.
          </p>
          <button
            type="button"
            onClick={handleCreateNewDirectly}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-4 py-2 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Створити перше тренування</span>
          </button>
        </div>
      ) : filteredWorkouts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-8 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
          <p className="font-semibold text-zinc-700 dark:text-zinc-300">
            Немає тренувань зі статусом «{filterStatus === 'in_progress' ? 'У процесі' : 'Завершено'}».
          </p>
          <p className="text-[11px] text-zinc-400">
            Свайпніть вліво або вправо для перемикання фільтрів.
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
                  className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer space-y-1.5"
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
