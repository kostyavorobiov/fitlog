import React, { useMemo, useState } from 'react';
import { StorageService } from '../services/storageService';
import { MUSCLE_GROUPS, MuscleGroup, Exercise, WorkoutSet, WorkoutPlan } from '../types/workout';
import { ExerciseHistoryModal } from './ExerciseHistoryModal';
import {
  Trophy,
  Flame,
  Calendar,
  Layers,
  TrendingUp,
  Activity,
  Dumbbell,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Search,
} from 'lucide-react';

interface AnalyticsViewProps {
  userId: string;
}

export type AnalyticsPeriod = 'day' | 'week' | 'month';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ userId }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>('week');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [viewMode, setViewMode] = useState<'prs' | 'all'>('prs');
  const [searchQuery, setSearchQuery] = useState('');

  const workouts = useMemo(() => StorageService.getWorkouts(userId), [userId]);

  // Helper to determine the local time range for the period
  const periodRange = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (selectedPeriod === 'day') {
      // 1 день: поточний день (00:00:00 до 23:59:59 місцевого часу)
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return { start, end, titleUk: '1 день (Сьогодні)' };
    }

    if (selectedPeriod === 'week') {
      // 1 тиждень: від першого дня поточного календарного тижня (Понеділок 00:00:00)
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7; // 0 for Monday, 6 for Sunday
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
      return { start, end, titleUk: '1 тиждень (з Пн)' };
    }

    // 1 місяць: від першого дня поточного календарного місяця (1-е число 00:00:00)
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { start, end, titleUk: '1 місяць (з 1-го числа)' };
  }, [selectedPeriod]);

  // Compute stats filtered by selected period
  const stats = useMemo(() => {
    const { start, end } = periodRange;

    let periodVolumeKg = 0;
    let periodCompletedSets = 0;
    const periodWorkoutsSet = new Set<string>();

    // Muscle group sets count (NOT total weight as per specification)
    const muscleSetsMap: Record<string, number> = {};

    // Track best exercises/PRs across all time and in period
    const exerciseMaxMap: Record<
      string,
      { id: string; name: string; maxWeight: number; reps: number; muscle: MuscleGroup; exercise: Exercise }
    > = {};

    workouts.forEach((w) => {
      let workoutHasPeriodActivity = false;

      (w.exercises || []).forEach((we) => {
        const ex = StorageService.getExerciseById(we.exerciseId);
        const muscle = ex?.muscleGroup || 'full_body';

        (we.sets || []).forEach((s) => {
          // Strictly count only completed sets with valid weight and reps
          if (s.completedAt && s.weight !== undefined && s.weight !== null && s.actualReps && s.actualReps > 0) {
            // Determine set date in local time
            const setDate = new Date(s.completedAt);

            // Check if set is within the selected period
            if (setDate >= start && setDate <= end) {
              const vol = s.weight * s.actualReps;
              periodVolumeKg += vol;
              periodCompletedSets += 1;
              workoutHasPeriodActivity = true;

              // Count completed sets per muscle group
              muscleSetsMap[muscle] = (muscleSetsMap[muscle] || 0) + 1;

              if (ex) {
                const currentEx = exerciseMaxMap[ex.id];
                if (!currentEx || s.weight > currentEx.maxWeight) {
                  exerciseMaxMap[ex.id] = {
                    id: ex.id,
                    name: ex.name,
                    maxWeight: s.weight,
                    reps: s.actualReps,
                    muscle: ex.muscleGroup,
                    exercise: ex,
                  };
                }
              }
            }
          }
        });
      });

      if (workoutHasPeriodActivity || (w.status === 'completed' && w.completedAt && new Date(w.completedAt) >= start && new Date(w.completedAt) <= end)) {
        periodWorkoutsSet.add(w.id);
      }
    });

    const topPRs = Object.values(exerciseMaxMap)
      .sort((a, b) => b.maxWeight - a.maxWeight)
      .slice(0, 8);

    const allTrackedExercises = Object.values(exerciseMaxMap).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return {
      periodWorkoutsCount: periodWorkoutsSet.size,
      periodVolumeKg,
      periodTons: Math.round((periodVolumeKg / 1000) * 10) / 10,
      periodCompletedSets,
      muscleSetsMap,
      topPRs,
      allTrackedExercises,
    };
  }, [workouts, periodRange]);

  const displayedExercises = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return stats.allTrackedExercises.filter(
        (item) => item.name.toLowerCase().includes(q) || (MUSCLE_GROUPS[item.muscle]?.nameUk || '').toLowerCase().includes(q)
      );
    }
    return viewMode === 'prs' ? stats.topPRs : stats.allTrackedExercises;
  }, [viewMode, searchQuery, stats.topPRs, stats.allTrackedExercises]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Top Header & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Activity className="h-5 w-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Аналітика
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Кількість завершених підходів за м'язовими групами та динаміка навантаження
          </p>
        </div>

        {/* Period Filter: Only 1 день, 1 тиждень, 1 місяць */}
        <div className="flex items-center space-x-1.5 rounded-2xl border border-slate-800 bg-slate-900/90 p-1.5 shadow-lg shrink-0">
          {(
            [
              { key: 'day', label: '1 день' },
              { key: 'week', label: '1 тиждень' },
              { key: 'month', label: '1 місяць' },
            ] as const
          ).map((p) => {
            const isActive = selectedPeriod === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelectedPeriod(p.key)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Metrics for the Selected Period */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Completed Sets (Primary metric per requirement) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-md">
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400 mb-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>Завершено підходів</span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-white">
            {stats.periodCompletedSets}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            за {periodRange.titleUk}
          </div>
        </div>

        {/* Workouts in Period */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-md">
          <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400 mb-2">
            <Calendar className="h-4 w-4" />
            <span>Активних тренувань</span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-white">
            {stats.periodWorkoutsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            у поточному періоді
          </div>
        </div>

        {/* Volume in Period */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-md">
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400 mb-2">
            <Flame className="h-4 w-4" />
            <span>Тоннаж періоду</span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-white">
            {stats.periodTons > 0 ? `${stats.periodTons} т` : `${stats.periodVolumeKg} кг`}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {stats.periodVolumeKg.toLocaleString()} кг піднято
          </div>
        </div>

        {/* Exercises Tracked */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-md">
          <div className="flex items-center space-x-2 text-xs font-semibold text-purple-400 mb-2">
            <Trophy className="h-4 w-4" />
            <span>Задіяних вправ</span>
          </div>
          <div className="font-mono text-2xl font-extrabold text-white">
            {stats.allTrackedExercises.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            з результатами у вибірці
          </div>
        </div>
      </div>

      {/* Muscle Group Distribution: Graph shows NUMBER OF COMPLETED SETS on each muscle group */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-amber-400" />
              <span>Кількість завершених підходів на м'язову групу</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Враховуються лише успішно виконані підходи за обраний період ({periodRange.titleUk})
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-400 font-mono">
            Всього: <strong className="text-amber-400">{stats.periodCompletedSets}</strong> підх.
          </div>
        </div>

        {stats.periodCompletedSets === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-500 mx-auto">
              <Layers className="h-5 w-5" />
            </div>
            <p className="text-xs text-slate-400 font-medium">
              За обраний період ({periodRange.titleUk}) немає зафіксованих підходів.
            </p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Завершуйте підходи у тренуваннях натисканням галочки ✓, і дані про м'язові групи з'являться тут автоматично.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((groupKey) => {
              const info = MUSCLE_GROUPS[groupKey];
              const setsCount = stats.muscleSetsMap[groupKey] || 0;
              const percent =
                stats.periodCompletedSets > 0
                  ? (setsCount / stats.periodCompletedSets) * 100
                  : 0;

              if (setsCount === 0) return null;

              return (
                <div key={groupKey} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${info.badgeBg} border ${info.badgeBorder}`} />
                      <span className="font-semibold text-slate-200">{info.nameUk}</span>
                    </div>
                    <div className="font-mono text-xs flex items-center space-x-2">
                      <span className="text-slate-300 font-bold">
                        {setsCount}{' '}
                        {setsCount === 1
                          ? 'підхід'
                          : setsCount >= 2 && setsCount <= 4
                          ? 'підходи'
                          : 'підходів'}
                      </span>
                      <span className="text-amber-400 font-bold">({Math.round(percent)}%)</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500 shadow-sm"
                      style={{ width: `${Math.max(4, percent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Personal Records & Tracked Exercises for the Period */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Вправи періоду та рекорди</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('prs')}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  viewMode === 'prs' && !searchQuery
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Топ ({stats.topPRs.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  viewMode === 'all' && !searchQuery
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Всі ({stats.allTrackedExercises.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Пошук вправи..."
                className="w-36 sm:w-44 rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Натисніть на будь-яку вправу, щоб переглянути повну історію всіх тренувань, динаміку ваги та техніку виконання.
        </p>

        {displayedExercises.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
            {searchQuery
              ? 'Вправ за цим запитом не знайдено.'
              : `У періоді «${periodRange.titleUk}» ще немає зафіксованих підходів із вагою.`}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {displayedExercises.map((pr, idx) => {
              const muscle = MUSCLE_GROUPS[pr.muscle] || MUSCLE_GROUPS.full_body;
              return (
                <div
                  key={pr.id || idx}
                  onClick={() => setSelectedExercise(pr.exercise)}
                  className="group rounded-xl border border-slate-800 bg-slate-850/60 p-3.5 flex flex-col justify-between cursor-pointer hover:border-amber-500/50 hover:bg-slate-800/90 transition shadow-md"
                  title="Натисніть для перегляду повної динаміки та історії цієї вправи"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${muscle.badgeBg} border ${muscle.badgeBorder}`}>
                        {muscle.nameUk}
                      </span>
                      <span className="font-mono text-xs text-slate-500">#{idx + 1}</span>
                    </div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-400 line-clamp-1 mb-2 transition">
                      {pr.name}
                    </div>
                  </div>

                  <div>
                    <div className="border-t border-slate-800 pt-2 flex items-baseline justify-between font-mono">
                      <span className="text-lg font-extrabold text-amber-400">
                        {pr.maxWeight} кг
                      </span>
                      <span className="text-xs text-slate-400">× {pr.reps} повт</span>
                    </div>
                    <div className="mt-2 flex items-center justify-end text-[10px] font-medium text-slate-400 group-hover:text-amber-300 transition">
                      <span>Дані та техніка</span>
                      <ChevronRight className="h-3 w-3 ml-0.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Exercise Details Modal */}
      <ExerciseHistoryModal
        exercise={selectedExercise}
        userId={userId}
        isOpen={Boolean(selectedExercise)}
        onClose={() => setSelectedExercise(null)}
        initialTab="history"
      />
    </div>
  );
};
