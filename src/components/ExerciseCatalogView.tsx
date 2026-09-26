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
  History,
  Filter,
  Layers,
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
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center space-x-2">
            <Dumbbell className="h-6 w-6 text-amber-400" />
            <span>Вправи</span>
          </h2>
          <p className="text-xs text-slate-400">
            Каталог вправ із персональною статистикою, історією та технікою виконання
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Створити власну вправу</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3.5 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Пошук вправи за назвою..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-xs text-slate-400 hover:text-white"
              >
                Очистити
              </button>
            )}
          </div>

          <label className="flex items-center space-x-2 cursor-pointer self-start sm:self-center text-xs text-slate-300 select-none">
            <input
              type="checkbox"
              checked={onlyCustom}
              onChange={(e) => setOnlyCustom(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
            />
            <span>Тільки створені мною</span>
          </label>
        </div>

        {/* Muscle group tabs */}
        <div className="flex space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => setSelectedMuscle('all')}
            className={`rounded-lg px-3 py-1.5 font-medium whitespace-nowrap transition ${
              selectedMuscle === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
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
                onClick={() => setSelectedMuscle(groupKey)}
                className={`rounded-lg px-2.5 py-1.5 font-medium whitespace-nowrap transition border ${
                  isSelected
                    ? `${info.badgeBg} ${info.badgeBorder} font-bold text-white`
                    : 'border-transparent bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {info.nameUk} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of exercises */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-800 p-12 text-center">
            <p className="text-sm text-slate-400">Вправ не знайдено.</p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-3 inline-flex items-center space-x-2 rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition"
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
                className="group rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg hover:border-amber-500/40 hover:bg-slate-850/80 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition">
                      {ex.name}
                    </h3>
                    <div className="flex items-center space-x-1 shrink-0">
                      {!ex.isDefault && (
                        <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                          Власна
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${muscleInfo.badgeBg} border ${muscleInfo.badgeBorder}`}
                      >
                        {muscleInfo.nameUk}
                      </span>
                    </div>
                  </div>

                  {ex.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                      {ex.description}
                    </p>
                  )}
                </div>

                {/* Bottom stats hint */}
                <div className="border-t border-slate-800/80 pt-2.5 mt-2 flex items-center justify-between text-xs">
                  {lastPerf ? (
                    <div className="flex items-center space-x-1.5 text-amber-400 font-mono text-[11px]">
                      <Sparkles className="h-3 w-3" />
                      <span>
                        Останній: {lastPerf.maxWeight} кг ({lastPerf.sets.length} підх.)
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-[11px]">Ще не виконувалась</span>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHistoryModalExercise(ex);
                    }}
                    className="flex items-center space-x-1 rounded-lg bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 text-slate-300 text-xs font-semibold transition"
                  >
                    <span>Дані та техніка</span>
                    <ChevronRight className="h-3.5 w-3.5" />
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
