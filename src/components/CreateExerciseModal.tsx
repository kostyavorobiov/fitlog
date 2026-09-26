import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Dumbbell } from 'lucide-react';
import { MuscleGroup, MUSCLE_GROUPS, Exercise } from '../types/workout';
import { StorageService } from '../services/storageService';

interface CreateExerciseModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newExercise: Exercise) => void;
}

export const CreateExerciseModal: React.FC<CreateExerciseModalProps> = ({
  userId,
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const backdropMouseDownRef = React.useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введіть назву вправи');
      return;
    }

    const created = StorageService.createExercise({
      userId,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] my-auto overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Нова вправа в базу</h3>
            <p className="text-xs text-slate-400">Вправа буде доступна для вибору у всіх ваших тренуваннях</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Назва вправи <span className="text-amber-400">*</span>
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
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Цільова м'язова група
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((groupKey) => {
                const info = MUSCLE_GROUPS[groupKey];
                const isSelected = muscleGroup === groupKey;
                return (
                  <button
                    key={groupKey}
                    type="button"
                    onClick={() => setMuscleGroup(groupKey)}
                    className={`rounded-xl px-2.5 py-2 text-xs font-medium border text-center transition ${
                      isSelected
                        ? `${info.badgeBg} ${info.badgeBorder} ring-1 ring-amber-400/50 text-white font-semibold`
                        : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {info.nameUk}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Опис / Техніка виконання (необов'язково)
            </label>
            <textarea
              rows={2}
              placeholder="Положення ліктів, акцент скорочення, налаштування..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-sm font-bold text-slate-950 hover:from-amber-400 hover:to-orange-400 transition shadow-lg shadow-amber-500/20"
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
