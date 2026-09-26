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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] my-auto flex flex-col rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="border-b border-slate-800 p-4 sm:p-5 bg-slate-900/95 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div
                className={`p-2.5 sm:p-3 rounded-2xl ${muscleInfo.badgeBg} border ${muscleInfo.badgeBorder} shrink-0`}
              >
                <Dumbbell className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-white break-words leading-tight">
                    {exercise.name}
                  </h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${muscleInfo.badgeBg} border ${muscleInfo.badgeBorder}`}
                  >
                    {muscleInfo.nameUk}
                  </span>
                  {guide && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {guide.type}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  Картка вправи: результати, рекорди та техніка
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition shrink-0"
              aria-label="Закрити"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Metrics Strip (Visible regardless of active tab so data is always accessible) */}
          <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* PR Weight */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2 sm:p-2.5 text-center">
              <div className="flex items-center justify-center space-x-1 text-amber-400 text-[10px] font-semibold">
                <Trophy className="h-3 w-3" />
                <span>Рекорд (PR)</span>
              </div>
              <div className="font-mono text-sm sm:text-base font-extrabold text-white mt-0.5">
                {stats.prWeight > 0 ? `${stats.prWeight} кг` : '—'}
              </div>
              {stats.bestRepsAtPR > 0 && (
                <div className="text-[9px] text-slate-400 font-mono">
                  на {stats.bestRepsAtPR} повт.
                </div>
              )}
            </div>

            {/* Est. 1RM */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2 sm:p-2.5 text-center">
              <div className="flex items-center justify-center space-x-1 text-cyan-400 text-[10px] font-semibold">
                <TrendingUp className="h-3 w-3" />
                <span>Розрахунковий 1RM</span>
              </div>
              <div className="font-mono text-sm sm:text-base font-extrabold text-white mt-0.5">
                {stats.best1RM > 0 ? `${stats.best1RM} кг` : '—'}
              </div>
              <div className="text-[9px] text-slate-500">макс. на 1 повт.</div>
            </div>

            {/* Last Performance */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2 sm:p-2.5 text-center">
              <div className="flex items-center justify-center space-x-1 text-emerald-400 text-[10px] font-semibold">
                <Clock className="h-3 w-3" />
                <span>Останній раз</span>
              </div>
              <div className="font-mono text-sm sm:text-base font-extrabold text-emerald-400 mt-0.5 truncate">
                {lastPerformance ? `${lastPerformance.maxWeight} кг` : '—'}
              </div>
              <div className="text-[9px] text-slate-400 truncate">
                {lastPerformance ? lastPerformance.date : 'Немає записів'}
              </div>
            </div>

            {/* Completed Sets / Sessions */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2 sm:p-2.5 text-center">
              <div className="flex items-center justify-center space-x-1 text-purple-400 text-[10px] font-semibold">
                <Layers className="h-3 w-3" />
                <span>Підходів / Занять</span>
              </div>
              <div className="font-mono text-sm sm:text-base font-extrabold text-white mt-0.5">
                {stats.totalCompletedSets} / {stats.totalSessions}
              </div>
              <div className="text-[9px] text-slate-400">
                {stats.totalRepsAllTime} повторень
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-3 flex items-center space-x-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center space-x-2 rounded-lg py-2 text-xs font-bold transition ${
                activeTab === 'history'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Дані та історія підходів ({history.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`flex-1 flex items-center justify-center space-x-2 rounded-lg py-2 text-xs font-bold transition ${
                activeTab === 'info'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Техніка та інструкція</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* TAB: DATA & WORKOUT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-amber-400" />
                  <span>Хронологія тренувань та виконаних підходів</span>
                </h4>
                <span className="text-xs text-slate-400 font-mono">
                  {history.length}{' '}
                  {history.length === 1
                    ? 'тренування'
                    : history.length >= 2 && history.length <= 4
                    ? 'тренування'
                    : 'тренувань'}
                </span>
              </div>

              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Даних тренувань ще немає</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Ця вправа ще не виконувалась у збережених тренуваннях. Додайте її до програми, відмічайте підходи галочкою, і тут зʼявиться історія ваги, повторень та прогресу!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('info')}
                    className="inline-flex items-center space-x-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white px-4 py-2 transition"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                    <span>Переглянути техніку виконання</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((record) => (
                    <div
                      key={record.workoutId}
                      className="rounded-2xl border border-slate-800 bg-slate-850/60 p-4 hover:border-slate-700 transition space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div>
                          <span className="text-sm font-bold text-white">
                            {record.workoutTitle || 'Тренування'}
                          </span>
                          <div className="text-xs text-slate-400 flex items-center space-x-1 mt-0.5">
                            <Calendar className="h-3 w-3 text-slate-500" />
                            <span>{record.date}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 text-xs">
                          <span className="text-slate-400">
                            Макс:{' '}
                            <strong className="text-amber-400 font-mono font-bold">
                              {record.maxWeight} кг
                            </strong>
                          </span>
                          <span className="text-slate-400">
                            Тоннаж:{' '}
                            <strong className="text-white font-mono font-bold">
                              {record.totalVolume.toLocaleString()} кг
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Sets grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {record.sets.map((s) => (
                          <div
                            key={s.setNumber}
                            className="flex items-center justify-between rounded-xl bg-slate-900/90 px-3 py-2 border border-slate-800 text-xs"
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded font-mono text-[10px] font-bold bg-amber-500/20 text-amber-300">
                              #{s.setNumber}
                            </span>
                            <div className="font-mono text-right">
                              <span className="font-bold text-white">{s.weight} кг</span>
                              <span className="text-amber-400 font-semibold ml-1.5">
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
            <div className="space-y-5 animate-fade-in">
              {/* Short Description */}
              {exercise.description && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/90 leading-relaxed">
                  <span className="font-bold text-amber-400">Призначення: </span>
                  {exercise.description}
                </div>
              )}

              {guide && (
                <>
                  {/* Muscles Working Section */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-850/60 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <Target className="h-4 w-4 text-rose-400" />
                      <span>Задіяні м'язові групи</span>
                    </h4>

                    <div className="space-y-2">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 mb-1">
                          Основні цільові м'язи:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {guide.primaryMuscles.map((m, idx) => (
                            <span
                              key={idx}
                              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>

                      {guide.secondaryMuscles.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold text-slate-400 mb-1">
                            Додаткові м'язи та стабілізатори:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {guide.secondaryMuscles.map((m, idx) => (
                              <span
                                key={idx}
                                className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Starting Position (Setup) */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-850/60 p-4 space-y-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <Layers className="h-4 w-4 text-cyan-400" />
                      <span>Вихідне положення (Setup)</span>
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                      {guide.setup}
                    </p>
                  </div>

                  {/* Step-by-Step Execution */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-850/60 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Покрокова техніка виконання</span>
                    </h4>

                    <div className="space-y-2">
                      {guide.steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-start space-x-3 rounded-xl border border-slate-800/80 bg-slate-900/80 p-3"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40 font-mono text-xs font-bold text-amber-300">
                            {idx + 1}
                          </span>
                          <p className="text-xs text-slate-200 leading-relaxed flex-1 pt-0.5">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Breathing */}
                  {guide.breathing && (
                    <div className="rounded-2xl border border-sky-500/20 bg-sky-950/20 p-3.5 flex items-start space-x-3">
                      <Wind className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-bold text-sky-300">Правильне дихання: </span>
                        <span className="text-slate-300">{guide.breathing}</span>
                      </div>
                    </div>
                  )}

                  {/* Coach Tips */}
                  {guide.tips.length > 0 && (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/15 p-4 space-y-2">
                      <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center space-x-2">
                        <Sparkles className="h-4 w-4 text-emerald-400" />
                        <span>Поради від тренерів</span>
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {guide.tips.map((tip, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-emerald-400 mt-1">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Common Mistakes */}
                  {guide.mistakes.length > 0 && (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-950/15 p-4 space-y-2">
                      <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-rose-400" />
                        <span>Типові помилки, яких слід уникати</span>
                      </h4>
                      <ul className="space-y-1.5 text-xs text-rose-200/90">
                        {guide.mistakes.map((mistake, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-rose-400 mt-1">•</span>
                            <span>{mistake}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Rep Range Recommendations */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-850/60 p-4 space-y-2.5">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Рекомендовані діапазони повторень
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 text-center">
                        <div className="text-[10px] font-bold text-amber-400">Сила (Strength)</div>
                        <div className="font-mono text-xs font-bold text-white mt-1">4–6 повт.</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {guide.repRecommendations.strength}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 text-center">
                        <div className="text-[10px] font-bold text-emerald-400">Гіпертрофія (Маса)</div>
                        <div className="font-mono text-xs font-bold text-white mt-1">
                          6–8 / 8–12 повт.
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {guide.repRecommendations.hypertrophy}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5 text-center">
                        <div className="text-[10px] font-bold text-cyan-400">Витривалість / Памп</div>
                        <div className="font-mono text-xs font-bold text-white mt-1">10–15+ повт.</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
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
        <div className="border-t border-slate-800 p-4 bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {activeTab === 'history'
              ? 'Повна хронологія робочих підходів'
              : 'Анатомічна та технічна інструкція'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-2 text-xs font-bold text-white transition"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
