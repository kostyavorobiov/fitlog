import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Exercise, MuscleGroup, MUSCLE_GROUPS, PastExercisePerformance } from '../types/workout';
import { StorageService } from '../services/storageService';
import { getExerciseGuide } from '../data/exerciseGuides';
import {
  X,
  Dumbbell,
  Trophy,
  History,
  TrendingUp,
  Target,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Wind,
  Calendar,
  Clock,
  BookOpen,
  Flame,
  Award,
} from 'lucide-react';

interface ExerciseHistoryModalProps {
  exercise: Exercise | null;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'info' | 'history';
}

export const ExerciseHistoryModal: React.FC<ExerciseHistoryModalProps> = ({
  exercise,
  userId,
  isOpen,
  onClose,
  initialTab = 'history',
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'history'>(initialTab);
  const backdropMouseDownRef = useRef(false);

  // Sync initial tab when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab, exercise?.id]);

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

  const guide = useMemo(() => {
    if (!exercise) return null;
    return getExerciseGuide(exercise.name, exercise.muscleGroup);
  }, [exercise?.name, exercise?.muscleGroup]);

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
                  {guide && (
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                      {guide.type}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Результати, історія підходів та техніка
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shrink-0"
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

          {/* Navigation Tabs */}
          <div className="mt-3 flex items-center space-x-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center space-x-2 rounded-lg py-1.5 text-xs font-semibold transition ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Історія підходів ({history.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`flex-1 flex items-center justify-center space-x-2 rounded-lg py-1.5 text-xs font-semibold transition ${
                activeTab === 'info'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Техніка та поради</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB: DATA & WORKOUT HISTORY */}
          {activeTab === 'history' && (
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
                  <button
                    type="button"
                    onClick={() => setActiveTab('info')}
                    className="inline-flex items-center space-x-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold px-4 py-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Переглянути техніку</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {history.map((record) => (
                    <div
                      key={record.workoutId}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 p-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-2">
                        <div>
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {record.workoutTitle || 'Тренування'}
                          </span>
                          <div className="text-xs text-zinc-400 flex items-center space-x-1 mt-0.5">
                            <Calendar className="h-3 w-3" />
                            <span>{record.date}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 text-xs">
                          <span className="text-zinc-500 dark:text-zinc-400">
                            Макс: <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">{record.maxWeight} кг</strong>
                          </span>
                          <span className="text-zinc-500 dark:text-zinc-400">
                            Тоннаж: <strong className="text-zinc-900 dark:text-zinc-100 font-mono font-bold">{record.totalVolume.toLocaleString()} кг</strong>
                          </span>
                        </div>
                      </div>

                      {/* Sets grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {record.sets.map((s) => (
                          <div
                            key={s.setNumber}
                            className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700/60 text-xs"
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded font-mono text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                              #{s.setNumber}
                            </span>
                            <div className="font-mono text-right">
                              <span className="font-bold text-zinc-900 dark:text-zinc-100">{s.weight} кг</span>
                              <span className="text-zinc-500 dark:text-zinc-400 font-medium ml-1">
                                × {s.actualReps}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: TECHNIQUE & INSTRUCTIONS */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* Short Description */}
              {exercise.description && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-3.5 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">Призначення: </span>
                  {exercise.description}
                </div>
              )}

              {guide && (
                <>
                  {/* Muscles Working Section */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/30 p-3.5 space-y-3">
                    <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide flex items-center space-x-2">
                      <Target className="h-4 w-4 text-zinc-500" />
                      <span>Задіяні м'язи</span>
                    </h4>

                    <div className="space-y-2">
                      <div>
                        <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          Основні:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {guide.primaryMuscles.map((m, idx) => (
                            <span
                              key={idx}
                              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>

                      {guide.secondaryMuscles.length > 0 && (
                        <div>
                          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                            Стабілізатори:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {guide.secondaryMuscles.map((m, idx) => (
                              <span
                                key={idx}
                                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-400"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Starting Position */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/30 p-3.5 space-y-2">
                    <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide flex items-center space-x-2">
                      <Layers className="h-4 w-4 text-zinc-500" />
                      <span>Вихідне положення (Setup)</span>
                    </h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60">
                      {guide.setup}
                    </p>
                  </div>

                  {/* Step-by-Step Execution */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/30 p-3.5 space-y-2.5">
                    <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>Техніка виконання</span>
                    </h4>

                    <div className="space-y-1.5">
                      {guide.steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-start space-x-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-2.5"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-200 dark:bg-zinc-700 font-mono text-[10px] font-bold text-zinc-800 dark:text-zinc-200">
                            {idx + 1}
                          </span>
                          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed flex-1">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Breathing */}
                  {guide.breathing && (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-3 flex items-start space-x-2.5">
                      <Wind className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">Дихання: </span>
                        <span className="text-zinc-600 dark:text-zinc-300">{guide.breathing}</span>
                      </div>
                    </div>
                  )}

                  {/* Coach Tips */}
                  {guide.tips.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/30 p-3.5 space-y-2">
                      <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide flex items-center space-x-2">
                        <Sparkles className="h-4 w-4" />
                        <span>Поради тренерів</span>
                      </h4>
                      <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                        {guide.tips.map((tip, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-emerald-500 mt-0.5">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Common Mistakes */}
                  {guide.mistakes.length > 0 && (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 space-y-2">
                      <h4 className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Помилки</span>
                      </h4>
                      <ul className="space-y-1 text-xs text-rose-700 dark:text-rose-300">
                        {guide.mistakes.map((mistake, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-rose-500 mt-0.5">•</span>
                            <span>{mistake}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Rep Range Recommendations */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/30 p-3.5 space-y-2">
                    <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                      Рекомендовані діапазони повторень
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/60 p-2 text-center">
                        <div className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">Сила</div>
                        <div className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">4–6 повт.</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {guide.repRecommendations.strength}
                        </div>
                      </div>
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/60 p-2 text-center">
                        <div className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">Гіпертрофія</div>
                        <div className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                          8–12 повт.
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {guide.repRecommendations.hypertrophy}
                        </div>
                      </div>
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/60 p-2 text-center">
                        <div className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">Витривалість</div>
                        <div className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">12–15+ повт.</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {guide.repRecommendations.endurance}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3.5 bg-zinc-50/70 dark:bg-zinc-900 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-400">
            {activeTab === 'history'
              ? 'Хронологія робочих підходів'
              : 'Технічна інструкція'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 px-4 py-1.5 text-xs font-semibold transition"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
