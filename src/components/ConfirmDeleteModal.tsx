import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs overscroll-contain animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-no-swipe="true"
        className="relative w-full max-w-md my-auto rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label="Закрити"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start space-x-3 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="pr-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{message}</p>
          </div>
        </div>

        {/* Workout preview card */}
        {(workoutTitle || workoutDate) && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-3.5 mb-5 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 dark:text-zinc-200 truncate max-w-[200px] sm:max-w-[260px]">
                {workoutTitle || 'Тренування'}
              </span>
              {isCompleted && (
                <span className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  Завершене
                </span>
              )}
            </div>
            {workoutDate && (
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-mono">
                Дата: {workoutDate}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center space-x-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 h-11 inline-flex items-center justify-center space-x-1.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
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
