import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Dumbbell, Calendar, Plus, AlertCircle, Bookmark, Check, Trash2 } from 'lucide-react';
import { formatDateDDMMYYYY } from './WorkoutListView';
import { WorkoutTemplate, TemplateService } from '../services/templateService';
import { StorageService } from '../services/storageService';
import { MobileSwipeableWorkoutCard } from './MobileSwipeableWorkoutCard';

interface CreateWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, scheduledDate: string, template?: WorkoutTemplate) => void;
  initialDate?: string;
  userId?: string;
  modalTitle?: string;
  modalSub?: string;
}

export const CreateWorkoutModal: React.FC<CreateWorkoutModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  initialDate,
  userId,
  modalTitle,
  modalSub,
}) => {
  const [mode, setMode] = useState<'empty' | 'template'>('empty');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const backdropMouseDownRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (initialDate) {
        setDate(initialDate);
      }
      setTitle('');
      setError('');
      setMode('empty');
      setSelectedTemplate(null);

      const effectiveUserId = userId || StorageService.getActiveUserId() || '';
      if (effectiveUserId) {
        setIsLoadingTemplates(true);
        TemplateService.getTemplates(effectiveUserId)
          .then((tpls) => setTemplates(tpls))
          .catch((e) => console.warn('[CreateWorkoutModal] Templates load error:', e))
          .finally(() => setIsLoadingTemplates(false));
      }
    }
  }, [isOpen, initialDate, userId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'template') {
      if (!selectedTemplate) {
        setError('Оберіть шаблон зі списку');
        return;
      }
      onCreate(
        title.trim() || selectedTemplate.title,
        date || new Date().toISOString().split('T')[0],
        selectedTemplate
      );
      setTitle('');
      setError('');
      onClose();
      return;
    }

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

  const handleDeleteTemplate = async (templateId: string) => {
    const effectiveUserId = userId || StorageService.getActiveUserId() || '';
    if (!effectiveUserId) return;
    if (!window.confirm('Видалити цей шаблон тренування?')) return;
    try {
      await TemplateService.deleteTemplate(effectiveUserId, templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
        setTitle('');
      }
    } catch (e: any) {
      alert(e?.message || 'Не вдалося видалити шаблон');
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pb-10 sm:pb-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-no-swipe="true"
        className="relative w-full max-w-md my-auto mb-8 sm:mb-auto rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB]/10 dark:bg-[#2563EB]/15 text-[#2563EB] dark:text-[#60A5FA]">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">{modalTitle || 'Нове тренування'}</h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">{modalSub || 'Створіть порожнє або з збереженого шаблону'}</p>
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

        {/* Mode Selector Segment */}
        <div className="flex rounded-2xl bg-slate-100 dark:bg-zinc-950 p-1 mt-4 border border-slate-200/80 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setMode('empty');
              setError('');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${mode === 'empty'
              ? 'bg-white dark:bg-zinc-800 text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Dumbbell className="h-3.5 w-3.5" />
            <span>Нове тренування</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('template');
              setError('');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${mode === 'template'
              ? 'bg-white dark:bg-zinc-800 text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>З шаблону {templates.length > 0 ? `(${templates.length})` : ''}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {mode === 'template' ? (
            <div className="space-y-3">
              {isLoadingTemplates ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-400 font-mono">
                  Завантаження шаблонів...
                </div>
              ) : templates.length === 0 ? (
                <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 text-center space-y-2">
                  <Bookmark className="h-6 w-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Немає збережених шаблонів
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Збережіть будь-яке створене тренування як шаблон, натиснувши «Шаблон» у верхньому меню.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMode('empty')}
                    className="inline-block mt-1 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-100 transition cursor-pointer"
                  >
                    Створити порожнє тренування
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                    Оберіть шаблон *
                  </label>
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {templates.map((tpl) => {
                      const isSelected = selectedTemplate?.id === tpl.id;
                      return (
                        <MobileSwipeableWorkoutCard
                          key={tpl.id}
                          workoutId={tpl.id}
                          onDelete={() => handleDeleteTemplate(tpl.id)}
                        >
                          <div
                            onClick={() => {
                              setSelectedTemplate(tpl);
                              setTitle(tpl.title);
                              setError('');
                            }}
                            className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${isSelected
                              ? 'border-[#2563EB] bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-[#2563EB]'
                              : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50 dark:bg-zinc-950'
                              }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                                {tpl.title}
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                                {tpl.exercises?.length || 0} вправ • {tpl.exercises?.map((e) => e.exerciseName).filter(Boolean).slice(0, 3).join(', ')}
                              </p>
                            </div>
                            <div className="flex items-center space-x-1.5 shrink-0">
                              <div
                                className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border ${isSelected
                                  ? 'bg-[#2563EB] border-[#2563EB] text-white'
                                  : 'border-slate-300 dark:border-zinc-700'
                                  }`}
                              >
                                {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTemplate(tpl.id);
                                }}
                                title="Видалити шаблон"
                                className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </MobileSwipeableWorkoutCard>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
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
                  className={`w-full h-11 rounded-2xl border px-4 text-base sm:text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 bg-slate-50 dark:bg-zinc-950 focus:outline-none transition-colors ${error
                    ? 'border-rose-500'
                    : 'border-slate-200 dark:border-zinc-800 focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]'
                    }`}
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center space-x-1 mt-1.5">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {/* Date Field with Calendar Picker and DD/MM/YYYY display */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Дата тренування
            </label>
            <label className="relative flex items-center space-x-2 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 h-11 cursor-pointer hover:border-[#2563EB] transition-colors">
              <Calendar className="h-4 w-4 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
              <span className="text-sm font-mono text-slate-900 dark:text-zinc-100 flex-1 select-none">
                {date ? formatDateDDMMYYYY(date) : 'Виберіть дату'}
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.target as any).showPicker?.();
                  } catch { }
                }}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                tabIndex={-1}
              />
            </label>
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
              <span>{mode === 'template' ? 'Створити з шаблону' : 'Створити'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
