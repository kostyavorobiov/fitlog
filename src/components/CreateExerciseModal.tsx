import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Dumbbell, Loader2 } from 'lucide-react';
import { MuscleGroup, MUSCLE_GROUPS, Exercise } from '../types/workout';
import { StorageService } from '../services/storageService';

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
  const [name, setName] = useState(initialName);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const backdropMouseDownRef = React.useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(initialName);
    setIsSubmitting(false);
    setError('');
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введіть назву вправи');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const creatorId = StorageService.getActiveUserId() || userId;
      const created = await StorageService.createExercise({
        userId: creatorId,
        name: name.trim(),
        muscleGroup,
        description: description.trim() || undefined,
        isDefault: false,
      });

      onCreated(created);
      setName('');
      setDescription('');
      setError('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Помилка при створенні вправи');
    } finally {
      setIsSubmitting(false);
    }
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
        className="relative w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] my-auto overflow-y-auto rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl"
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
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">Нова вправа</h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">Вправа буде додана до вашої особистої бази</p>
          </div>
        </div>

        {error && (
          <div className="mb-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300">
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
              required
              placeholder="наприклад: Жим гантелей під кутом 45°"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              className="w-full h-11 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 text-base sm:text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
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
                    className={`rounded-xl p-2.5 text-xs font-semibold border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#2563EB] bg-[#2563EB] text-white font-bold shadow-xs'
                        : 'border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {info.nameUk}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Опис (необов'язково)
            </label>
            <textarea
              rows={2}
              placeholder="Короткі нотатки чи примітки до вправи..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-3 text-base sm:text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB] resize-none"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 h-11 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-11 inline-flex items-center justify-center space-x-1.5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>{isSubmitting ? 'Збереження...' : 'Зберегти вправу'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
