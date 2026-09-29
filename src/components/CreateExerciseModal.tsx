import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Dumbbell } from 'lucide-react';
import { MuscleGroup, MUSCLE_GROUPS, Exercise } from '../types/workout';
import { StorageService } from '../services/storageService';
import { useAuth } from '../context/AuthContext';

interface CreateExerciseModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newExercise: Exercise) => void;
  initialName?: string;
}

export const CreateExerciseModal: React.FC<CreateExerciseModalProps> = ({
  userId,
  isOpen,
  onClose,
  onCreated,
  initialName = '',
}) => {
  const { isAdmin } = useAuth();
  const [name, setName] = useState(initialName);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [description, setDescription] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  const [error, setError] = useState('');
  const backdropMouseDownRef = React.useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(initialName);
    setIsGlobal(false);
    setError('');
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введіть назву вправи');
      return;
    }

    const creatorId = StorageService.getActiveUserId() || userId;

    const created = (isAdmin && isGlobal)
      ? StorageService.createGlobalExercise({
          name: name.trim(),
          muscleGroup,
          description: description.trim() || undefined,
        })
      : StorageService.createExercise({
          userId: creatorId,
          name: name.trim(),
          muscleGroup,
          description: description.trim() || undefined,
          isDefault: false,
        });

    onCreated(created);
    setName('');
    setDescription('');
    setIsGlobal(false);
    setError('');
    onClose();
  };

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    backdropMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && backdropMouseDownRef.current) {
      onClose();
    }
    backdropMouseDownRef.current = false;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-no-swipe="true"
        className="relative w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] my-auto overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl"
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
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Нова вправа в базу</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Вправа буде доступна для вибору у всіх тренуваннях</p>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Назва вправи *
            </label>
            <input
              type="text"
              required
              placeholder="наприклад: Жим гантелей під кутом 45°"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-base sm:text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Цільова м'язова група
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((groupKey) => {
                const info = MUSCLE_GROUPS[groupKey];
                const isSelected = muscleGroup === groupKey;
                return (
                  <button
                    key={groupKey}
                    type="button"
                    onClick={() => setMuscleGroup(groupKey)}
                    className={`rounded-md p-2 text-xs font-semibold border text-center transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {info.nameUk}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Опис (необов'язково)
            </label>
            <textarea
              rows={2}
              placeholder="Короткі нотатки чи примітки до вправи..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5 text-base sm:text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none"
            />
          </div>

          {isAdmin && (
            <div className="flex items-center space-x-2.5 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 p-2.5">
              <input
                type="checkbox"
                id="is-global-checkbox"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <label
                htmlFor="is-global-checkbox"
                className="text-xs text-amber-950 dark:text-amber-200 cursor-pointer select-none"
              >
                <span className="font-bold">Global</span> (додає вправу в глобальну базу)
              </label>
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="flex-1 h-9 inline-flex items-center justify-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Зберегти вправу</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
