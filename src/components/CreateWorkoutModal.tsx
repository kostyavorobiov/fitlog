import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Dumbbell, Calendar, Plus, Sparkles, AlertCircle } from 'lucide-react';

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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-md my-auto rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Нове тренування</h3>
              <p className="text-xs text-slate-400">Вкажіть назву та заплановану дату</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title Field (REQUIRED with placeholder) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Назва тренування <span className="text-rose-400">*</span>
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
              placeholder="Назва тренування"
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-white placeholder-slate-500 bg-slate-800/90 focus:outline-none transition ${
                error
                  ? 'border-rose-500 ring-1 ring-rose-500/50'
                  : 'border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50'
              }`}
            />
            {error && (
              <p className="text-xs text-rose-400 flex items-center space-x-1 mt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Quick presets */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
              Швидкі шаблони назв:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {titlePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition ${
                    title === preset
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Date Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Дата тренування
            </label>
            <div className="flex items-center space-x-2 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5">
              <Calendar className="h-4 w-4 text-amber-400 shrink-0" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent text-sm text-white focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Створити тренування</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
