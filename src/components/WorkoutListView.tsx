import React, { useState } from 'react';
import { WorkoutPlan } from '../types/workout';
import { StorageService } from '../services/storageService';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { useSwipeGesture } from '../utils/useSwipeGesture';
import {
  Plus,
  Calendar,
  Trash2,
  ChevronRight,
  Layers,
} from 'lucide-react';

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'completed'>('all');

  const workouts = StorageService.getWorkouts(userId);

  const filterTabs: ('all' | 'in_progress' | 'completed')[] = ['all', 'in_progress', 'completed'];

  // Swipe Left -> next filter status (Всі -> У процесі -> Завершено)
  // Swipe Right -> previous filter status (Завершено -> У процесі -> Всі)
  const handleNextFilter = () => {
    const currentIndex = filterTabs.indexOf(filterStatus);
    if (currentIndex < filterTabs.length - 1) {
      setFilterStatus(filterTabs[currentIndex + 1]);
    }
  };

  const handlePrevFilter = () => {
    const currentIndex = filterTabs.indexOf(filterStatus);
    if (currentIndex > 0) {
      setFilterStatus(filterTabs[currentIndex - 1]);
    }
  };

  const swipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft: handleNextFilter,
    onSwipeRight: handlePrevFilter,
    threshold: 60,
  });

  const handleConfirmDelete = () => {
    if (!workoutToDelete) return;
    StorageService.deleteWorkout(workoutToDelete.id);
    onDeleteWorkout(workoutToDelete.id);
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
      {/* Top Header Bar - Minimal Functional Flat */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Тренування
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Список тренувань та створення нової програми занять
          </p>
        </div>

        {/* Primary Action Button - Opens workout creation form directly */}
        <button
          type="button"
          onClick={handleCreateNewDirectly}
          className="inline-flex items-center justify-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-4 py-2 text-xs sm:text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-white active:bg-zinc-700 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Нове тренування</span>
        </button>
      </div>

      {/* Filter Tabs (Flat Segmented Control with Swipe Navigation) */}
      {workouts.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Всі ({workouts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('in_progress')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                filterStatus === 'in_progress'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              У процесі ({workouts.filter((w) => w.status === 'in_progress').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('completed')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                filterStatus === 'completed'
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

            // Compute total volume for completed sets
            let totalVolume = 0;
            (w.exercises || []).forEach((ex) => {
              (ex.sets || []).forEach((s) => {
                if (s.completedAt && s.weight && s.actualReps) {
                  totalVolume += s.weight * s.actualReps;
                }
              });
            });

            return (
              <div
                key={w.id}
                onClick={() => onSelectWorkout(w)}
                className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-4.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    {/* Status & Date labels */}
                    <div className="flex items-center space-x-2 text-xs">
                      <span
                        className={`font-semibold ${
                          isCompleted
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : w.status === 'in_progress'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {isCompleted
                          ? 'Завершено'
                          : w.status === 'in_progress'
                          ? 'У процесі'
                          : 'Заплановано'}
                      </span>

                      <span className="text-zinc-300 dark:text-zinc-700">·</span>

                      <span className="flex items-center space-x-1 text-zinc-500 dark:text-zinc-400 font-mono text-xs">
                        <Calendar className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                        <span>{w.scheduledDate}</span>
                      </span>

                      {w.assignedByCoachId && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-700">·</span>
                          <span className="text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                            Від тренера
                          </span>
                        </>
                      )}
                    </div>

                    {/* Workout Title */}
                    <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors truncate">
                      {w.title || 'Тренування без назви'}
                    </h3>

                    {/* Exercises Summary List */}
                    <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400 pt-0.5">
                      <span className="flex items-center space-x-1">
                        <Layers className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {(w.exercises || []).length}
                        </span>{' '}
                        вправ
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{totalSets}</span> підходів
                      </span>
                      {totalVolume > 0 && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-700">·</span>
                          <span className="font-mono text-zinc-700 dark:text-zinc-300">
                            {totalVolume.toLocaleString()} кг
                          </span>
                        </>
                      )}
                    </div>

                    {/* Exercises Names Preview */}
                    {(w.exercises || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(w.exercises || []).slice(0, 4).map((we, idx) => {
                          const ex = StorageService.getExerciseById(we.exerciseId);
                          return (
                            <span
                              key={idx}
                              className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-2 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-400"
                            >
                              {ex?.name || we.exerciseName || 'Вправа'} ({we.sets?.length || 0})
                            </span>
                          );
                        })}
                        {(w.exercises || []).length > 4 && (
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 self-center">
                            + ще {(w.exercises || []).length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right side actions */}
                  <div className="flex items-center space-x-2 shrink-0 pt-1 sm:pt-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWorkoutToDelete(w);
                      }}
                      className="p-2 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Видалити тренування"
                      aria-label="Видалити тренування"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      className="flex items-center space-x-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors"
                    >
                      <span>
                        {isCompleted
                          ? 'Переглянути'
                          : w.status === 'in_progress'
                          ? 'Продовжити'
                          : 'Розпочати'}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                    </button>
                  </div>
                </div>
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
