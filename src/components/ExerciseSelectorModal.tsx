import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Plus, Dumbbell, Sparkles } from 'lucide-react';
import { Exercise, MuscleGroup, MUSCLE_GROUPS } from '../types/workout';
import { StorageService } from '../services/storageService';

interface ExerciseSelectorModalProps {
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  onOpenCreateModal: () => void;
}

export const ExerciseSelectorModal: React.FC<ExerciseSelectorModalProps> = ({
  isOpen,
  userId,
  onClose,
  onSelect,
  onOpenCreateModal,
}) => {
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    StorageService.syncExercises().then(() => {
      setRefreshKey((prev) => prev + 1);
    });
    const scrollY = window.scrollY;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const exercises = useMemo(() => {
    return StorageService.getExercises(userId);
  }, [userId, isOpen, refreshKey]);

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchSearch =
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        (ex.description && ex.description.toLowerCase().includes(search.toLowerCase()));
      const matchMuscle = selectedMuscle === 'all' || ex.muscleGroup === selectedMuscle;
      return matchSearch && matchMuscle;
    });
  }, [exercises, search, selectedMuscle]);

  const backdropMouseDownRef = React.useRef(false);

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    backdropMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && backdropMouseDownRef.current) {
      onClose();
    }
    backdropMouseDownRef.current = false;
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 dark:bg-black/75 backdrop-blur-sm animate-fade-in"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-no-swipe="true"
        className="relative w-full max-w-xl max-h-[85vh] my-auto flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
              <Dumbbell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Вибір вправи</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Оберіть зі списку або додайте власну</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Muscle Filters */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/40">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Пошук вправи за назвою..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-10 pr-16 py-2.5 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 dark:focus:border-zinc-500 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 py-0.5 px-1.5"
              >
                Очистити
              </button>
            )}
          </div>

          {/* Muscle filter pills */}
          <div className="flex space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => setSelectedMuscle('all')}
              className={`rounded-lg px-2.5 py-1 font-medium whitespace-nowrap transition ${
                selectedMuscle === 'all'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              Всі ({exercises.length})
            </button>
            {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((groupKey) => {
              const info = MUSCLE_GROUPS[groupKey];
              const count = exercises.filter((e) => e.muscleGroup === groupKey).length;
              const isSelected = selectedMuscle === groupKey;
              return (
                <button
                  key={groupKey}
                  onClick={() => setSelectedMuscle(groupKey)}
                  className={`rounded-lg px-2.5 py-1 font-medium whitespace-nowrap transition border ${
                    isSelected
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-semibold'
                      : 'border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {info.nameUk} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* List of exercises */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Вправу не знайдено за вашим запитом.</p>
              <button
                onClick={() => {
                  onClose();
                  onOpenCreateModal();
                }}
                className="mt-3 inline-flex items-center space-x-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3.5 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Створити «{search || 'цю вправу'}»</span>
              </button>
            </div>
          ) : (
            filtered.map((ex) => {
              const muscleInfo = MUSCLE_GROUPS[ex.muscleGroup] || MUSCLE_GROUPS.full_body;
              const lastPerf = StorageService.getLastExercisePerformance(userId, ex.id);

              return (
                <button
                  key={ex.id}
                  onClick={() => {
                    onSelect(ex);
                    onClose();
                  }}
                  className="w-full text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800/90 hover:border-zinc-300 dark:hover:border-zinc-700 p-3 transition flex items-center justify-between group"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition truncate">
                        {ex.name}
                      </span>
                      {!ex.isDefault && (
                        <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 text-[9px] font-medium text-amber-700 dark:text-amber-300">
                          Власна
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        {muscleInfo.nameUk}
                      </span>
                    </div>

                    {/* Past history hint if available */}
                    {lastPerf && (
                      <div className="mt-1.5 flex items-center space-x-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          Минулий рез.: {lastPerf.maxWeight} кг ({lastPerf.sets.length} підх.) від {lastPerf.date}
                        </span>
                      </div>
                    )}
                  </div>

                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap pl-2">
                    Обрати +
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer with create custom trigger */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3.5 bg-zinc-50/70 dark:bg-zinc-900 flex items-center justify-between">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Немає потрібної вправи?</span>
          <button
            onClick={() => {
              onClose();
              onOpenCreateModal();
            }}
            className="flex items-center space-x-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
          >
            <Plus className="h-3.5 w-3.5 text-amber-500" />
            <span>Створити нову вправу</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
