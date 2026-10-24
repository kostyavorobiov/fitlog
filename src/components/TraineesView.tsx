import React, { useState, useEffect, useMemo } from 'react';
import { User, WorkoutPlan } from '../types/workout';
import { StorageService, generateId } from '../services/storageService';
import { CloudStorageService } from '../services/cloudStorageService';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { CreateWorkoutModal } from './CreateWorkoutModal';
import { WorkoutTemplate, TemplateService } from '../services/templateService';
import { UserAvatar } from './UserAvatar';
import {
  Users,
  UserPlus,
  Calendar,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Dumbbell,
  Copy,
  Check,
  Edit3,
  Loader2,
  ArrowLeft,
  Key,
  Layers,
} from 'lucide-react';
import { useSwipeGesture } from '../utils/useSwipeGesture';
import { getMonthKeyAndLabel, formatDateDDMMYY, MonthGroup } from './WorkoutListView';
import { MobileSwipeableWorkoutCard } from './MobileSwipeableWorkoutCard';

interface TraineesViewProps {
  coach: User;
  onOpenWorkoutEditor: (workout: WorkoutPlan, trainee: User) => void;
  selectedTraineeId?: string | null;
  onSelectTraineeId?: (traineeId: string | null) => void;
  onBack?: () => void;
}

