import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Exercise, MuscleGroup, MUSCLE_GROUPS, isCustomExercise } from '../types/workout';
import { StorageService } from '../services/storageService';
import { CreateExerciseModal } from './CreateExerciseModal';
import { EditExerciseModal } from './EditExerciseModal';
import { ExerciseHistoryModal } from './ExerciseHistoryModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { MobileSwipeableExerciseCard } from './MobileSwipeableExerciseCard';
import {
  Search,
  Plus,
  Dumbbell,
  Sparkles,
  ChevronRight,
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

  const handleDeleteExercise = async (id: string) => {
    await StorageService.deleteExercise(id);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#2563eb] text-white hover:bg-[#1d4ed8] px-4 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Додати вправу</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1d2939] p-3.5 sm:p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b] dark:text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Пошук вправи за назвою..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-[#f1f5f9] dark:bg-[#0b1220] pl-9 pr-16 text-base sm:text-xs text-[#0f172a] dark:text-[#f8fafc] placeholder-[#64748b] dark:placeholder-[#94a3b8] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f8fafc] cursor-pointer"
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
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${selectedMuscle === 'all'
              ? 'border-[#2563eb] bg-[#2563eb] text-white font-bold shadow-sm'
              : 'border-[#e2e8f0] dark:border-[#334155] bg-[#f1f5f9] dark:bg-[#1d2939] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#263140]'
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
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${isSelected
                  ? 'border-[#2563eb] bg-[#2563eb] text-white font-bold shadow-sm'
                  : 'border-[#e2e8f0] dark:border-[#334155] bg-[#f1f5f9] dark:bg-[#1d2939] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#263140]'
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
          <div className="col-span-full rounded-[28px] border border-dashed border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1d2939]/50 py-12 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#f1f5f9] dark:bg-[#263140] flex items-center justify-center">
              <Dumbbell className="w-6 h-6 text-[#2563eb] dark:text-[#60a5fa] stroke-[1.75]" />
            </div>
            <h3 className="mt-4 font-bold text-base text-[#0f172a] dark:text-[#f8fafc]">
              Вправ не знайдено
            </h3>
            <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8] max-w-xs">
              Спробуйте інший пошуковий запит або створіть власну вправу.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#2563eb] text-white hover:bg-[#1d4ed8] px-4 py-2 text-xs font-bold transition-all cursor-pointer shadow-sm"
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
              <MobileSwipeableExerciseCard
                key={ex.id}
                exerciseId={ex.id}
                disabled={!canEdit}
                onDelete={() => handleDeleteExercise(ex.id)}
              >
                <div
                  onClick={() => {
                    if (Date.now() < blockHistoryModalUntilRef.current) return;
                    setHistoryModalExercise(ex);
                  }}
                  className="group rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors cursor-pointer flex flex-col justify-between h-full shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                        {ex.name}
                      </h3>
                      <div className="flex items-center space-x-1 shrink-0">
                        <span className="rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
                          {muscleInfo.nameUk}
                        </span>
                      </div>
                    </div>

                    {ex.description && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 mb-2.5">
                        {ex.description}
                      </p>
                    )}
                  </div>

                  {/* Bottom stats hint */}
                  <div className="border-t border-slate-100 dark:border-zinc-800 pt-2 mt-2 flex items-center justify-between text-xs">
                    {lastPerf ? (
                      <div className="flex items-center space-x-1.5 text-slate-700 dark:text-zinc-300 font-mono text-[11px]">
                        <Sparkles className="h-3 w-3 text-amber-500" />
                        <span>
                          Останній: {lastPerf.maxWeight} кг ({lastPerf.sets.length} підх.)
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Ще не виконувалась</span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (Date.now() < blockHistoryModalUntilRef.current) return;
                        setHistoryModalExercise(ex);
                      }}
                      className="flex items-center space-x-1 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 px-2.5 py-1 text-slate-800 dark:text-zinc-200 text-xs font-semibold transition-colors"
                    >
                      <span>Історія та рекорди</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>
              </MobileSwipeableExerciseCard>
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
    </div>
  );
};
