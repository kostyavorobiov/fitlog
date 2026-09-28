import React, { useMemo, useState } from 'react';
import { StorageService } from '../services/storageService';
import { MUSCLE_GROUPS, MuscleGroup, Exercise } from '../types/workout';
import { ExerciseHistoryModal } from './ExerciseHistoryModal';
import { useSwipeGesture } from '../utils/useSwipeGesture';
import {
  Trophy,
  Flame,
  Calendar,
  Layers,
  TrendingUp,
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';

interface AnalyticsViewProps {
  userId: string;
}

export type AnalyticsPeriod = 'day' | 'week' | 'month';

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ userId }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [viewMode, setViewMode] = useState<'prs' | 'all'>('prs');
  const [searchQuery, setSearchQuery] = useState('');

  const periods: AnalyticsPeriod[] = ['day', 'week', 'month'];

  // Swipe Left -> next period (Day -> Week -> Month)
  // Swipe Right -> previous period (Month -> Week -> Day)
  const handleNextPeriod = () => {
    const currentIndex = periods.indexOf(selectedPeriod);
    if (currentIndex < periods.length - 1) {
      setSelectedPeriod(periods[currentIndex + 1]);
      setCurrentDate(new Date());
    }
  };

  const handlePrevPeriod = () => {
    const currentIndex = periods.indexOf(selectedPeriod);
    if (currentIndex > 0) {
      setSelectedPeriod(periods[currentIndex - 1]);
      setCurrentDate(new Date());
    }
  };

  const analyticsSwipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft: handleNextPeriod,
    onSwipeRight: handlePrevPeriod,
    threshold: 60,
  });

  const workouts = useMemo(() => StorageService.getWorkouts(userId), [userId]);

  // Navigate date backwards/forwards for Day, Week, Month
  const handlePrevDate = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (selectedPeriod === 'day') {
        d.setDate(d.getDate() - 1);
      } else if (selectedPeriod === 'week') {
        d.setDate(d.getDate() - 7);
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  };

  const handleNextDate = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (selectedPeriod === 'day') {
        d.setDate(d.getDate() + 1);
      } else if (selectedPeriod === 'week') {
        d.setDate(d.getDate() + 7);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Helper to determine the local time range and formatted strings for the period
  const periodInfo = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = currentDate.getDate();

    if (selectedPeriod === 'day') {
      const start = new Date(year, month, date, 0, 0, 0, 0);
      const end = new Date(year, month, date, 23, 59, 59, 999);
      const targetDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

      const today = new Date();
      const isToday =
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === date;

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday =
        yesterday.getFullYear() === year &&
        yesterday.getMonth() === month &&
        yesterday.getDate() === date;

      const formatter = new Intl.DateTimeFormat('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const formatted = formatter.format(currentDate);

      const titleUk = isToday
        ? `Сьогодні, ${formatted}`
        : isYesterday
        ? `Вчора, ${formatted}`
        : formatted;

      return {
        type: 'day' as const,
        start,
        end,
        targetDayStr,
        titleUk,
        isCurrent: isToday,
      };
    }

    if (selectedPeriod === 'week') {
      const dayOfWeek = currentDate.getDay();
      const diffToMonday = (dayOfWeek + 6) % 7;
      const monday = new Date(year, month, date - diffToMonday, 0, 0, 0, 0);
      const sunday = new Date(year, month, date - diffToMonday + 6, 23, 59, 59, 999);

      const mY = monday.getFullYear();
      const mM = String(monday.getMonth() + 1).padStart(2, '0');
      const mD = String(monday.getDate()).padStart(2, '0');
      const weekStartStr = `${mY}-${mM}-${mD}`;

      const sY = sunday.getFullYear();
      const sM = String(sunday.getMonth() + 1).padStart(2, '0');
      const sD = String(sunday.getDate()).padStart(2, '0');
      const weekEndStr = `${sY}-${sM}-${sD}`;

      const now = new Date();
      const isCurrentWeek = now >= monday && now <= sunday;

      const f = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' });
      const titleUk = `${f.format(monday)} — ${f.format(sunday)} ${sunday.getFullYear()}`;

      return {
        type: 'week' as const,
        start: monday,
        end: sunday,
        weekStartStr,
        weekEndStr,
        titleUk,
        isCurrent: isCurrentWeek,
      };
    }

    // Month
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = new Date(year, month, lastDay, 23, 59, 59, 999);
    const targetMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;

    const f = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' });
    const formatted = f.format(currentDate);
    const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);

    return {
      type: 'month' as const,
      start,
      end,
      targetMonthStr,
      titleUk: capitalized,
      isCurrent: isCurrentMonth,
    };
  }, [selectedPeriod, currentDate]);

  // Compute stats filtered strictly by selected period & workout date
  const stats = useMemo(() => {
    let periodVolumeKg = 0;
    let periodCompletedSets = 0;
    const periodWorkoutsSet = new Set<string>();
    const muscleSetsMap: Record<string, number> = {};

    const exerciseMaxMap: Record<
      string,
      { id: string; name: string; maxWeight: number; reps: number; muscle: MuscleGroup; exercise: Exercise }
    > = {};

    workouts.forEach((w) => {
      // Determine workout date in YYYY-MM-DD
      const workoutDateStr =
        w.scheduledDate ||
        (w.completedAt ? w.completedAt.split('T')[0] : '') ||
        (w.createdAt ? w.createdAt.split('T')[0] : '');

      if (!workoutDateStr) return;

      // Filter workout by period
      let workoutInPeriod = false;
      if (periodInfo.type === 'day') {
        workoutInPeriod = workoutDateStr === periodInfo.targetDayStr;
      } else if (periodInfo.type === 'week') {
        workoutInPeriod =
          workoutDateStr >= periodInfo.weekStartStr &&
          workoutDateStr <= periodInfo.weekEndStr;
      } else if (periodInfo.type === 'month') {
        workoutInPeriod = workoutDateStr.startsWith(periodInfo.targetMonthStr);
      }

      if (!workoutInPeriod) return;

      let workoutHasPeriodActivity = false;

      (w.exercises || []).forEach((we) => {
        const ex = StorageService.getExerciseById(we.exerciseId);
        const muscle = ex?.muscleGroup || we.muscleGroup || 'full_body';

        (we.sets || []).forEach((s) => {
          const isSetDone = Boolean(s.completedAt) || w.status === 'completed';
          const reps = s.actualReps !== null && s.actualReps !== undefined ? s.actualReps : 0;
          const weight = s.weight !== null && s.weight !== undefined ? s.weight : 0;

          if (isSetDone && reps > 0) {
            const vol = weight * reps;
            periodVolumeKg += vol;
            periodCompletedSets += 1;
            workoutHasPeriodActivity = true;

            muscleSetsMap[muscle] = (muscleSetsMap[muscle] || 0) + 1;

            if (ex && weight > 0) {
              const currentEx = exerciseMaxMap[ex.id];
              if (!currentEx || weight > currentEx.maxWeight || (weight === currentEx.maxWeight && reps > currentEx.reps)) {
                exerciseMaxMap[ex.id] = {
                  id: ex.id,
                  name: ex.name,
                  maxWeight: weight,
                  reps,
                  muscle,
                  exercise: ex,
                };
              }
            }
          }
        });
      });

      if (workoutHasPeriodActivity || w.status === 'completed') {
        periodWorkoutsSet.add(w.id);
      }
    });

    const allTracked = Object.values(exerciseMaxMap).sort((a, b) => b.maxWeight - a.maxWeight);
    const topPRs = allTracked.slice(0, 8);

    return {
      periodVolumeKg,
      periodTons: Math.round((periodVolumeKg / 1000) * 10) / 10,
      periodCompletedSets,
      periodWorkoutsCount: periodWorkoutsSet.size,
      muscleSetsMap,
      allTrackedExercises: allTracked,
      topPRs,
    };
  }, [workouts, periodInfo]);

  const displayedExercises = useMemo(() => {
    let list = viewMode === 'prs' ? stats.topPRs : stats.allTrackedExercises;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = stats.allTrackedExercises.filter((e) => e.name.toLowerCase().includes(q));
    }
    return list;
  }, [stats, viewMode, searchQuery]);

  return (
    <div
      ref={analyticsSwipeRef}
      className="space-y-5 max-w-5xl mx-auto animate-fade-in pb-12 touch-pan-y"
    >
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Аналітика
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Кількість завершених підходів за м'язовими групами та динаміка навантаження
          </p>
        </div>

        {/* Period Filter (Flat Segmented Control) */}
        <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-0.5 shrink-0 self-start sm:self-auto">
          {(
            [
              { key: 'day', label: 'День' },
              { key: 'week', label: 'Тиждень' },
              { key: 'month', label: 'Місяць' },
            ] as const
          ).map((p) => {
            const isActive = selectedPeriod === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setSelectedPeriod(p.key);
                  setCurrentDate(new Date());
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Navigation Bar (Allows switching days, weeks, months) */}
      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 shadow-2xs">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handlePrevDate}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Попередній період"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNextDate}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Наступний період"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-zinc-400" />
          <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {periodInfo.titleUk}
          </span>
        </div>

        {!periodInfo.isCurrent ? (
          <button
            type="button"
            onClick={handleToday}
            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded cursor-pointer"
          >
            Сьогодні
          </button>
        ) : (
          <div className="w-14" />
        )}
      </div>

      {/* KPI Metrics Cards - Minimal Flat */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Completed Sets */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">
            <CheckCircle2 className="h-4 w-4" />
            <span>Завершено підходів</span>
          </div>
          <div className="font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {stats.periodCompletedSets}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            за {periodInfo.titleUk}
          </div>
        </div>

        {/* Workouts in Period */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">
            <Calendar className="h-4 w-4" />
            <span>Активних тренувань</span>
          </div>
          <div className="font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {stats.periodWorkoutsCount}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            у поточному періоді
          </div>
        </div>

        {/* Volume in Period */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1.5">
            <Flame className="h-4 w-4" />
            <span>Тоннаж періоду</span>
          </div>
          <div className="font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {stats.periodTons > 0 ? `${stats.periodTons} т` : `${stats.periodVolumeKg} кг`}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
            {stats.periodVolumeKg.toLocaleString()} кг піднято
          </div>
        </div>

        {/* Exercises Tracked */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1.5">
            <Trophy className="h-4 w-4" />
            <span>Задіяних вправ</span>
          </div>
          <div className="font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {stats.allTrackedExercises.length}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            з результатами у вибірці
          </div>
        </div>
      </div>

      {/* Muscle Group Distribution */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              <span>Кількість завершених підходів на м'язову групу</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Враховуються лише успішно виконані підходи за обраний період ({periodInfo.titleUk})
            </p>
          </div>

          <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 font-mono">
            Всього: <strong className="text-zinc-900 dark:text-zinc-100">{stats.periodCompletedSets}</strong> підх.
          </div>
        </div>

        {stats.periodCompletedSets === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 mx-auto">
              <Layers className="h-5 w-5" />
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
              За обраний період ({periodInfo.titleUk}) немає зафіксованих підходів.
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 max-w-md mx-auto">
              Завершуйте підходи у тренуваннях натисканням галочки ✓, і дані про навантаження відобразяться тут.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((groupKey) => {
              const info = MUSCLE_GROUPS[groupKey];
              const setsCount = stats.muscleSetsMap[groupKey] || 0;
              const percent =
                stats.periodCompletedSets > 0
                  ? (setsCount / stats.periodCompletedSets) * 100
                  : 0;

              if (setsCount === 0) return null;

              return (
                <div key={groupKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{info.nameUk}</span>
                    </div>
                    <div className="font-mono text-xs flex items-center space-x-2">
                      <span className="text-zinc-700 dark:text-zinc-300 font-bold">
                        {setsCount}{' '}
                        {setsCount === 1
                          ? 'підхід'
                          : setsCount >= 2 && setsCount <= 4
                            ? 'підходи'
                            : 'підходів'}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400">({Math.round(percent)}%)</span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-300"
                      style={{ width: `${Math.max(3, percent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Personal Records & Tracked Exercises */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center space-x-2">
            <Trophy className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              Вправи періоду та рекорди
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('prs')}
                className={`rounded px-2.5 py-1 font-semibold transition-colors cursor-pointer ${viewMode === 'prs' && !searchQuery
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
              >
                Топ ({stats.topPRs.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`rounded px-2.5 py-1 font-semibold transition-colors cursor-pointer ${viewMode === 'all' && !searchQuery
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
              >
                Всі ({stats.allTrackedExercises.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Пошук вправи..."
                className="w-36 sm:w-44 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 pl-8 pr-2.5 text-base sm:text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>
          </div>
        </div>

        {displayedExercises.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center text-xs text-zinc-500">
            {searchQuery
              ? 'Вправ за цим запитом не знайдено.'
              : `У періоді «${periodInfo.titleUk}» ще немає зафіксованих підходів із вагою.`}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {displayedExercises.map((pr, idx) => {
              const muscle = MUSCLE_GROUPS[pr.muscle] || MUSCLE_GROUPS.full_body;
              return (
                <div
                  key={pr.id || idx}
                  onClick={() => setSelectedExercise(pr.exercise)}
                  className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-3 flex flex-col justify-between cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                  title="Натисніть для перегляду динаміки та історії цієї вправи"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                        {muscle.nameUk}
                      </span>
                      <span className="font-mono text-xs text-zinc-400">#{idx + 1}</span>
                    </div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white line-clamp-1 mb-2 transition-colors">
                      {pr.name}
                    </div>
                  </div>

                  <div>
                    <div className="border-t border-zinc-200 dark:border-zinc-800/80 pt-2 flex items-baseline justify-between font-mono">
                      <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {pr.maxWeight} кг
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">× {pr.reps} повт</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-end text-[10px] font-medium text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                      <span>Історія</span>
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
