import React, { useState, useMemo } from 'react';
import { Exercise, MuscleGroup, MUSCLE_GROUPS } from '../types/workout';
import { StorageService } from '../services/storageService';
import { CreateExerciseModal } from './CreateExerciseModal';
import { ExerciseHistoryModal } from './ExerciseHistoryModal';
import {
  Search,
  Plus,
  Dumbbell,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface ExerciseCatalogViewProps {
  userId: string;
}

export const ExerciseCatalogView: React.FC<ExerciseCatalogViewProps> = ({ userId }) => {
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [historyModalExercise, setHistoryModalExercise] = useState<Exercise | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const exercises = useMemo(() => {
    return StorageService.getExercises(userId);
  }, [userId, refreshKey]);

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchSearch =
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        (ex.description && ex.description.toLowerCase().includes(search.toLowerCase()));

      const matchMuscle = selectedMuscle === 'all' || ex.muscleGroup === selectedMuscle;
      const matchCustom = !onlyCustom || !ex.isDefault;

      return matchSearch && matchMuscle && matchCustom;
    });
  }, [exercises, search, selectedMuscle, onlyCustom]);

  return (
    <div className="space-y-5 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            База вправ
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Каталог вправ із персональною статистикою, історією та технікою виконання
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-4 py-2 text-xs sm:text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Створити власну вправу</span>
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

          <label className="flex items-center space-x-2 cursor-pointer self-start sm:self-center text-xs text-zinc-700 dark:text-zinc-300 select-none">
            <input
              type="checkbox"
              checked={onlyCustom}
              onChange={(e) => setOnlyCustom(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-500"
            />
            <span>Тільки мої вправи</span>
          </label>
        </div>

        {/* Muscle group tabs */}
        <div className="flex space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedMuscle('all')}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
              selectedMuscle === 'all'
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            Всі м'язи ({exercises.length})
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
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                  isSelected
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

      {/* Grid of exercises */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 p-10 text-center space-y-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Вправ не знайдено.</p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3.5 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Додати нову вправу</span>
            </button>
          </div>
        ) : (
          filtered.map((ex) => {
            const muscleInfo = MUSCLE_GROUPS[ex.muscleGroup] || MUSCLE_GROUPS.full_body;
            const lastPerf = StorageService.getLastExercisePerformance(userId, ex.id);

            return (
              <div
                key={ex.id}
                onClick={() => setHistoryModalExercise(ex)}
                className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                      {ex.name}
                    </h3>
                    <div className="flex items-center space-x-1 shrink-0">
                      {!ex.isDefault && (
                        <span className="rounded border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                          Власна
                        </span>
                      )}
                      <span className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                        {muscleInfo.nameUk}
                      </span>
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
                      setHistoryModalExercise(ex);
                    }}
                    className="flex items-center space-x-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2 py-1 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors"
                  >
                    <span>Дані та техніка</span>
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
        onClose={() => setIsCreateOpen(false)}
        onCreated={(newEx) => {
          setRefreshKey((prev) => prev + 1);
          setHistoryModalExercise(newEx);
        }}
      />

      <ExerciseHistoryModal
        exercise={historyModalExercise}
        userId={userId}
        isOpen={Boolean(historyModalExercise)}
        onClose={() => setHistoryModalExercise(null)}
        initialTab="history"
      />
    </div>
  );
};
