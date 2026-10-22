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
        className="relative w-full max-w-md my-auto rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB]/10 dark:bg-[#2563EB]/15 text-[#2563EB] dark:text-[#60A5FA]">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">Нове тренування</h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">Вкажіть назву та заплановану дату</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
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
              className={`w-full h-11 rounded-2xl border px-4 text-base sm:text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 bg-slate-50 dark:bg-zinc-950 focus:outline-none transition-colors ${
                error
                  ? 'border-rose-500'
                  : 'border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]'
              }`}
            />
            {error && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center space-x-1 mt-1.5">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Quick presets */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 block mb-1.5">
              Швидкі шаблони назв:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {titlePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`rounded-xl border px-2.5 py-1 text-[11px] transition-all cursor-pointer ${
                    title === preset
                      ? 'border-[#2563EB] bg-[#2563EB] text-white font-bold shadow-xs'
                      : 'border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Date Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Дата тренування
            </label>
            <div className="flex items-center space-x-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 h-11">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent text-base sm:text-xs text-slate-900 dark:text-zinc-100 font-mono focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="flex-1 h-11 inline-flex items-center justify-center space-x-1.5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer"
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
