import React, { useState, useEffect } from 'react';
import { WorkoutPlan } from '../types/workout';
import { StorageService, generateId } from '../services/storageService';
import { CloudStorageService } from '../services/cloudStorageService';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { CreateWorkoutModal } from './CreateWorkoutModal';
import { MobileSwipeableWorkoutCard } from './MobileSwipeableWorkoutCard';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Layers,
  Clock,
} from 'lucide-react';
import { useSwipeGesture } from '../utils/useSwipeGesture';

interface WorkoutHistoryViewProps {
  userId: string;
  onSelectWorkout: (workout: WorkoutPlan) => void;
  onCreateNew?: () => void;
  onCreateWorkout?: (title: string, scheduledDate: string) => void;
  onDeleteWorkout?: (workoutId: string) => void;
}

export const WorkoutHistoryView: React.FC<WorkoutHistoryViewProps> = ({
  userId,
  onSelectWorkout,
  onCreateNew,
  onCreateWorkout,
  onDeleteWorkout,
}) => {
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedCalendarDateStr, setSelectedCalendarDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState<WorkoutPlan | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
  };

  const handlePrevDay = () => {
    try {
      const [y, m, d] = selectedCalendarDateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() - 1);
      const newY = dt.getFullYear();
      const newM = String(dt.getMonth() + 1).padStart(2, '0');
      const newD = String(dt.getDate()).padStart(2, '0');
      const newStr = `${newY}-${newM}-${newD}`;
      setSelectedCalendarDateStr(newStr);
      if (dt.getMonth() !== currentCalendarDate.getMonth() || dt.getFullYear() !== currentCalendarDate.getFullYear()) {
        setCurrentCalendarDate(new Date(dt.getFullYear(), dt.getMonth(), 1));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleNextDay = () => {
    try {
      const [y, m, d] = selectedCalendarDateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + 1);
      const newY = dt.getFullYear();
      const newM = String(dt.getMonth() + 1).padStart(2, '0');
      const newD = String(dt.getDate()).padStart(2, '0');
      const newStr = `${newY}-${newM}-${newD}`;
      setSelectedCalendarDateStr(newStr);
      if (dt.getMonth() !== currentCalendarDate.getMonth() || dt.getFullYear() !== currentCalendarDate.getFullYear()) {
        setCurrentCalendarDate(new Date(dt.getFullYear(), dt.getMonth(), 1));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const swipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft: handleNextMonth,
    onSwipeRight: handlePrevMonth,
    threshold: 30,
    disabled: isCreateModalOpen || Boolean(workoutToDelete),
  });

  const daySwipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft: handleNextDay,
    onSwipeRight: handlePrevDay,
    threshold: 30,
    disabled: isCreateModalOpen || Boolean(workoutToDelete),
  });

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
  }, [userId, reloadKey]);

  // Calendar Helpers (Ukrainian locale)
  const ukrainianMonths = [
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




  const handleToday = () => {
    const today = new Date();
    setCurrentCalendarDate(today);
    setSelectedCalendarDateStr(today.toISOString().split('T')[0]);
  };

  // Generate days for current month grid (Monday first)
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // 0 is Sunday in JS, so convert to Mon=0 ... Sun=6
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

  // Calendar cells array
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day);
  }

  // Workouts for the currently selected date
  const selectedDateWorkouts = workouts.filter(
    (w) => w.scheduledDate === selectedCalendarDateStr
  );

  const handleCreateForDate = (title: string, dateStr: string) => {
    if (onCreateWorkout) {
      onCreateWorkout(title, dateStr);
    } else {
      const newWorkout: WorkoutPlan = {
        id: generateId('workout'),
        userId,
        title: title.trim(),
        scheduledDate: dateStr,
        status: 'in_progress',
        completedAt: null,
        notes: '',
        createdAt: new Date().toISOString(),
        exercises: [],
      };
      StorageService.saveWorkout(newWorkout);
      onSelectWorkout(newWorkout);
    }
    setIsCreateModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!workoutToDelete) return;
    const id = workoutToDelete.id;
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
    StorageService.deleteWorkout(id);
    if (onDeleteWorkout) {
      onDeleteWorkout(id);
    }
    setWorkoutToDelete(null);
  };

  // Format date nicely for header (e.g. "26 вересня 2026")
  const formatUkDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return dateStr;
      const monthNamesGenitive = [
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
      return `${d} ${monthNamesGenitive[m - 1]} ${y}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto animate-fade-in pb-12" key={reloadKey}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Календар
          </h1>
        </div>

        {/* Add Workout Button */}
      </div>

      {/* CALENDAR CARD - Minimal Flat */}
      <div
        ref={swipeRef}
        className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-4 touch-pan-y"
      >
        {/* Month & Year Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Попередній місяць"
              aria-label="Попередній місяць"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 min-w-[150px] text-center select-none">
              {ukrainianMonths[month]} {year}
            </h3>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Наступний місяць"
              aria-label="Наступний місяць"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Сьогодні
          </button>
        </div>

        {/* Weekdays header */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] sm:text-xs text-zinc-400 dark:text-zinc-500 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <div>Пн</div>
          <div>Вт</div>
          <div>Ср</div>
          <div>Чт</div>
          <div>Пт</div>
          <div className="text-zinc-600 dark:text-zinc-400">Сб</div>
          <div className="text-zinc-600 dark:text-zinc-400">Нд</div>
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {calendarCells.map((dayNum, idx) => {
            if (dayNum === null) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="h-14 sm:h-20 rounded bg-transparent"
                />
              );
            }

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
              dayNum
            ).padStart(2, '0')}`;
            const isSelected = selectedCalendarDateStr === dateStr;
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const dayWorkouts = workouts.filter((w) => w.scheduledDate === dateStr);

            return (
              <div
                key={`day-${dayNum}`}
                onClick={() => setSelectedCalendarDateStr(dateStr)}
                className={`h-14 sm:h-20 rounded-lg border p-1 sm:p-1.5 cursor-pointer transition-colors flex flex-col justify-between ${isSelected
                  ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-900 dark:ring-zinc-100'
                  : isToday
                    ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900'
                    : dayWorkouts.length > 0
                      ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
                      : 'border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] sm:text-xs font-bold ${isSelected
                      ? 'text-zinc-950 dark:text-zinc-50'
                      : isToday
                        ? 'text-zinc-900 dark:text-zinc-100 font-extrabold'
                        : dayWorkouts.length > 0
                          ? 'text-zinc-800 dark:text-zinc-200'
                          : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                  >
                    {dayNum}
                  </span>
                  {isToday && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-amber-500"
                      title="Сьогодні"
                    />
                  )}
                </div>

                {/* Workout indicators */}
                <div className="space-y-0.5 overflow-hidden">
                  {dayWorkouts.slice(0, 2).map((dw) => {
                    const isDone = dw.status === 'completed';
                    return (
                      <div
                        key={dw.id}
                        className={`truncate rounded px-1 py-0.5 text-[8px] sm:text-[9px] font-semibold border ${isDone
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                          }`}
                        title={dw.title}
                      >
                        <span className="hidden sm:inline">{dw.title || 'Тренування'}</span>
                        <span className="sm:hidden">
                          {isDone ? '✓' : '•'} {dw.exercises?.length || 0}
                        </span>
                      </div>
                    );
                  })}
                  {dayWorkouts.length > 2 && (
                    <div className="text-[8px] text-zinc-400 font-mono text-center">
                      +{dayWorkouts.length - 2}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SELECTED DATE DETAILS & WORKOUTS */}
      <div
        ref={daySwipeRef}
        className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-3 touch-pan-y"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <div className="flex items-center space-x-1.5">
              <CalendarIcon className="h-4 w-4 text-zinc-500 shrink-0" />
              <button
                type="button"
                onClick={handlePrevDay}
                className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Попередній день"
                aria-label="Попередній день"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 select-none">
                {formatUkDate(selectedCalendarDateStr)}
              </h3>
              <button
                type="button"
                onClick={handleNextDay}
                className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Наступний день"
                aria-label="Наступний день"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onCreateWorkout) {
                onCreateWorkout('', selectedCalendarDateStr);
              } else {
                setIsCreateModalOpen(true);
              }
            }}
            className="inline-flex items-center justify-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3.5 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Додати тренування на цей день</span>
          </button>
        </div>

        {selectedDateWorkouts.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">
              На обрану дату немає тренувань.
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 max-w-sm mx-auto">
              Натисніть кнопку вище, щоб одразу скласти нову програму занять.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedDateWorkouts.map((w) => {
              const isDone = w.status === 'completed';
              const exercisesCount = w.exercises?.length || 0;
              const setsCount = (w.exercises || []).reduce(
                (acc, ex) => acc + (ex.sets?.length || 0),
                0
              );
              let totalVolume = 0;
              (w.exercises || []).forEach((ex) => {
                (ex.sets || []).forEach((s) => {
                  if (s.completedAt && s.weight && s.actualReps) {
                    totalVolume += s.weight * s.actualReps;
                  }
                });
              });

              return (
                <MobileSwipeableWorkoutCard
                  key={w.id}
                  workoutId={w.id}
                  onDelete={() => setWorkoutToDelete(w)}
                >
                  <div
                    onClick={() => onSelectWorkout(w)}
                    className="group cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors space-y-1.5"
                  >
                    {/* Row 1: Status · Date */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs min-w-0 flex-wrap">
                        <span
                          className={`font-semibold ${isDone
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : w.status === 'in_progress'
                              ? 'text-amber-500 dark:text-amber-400'
                              : 'text-zinc-500 dark:text-zinc-400'
                            }`}
                        >
                          {isDone ? 'Завершено' : w.status === 'in_progress' ? 'У процесі' : 'Заплановано'}
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700">·</span>
                        <span className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500 font-mono">
                          <CalendarIcon className="h-3 w-3 shrink-0" />
                          <span>{w.scheduledDate}</span>
                        </span>
                        {w.assignedByCoachId && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-700">·</span>
                            <span className="text-indigo-500 dark:text-indigo-400 font-medium">Від тренера</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Title */}
                    <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                      {w.title || 'Тренування без назви'}
                    </h4>

                    {/* Row 3: Stats */}
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{exercisesCount}</span>
                        <span>вправ</span>
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{setsCount}</span>
                        {' підходів'}
                      </span>
                      {totalVolume > 0 && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-700">·</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 font-mono">
                            {totalVolume.toLocaleString()} кг
                          </span>
                        </>
                      )}
                      {w.durationMinutes && w.durationMinutes > 0 && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-700">·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>{w.durationMinutes} хв</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </MobileSwipeableWorkoutCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Workout Modal fallback */}
      <CreateWorkoutModal
        isOpen={isCreateModalOpen}
        initialDate={selectedCalendarDateStr}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={(title, dateStr) => handleCreateForDate(title, dateStr)}
      />

      {/* Delete Confirmation Modal */}
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
