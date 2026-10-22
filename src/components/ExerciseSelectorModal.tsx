import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Plus, Dumbbell, Sparkles } from 'lucide-react';
import { Exercise, MuscleGroup, MUSCLE_GROUPS } from '../types/workout';
import { StorageService } from '../services/storageService';
import { useSwipeGesture } from '../utils/useSwipeGesture';

interface ExerciseSelectorModalProps {
  isOpen: boolean;
  userId: string;
  traineeId?: string;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  onOpenCreateModal: (initialName?: string) => void;
}

export const ExerciseSelectorModal: React.FC<ExerciseSelectorModalProps> = ({
  isOpen,
  userId,
  traineeId,
  onClose,
  onSelect,
  onOpenCreateModal,
}) => {
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

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

  const modalSwipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft: handleNextMuscle,
    onSwipeRight: handlePrevMuscle,
    threshold: 30,
    disabled: !isOpen,
  });

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    const syncPromises = [StorageService.syncExercises(userId)];
    if (traineeId && traineeId !== userId) {
      syncPromises.push(StorageService.syncExercises(traineeId));
    }
    Promise.all(syncPromises).then(() => {
      setRefreshKey((prev) => prev + 1);
    });
    const scrollY = window.scrollY;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, userId, traineeId]);

  const exercises = useMemo(() => {
    return StorageService.getExercises(userId, { traineeId });
  }, [userId, traineeId, isOpen, refreshKey]);

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

  // Pre-index past performances once when modal is open to eliminate 100+ JSON parses on render/keystrokes
  const perfMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof StorageService.getLastExercisePerformance>>();
    if (!isOpen) return map;
    try {
      const historyUserId = traineeId || userId;
      const workouts = StorageService.getWorkouts(historyUserId);
      workouts.forEach((w) => {
        (w.exercises || []).forEach((we) => {
          if (!map.has(we.exerciseId) && we.sets && we.sets.some((s) => s.completedAt || (s.actualReps && s.actualReps > 0))) {
            const perf = StorageService.getLastExercisePerformance(historyUserId, we.exerciseId);
            if (perf) map.set(we.exerciseId, perf);
          }
        });
      });
    } catch { }
    return map;
  }, [userId, traineeId, isOpen]);

  if (!isOpen) return null;

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    backdropMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && backdropMouseDownRef.current) {
      onClose();
    }
    backdropMouseDownRef.current = false;
  };

  const handleSelect = (e: React.MouseEvent | React.TouchEvent, ex: Exercise) => {
    e.stopPropagation();
    try {
      onSelect(ex);
    } catch (err) {
      console.error('Failed to select exercise:', err);
    }
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12px] px-3 sm:items-center sm:p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      {/* Modal Dialog Content */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-xl max-h-[97dvh] sm:max-h-[85vh] flex flex-col rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 p-4 sm:p-5 bg-white dark:bg-zinc-900">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB]/10 dark:bg-[#2563EB]/15 text-[#2563EB] dark:text-[#60A5FA]">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">Вибір вправи</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Оберіть зі списку або додайте власну</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Muscle Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 space-y-3 bg-slate-50/60 dark:bg-zinc-900/40">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Пошук вправи за назвою..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-10 pr-16 text-base sm:text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white py-0.5 px-2 font-medium"
              >
                Очистити
              </button>
            )}
          </div>

          {/* Muscle filter pills */}
          <div className="flex space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => setSelectedMuscle('all')}
              className={`rounded-xl px-3 py-1.5 font-medium whitespace-nowrap transition cursor-pointer ${selectedMuscle === 'all'
                ? 'bg-[#2563EB] text-white font-bold shadow-xs'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
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
                  className={`rounded-xl px-3 py-1.5 font-medium whitespace-nowrap transition border cursor-pointer ${isSelected
                    ? 'bg-[#2563EB] text-white border-[#2563EB] font-bold shadow-xs'
                    : 'border-transparent bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                    }`}
                >
                  {info.nameUk} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* List of exercises (Supports Swipe Left/Right to change muscle group) */}
        <div ref={modalSwipeRef} className="flex-1 overflow-y-auto p-4 space-y-2 touch-pan-y">
          {filtered.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 dark:border-zinc-800 p-8 text-center flex flex-col items-center justify-center">
              <p className="text-sm text-slate-500 dark:text-zinc-400">Вправу не знайдено за вашим запитом.</p>
              <button
                onClick={() => {
                  const query = search.trim();
                  onClose();
                  onOpenCreateModal(query);
                }}
                className="mt-3.5 inline-flex items-center space-x-2 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 text-xs font-bold shadow-xs active:scale-[0.98] transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Створити «{search || 'цю вправу'}»</span>
              </button>
            </div>
          ) : (
            filtered.map((ex) => {
              const muscleInfo = MUSCLE_GROUPS[ex.muscleGroup] || MUSCLE_GROUPS.full_body;
              const lastPerf = perfMap.get(ex.id);

              return (
                <button
                  type="button"
                  key={ex.id}
                  onClick={(e) => handleSelect(e, ex)}
                  className="w-full text-left rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-800/90 hover:border-[#2563EB]/40 dark:hover:border-[#60A5FA]/40 p-3.5 transition flex items-center justify-between group touch-manipulation cursor-pointer active:scale-[0.99] shadow-xs"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition truncate">
                        {ex.name}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                        {muscleInfo.nameUk}
                      </span>
                    </div>

                    {/* Past history hint if available */}
                    {lastPerf && (
                      <div className="mt-1.5 flex items-center space-x-1.5 text-[11px] text-[#2563EB] dark:text-[#60A5FA] font-mono font-medium">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          Минулий рез.: {lastPerf.maxWeight} кг ({lastPerf.sets.length} підх.) від {lastPerf.date}
                        </span>
                      </div>
                    )}
                  </div>

                  <span className="text-xs font-bold text-[#2563EB] dark:text-[#60A5FA] opacity-0 group-hover:opacity-100 transition whitespace-nowrap pl-2">
                    Обрати +
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer with create custom trigger */}
        <div className="border-t border-slate-200 dark:border-zinc-800 p-4 bg-slate-50/70 dark:bg-zinc-900 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-zinc-400">Немає потрібної вправи?</span>
          <button
            onClick={() => {
              const query = search.trim();
              onClose();
              onOpenCreateModal(query);
            }}
            className="flex items-center space-x-1.5 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition shadow-2xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
            <span>Створити нову вправу</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
