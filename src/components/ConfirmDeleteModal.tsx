import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  workoutTitle?: string;
  workoutDate?: string;
  isCompleted?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  message,
  workoutTitle,
  workoutDate,
  isCompleted,
  confirmLabel = 'Так, видалити',
  cancelLabel = 'Скасувати',
  onConfirm,
  onClose,
}) => {
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

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-full h-[100dvh] z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overscroll-contain animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md my-auto rounded-2xl border border-rose-500/30 bg-slate-900 p-5 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3.5 top-3.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          aria-label="Закрити"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start space-x-3.5 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
            <Trash2 className="h-6 w-6" />
          </div>
          <div className="pr-4">
            <h3 className="text-lg font-bold text-white leading-tight">{title}</h3>
            <p className="text-xs text-slate-400 mt-1">{message}</p>
          </div>
        </div>

        {/* Workout preview card */}
        {(workoutTitle || workoutDate) && (
          <div className="rounded-xl border border-slate-800 bg-slate-850/80 p-3 mb-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white truncate max-w-[200px] sm:max-w-[260px]">
                {workoutTitle || 'Тренування'}
              </span>
              {isCompleted && (
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  Завершене
                </span>
              )}
            </div>
            {workoutDate && (
              <div className="text-[11px] text-slate-400 mt-1 font-mono">Дата: {workoutDate}</div>
            )}
          </div>
        )}

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs sm:text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-rose-600/30 hover:from-rose-500 hover:to-red-500 transition"
          >
            <Trash2 className="h-4 w-4" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
