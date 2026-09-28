import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Exercise, MUSCLE_GROUPS } from '../types/workout';
import { StorageService } from '../services/storageService';
import {
  X,
  Dumbbell,
  Trophy,
  TrendingUp,
  Layers,
  Calendar,
  Clock,
  Award,
} from 'lucide-react';

interface ExerciseHistoryModalProps {
  exercise: Exercise | null;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ExerciseHistoryModal: React.FC<ExerciseHistoryModalProps> = ({
  exercise,
  userId,
  isOpen,
  onClose,
}) => {
  const backdropMouseDownRef = useRef(false);

  // Lock body scroll safely
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const history = useMemo(() => {
    if (!exercise) return [];
    try {
      return StorageService.getAllPastPerformances(userId, exercise.id);
    } catch (e) {
      console.error('Failed to load exercise history:', e);
      return [];
    }
  }, [userId, exercise?.id]);

  if (!isOpen || !exercise) return null;

  const muscleInfo = MUSCLE_GROUPS[exercise.muscleGroup] || MUSCLE_GROUPS.full_body;

  // Calculate Personal Record (PR) and Estimated 1RM
  let prWeight = 0;
  let bestRepsAtPR = 0;
  let best1RM = 0;
  let totalRepsAllTime = 0;
  let totalCompletedSets = 0;

  history.forEach((h) => {
    if (!h || !Array.isArray(h.sets)) return;
    h.sets.forEach((s) => {
      if (!s) return;
      if (s.weight > prWeight) {
        prWeight = s.weight;
        bestRepsAtPR = s.actualReps || 0;
      }
      // Brzycki 1RM formula: weight * (36 / (37 - reps))
      if (s.weight > 0 && s.actualReps && s.actualReps > 0 && s.actualReps <= 30) {
        const est1RM = s.actualReps === 1 ? s.weight : s.weight * (36 / (37 - s.actualReps));
        if (est1RM > best1RM) best1RM = est1RM;
      }
      totalRepsAllTime += s.actualReps || 0;
      totalCompletedSets += 1;
    });
  });

  const lastPerformance = history.length > 0 ? history[history.length - 1] : null;

  const stats = {
    prWeight,
    bestRepsAtPR,
    best1RM: Math.round(best1RM * 10) / 10,
    totalRepsAllTime,
    totalCompletedSets,
    totalSessions: history.length,
  };

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      backdropMouseDownRef.current = true;
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && backdropMouseDownRef.current) {
      onClose();
    }
    backdropMouseDownRef.current = false;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 dark:bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-no-swipe="true"
        className="relative w-full max-w-2xl max-h-[90vh] my-auto flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div
                className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shrink-0 border border-zinc-200 dark:border-zinc-700"
              >
                <Dumbbell className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 break-words leading-tight">
                    {exercise.name}
                  </h3>
                  <span
                    className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                  >
                    {muscleInfo.nameUk}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Результати, рекорди та історія підходів
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shrink-0 cursor-pointer"
              aria-label="Закрити"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Metrics Strip */}
          <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* PR Weight */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-2 sm:p-2.5 text-center">
              <div className="flex items-center justify-center space-x-1 text-amber-600 dark:text-amber-400 text-[10px] font-medium">
                <Trophy className="h-3 w-3" />
                <span>Рекорд (PR)</span>
              </div>
              <div className="font-mono text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {stats.prWeight > 0 ? `${stats.prWeight} кг` : '—'}
              </div>
              {stats.bestRepsAtPR > 0 && (
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                  на {stats.bestRepsAtPR} повт.
                </div>
              )}
            </div>

            {/* Est. 1RM */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-2 sm:p-2.5 text-center">
              <div className="flex items-center justify-center space-x-1 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>Розрахунковий 1RM</span>
              </div>
              <div className="font-mono text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {stats.best1RM > 0 ? `${stats.best1RM} кг` : '—'}
              </div>
              <div className="text-[10px] text-zinc-400">макс. на 1 повт.</div>
            </div>

            {/* Last Performance */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-2 sm:p-2.5 text-center">
              <div className="flex items-center justify-center space-x-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                <Clock className="h-3 w-3" />
                <span>Останній раз</span>
              </div>
              <div className="font-mono text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                {lastPerformance ? `${lastPerformance.maxWeight} кг` : '—'}
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                {lastPerformance ? lastPerformance.date : 'Немає записів'}
              </div>
            </div>

            {/* Completed Sets / Sessions */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-2 sm:p-2.5 text-center">
              <div className="flex items-center justify-center space-x-1 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
                <Layers className="h-3 w-3" />
                <span>Підходів / Занять</span>
              </div>
              <div className="font-mono text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {stats.totalCompletedSets} / {stats.totalSessions}
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {stats.totalRepsAllTime} повторень
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Content: History of Sets */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide flex items-center space-x-2">
                <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                <span>Хронологія виконаних підходів</span>
              </h4>
              <span className="text-xs text-zinc-400 font-mono">
                {history.length} {history.length === 1 ? 'тренування' : 'тренувань'}
              </span>
            </div>

            {history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/20 p-8 text-center space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 mx-auto">
                  <Trophy className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Даних тренувань ще немає</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                  Ця вправа ще не виконувалась у збережених тренуваннях. Додайте її до програми, відмічайте підходи, і тут зʼявиться історія!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {history
                  .slice()
                  .reverse()
                  .map((perf, pIdx) => {
                    const isBestSession = perf.maxWeight === stats.prWeight && stats.prWeight > 0;
                    const sessionVolume = (perf.sets || []).reduce(
                      (acc, s) => acc + (s.weight || 0) * (s.actualReps || 0),
                      0
                    );

                    return (
                      <div
                        key={pIdx}
                        className={`rounded-xl border p-3.5 sm:p-4 transition ${
                          isBestSession
                            ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/30 dark:bg-amber-950/20'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              {perf.date}
                            </span>
                            {isBestSession && (
                              <span className="inline-flex items-center space-x-1 rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                <Award className="h-3 w-3" />
                                <span>PR Сесія</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2 text-xs font-mono">
                            <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                              Тоннаж: {sessionVolume.toLocaleString()} кг
                            </span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              Макс: {perf.maxWeight} кг
                            </span>
                          </div>
                        </div>

                        {/* Sets Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {(perf.sets || []).map((s, sIdx) => {
                            const isPrSet = s.weight === stats.prWeight && stats.prWeight > 0;
                            return (
                              <div
                                key={sIdx}
                                className={`rounded-lg border px-2 py-1.5 text-center font-mono ${
                                  isPrSet
                                    ? 'border-amber-300 dark:border-amber-700 bg-amber-100/60 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200'
                                    : 'border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200'
                                }`}
                              >
                                <div className="text-[10px] text-zinc-400">Сет {s.setNumber || sIdx + 1}</div>
                                <div className="text-xs font-bold mt-0.5">
                                  {s.weight} кг × {s.actualReps}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3.5 bg-zinc-50/70 dark:bg-zinc-900 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-400">
            Хронологія робочих підходів
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 px-4 py-1.5 text-xs font-semibold transition cursor-pointer"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
