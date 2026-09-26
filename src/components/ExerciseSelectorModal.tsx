import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Plus, Dumbbell, Sparkles } from 'lucide-react';
import { Exercise, MuscleGroup, MUSCLE_GROUPS } from '../types/workout';
import { StorageService } from '../services/storageService';

interface ExerciseSelectorModalProps {
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  onOpenCreateModal: () => void;
}

export const ExerciseSelectorModal: React.FC<ExerciseSelectorModalProps> = ({
  isOpen,
  userId,
  onClose,
  onSelect,
  onOpenCreateModal,
}) => {
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');

  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const exercises = useMemo(() => {
    return StorageService.getExercises(userId);
  }, [userId, isOpen]);

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchSearch =
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        (ex.description && ex.description.toLowerCase().includes(search.toLowerCase()));
      const matchMuscle = selectedMuscle === 'all' || ex.muscleGroup === selectedMuscle;
      return matchSearch && matchMuscle;
    });
  }, [exercises, search, selectedMuscle]);

  const backdropMouseDownRef = React.useRef(false);

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    backdropMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && backdropMouseDownRef.current) {
      onClose();
    }
    backdropMouseDownRef.current = false;
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] my-auto flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Dumbbell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Вибір вправи для тренування</h3>
              <p className="text-[11px] text-slate-400">Оберіть зі списку або додайте власну</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Muscle Filters */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/50">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Пошук вправи за назвою..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
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

          {/* Muscle filter pills */}
          <div className="flex space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => setSelectedMuscle('all')}
              className={`rounded-lg px-2.5 py-1 font-medium whitespace-nowrap transition ${
                selectedMuscle === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Всі ({exercises.length})
            </button>
            {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((groupKey) => {
              const info = MUSCLE_GROUPS[groupKey];
              const count = exercises.filter((e) => e.muscleGroup === groupKey).length;
              const isSelected = selectedMuscle === groupKey;
              return (
                <button
                  key={groupKey}
                  onClick={() => setSelectedMuscle(groupKey)}
                  className={`rounded-lg px-2.5 py-1 font-medium whitespace-nowrap transition border ${
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

        {/* List of exercises */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
              <p className="text-sm text-slate-400">Вправу не знайдено за вашим запитом.</p>
              <button
                onClick={() => {
                  onClose();
                  onOpenCreateModal();
                }}
                className="mt-3 inline-flex items-center space-x-2 rounded-xl bg-amber-500/20 border border-amber-500/40 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Створити «{search || 'цю вправу'}»</span>
              </button>
            </div>
          ) : (
            filtered.map((ex) => {
              const muscleInfo = MUSCLE_GROUPS[ex.muscleGroup] || MUSCLE_GROUPS.full_body;
              // Check if user has past performance
              const lastPerf = StorageService.getLastExercisePerformance(userId, ex.id);

              return (
                <button
                  key={ex.id}
                  onClick={() => {
                    onSelect(ex);
                    onClose();
                  }}
                  className="w-full text-left rounded-xl border border-slate-800/80 bg-slate-800/30 hover:bg-slate-800 hover:border-amber-500/40 p-3 transition flex items-center justify-between group"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-semibold text-white group-hover:text-amber-400 transition truncate">
                        {ex.name}
                      </span>
                      {!ex.isDefault && (
                        <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-medium text-amber-300">
                          Власна
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${muscleInfo.badgeBg} border ${muscleInfo.badgeBorder}`}>
                        {muscleInfo.nameUk}
                      </span>
                    </div>

                    {/* Past history hint if available */}
                    {lastPerf && (
                      <div className="mt-1.5 flex items-center space-x-1.5 text-[11px] text-amber-400/90 font-mono">
                        <Sparkles className="h-3 w-3 text-amber-400" />
                        <span>
                          Минулий рез.: {lastPerf.maxWeight} кг ({lastPerf.sets.length} підх.) від {lastPerf.date}
                        </span>
                      </div>
                    )}
                  </div>

                  <span className="text-xs font-semibold text-amber-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap pl-2">
                    Обрати +
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer with create custom trigger */}
        <div className="border-t border-slate-800 p-3.5 bg-slate-900/90 flex items-center justify-between">
          <span className="text-xs text-slate-400">Немає потрібної вправи?</span>
          <button
            onClick={() => {
              onClose();
              onOpenCreateModal();
            }}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
          >
            <Plus className="h-3.5 w-3.5 text-amber-400" />
            <span>Створити нову вправу</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
