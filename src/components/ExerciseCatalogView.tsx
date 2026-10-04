import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Exercise, MuscleGroup, MUSCLE_GROUPS, isCustomExercise } from '../types/workout';
import { StorageService } from '../services/storageService';
import { CreateExerciseModal } from './CreateExerciseModal';
import { EditExerciseModal } from './EditExerciseModal';
import { ExerciseHistoryModal } from './ExerciseHistoryModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  Search,
  Plus,
  Dumbbell,
  Sparkles,
  ChevronRight,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useSwipeGesture } from '../utils/useSwipeGesture';

export { isCustomExercise };

interface ExerciseCatalogViewProps {
  userId: string;
}

export const ExerciseCatalogView: React.FC<ExerciseCatalogViewProps> = ({ userId }) => {
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [exerciseToEdit, setExerciseToEdit] = useState<Exercise | null>(null);
  const [historyModalExercise, setHistoryModalExercise] = useState<Exercise | null>(null);
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const blockHistoryModalUntilRef = useRef<number>(0);

  const muscleTabs = useMemo<(MuscleGroup | 'all')[]>(
    () => ['all', ...(Object.keys(MUSCLE_GROUPS) as MuscleGroup[])],
    []
  );

  const handleNextMuscle = () => {
    const idx = muscleTabs.indexOf(selectedMuscle);
    if (idx < muscleTabs.length - 1) {
      setSelectedMuscle(muscleTabs[idx + 1]);
    }
  };

  const handlePrevMuscle = () => {
    const idx = muscleTabs.indexOf(selectedMuscle);
    if (idx > 0) {
      setSelectedMuscle(muscleTabs[idx - 1]);
    }
  };

  const catalogSwipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft: handleNextMuscle,
    onSwipeRight: handlePrevMuscle,
    threshold: 30,
    disabled: isCreateOpen || Boolean(exerciseToEdit) || Boolean(exerciseToDelete) || Boolean(historyModalExercise),
  });

  useEffect(() => {
    StorageService.syncExercises().then(() => {
      setRefreshKey((prev) => prev + 1);
    });
  }, [userId]);

  const exercises = useMemo(() => {
    return StorageService.getExercises(userId);
  }, [userId, refreshKey]);

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchSearch =
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        (ex.description && ex.description.toLowerCase().includes(search.toLowerCase()));
      const matchMuscle = selectedMuscle === 'all' || ex.muscleGroup === selectedMuscle;
      return matchSearch && matchMuscle;
    });
  }, [exercises, search, selectedMuscle]);

  const handleConfirmDelete = async () => {
    if (!exerciseToDelete) return;
    const idToDelete = exerciseToDelete.id;
    await StorageService.deleteExercise(idToDelete);
    setExerciseToDelete(null);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            База вправ
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3.5 py-2 text-xs sm:text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-white active:bg-zinc-700 transition-colors cursor-pointer shrink-0 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Додати вправу</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Пошук вправи за назвою..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 pl-9 pr-16 text-base sm:text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                Очистити
              </button>
            )}
          </div>
        </div>

        {/* Muscle group tabs */}
        <div className="flex space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedMuscle('all')}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors border cursor-pointer ${selectedMuscle === 'all'
              ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
              : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
          >
            Всі мʼязи ({exercises.length})
          </button>
          {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((groupKey) => {
            const info = MUSCLE_GROUPS[groupKey];
            const count = exercises.filter((e) => e.muscleGroup === groupKey).length;
            const isSelected = selectedMuscle === groupKey;
            return (
              <button
                key={groupKey}
                type="button"
                onClick={() => setSelectedMuscle(groupKey)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors border cursor-pointer ${isSelected
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
              >
                {info.nameUk} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of exercises (Supports Swipe Left/Right to change muscle group) */}
      <div ref={catalogSwipeRef} className="grid grid-cols-1 md:grid-cols-2 gap-3 touch-pan-y">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 p-10 text-center space-y-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {'Вправ не знайдено.'}
            </p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3.5 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{search.trim() ? `Створити «${search.trim()}»` : 'Додати власну вправу'}</span>
            </button>
          </div>
        ) : (
          filtered.map((ex) => {
            const muscleInfo = MUSCLE_GROUPS[ex.muscleGroup] || MUSCLE_GROUPS.full_body;
            const lastPerf = StorageService.getLastExercisePerformance(userId, ex.id);
            // All exercises are now user-owned — everyone can edit their own
            const canEdit = ex.userId === userId;

            return (
              <div
                key={ex.id}
                onClick={() => {
                  if (Date.now() < blockHistoryModalUntilRef.current) return;
                  setHistoryModalExercise(ex);
                }}
                className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                      {ex.name}
                    </h3>
                    <div className="flex items-center space-x-1 shrink-0">
                      <span className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                        {muscleInfo.nameUk}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExerciseToEdit(ex);
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ml-0.5"
                          title="Редагувати вправу"
                          aria-label={`Редагувати вправу ${ex.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExerciseToDelete(ex);
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer ml-0.5"
                          title="Видалити вправу"
                          aria-label={`Видалити вправу ${ex.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {ex.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-2.5">
                      {ex.description}
                    </p>
                  )}
                </div>

                {/* Bottom stats hint */}
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 mt-2 flex items-center justify-between text-xs">
                  {lastPerf ? (
                    <div className="flex items-center space-x-1.5 text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <span>
                        Останній: {lastPerf.maxWeight} кг ({lastPerf.sets.length} підх.)
                      </span>
                    </div>
                  ) : (
                    <span className="text-zinc-400 text-[11px]">Ще не виконувалась</span>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (Date.now() < blockHistoryModalUntilRef.current) return;
                      setHistoryModalExercise(ex);
                    }}
                    className="flex items-center space-x-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2 py-1 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors"
                  >
                    <span>Історія та рекорди</span>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      <CreateExerciseModal
        userId={userId}
        isOpen={isCreateOpen}
        initialName={search.trim()}
        onClose={() => {
          blockHistoryModalUntilRef.current = Date.now() + 800;
          setIsCreateOpen(false);
        }}
        onCreated={(newEx) => {
          blockHistoryModalUntilRef.current = Date.now() + 800;
          setHistoryModalExercise(null);
          if (newEx?.muscleGroup) {
            setSelectedMuscle(newEx.muscleGroup);
          }
          setSearch('');
          setRefreshKey((prev) => prev + 1);
        }}
      />

      <EditExerciseModal
        exercise={exerciseToEdit}
        isOpen={Boolean(exerciseToEdit)}
        onClose={() => setExerciseToEdit(null)}
        onSaved={() => {
          setRefreshKey((prev) => prev + 1);
        }}
      />

      <ExerciseHistoryModal
        exercise={historyModalExercise}
        userId={userId}
        isOpen={Boolean(historyModalExercise)}
        onClose={() => setHistoryModalExercise(null)}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(exerciseToDelete)}
        title="Видалити вправу?"
        message={`Ви впевнені, що хочете видалити вправу "${exerciseToDelete?.name || ''}"? Її буде вилучено з бази вправ.`}
        confirmLabel="Видалити"
        cancelLabel="Скасувати"
        onConfirm={handleConfirmDelete}
        onClose={() => setExerciseToDelete(null)}
      />
    </div>
  );
};
