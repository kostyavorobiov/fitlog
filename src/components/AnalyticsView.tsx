import React, { useMemo, useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { CloudStorageService } from '../services/cloudStorageService';
import { MuscleGroup, Exercise, WorkoutPlan } from '../types/workout';
import { ExerciseHistoryModal } from './ExerciseHistoryModal';
import {
  Trophy,
  Flame,
  Calendar,
  Layers,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  Dumbbell,
  X,
} from 'lucide-react';
import { useSwipeGesture } from '../utils/useSwipeGesture';

export type AnalyticsPeriod = 'day' | 'week' | 'month';

export interface AggregatedExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  completedSetsCount: number;
  totalVolumeKg: number;
  maxWeight: number;
  repsAtMaxWeight: number;
}

export interface MuscleGroupStats {
  groupKey: MuscleGroup;
  nameUk: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  setsCount: number;
  percentage: number;
}

export interface AnalyticsResult {
  periodVolumeKg: number;
  periodTons: number;
  periodCompletedSets: number;
  workoutsCount: number;
  muscleList: MuscleGroupStats[];
  exercisesList: AggregatedExercise[];
}

export const UKRAINIAN_MONTHS = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];

export const UKRAINIAN_MONTHS_GENITIVE = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];

export const UKRAINIAN_WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

export const UKRAINIAN_WEEKDAYS_FULL = [
  'Неділя',
  'Понеділок',
  'Вівторок',
  'Середа',
  'Четвер',
  'П’ятниця',
  'Субота',
];

export const MUSCLE_CONFIG: Record<
  string,
  { nameUk: string; color: string; badgeBg: string; badgeBorder: string }
> = {
  back: {
    nameUk: 'Спина',
    color: '#818cf8',
    badgeBg: 'rgba(99, 102, 241, 0.1)',
    badgeBorder: 'rgba(99, 102, 241, 0.3)',
  },
  legs: {
    nameUk: 'Ноги',
    color: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.1)',
    badgeBorder: 'rgba(245, 158, 11, 0.3)',
  },
  chest: {
    nameUk: 'Грудні',
    color: '#fb7185',
    badgeBg: 'rgba(244, 63, 94, 0.1)',
    badgeBorder: 'rgba(244, 63, 94, 0.3)',
  },
  biceps: {
    nameUk: 'Біцепс',
    color: '#34d399',
    badgeBg: 'rgba(16, 185, 129, 0.1)',
    badgeBorder: 'rgba(16, 185, 129, 0.3)',
  },
  triceps: {
    nameUk: 'Тріцепс',
    color: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.1)',
    badgeBorder: 'rgba(56, 189, 248, 0.3)',
  },
  shoulders: {
    nameUk: 'Плечі',
    color: '#22d3ee',
    badgeBg: 'rgba(6, 182, 212, 0.1)',
    badgeBorder: 'rgba(6, 182, 212, 0.3)',
  },
  full_body: {
    nameUk: 'Все тіло',
    color: '#a855f7',
    badgeBg: 'rgba(168, 85, 247, 0.1)',
    badgeBorder: 'rgba(168, 85, 247, 0.3)',
  },
  other: {
    nameUk: 'Інше',
    color: '#94a3b8',
    badgeBg: 'rgba(148, 163, 184, 0.1)',
    badgeBorder: 'rgba(148, 163, 184, 0.3)',
  },
};

export const formatLocalDate = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatUkFullDate = (dateStr: string): string => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dt = new Date(y, m - 1, d);
    const dayOfWeek = UKRAINIAN_WEEKDAYS_FULL[dt.getDay()];
    const monthName = UKRAINIAN_MONTHS_GENITIVE[m - 1];
    return `${d} ${monthName} ${y}, ${dayOfWeek}`;
  } catch {
    return dateStr;
  }
};

export interface PeriodRange {
  type: 'day' | 'week' | 'month';
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string;   // YYYY-MM-DD
  titleUk: string;
  isCurrent: boolean;
}

