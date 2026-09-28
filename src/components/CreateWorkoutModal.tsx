import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Dumbbell, Calendar, Plus, AlertCircle } from 'lucide-react';

interface CreateWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, scheduledDate: string) => void;
  initialDate?: string;
}

export const CreateWorkoutModal: React.FC<CreateWorkoutModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  initialDate,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const backdropMouseDownRef = React.useRef(false);

  React.useEffect(() => {
    if (isOpen) {
      if (initialDate) {
        setDate(initialDate);
      }
      setError('');
    }
  }, [isOpen, initialDate]);

  if (!isOpen) return null;

  const titlePresets = [
    'Груди та Тріцепс',
    'Спина та Біцепс',
    'День ніг',
    'Плечі та Прес',
    'Full Body',
    'Тяга / Жим / Ноги',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Назва тренування обов'язкова до заповнення");
      return;
    }

    onCreate(cleanTitle, date || new Date().toISOString().split('T')[0]);
    setTitle('');
    setError('');
    onClose();
  };

  const handleSelectPreset = (preset: string) => {
    setTitle(preset);
    setError('');
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
        className="relative w-full max-w-md my-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              <Dumbbell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Нове тренування</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Вкажіть назву та заплановану дату</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
          {/* Title Field */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Назва тренування *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="наприклад: Груди та Тріцепс"
              className={`w-full h-9 rounded-lg border px-3 text-base sm:text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 bg-zinc-50 dark:bg-zinc-950 focus:outline-none transition-colors ${
                error
                  ? 'border-rose-500'
                  : 'border-zinc-200 dark:border-zinc-800 focus:ring-1 focus:ring-zinc-400'
              }`}
            />
            {error && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center space-x-1 mt-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Quick presets */}
          <div>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
              Швидкі шаблони назв:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {titlePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`rounded border px-2 py-0.5 text-[11px] transition-colors cursor-pointer ${
                    title === preset
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 font-semibold'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Date Field */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Дата тренування
            </label>
            <div className="flex items-center space-x-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 h-9">
              <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent text-base sm:text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
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
              <span>Створити</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
