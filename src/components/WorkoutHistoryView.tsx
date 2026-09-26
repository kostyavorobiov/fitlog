import React, { useState } from 'react';
import { WorkoutPlan } from '../types/workout';
import { StorageService, generateId } from '../services/storageService';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { CreateWorkoutModal } from './CreateWorkoutModal';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  ChevronRight as ArrowRight,
  Award,
  Trash2,
} from 'lucide-react';

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

  const workouts = StorageService.getWorkouts(userId);

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

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
  };

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
    StorageService.deleteWorkout(id);
    if (onDeleteWorkout) {
      onDeleteWorkout(id);
    }
    setWorkoutToDelete(null);
    setReloadKey((prev) => prev + 1);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Календар
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Перегляд графіка тренувань та планування занять на будь-яку дату
          </p>
        </div>

        {/* Add Workout Button */}
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center space-x-2 rounded-xl bg-amber-500 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 hover:bg-amber-400 active:scale-[0.98] transition shrink-0"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Додати тренування</span>
        </button>
      </div>

      {/* CALENDAR CARD */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-4">
        {/* Month & Year Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl border border-slate-800 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Попередній місяць"
              aria-label="Попередній місяць"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-base sm:text-lg font-bold text-white min-w-[170px] text-center select-none">
              {ukrainianMonths[month]} {year}
            </h3>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl border border-slate-800 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Наступний місяць"
              aria-label="Наступний місяць"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-1.5 text-xs font-bold text-amber-400 hover:bg-slate-700 hover:text-amber-300 transition shadow-sm"
          >
            Сьогодні
          </button>
        </div>

        {/* Weekdays header (Mon - Sun) */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] sm:text-xs text-slate-400 pb-1 border-b border-slate-800/60">
          <div>Пн</div>
          <div>Вт</div>
          <div>Ср</div>
          <div>Чт</div>
          <div>Пт</div>
          <div className="text-amber-400">Сб</div>
          <div className="text-rose-400">Нд</div>
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarCells.map((dayNum, idx) => {
            if (dayNum === null) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="h-16 sm:h-24 rounded-2xl bg-transparent"
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
                className={`h-16 sm:h-24 rounded-2xl border p-1.5 sm:p-2 cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-md shadow-amber-500/10'
                    : isToday
                    ? 'border-amber-500/40 bg-slate-800/90 hover:bg-slate-800'
                    : dayWorkouts.length > 0
                    ? 'border-slate-700/80 bg-slate-850/80 hover:border-slate-600'
                    : 'border-slate-800/60 bg-slate-900/40 hover:bg-slate-850/50 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      isSelected
                        ? 'text-amber-400 font-extrabold'
                        : isToday
                        ? 'text-white'
                        : dayWorkouts.length > 0
                        ? 'text-slate-200'
                        : 'text-slate-500'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {isToday && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-amber-400"
                      title="Сьогодні"
                    />
                  )}
                </div>

                {/* Workout pills / indicators inside calendar day cell */}
                <div className="space-y-1 overflow-hidden">
                  {dayWorkouts.slice(0, 2).map((dw) => {
                    const isDone = dw.status === 'completed';
                    return (
                      <div
                        key={dw.id}
                        className={`truncate rounded px-1 py-0.5 text-[9px] font-bold ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                        title={dw.title}
                      >
                        <span className="hidden sm:inline">{dw.title}</span>
                        <span className="sm:hidden">
                          {isDone ? '✓' : '•'} {dw.exercises?.length || 0} впр
                        </span>
                      </div>
                    );
                  })}
                  {dayWorkouts.length > 2 && (
                    <div className="text-[8px] text-slate-400 font-mono text-center">
                      +{dayWorkouts.length - 2} ще
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SELECTED DATE DETAILS & WORKOUTS */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm sm:text-base font-bold text-white">
                {formatUkDate(selectedCalendarDateStr)}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedDateWorkouts.length === 0
                ? 'На цей день немає тренувань'
                : `Заплановано / виконано тренувань: ${selectedDateWorkouts.length}`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center space-x-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition shadow-md shrink-0"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Додати тренування на цей день</span>
          </button>
        </div>

        {selectedDateWorkouts.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-2">
            <p className="text-slate-300 font-medium">
              На обрану дату немає тренувань.
            </p>
            <p className="text-slate-500 text-[11px] max-w-sm mx-auto">
              Натисніть кнопку «Додати тренування на цей день», щоб скласти програму занять.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedDateWorkouts.map((w) => {
              const isDone = w.status === 'completed';
              const exercisesCount = w.exercises?.length || 0;
              const setsCount = (w.exercises || []).reduce(
                (acc, ex) => acc + (ex.sets?.length || 0),
                0
              );

              return (
                <div
                  key={w.id}
                  onClick={() => onSelectWorkout(w)}
                  className="group cursor-pointer rounded-2xl border border-slate-800 bg-slate-850/80 p-3.5 hover:border-amber-500/50 hover:bg-slate-800 transition flex items-center justify-between gap-3 shadow-md"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                          isDone
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : w.status === 'in_progress'
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                            : 'border-slate-700 bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isDone
                          ? 'Завершено ✓'
                          : w.status === 'in_progress'
                          ? 'У процесі ⚡'
                          : 'Заплановано'}
                      </span>
                      {w.assignedByCoachId && (
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 flex items-center space-x-1">
                          <Award className="h-3 w-3" />
                          <span>Від тренера</span>
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-amber-400 transition truncate">
                      {w.title || 'Тренування без назви'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {exercisesCount} вправ • {setsCount} підходів
                    </p>
                  </div>

                  <div
                    className="flex items-center space-x-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setWorkoutToDelete(w)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Видалити тренування"
                      aria-label="Видалити тренування"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectWorkout(w)}
                      className="flex items-center space-x-1 rounded-xl bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 px-3 py-1.5 text-xs font-bold text-slate-300 transition"
                    >
                      <span>{isDone ? 'Переглянути' : 'Відкрити'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Workout Modal (pre-filled with the selected date) */}
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
