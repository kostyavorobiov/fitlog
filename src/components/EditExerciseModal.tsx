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
        className="relative z-10 w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] my-auto overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center space-x-2.5 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            <Dumbbell className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Редагування власної вправи</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Зміна назви або категорії не порушить існуючі тренування</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
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
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              М'язова група *
            </label>
            <select
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer"
            >
              {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((groupKey) => (
                <option key={groupKey} value={groupKey}>
                  {MUSCLE_GROUPS[groupKey].nameUk}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Опис або коментар (опціонально)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Порада щодо виконання, особливості хвату тощо..."
              rows={3}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="inline-flex items-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-4 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Зберегти зміни</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
