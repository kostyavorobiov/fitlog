import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Dumbbell } from 'lucide-react';
import { MuscleGroup, MUSCLE_GROUPS, Exercise } from '../types/workout';
import { StorageService } from '../services/storageService';

interface EditExerciseModalProps {
  exercise: Exercise | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedExercise: Exercise) => void;
}

export const EditExerciseModal: React.FC<EditExerciseModalProps> = ({
  exercise,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (exercise && isOpen) {
      setName(exercise.name || '');
      setMuscleGroup(exercise.muscleGroup || 'chest');
      setDescription(exercise.description || '');
      setError('');
    }
  }, [exercise, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !exercise) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введіть назву вправи');
      return;
    }

    const updated: Exercise = {
      ...exercise,
      name: name.trim(),
      muscleGroup,
      description: description.trim() || undefined,
    };

    StorageService.updateExercise(updated);
    onSaved(updated);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        role="dialog"
        aria-modal="true"
        data-no-swipe="true"
        className="relative z-10 w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] my-auto overflow-y-auto rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center space-x-2.5 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB]/10 dark:bg-[#2563EB]/15 text-[#2563EB] dark:text-[#60A5FA]">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">Редагування власної вправи</h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">Зміна назви або категорії не порушить існуючі тренування</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Назва вправи *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Наприклад: Жим гантелей під кутом 30°"
              className="w-full h-11 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 text-base sm:text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              М'язова група *
            </label>
            <select
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
              className="w-full h-11 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 text-base sm:text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB] cursor-pointer"
            >
              {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((groupKey) => (
                <option key={groupKey} value={groupKey}>
                  {MUSCLE_GROUPS[groupKey].nameUk}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Опис або коментар (опціонально)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Порада щодо виконання, особливості хвату тощо..."
              rows={3}
              className="w-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-3 text-base sm:text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB] resize-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-4 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="h-11 inline-flex items-center space-x-1.5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 text-xs font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>Зберегти зміни</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
