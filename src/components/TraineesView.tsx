import React, { useState, useEffect } from 'react';
import { User, WorkoutPlan } from '../types/workout';
import { StorageService, generateId } from '../services/storageService';
import { CloudStorageService } from '../services/cloudStorageService';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { UserAvatar } from './UserAvatar';
import {
  Users,
  UserPlus,
  Calendar,
  Plus,
  Trash2,
  ChevronRight,
  Dumbbell,
  Clock,
  Layers,
  Award,
  Copy,
  Check,
  Edit3,
  Loader2,
} from 'lucide-react';
import { useSwipeGesture } from '../utils/useSwipeGesture';

interface TraineesViewProps {
  coach: User;
  onOpenWorkoutEditor: (workout: WorkoutPlan, trainee: User) => void;
  selectedTraineeId?: string | null;
  onSelectTraineeId?: (traineeId: string | null) => void;
}

export const TraineesView: React.FC<TraineesViewProps> = ({
  coach,
  onOpenWorkoutEditor,
  selectedTraineeId: externalSelectedTraineeId,
  onSelectTraineeId: externalOnSelectTraineeId,
}) => {
  const [trainees, setTrainees] = useState<User[]>([]);
  const [selectedTrainee, setSelectedTrainee] = useState<User | null>(null);
  const [newTraineeCode, setNewTraineeCode] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState<WorkoutPlan | null>(null);
  const [traineeToRemove, setTraineeToRemove] = useState<User | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  // Create new plan for selected trainee using the unified workout editor
  const handleCreatePlanForTrainee = async () => {
    if (!selectedTrainee) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const newWorkout: WorkoutPlan = {
      id: generateId('workout'),
      userId: selectedTrainee.id,
      assignedByCoachId: coach.id,
      title: `Тренування для ${selectedTrainee.firstName || selectedTrainee.name}`,
      scheduledDate: tomorrowStr,
      status: 'planned',
      completedAt: null,
      notes: '',
      createdAt: new Date().toISOString(),
      exercises: [],
    };

    StorageService.saveWorkout(newWorkout);
    // Explicitly await cloud save to guarantee it's in Supabase
    await CloudStorageService.saveWorkout(newWorkout);
    setRefreshKey((k) => k + 1);
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-16">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`rounded-lg border p-3 flex items-center space-x-2 text-xs font-semibold animate-fade-in ${
            toastMessage.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
              : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Підопічні (Тренер)
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Управління підопічними, складання тренувальних планів та контроль прогресу
          </p>
        </div>

        {/* Coach ID Share Box */}
        <div className="flex items-center space-x-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 text-xs self-start sm:self-auto">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Мій код тренера:</div>
          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 select-all">
            {coach.profileCode || coach.id}
          </span>
          <button
            type="button"
            onClick={handleCopyCoachCode}
            className="p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Скопіювати код"
          >
            {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Add Trainee Bar */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
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
            className="flex-1 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-base sm:text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => handleAddTrainee()}
            disabled={isAdding}
            className="h-9 inline-flex items-center justify-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-4 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer shrink-0 disabled:opacity-50"
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
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-10 text-center space-y-2">
          <Users className="h-8 w-8 text-zinc-400 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            У вас ще немає підопічних
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            Поділіться своїм кодом тренера або введіть код спортсмена вище, щоб додати його до списку.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Trainees Selector Row */}
          <div>
            <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
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
                    className={`rounded-lg border p-3 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-900 dark:ring-zinc-100'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <UserAvatar src={t.image} alt={t.name} size="sm" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {t.firstName || t.name} {t.lastName || ''}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          {traineeWorkoutCount} тренувань
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Trainee Workouts & Management Panel (Supports Swipe Left/Right between trainees) */}
          {selectedTrainee && (
            <div
              ref={traineeSwipeRef}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-4 touch-pan-y"
            >
              {/* Trainee Subheader */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <div className="flex items-center space-x-3">
                  <UserAvatar src={selectedTrainee.image} alt={selectedTrainee.name} size="md" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {selectedTrainee.firstName || selectedTrainee.name} {selectedTrainee.lastName || ''}
                      </h2>
                      <span className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-400">
                        Атлет
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {selectedTrainee.email} · ID: {selectedTrainee.profileCode || selectedTrainee.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setTraineeToRemove(selectedTrainee)}
                    className="h-8 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-medium hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                  >
                    Відкріпити
                  </button>

                  {/* CREATE PLAN BUTTON: Opens the SAME unified WorkoutEditor UI */}
                  <button
                    type="button"
                    onClick={handleCreatePlanForTrainee}
                    className="h-8 inline-flex items-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Створити план тренування</span>
                  </button>
                </div>
              </div>

              {/* Trainee Workouts List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Тренування підопічного ({traineeWorkouts.length})
                  </span>
                </div>

                {traineeWorkouts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center space-y-2">
                    <Dumbbell className="h-6 w-6 text-zinc-400 mx-auto" />
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      У цього підопічного ще немає запланованих тренувань.
                    </p>
                    <button
                      type="button"
                      onClick={handleCreatePlanForTrainee}
                      className="inline-flex items-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3.5 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Скласти перше тренування</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {traineeWorkouts.map((w) => {
                      const isCompleted = w.status === 'completed';
                      const exercisesCount = w.exercises?.length || 0;
                      const setsCount = (w.exercises || []).reduce(
                        (acc, ex) => acc + (ex.sets?.length || 0),
                        0
                      );

                      return (
                        <div
                          key={w.id}
                          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center space-x-2 text-xs">
                              <span
                                className={`font-semibold ${
                                  isCompleted
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : w.status === 'in_progress'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-zinc-500 dark:text-zinc-400'
                                }`}
                              >
                                {isCompleted
                                  ? 'Завершено'
                                  : w.status === 'in_progress'
                                  ? 'У процесі'
                                  : 'Заплановано'}
                              </span>
                              <span className="text-zinc-300 dark:text-zinc-700">·</span>
                              <span className="flex items-center space-x-1 text-zinc-500 dark:text-zinc-400 font-mono text-xs">
                                <Calendar className="h-3 w-3" />
                                <span>{w.scheduledDate}</span>
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {w.title || 'Тренування без назви'}
                            </h4>

                            <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                              <span>{exercisesCount} вправ</span>
                              <span className="text-zinc-300 dark:text-zinc-700">·</span>
                              <span>{setsCount} підходів</span>
                            </div>

                            {/* Exercises Names Preview */}
                            {(w.exercises || []).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {(w.exercises || []).map((we, idx) => {
                                  const ex = StorageService.getExerciseById(we.exerciseId);
                                  const exName = ex?.name || we.exerciseName || 'Вправа';
                                  return (
                                    <span
                                      key={idx}
                                      className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-700 dark:text-zinc-300 font-medium"
                                    >
                                      {exName} ({we.sets?.length || 0})
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setWorkoutToDelete(w)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Видалити тренування"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>

                            {/* Open WorkoutEditor with this trainee's workout */}
                            <button
                              type="button"
                              onClick={() => onOpenWorkoutEditor(w, selectedTrainee)}
                              className="inline-flex items-center space-x-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Редагувати план</span>
                            </button>
                          </div>
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
    </div>
  );
};