export const getPeriodRange = (
  period: 'day' | 'week' | 'month',
  currentDate: Date = new Date()
): PeriodRange => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const date = currentDate.getDate();
  const today = new Date();
  const todayStr = formatLocalDate(today);

  if (period === 'day') {
    const targetDayStr = formatLocalDate(currentDate);
    const isToday = targetDayStr === todayStr;

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = targetDayStr === formatLocalDate(yesterday);

    const fullUk = formatUkFullDate(targetDayStr);
    const titleUk = isToday ? `Сьогодні, ${fullUk}` : isYesterday ? `Вчора, ${fullUk}` : fullUk;

    return {
      type: 'day',
      startDateStr: targetDayStr,
      endDateStr: targetDayStr,
      titleUk,
      isCurrent: isToday,
    };
  }

  if (period === 'week') {
    const dayOfWeek = currentDate.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const diffToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(year, month, date - diffToMonday);
    const sunday = new Date(year, month, date - diffToMonday + 6);

    const weekStartStr = formatLocalDate(monday);
    const weekEndStr = formatLocalDate(sunday);

    const now = new Date();
    const isCurrentWeek = now >= monday && now <= sunday;

    const mD = monday.getDate();
    const sD = sunday.getDate();
    const mM = UKRAINIAN_MONTHS_GENITIVE[monday.getMonth()].slice(0, 3);
    const sM = UKRAINIAN_MONTHS_GENITIVE[sunday.getMonth()].slice(0, 3);
    const sY = sunday.getFullYear();

    const titleUk =
      monday.getMonth() === sunday.getMonth()
        ? `${mD} — ${sD} ${sM} ${sY}`
        : `${mD} ${mM} — ${sD} ${sM} ${sY}`;

    return {
      type: 'week',
      startDateStr: weekStartStr,
      endDateStr: weekEndStr,
      titleUk,
      isCurrent: isCurrentWeek,
    };
  }

  // Month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEndStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const titleUk = `${UKRAINIAN_MONTHS[month]} ${year}`;

  return {
    type: 'month',
    startDateStr: monthStartStr,
    endDateStr: monthEndStr,
    titleUk,
    isCurrent: isCurrentMonth,
  };
};

export const formatSetsUnit = (count: number): string => {
  if (count === 1) return 'підхід';
  if (count >= 2 && count <= 4) return 'підходи';
  return 'підходів';
};