export const TraineesView: React.FC<TraineesViewProps> = ({
  coach,
  onOpenWorkoutEditor,
  selectedTraineeId: externalSelectedTraineeId,
  onSelectTraineeId: externalOnSelectTraineeId,
  onBack,
}) => {
  const [trainees, setTrainees] = useState<User[]>([]);
  const [selectedTrainee, setSelectedTrainee] = useState<User | null>(null);
  const [newTraineeCode, setNewTraineeCode] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState<WorkoutPlan | null>(null);
  const [traineeToRemove, setTraineeToRemove] = useState<User | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedWorkoutIds, setExpandedWorkoutIds] = useState<Record<string, boolean>>({});

  const toggleWorkoutExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedWorkoutIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handlePrevTrainee = () => {
    if (!selectedTrainee || trainees.length <= 1) return;
    const idx = trainees.findIndex((t) => t.id === selectedTrainee.id);
    if (idx > 0) {
      selectTrainee(trainees[idx - 1]);
    }
  };

  const handleNextTrainee = () => {
    if (!selectedTrainee || trainees.length <= 1) return;
    const idx = trainees.findIndex((t) => t.id === selectedTrainee.id);
    if (idx < trainees.length - 1) {
      selectTrainee(trainees[idx + 1]);
    }
  };

  const traineeSwipeRef = useSwipeGesture<HTMLDivElement>({
    onSwipeLeft: handleNextTrainee,
    onSwipeRight: handlePrevTrainee,
    threshold: 30,
    disabled: trainees.length <= 1 || Boolean(workoutToDelete) || Boolean(traineeToRemove),
  });

  // Load trainees (locally + cloud sync)
  useEffect(() => {
    let isMounted = true;
    const list = StorageService.getTrainees(coach.id);
    setTrainees(list);

    // Determine selected trainee: prefer externalSelectedTraineeId
    const savedId = externalSelectedTraineeId;
    const matched = list.find((t) => t.id === savedId);

    if (matched) {
      setSelectedTrainee(matched);
    } else if (list.length > 0 && !selectedTrainee) {
      setSelectedTrainee(list[0]);
    } else if (selectedTrainee) {
      const refreshed = list.find((t) => t.id === selectedTrainee.id) || list[0] || null;
      setSelectedTrainee(refreshed);
    }

    // Sync from Supabase cloud
    StorageService.syncTraineesFromCloud(coach.id).then((cloudList) => {
      if (!isMounted) return;
      if (cloudList && cloudList.length > 0) {
        setTrainees(cloudList);
        const curSavedId = externalSelectedTraineeId;
        const curMatched = cloudList.find((t) => t.id === curSavedId);
        if (curMatched) {
          setSelectedTrainee(curMatched);
        } else if (!selectedTrainee) {
          setSelectedTrainee(cloudList[0]);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [coach.id, coach.traineeIds, refreshKey, externalSelectedTraineeId]);

  const selectTrainee = (trainee: User) => {
    setSelectedTrainee(trainee);
    if (externalOnSelectTraineeId) {
      externalOnSelectTraineeId(trainee.id);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCopyCoachCode = () => {
    const code = coach.profileCode || coach.id;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleAddTrainee = async (codeToUse?: string) => {
    const code = (codeToUse || newTraineeCode).trim();
    if (!code) {
      showToast('Введіть ID, код або email підопічного', 'error');
      return;
    }

    setIsAdding(true);
    try {
      const result = await StorageService.addTraineeByCode(coach.id, code);
      if (result.success) {
        showToast(result.message, 'success');
        setNewTraineeCode('');
        setRefreshKey((k) => k + 1);
        if (result.trainee) {
          selectTrainee(result.trainee);
        }
      } else {
        showToast(result.message, 'error');
      }
    } catch {
      showToast('Помилка при додаванні підопічного', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleConfirmRemoveTrainee = async () => {
    if (!traineeToRemove) return;
    const removedId = traineeToRemove.id;
    // Immediate UI removal
    setTrainees((prev) => prev.filter((t) => t.id !== removedId));
    if (selectedTrainee?.id === removedId) {
      setSelectedTrainee(null);
      if (externalOnSelectTraineeId) {
        externalOnSelectTraineeId(null);
      }
    }
    setTraineeToRemove(null);

    // Persist removal locally and in Supabase
    await StorageService.removeTrainee(coach.id, removedId);
    showToast('Підопічного відкріплено', 'success');
    setRefreshKey((k) => k + 1);
  };

  // Trainee Workouts: keep in reactive state and sync with Supabase cloud
  const [traineeWorkouts, setTraineeWorkouts] = useState<WorkoutPlan[]>([]);

  useEffect(() => {
    if (!selectedTrainee) {
      setTraineeWorkouts([]);
      return;
    }
    // 1. Initial local load
    setTraineeWorkouts(StorageService.getWorkouts(selectedTrainee.id));

    // 2. Fetch from cloud and update authoritatively
    let isSubscribed = true;
    CloudStorageService.fetchWorkouts(selectedTrainee.id).then((cloudWorkouts: WorkoutPlan[] | null) => {
      if (!isSubscribed) return;
      if (cloudWorkouts !== null) {
        StorageService.setWorkoutsForUser(selectedTrainee.id, cloudWorkouts);
        setTraineeWorkouts(StorageService.getWorkouts(selectedTrainee.id));
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [selectedTrainee?.id, refreshKey]);

  // Group trainee workouts by calendar month (YYYY-MM), sorted newest to oldest
  const traineeMonthGroups: MonthGroup[] = useMemo(() => {
    const sorted = [...traineeWorkouts].sort((a, b) => {
      const dateA = a.scheduledDate || a.createdAt || '';
      const dateB = b.scheduledDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
    const map = new Map<string, { label: string; workouts: WorkoutPlan[] }>();
    for (const w of sorted) {
      const { key, label } = getMonthKeyAndLabel(w.scheduledDate);
      if (!map.has(key)) {
        map.set(key, { label, workouts: [] });
      }
      map.get(key)!.workouts.push(w);
    }
    const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return keys.map((key) => ({
      key,
      label: map.get(key)!.label,
      workouts: map.get(key)!.workouts,
    }));
  }, [traineeWorkouts]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [openTraineeMonths, setOpenTraineeMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (traineeMonthGroups.length > 0) {
      const hasCurrent = traineeMonthGroups.some((g) => g.key === currentMonthKey);
      const defaultKey = hasCurrent ? currentMonthKey : traineeMonthGroups[0].key;
      setOpenTraineeMonths((prev) => {
        if (Object.keys(prev).length === 0) {
          return { [defaultKey]: true };
        }
        return prev;
      });
    }
  }, [traineeMonthGroups, currentMonthKey]);

  const toggleTraineeMonth = (key: string) => {
    setOpenTraineeMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Open create workout modal for selected trainee
  const handleOpenCreateModal = () => {
    if (!selectedTrainee) return;
    setIsCreateModalOpen(true);
  };

  // Submit new plan for selected trainee (either custom title + date or from coach template)
  const handleCreateWorkoutSubmit = async (
    title: string,
    scheduledDate: string,
    template?: WorkoutTemplate
  ) => {
    if (!selectedTrainee) return;

    let newWorkout: WorkoutPlan;
    if (template) {
      newWorkout = TemplateService.createWorkoutFromTemplate(
        template,
        selectedTrainee.id,
        scheduledDate
      );
      newWorkout.assignedByCoachId = coach.id;
      if (title.trim()) newWorkout.title = title.trim();
    } else {
      newWorkout = {
        id: generateId('workout'),
        userId: selectedTrainee.id,
        assignedByCoachId: coach.id,
        title: title.trim() || `Тренування для ${selectedTrainee.firstName || selectedTrainee.name}`,
        scheduledDate: scheduledDate || new Date().toISOString().split('T')[0],
        status: 'planned',
        completedAt: null,
        notes: '',
        createdAt: new Date().toISOString(),
        exercises: [],
      };
    }

    StorageService.saveWorkout(newWorkout);
    // Explicitly await cloud save to guarantee it's in Supabase
    await CloudStorageService.saveWorkout(newWorkout);
    setRefreshKey((k) => k + 1);
    setIsCreateModalOpen(false);
    onOpenWorkoutEditor(newWorkout, selectedTrainee);
  };

  const handleConfirmDeleteWorkout = async () => {
    if (!workoutToDelete) return;
    StorageService.deleteWorkout(workoutToDelete.id);
    await CloudStorageService.deleteWorkout(workoutToDelete.id);
    setWorkoutToDelete(null);
    setRefreshKey((k) => k + 1);
    showToast('Тренування видалено', 'success');
  };

  const handleCopyWorkout = async (source: WorkoutPlan) => {
    if (!selectedTrainee) return;
    try {
      const newWorkoutId = generateId('workout');
      const today = new Date().toISOString().split('T')[0];

      const clonedExercises = (source.exercises || []).map((ex) => {
        const weId = generateId('workoutexercise');
        const clonedSets = (ex.sets || []).map((s) => ({
          ...s,
          id: generateId('set'),
          completed: false,
          workoutExerciseId: weId,
          completedAt: null,
        }));
        return {
          ...ex,
          id: weId,
          workoutPlanId: newWorkoutId,
          sets: clonedSets,
        };
      });

      const copied: WorkoutPlan = {
        ...source,
        id: newWorkoutId,
        userId: selectedTrainee.id,
        assignedByCoachId: coach.id,
        title: `${source.title || 'Тренування'} (Копія)`,
        scheduledDate: today,
        status: 'planned',
        createdAt: new Date().toISOString(),
        completedAt: null,
        exercises: clonedExercises,
      };

      StorageService.saveWorkout(copied);
      await CloudStorageService.saveWorkout(copied);
      setRefreshKey((k) => k + 1);
      showToast('Тренування скопійовано', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Не вдалося скопіювати тренування', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-16">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`rounded-xl border p-3 flex items-center space-x-2 text-xs font-semibold animate-fade-in ${
            toastMessage.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
              : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Navbar matching WorkoutEditor and mobile app */}
      <div className="flex items-center justify-between gap-3 px-1 sm:px-2 py-2 sm:py-3 border-b border-zinc-200 dark:border-[#334155] -mt-2 mb-3 sm:mb-5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="p-1 -ml-1 text-zinc-700 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer shrink-0"
              title="Назад у профіль"
              aria-label="Назад у профіль"
            >
              <ArrowLeft className="h-6 w-6 stroke-[2]" />
            </button>
          ) : null}

          <div className="min-w-0 flex flex-col items-start text-left">
            <h1 className="font-bold text-[17px] sm:text-lg text-zinc-900 dark:text-white truncate">
              Підопічні
            </h1>
            <p className="text-[11px] text-zinc-500 dark:text-[#94A3B8] truncate mt-0.5">
              {selectedTrainee ? `Обрано: ${selectedTrainee.name || selectedTrainee.email}` : 'Складання планів та контроль прогресу'}
            </p>
          </div>
        </div>

        {/* Empty right container for balanced layout */}
        <div className="w-8 shrink-0" />
      </div>

      {/* Coach Code Sharing Box */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#60A5FA] shrink-0">
            <Key className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">Ваш код тренера</p>
            <p className="text-sm font-mono font-bold text-slate-900 dark:text-zinc-100 truncate select-all">
              {coach.profileCode || coach.id}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopyCoachCode}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 border ${
            copiedCode
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
              : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300'
          }`}
        >
          {copiedCode ? (
            <>
              <Check className="h-4 w-4 text-[#22C55E]" />
              <span>Скопійовано</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Копіювати</span>
            </>
          )}
        </button>
      </div>

      {/* Add Trainee Bar */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs">
        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
          Прикріпити нового підопічного
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Введіть ID, код або email підопічного (напр. U_278AF2CCCC або email)"
            value={newTraineeCode}
            onChange={(e) => setNewTraineeCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isAdding) {
                handleAddTrainee();
              }
            }}
            disabled={isAdding}
            className="flex-1 h-11 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 text-base sm:text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB] disabled:opacity-50 transition-all"
          />
          <button
            type="button"
            onClick={() => handleAddTrainee()}
            disabled={isAdding}
            className="h-11 inline-flex items-center justify-center space-x-1.5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 text-xs font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Пошук...</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Прикріпити</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Trainees List & Details Split */}
      {trainees.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 py-12 px-6 flex flex-col items-center justify-center text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB]/10 dark:bg-[#2563EB]/15 flex items-center justify-center mb-3 text-[#2563EB] dark:text-[#60A5FA]">
            <Users className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            У вас ще немає підопічних
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mt-1">
            Поділіться своїм кодом тренера або введіть код спортсмена вище, щоб додати його до списку.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Trainees Selector Row */}
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Ваші підопічні ({trainees.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {trainees.map((t) => {
                const isSelected = selectedTrainee?.id === t.id;
                const traineeWorkoutCount = StorageService.getWorkouts(t.id).length;

                return (
                  <div
                    key={t.id}
                    onClick={() => selectTrainee(t)}
                    className={`rounded-2xl border p-3.5 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-xs ${
                      isSelected
                        ? 'border-[#2563EB] dark:border-[#60A5FA] bg-[#2563EB]/5 dark:bg-[#2563EB]/10 ring-1 ring-[#2563EB] dark:ring-[#60A5FA]'
                        : 'border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <UserAvatar src={t.image} alt={t.name} size="sm" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                          {t.firstName || t.name} {t.lastName || ''}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {traineeWorkoutCount} тренувань
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Trainee Card & Workouts */}
          {selectedTrainee && (
            <div className="space-y-4">
              {/* Trainee Profile Card */}
              <div
                ref={traineeSwipeRef}
                className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs touch-pan-y"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <UserAvatar src={selectedTrainee.image} alt={selectedTrainee.name} size="md" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                          {selectedTrainee.firstName || selectedTrainee.name} {selectedTrainee.lastName || ''}
                        </h2>
                        <span className="rounded-md border border-[#2563EB]/30 bg-[#2563EB]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                          Атлет
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        {selectedTrainee.email} · ID: {selectedTrainee.profileCode || selectedTrainee.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setTraineeToRemove(selectedTrainee)}
                      className="h-9 px-3 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                    >
                      Відкріпити
                    </button>

                    {/* CREATE PLAN BUTTON: Opens the SAME unified CreateWorkoutModal UI */}
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="h-9 inline-flex items-center space-x-1.5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 text-xs font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Створити план тренування</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Trainee Workouts Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs px-0.5">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">
                    Тренування підопічного ({traineeWorkouts.length})
                  </span>
                </div>

                {traineeWorkouts.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/30 py-8 px-6 text-center space-y-3 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#2563EB]/10 dark:bg-[#2563EB]/15 flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA]">
                      <Dumbbell className="h-6 w-6" />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400">
                      У цього підопічного ще немає запланованих тренувань.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="inline-flex items-center space-x-1.5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 text-xs font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Скласти перше тренування</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {traineeMonthGroups.map((group) => {
                      const isOpen = Boolean(openTraineeMonths[group.key]);

                      return (
                        <div key={group.key} className="space-y-2">
                          {/* Accordion Month Header */}
                          <button
                            type="button"
                            onClick={() => toggleTraineeMonth(group.key)}
                            className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-[#f1f5f9] dark:bg-[#1d2939] hover:bg-[#e2e8f0] dark:hover:bg-[#263140] border border-[#e2e8f0] dark:border-[#334155] transition-colors cursor-pointer select-none"
                            aria-expanded={isOpen}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm sm:text-base text-[#0f172a] dark:text-[#f8fafc]">
                                {group.label}
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-[#263140] text-[#64748b] dark:text-[#94a3b8] shadow-xs">
                                {group.workouts.length}
                              </span>
                            </div>
                            <ChevronDown
                              className={`w-4 h-4 text-[#64748b] dark:text-[#94a3b8] transition-transform duration-200 shrink-0 ${
                                isOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          {/* Collapsible Month Workouts */}
                          {isOpen && (
                            <div className="space-y-2.5 pt-0.5 animate-fade-in">
                              {group.workouts.map((w) => {
                                const isCompleted = w.status === 'completed';
                                const exercisesCount = w.exercises?.length || 0;
                                const setsCount = (w.exercises || []).reduce(
                                  (acc, ex) => acc + (ex.sets?.length || 0),
                                  0
                                );

                                const isExpanded = Boolean(expandedWorkoutIds[w.id]);

                                return (
                                  <MobileSwipeableWorkoutCard
                                    key={w.id}
                                    workoutId={w.id}
                                    onCopy={() => handleCopyWorkout(w)}
                                    onDelete={() => setWorkoutToDelete(w)}
                                  >
                                    <div
                                      onClick={() => onOpenWorkoutEditor(w, selectedTrainee)}
                                      className="group bg-white dark:bg-[#1d2939] px-4 py-3.5 transition-colors cursor-pointer space-y-1.5"
                                    >
                                      {/* Row 1: Status on left, Expand/Collapse button on right */}
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-xs min-w-0 flex-wrap">
                                          <span
                                            className={`font-semibold ${
                                              isCompleted
                                                ? 'text-[#22c55e]'
                                                : w.status === 'in_progress'
                                                ? 'text-[#60a5fa]'
                                                : 'text-[#64748b] dark:text-[#94a3b8]'
                                            }`}
                                          >
                                            {isCompleted
                                              ? 'Завершено'
                                              : w.status === 'in_progress'
                                              ? 'У процесі'
                                              : 'Заплановано'}
                                          </span>
                                        </div>

                                        {/* Expand / Collapse Exercises Button */}
                                        {exercisesCount > 0 && (
                                          <button
                                            type="button"
                                            data-interactive="true"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleWorkoutExpand(w.id, e);
                                            }}
                                            className="p-1 -mr-1 rounded-lg text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] hover:bg-slate-100 dark:hover:bg-[#334155] transition-colors cursor-pointer"
                                            title={isExpanded ? 'Згорнути перелік вправ' : 'Розгорнути перелік вправ'}
                                            aria-label={isExpanded ? 'Згорнути перелік вправ' : 'Розгорнути перелік вправ'}
                                          >
                                            <ChevronDown
                                              className={`h-4 w-4 transition-transform duration-200 ${
                                                isExpanded ? 'rotate-180' : ''
                                              }`}
                                            />
                                          </button>
                                        )}
                                      </div>

                                      {/* Row 2: Title & Exercise count */}
                                      <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-sm sm:text-base text-[#0f172a] dark:text-[#f8fafc] truncate">
                                          {w.title || 'Тренування'}
                                        </h3>
                                        <span className="text-xs text-[#64748b] dark:text-[#94a3b8] shrink-0 font-medium">
                                          {exercisesCount} вправ
                                        </span>
                                      </div>

                                      {/* Row 3: Date & Sets info */}
                                      <div className="flex items-center justify-between text-xs text-[#64748b] dark:text-[#94a3b8]">
                                        <span className="font-mono text-[11px] sm:text-xs">
                                          {formatDateDDMMYY(w.scheduledDate)}
                                        </span>

                                        <div className="flex items-center gap-1 text-[11px] sm:text-xs">
                                          <Layers className="h-3 w-3" />
                                          <span>{setsCount} підходів</span>
                                        </div>
                                      </div>

                                      {/* Expandable Exercise Badges List matching user screenshot */}
                                      {isExpanded && (w.exercises || []).length > 0 && (
                                        <div
                                          data-interactive="true"
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex flex-wrap gap-1.5 pt-2.5 mt-1 border-t border-[#e2e8f0]/80 dark:border-[#334155]/80 animate-fade-in"
                                        >
                                          {(w.exercises || []).map((we, idx) => {
                                            const ex = StorageService.getExerciseById(we.exerciseId);
                                            const exName = (we.exerciseName && we.exerciseName !== 'Вправа')
                                              ? we.exerciseName
                                              : ((ex?.name && ex.name !== 'Вправа') ? ex.name : (we.exerciseName || 'Вправа'));
                                            return (
                                              <span
                                                key={idx}
                                                className="rounded-[10px] border border-[#e2e8f0] dark:border-[#334155] bg-[#f1f5f9] dark:bg-[#1e293b] px-2.5 py-1 text-xs text-[#0f172a] dark:text-[#f8fafc] font-medium"
                                              >
                                                {exName} ({we.sets?.length || 0})
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </MobileSwipeableWorkoutCard>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Workout Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(workoutToDelete)}
        title="Видалити тренування підопічного?"
        message="Ви впевнені, що хочете видалити це тренування? Всі дані тренування будуть видалені."
        workoutTitle={workoutToDelete?.title}
        workoutDate={workoutToDelete?.scheduledDate}
        confirmLabel="Так, видалити"
        onConfirm={handleConfirmDeleteWorkout}
        onClose={() => setWorkoutToDelete(null)}
      />

      {/* Remove Trainee Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(traineeToRemove)}
        title="Відкріпити підопічного?"
        message={`Ви впевнені, що хочете відкріпити ${traineeToRemove?.name}?`}
        confirmLabel="Відкріпити"
        onConfirm={handleConfirmRemoveTrainee}
        onClose={() => setTraineeToRemove(null)}
      />

      {/* Create Workout Modal for Trainee (Custom name + date or Coach's saved templates) */}
      <CreateWorkoutModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateWorkoutSubmit}
        userId={coach.id}
        modalTitle={selectedTrainee ? `Тренування: ${selectedTrainee.name}` : 'Нове тренування'}
        modalSub="Створіть порожнє або з вашого збереженого шаблону"
      />
    </div>
  );
};
