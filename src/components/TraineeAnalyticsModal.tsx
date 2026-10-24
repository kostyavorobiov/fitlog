import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../types/workout';
import { UserAvatar } from './UserAvatar';
import { AnalyticsView } from './AnalyticsView';
import { ArrowLeft, X, BarChart2 } from 'lucide-react';
import { useEdgeSwipeBack } from '../utils/useEdgeSwipeBack';

export interface TraineeAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainee: User | null;
}

export const TraineeAnalyticsModal: React.FC<TraineeAnalyticsModalProps> = ({
  isOpen,
  onClose,
  trainee,
}) => {
  // Mobile edge-swipe right to close modal
  useEdgeSwipeBack({
    onBack: onClose,
    disabled: !isOpen,
  });

  // Lock body scroll safely
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !trainee) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-[#0b1220] animate-fade-in overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="shrink-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer shrink-0 shadow-2xs"
            title="Назад до підопічних"
            aria-label="Назад"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.2]" />
          </button>

          <div className="flex items-center space-x-2.5 min-w-0">
            <UserAvatar
              src={trainee.image}
              alt={trainee.name}
              size="sm"
            />
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 truncate">
                  {trainee.firstName || trainee.name} {trainee.lastName || ''}
                </h2>
                <span className="rounded-md border border-[#2563EB]/30 bg-[#2563EB]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#2563EB] dark:text-[#60A5FA] shrink-0">
                  Аналітика підопічного
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {trainee.email} · ID: {trainee.profileCode || trainee.id}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-700/80 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer shrink-0 shadow-2xs"
          title="Закрити"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Analytics Content Container */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
        <AnalyticsView userId={trainee.id} />
      </div>
    </div>,
    document.body
  );
};