export const formatVolume = (kg: number): string => {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1)} т`;
  }
  return `${Math.round(kg)} кг`;
};

interface AnalyticsViewProps {
  userId: string;
  onSelectWorkout?: (workout: WorkoutPlan) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ userId, onSelectWorkout }) => {
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewTab, setViewTab] = useState<'muscles' | 'exercises'>('muscles');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // Month Calendar state
  const [calMonthDate, setCalMonthDate] = useState<Date>(() => new Date());
  const [selectedCalDateStr, setSelectedCalDateStr] = useState<string>(() => formatLocalDate(new Date()));

  const [workouts, setWorkouts] = useState<WorkoutPlan[]>(() => StorageService.getWorkouts(userId));

  useEffect(() => {
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

  // Calendar year/month
  const calYear = calMonthDate.getFullYear();
  const calMonth = calMonthDate.getMonth();
  const todayStr = formatLocalDate(new Date());

  const handlePrevCalMonth = () => {
    setCalMonthDate(new Date(calYear, calMonth - 1, 1));
  };

  const handleNextCalMonth = () => {
    setCalMonthDate(new Date(calYear, calMonth + 1, 1));
  };

  const handleCalJumpToToday = () => {
    const today = new Date();
    setCalMonthDate(today);
    setSelectedCalDateStr(todayStr);
    setCurrentDate(today);
    setPeriod('day');
  };

  // Calendar cells
  const firstDayOfMonth = new Date(calYear, calMonth, 1);
  const lastDayOfMonth = new Date(calYear, calMonth + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Monday first

  const calendarCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(day);
    }
    return cells;
  }, [startDayOfWeek, daysInMonth]);

  // Index workouts by scheduledDate for fast day lookup
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, WorkoutPlan[]>();
    workouts.forEach((w) => {
      const rawDateStr =
        w.scheduledDate ||
        (w.completedAt ? w.completedAt.split('T')[0] : '') ||
        (w.createdAt ? w.createdAt.split('T')[0] : '');
      if (!rawDateStr) return;
      const dateKey = rawDateStr.split('T')[0];
      const list = map.get(dateKey) || [];
      list.push(w);
      map.set(dateKey, list);
    });
    return map;
  }, [workouts]);

  // Period range calculation
  const periodRange = useMemo(() => {
    return getPeriodRange(period, currentDate);
  }, [period, currentDate]);

  // Navigate backward / forward for selected period
  const handlePrevPeriod = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (period === 'day') {
        d.setDate(d.getDate() - 1);
      } else if (period === 'week') {
        d.setDate(d.getDate() - 7);
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  };

  const handleNextPeriod = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (period === 'day') {
        d.setDate(d.getDate() + 1);
      } else if (period === 'week') {
        d.setDate(d.getDate() + 7);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  };

  const handleJumpToToday = () => {
    setCurrentDate(new Date());
  };

  // Swiping gestures
  const periods: AnalyticsPeriod[] = ['day', 'week', 'month'];
  const handleNextPeriodType = () => {
    const idx = periods.indexOf(period);
    if (idx < periods.length - 1) {
      setPeriod(periods[idx + 1]);
      setCurrentDate(new Date());
    }
  };
  const handlePrevPeriodType = () => {
    const idx = periods.indexOf(period);
    if (idx > 0) {
      setPeriod(periods[idx - 1]);
      setCurrentDate(new Date());
    }
  };

  const periodSwipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft: handleNextPeriodType,
    onSwipeRight: handlePrevPeriodType,
    threshold: 25,
    disabled: Boolean(selectedExercise),
  });

  const dateNavSwipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft: handleNextPeriod,
    onSwipeRight: handlePrevPeriod,
    threshold: 30,
    disabled: Boolean(selectedExercise),
  });

  const tabSwipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft: () => setViewTab('exercises'),
    onSwipeRight: () => setViewTab('muscles'),
    threshold: 40,
    disabled: Boolean(selectedExercise) || Boolean(searchQuery.trim()),
  });

  // Calculate analytics strictly based on completed sets within calendar period range
  const analyticsData: AnalyticsResult = useMemo(() => {
    let periodVolumeKg = 0;
    let periodCompletedSets = 0;
    const workoutsWithCompletedSets = new Set<string>();
    const muscleSetsMap: Record<string, number> = {};
    const exerciseAggMap: Record<string, AggregatedExercise> = {};

    workouts.forEach((w) => {
      const rawDateStr =
        w.scheduledDate ||
        (w.completedAt ? w.completedAt.split('T')[0] : '') ||
        (w.createdAt ? w.createdAt.split('T')[0] : '');

      if (!rawDateStr) return;
      const workoutDateStr = rawDateStr.split('T')[0];

      // Filter by calendar period boundaries [startDateStr, endDateStr]
      const inPeriod =
        workoutDateStr >= periodRange.startDateStr &&
        workoutDateStr <= periodRange.endDateStr;

      if (!inPeriod) return;

      let workoutHasCompletedSets = false;

      (w.exercises || []).forEach((we) => {
        let rawMuscle = (we.muscleGroup || 'other').toLowerCase() as MuscleGroup;
        const muscle: MuscleGroup = MUSCLE_CONFIG[rawMuscle] ? rawMuscle : 'other';

        const exKey =
          we.exerciseId ||
          (we.exerciseName ? we.exerciseName.trim().toLowerCase() : 'unknown');

        if (!exerciseAggMap[exKey]) {
          exerciseAggMap[exKey] = {
            exerciseId: we.exerciseId || exKey,
            exerciseName: we.exerciseName || 'Вправа',
            muscleGroup: muscle,
            completedSetsCount: 0,
            totalVolumeKg: 0,
            maxWeight: 0,
            repsAtMaxWeight: 0,
          };
        }

        (we.sets || []).forEach((s) => {
          const isDone =
            (s.completedAt !== null && s.completedAt !== undefined && String(s.completedAt).trim() !== '') ||
            w.status === 'completed';

          if (!isDone) return;

          periodCompletedSets += 1;
          workoutHasCompletedSets = true;
          muscleSetsMap[muscle] = (muscleSetsMap[muscle] || 0) + 1;

          exerciseAggMap[exKey].completedSetsCount += 1;

          const weight = Number(s.weight) || 0;
          const reps = s.actualReps !== null && s.actualReps !== undefined ? Number(s.actualReps) : 0;

          if (weight > 0 && reps > 0) {
            const vol = weight * reps;
            periodVolumeKg += vol;
            exerciseAggMap[exKey].totalVolumeKg += vol;
          }

          if (
            weight > exerciseAggMap[exKey].maxWeight ||
            (weight === exerciseAggMap[exKey].maxWeight && reps > exerciseAggMap[exKey].repsAtMaxWeight)
          ) {
            exerciseAggMap[exKey].maxWeight = weight;
            exerciseAggMap[exKey].repsAtMaxWeight = reps;
          }
        });
      });

      if (workoutHasCompletedSets || w.status === 'completed') {
        workoutsWithCompletedSets.add(w.id);
      }
    });

    // Muscle groups distribution sorted descending by completed sets
    const muscleList: MuscleGroupStats[] = (Object.keys(MUSCLE_CONFIG) as MuscleGroup[])
      .map((groupKey) => {
        const info = MUSCLE_CONFIG[groupKey];
        const setsCount = muscleSetsMap[groupKey] || 0;
        const percentage =
          periodCompletedSets > 0 ? Math.round((setsCount / periodCompletedSets) * 100) : 0;
        return {
          groupKey,
          nameUk: info.nameUk,
          color: info.color,
          badgeBg: info.badgeBg,
          badgeBorder: info.badgeBorder,
          setsCount,
          percentage,
        };
      })
      .filter((m) => m.setsCount > 0)
      .sort((a, b) => b.setsCount - a.setsCount);

    // Aggregated exercises sorted descending by completed sets
    const exercisesList = Object.values(exerciseAggMap)
      .filter((e) => e.completedSetsCount > 0)
      .sort((a, b) => b.completedSetsCount - a.completedSetsCount);

    return {
      periodVolumeKg,
      periodTons: Math.round((periodVolumeKg / 1000) * 10) / 10,
      periodCompletedSets,
      workoutsCount: workoutsWithCompletedSets.size,
      muscleList,
      exercisesList,
    };
  }, [workouts, periodRange]);

  // Filtered exercises for search
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return analyticsData.exercisesList;
    const q = searchQuery.trim().toLowerCase();
    return analyticsData.exercisesList.filter((e) =>
      e.exerciseName.toLowerCase().includes(q)
    );
  }, [analyticsData.exercisesList, searchQuery]);

  // Handle clicking an aggregated exercise to view details
  const handleOpenExerciseModal = (item: AggregatedExercise) => {
    const existing = StorageService.getExerciseById(item.exerciseId);
    if (existing) {
      setSelectedExercise(existing);
    } else {
      setSelectedExercise({
        id: item.exerciseId,
        userId: null,
        name: item.exerciseName,
        muscleGroup: item.muscleGroup,
        createdAt: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3.5 pb-24 md:pb-12 text-[#0f172a] dark:text-[#f8fafc]">
      {/* 1. Header with Segmented Period Switcher (День | Тиждень | Місяць) */}
      <div
        ref={periodSwipeRef}
        className="sticky top-0 z-30 bg-[#f8fafc]/90 dark:bg-[#0b1220]/90 backdrop-blur-xl pt-2 pb-2 flex items-center justify-between gap-2 border-b border-[#e2e8f0]/60 dark:border-[#334155]/60 md:border-b-0 touch-pan-y"
      >
        <h1 className="text-[26px] font-bold tracking-tight text-[#0f172a] dark:text-[#f8fafc] truncate">
          Аналітика
        </h1>

        {/* Period Switcher */}
        <div className="flex items-center p-0.5 sm:p-1 rounded-2xl bg-[#f1f5f9] dark:bg-[#263140] border border-[#e2e8f0] dark:border-[#334155] gap-0.5 sm:gap-1 shrink-0">
          {(
            [
              { key: 'day', label: 'День' },
              { key: 'week', label: 'Тиждень' },
              { key: 'month', label: 'Місяць' },
            ] as const
          ).map((p) => {
            const isActive = period === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPeriod(p.key);
                  setCurrentDate(new Date());
                }}
                className={`py-1.5 px-2.5 sm:px-3 text-center text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-[#1d2939] text-[#2563eb] dark:text-[#60a5fa] font-bold shadow-xs'
                    : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Interactive Month Calendar with workout dots at the top of Analytics */}
      <div className="rounded-2xl sm:rounded-3xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-3.5 sm:p-4 space-y-3 shadow-xs">
        {/* Month Navigation & Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <button
              type="button"
              onClick={handlePrevCalMonth}
              className="w-8 h-8 rounded-xl bg-[#f1f5f9] dark:bg-[#263140] border border-[#e2e8f0] dark:border-[#334155] flex items-center justify-center text-[#0f172a] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#334155] transition-colors cursor-pointer"
              title="Попередній місяць"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-sm sm:text-base font-bold text-[#0f172a] dark:text-[#f8fafc] min-w-[130px] sm:min-w-[150px] text-center select-none">
              {UKRAINIAN_MONTHS[calMonth]} {calYear}
            </span>

            <button
              type="button"
              onClick={handleNextCalMonth}
              className="w-8 h-8 rounded-xl bg-[#f1f5f9] dark:bg-[#263140] border border-[#e2e8f0] dark:border-[#334155] flex items-center justify-center text-[#0f172a] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#334155] transition-colors cursor-pointer"
              title="Наступний місяць"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCalJumpToToday}
            className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-[#2563eb]/10 dark:bg-[#2563eb]/20 text-[#2563eb] dark:text-[#60a5fa] border border-[#2563eb]/20 dark:border-[#334155] hover:bg-[#2563eb]/20 transition-colors cursor-pointer"
          >
            Сьогодні
          </button>
        </div>

        {/* Weekdays Row (Mon-Fri slate, Sat-Sun red) */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] sm:text-xs text-[#64748b] dark:text-[#94a3b8] pb-1.5 border-b border-[#e2e8f0] dark:border-[#334155]/60">
          {UKRAINIAN_WEEKDAYS_SHORT.map((day, idx) => (
            <div
              key={day}
              className={idx >= 5 ? 'text-[#ef4444] dark:text-[#ef4444]' : ''}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {calendarCells.map((dayNum, idx) => {
            if (dayNum === null) {
              return <div key={`empty_${idx}`} className="h-11 sm:h-12" />;
            }

            const cellDateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isSelected = selectedCalDateStr === cellDateStr;
            const isToday = todayStr === cellDateStr;
            const dayWorkouts = workoutsByDate.get(cellDateStr) || [];
            const hasWorkouts = dayWorkouts.length > 0;
            const allDone = hasWorkouts && dayWorkouts.every((w) => w.status === 'completed');
            const hasInProgress = hasWorkouts && dayWorkouts.some((w) => w.status === 'in_progress');

            return (
              <button
                key={`day_${dayNum}`}
                type="button"
                onClick={() => {
                  setSelectedCalDateStr(cellDateStr);
                  const parts = cellDateStr.split('-').map(Number);
                  if (parts.length === 3) {
                    setCurrentDate(new Date(parts[0], parts[1] - 1, parts[2]));
                    setPeriod('day');
                  }
                }}
                className={`relative h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all select-none ${
                  isSelected
                    ? 'bg-[#2563eb] text-white font-bold shadow-xs'
                    : isToday
                    ? 'border border-[#2563eb]/50 bg-blue-50/40 dark:bg-blue-900/10'
                    : 'hover:bg-[#f1f5f9] dark:hover:bg-[#263140]/60'
                }`}
              >
                <span
                  className={`text-sm font-bold leading-tight ${
                    isSelected
                      ? 'text-white'
                      : isToday
                      ? 'text-[#2563eb] dark:text-[#60a5fa]'
                      : hasWorkouts
                      ? 'text-[#0f172a] dark:text-[#f8fafc]'
                      : 'text-[#94a3b8] dark:text-[#475569]'
                  }`}
                >
                  {dayNum}
                </span>

                {/* Workout Indicator Dot */}
                <div className="h-2 flex items-center justify-center">
                  {hasWorkouts && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected
                          ? 'bg-white'
                          : allDone
                          ? 'bg-[#22c55e]'
                          : hasInProgress
                          ? 'bg-[#3b82f6]'
                          : 'bg-[#94a3b8]'
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Date Workouts Quick Link */}
        {workoutsByDate.get(selectedCalDateStr) && (workoutsByDate.get(selectedCalDateStr)?.length || 0) > 0 && (
          <div className="pt-2 border-t border-[#e2e8f0] dark:border-[#334155]/60 flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8]">
              Тренування на цей день:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(workoutsByDate.get(selectedCalDateStr) || []).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onSelectWorkout?.(w)}
                  className="px-2.5 py-1 rounded-lg bg-[#f1f5f9] dark:bg-[#263140] hover:border-[#2563eb] text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] flex items-center gap-1.5 border border-[#e2e8f0] dark:border-[#334155] cursor-pointer transition-colors"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      w.status === 'completed'
                        ? 'bg-[#22c55e]'
                        : w.status === 'in_progress'
                        ? 'bg-[#3b82f6]'
                        : 'bg-[#94a3b8]'
                    }`}
                  />
                  <span>{w.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Date Navigation Bar (Allows browsing previous/next day, week, month) */}
      <div
        ref={dateNavSwipeRef}
        className="rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-3 shadow-xs flex items-center justify-between gap-2 touch-pan-y"
      >
        <button
          type="button"
          onClick={handlePrevPeriod}
          className="w-8 h-8 rounded-xl bg-[#f1f5f9] dark:bg-[#263140] border border-[#e2e8f0] dark:border-[#334155] flex items-center justify-center text-[#0f172a] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#334155] transition-colors cursor-pointer shrink-0"
          title="Попередній період"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa] shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-[#0f172a] dark:text-[#f8fafc] truncate">
              {periodRange.titleUk}
            </span>
          </div>
          <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
            {period === 'day'
              ? 'Календарний день'
              : period === 'week'
              ? 'Календарний тиждень'
              : 'Календарний місяць'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleNextPeriod}
            className="w-8 h-8 rounded-xl bg-[#f1f5f9] dark:bg-[#263140] border border-[#e2e8f0] dark:border-[#334155] flex items-center justify-center text-[#0f172a] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#334155] transition-colors cursor-pointer"
            title="Наступний період"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!periodRange.isCurrent && (
            <button
              type="button"
              onClick={handleJumpToToday}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-xl bg-[#2563eb]/10 dark:bg-[#2563eb]/20 text-[#2563eb] dark:text-[#60a5fa] border border-[#2563eb]/20 dark:border-[#334155] hover:bg-[#2563eb]/20 transition-colors cursor-pointer"
            >
              Сьогодні
            </button>
          )}
        </div>
      </div>

      {/* 4. KPI Metrics Cards (2x2 Grid matching mobile screenshot) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* Completed Sets */}
        <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-3 sm:p-3.5 space-y-1 shadow-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
              ПІДХОДИ
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0f172a] dark:text-[#f8fafc] tracking-tight">
            {analyticsData.periodCompletedSets}
          </div>
          <div className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
            виконано
          </div>
        </div>

        {/* Active Workouts */}
        <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-3 sm:p-3.5 space-y-1 shadow-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Dumbbell className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
              ТРЕНУВАННЯ
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0f172a] dark:text-[#f8fafc] tracking-tight">
            {analyticsData.workoutsCount}
          </div>
          <div className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
            активних
          </div>
        </div>

        {/* Total Volume */}
        <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-3 sm:p-3.5 space-y-1 shadow-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Flame className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
              ТОННАЖ
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0f172a] dark:text-[#f8fafc] tracking-tight">
            {analyticsData.periodTons > 0
              ? `${analyticsData.periodTons} т`
              : formatVolume(analyticsData.periodVolumeKg)}
          </div>
          <div className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
            піднято
          </div>
        </div>

        {/* Tracked Exercises */}
        <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-3 sm:p-3.5 space-y-1 shadow-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Trophy className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
              ВПРАВИ
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-[#0f172a] dark:text-[#f8fafc] tracking-tight">
            {analyticsData.exercisesList.length}
          </div>
          <div className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
            задіяно
          </div>
        </div>
      </div>

      {/* 5. Empty State or Breakdown Section */}
      {analyticsData.periodCompletedSets === 0 ? (
        <div className="w-full rounded-[24px] border border-dashed border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] py-12 px-6 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-[#f1f5f9] dark:bg-[#263140] flex items-center justify-center">
            <Layers className="w-6 h-6 text-[#94a3b8] dark:text-[#94a3b8]" />
          </div>
          <h4 className="mt-4 font-bold text-base text-[#0f172a] dark:text-[#f8fafc]">
            За обраний період немає завершених підходів
          </h4>
          <p className="mt-2 text-xs text-[#64748b] dark:text-[#94a3b8] max-w-xs leading-relaxed">
            Враховуються лише успішно виконані підходи (відмічені галочкою ✓) у запланованих тренуваннях за цей календарний період.
          </p>
        </div>
      ) : (
        <div ref={tabSwipeRef} className="space-y-3.5 touch-pan-y">
          {/* Section View Switcher (Групи м'язів | Вправи) */}
          <div className="w-full bg-[#f1f5f9] dark:bg-[#263140] p-1 rounded-2xl flex items-center gap-1 border border-[#e2e8f0] dark:border-[#334155]">
            <button
              type="button"
              onClick={() => setViewTab('muscles')}
              className={`flex-1 py-2 px-3 text-center text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                viewTab === 'muscles'
                  ? 'bg-white dark:bg-[#1d2939] text-[#2563eb] dark:text-[#60a5fa] font-bold shadow-xs'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
              }`}
            >
              Групи м'язів ({analyticsData.muscleList.length})
            </button>

            <button
              type="button"
              onClick={() => setViewTab('exercises')}
              className={`flex-1 py-2 px-3 text-center text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                viewTab === 'exercises'
                  ? 'bg-white dark:bg-[#1d2939] text-[#2563eb] dark:text-[#60a5fa] font-bold shadow-xs'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
              }`}
            >
              Вправи ({analyticsData.exercisesList.length})
            </button>
          </div>

          {/* View Tab 1: Muscle Groups Distribution */}
          {viewTab === 'muscles' ? (
            <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-4 sm:p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-[#334155]/60">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0f172a] dark:text-[#f8fafc]">
                    Розподіл за групами м’язів
                  </h3>
                  <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                    Кількість виконаних підходів за період
                  </p>
                </div>

                <div className="px-2.5 py-1 rounded-lg bg-[#2563eb]/10 dark:bg-[#2563eb]/20 text-[#2563eb] dark:text-[#60a5fa] text-xs font-bold font-mono">
                  {analyticsData.periodCompletedSets} підх.
                </div>
              </div>

              <div className="space-y-3">
                {analyticsData.muscleList.map((m) => (
                  <div key={m.groupKey} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                          {m.nameUk}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-[#0f172a] dark:text-[#f8fafc] font-bold">
                          {m.setsCount}{' '}
                          <span className="font-normal text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                            {formatSetsUnit(m.setsCount)}
                          </span>
                        </span>
                        <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                          ({m.percentage}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar with specific muscle color */}
                    <div className="h-1.5 w-full rounded-full bg-[#f1f5f9] dark:bg-[#263140] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(5, m.percentage)}%`,
                          backgroundColor: m.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* View Tab 2: Exercises Breakdown */
            <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-4 sm:p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-[#334155]/60">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0f172a] dark:text-[#f8fafc]">
                    Агреговані вправи
                  </h3>
                  <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                    Підсумок виконаних підходів та ваг за період
                  </p>
                </div>
              </div>

              {/* Search input for exercises */}
              {analyticsData.exercisesList.length > 3 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Пошук вправи..."
                    className="w-full h-9 rounded-xl border border-[#e2e8f0] dark:border-[#334155] bg-[#f1f5f9] dark:bg-[#263140] pl-9 pr-8 text-xs text-[#0f172a] dark:text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                  />
                  {searchQuery.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Exercises List */}
              <div className="divide-y divide-[#e2e8f0] dark:divide-[#334155]/60">
                {filteredExercises.map((item) => {
                  const muscle = MUSCLE_CONFIG[item.muscleGroup] || MUSCLE_CONFIG.other;
                  return (
                    <div
                      key={item.exerciseId}
                      onClick={() => handleOpenExerciseModal(item)}
                      className="py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-[#f8fafc] dark:hover:bg-[#263140]/40 px-1 rounded-xl transition-colors"
                      title="Натисніть для перегляду історії цієї вправи"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-xs sm:text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc] truncate">
                          {item.exerciseName}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="px-1.5 py-0.5 rounded-lg text-[9px] font-semibold border"
                            style={{
                              backgroundColor: muscle.badgeBg,
                              borderColor: muscle.badgeBorder,
                              color: muscle.color,
                            }}
                          >
                            {muscle.nameUk}
                          </span>
                          {item.maxWeight > 0 && (
                            <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                              Макс:{' '}
                              <strong className="text-[#0f172a] dark:text-[#f8fafc]">
                                {item.maxWeight} кг
                              </strong>
                              {item.repsAtMaxWeight > 0 ? ` × ${item.repsAtMaxWeight}` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 min-w-[55px]">
                        <div className="text-sm sm:text-base font-extrabold text-[#0f172a] dark:text-[#f8fafc]">
                          {item.completedSetsCount}
                        </div>
                        <div className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                          {formatSetsUnit(item.completedSetsCount)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Exercise History Modal */}
      <ExerciseHistoryModal
        exercise={selectedExercise}
        userId={userId}
        isOpen={Boolean(selectedExercise)}
        onClose={() => setSelectedExercise(null)}
      />
    </div>
  );
};
