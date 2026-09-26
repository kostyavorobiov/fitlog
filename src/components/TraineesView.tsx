import React, { useState, useEffect } from 'react';
import { User, WorkoutPlan, WorkoutExercise, WorkoutSet, Exercise, MUSCLE_GROUPS, REPS_RANGES } from '../types/workout';
import { StorageService, generateId } from '../services/storageService';
import { ExerciseSelectorModal } from './ExerciseSelectorModal';
import { CreateExerciseModal } from './CreateExerciseModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  Users,
  UserPlus,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  ChevronRight,
  GripVertical,
  Dumbbell,
  Clock,
  Sparkles,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Layers,
  Save,
  X,
  UserCheck,
  Award,
  AlertCircle,
  Eye,
  Edit3,
} from 'lucide-react';

interface TraineesViewProps {
  coach: User;
  onOpenWorkoutEditor?: (workout: WorkoutPlan) => void;
}

export const TraineesView: React.FC<TraineesViewProps> = ({ coach, onOpenWorkoutEditor }) => {
  const [trainees, setTrainees] = useState<User[]>([]);
  const [selectedTrainee, setSelectedTrainee] = useState<User | null>(null);
  const [newTraineeCode, setNewTraineeCode] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Trainee Workout Plan Builder State
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [planTitle, setPlanTitle] = useState('Персональне тренування');
  const [planDate, setPlanDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [planExercises, setPlanExercises] = useState<WorkoutExercise[]>([]);
  const [isExerciseSelectorOpen, setIsExerciseSelectorOpen] = useState(false);
  const [isCreateExerciseOpen, setIsCreateExerciseOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [workoutToDelete, setWorkoutToDelete] = useState<WorkoutPlan | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load trainees
  useEffect(() => {
    const list = StorageService.getTrainees(coach.id);
    setTrainees(list);
    if (list.length > 0 && !selectedTrainee) {
      setSelectedTrainee(list[0]);
    } else if (selectedTrainee) {
      // Refresh selected trainee reference
      const refreshed = list.find((t) => t.id === selectedTrainee.id) || list[0] || null;
      setSelectedTrainee(refreshed);
    }
  }, [coach.id, coach.traineeIds, refreshKey]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddTrainee = (codeToUse?: string) => {
    const code = (codeToUse || newTraineeCode).trim();
    if (!code) {
      showToast('Введіть ID або код підопічного', 'error');
      return;
    }

    const result = StorageService.addTraineeByCode(coach.id, code);
    if (result.success) {
      showToast(result.message, 'success');
      setNewTraineeCode('');
      setRefreshKey((k) => k + 1);
      if (result.trainee) {
        setSelectedTrainee(result.trainee);
      }
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleRemoveTrainee = (traineeId: string) => {
    StorageService.removeTrainee(coach.id, traineeId);
    showToast('Підопічного відкріплено', 'success');
    if (selectedTrainee?.id === traineeId) {
      setSelectedTrainee(null);
    }
    setRefreshKey((k) => k + 1);
  };

  // Trainee Workouts
  const traineeWorkouts = selectedTrainee ? StorageService.getWorkouts(selectedTrainee.id) : [];

  // Plan creation handlers
  const handleOpenPlanCreator = () => {
    if (!selectedTrainee) return;
    setPlanTitle(`Тренування для ${selectedTrainee.firstName || selectedTrainee.name}`);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setPlanDate(tomorrow.toISOString().split('T')[0]);
    setPlanExercises([]);
    setIsCreatingPlan(true);
  };

  const handleAddExerciseToPlan = (exercise: Exercise) => {
    if (!selectedTrainee) return;
    const weId = generateId('we');

    // Retrieve last performance hint for trainee
    const lastPerf = StorageService.getLastExercisePerformance(selectedTrainee.id, exercise.id);
    const defaultRange = (lastPerf?.sets[0]?.targetRepsRange || '8-12') as string;

    // Default 3 sets (configurable from 2 to 5) with previous weights and reps recorded automatically
    const initialSets: WorkoutSet[] = [1, 2, 3].map((setNum, idx) => {
      const pastSet = lastPerf?.sets[idx] || (lastPerf && lastPerf.sets.length > 0 ? lastPerf.sets[lastPerf.sets.length - 1] : null);
      return {
        id: generateId('set'),
        workoutExerciseId: weId,
        setNumber: setNum,
        targetRepsRange: defaultRange,
        weight: pastSet ? pastSet.weight : 20,
        actualReps: pastSet ? pastSet.actualReps : null,
        completedAt: null,
      };
    });

    const newWe: WorkoutExercise = {
      id: weId,
      workoutPlanId: '',
      exerciseId: exercise.id,
      order: planExercises.length + 1,
      setCount: 3,
      targetRepsRange: defaultRange,
      sets: initialSets,
    };

    setPlanExercises([...planExercises, newWe]);
  };

  const handleSetCountChange = (weIndex: number, newCount: number) => {
    if (newCount < 2 || newCount > 5) return;
    const updated = [...planExercises];
    const target = updated[weIndex];
    const currentSets = target.sets;
    const targetRange = target.targetRepsRange || '8-12';
    const lastWeight = currentSets[currentSets.length - 1]?.weight || 20;
    const lastReps = currentSets[currentSets.length - 1]?.actualReps ?? null;

    let newSets: WorkoutSet[] = [];
    if (newCount > currentSets.length) {
      newSets = [...currentSets];
      for (let i = currentSets.length + 1; i <= newCount; i++) {
        newSets.push({
          id: generateId('set'),
          workoutExerciseId: target.id,
          setNumber: i,
          targetRepsRange: targetRange,
          weight: lastWeight,
          actualReps: lastReps,
          completedAt: null,
        });
      }
    } else {
      newSets = currentSets.slice(0, newCount).map((s, idx) => ({
        ...s,
        setNumber: idx + 1,
      }));
    }

    target.setCount = newCount;
    target.sets = newSets;
    setPlanExercises(updated);
  };

  const handleTargetRepsRangeChange = (weIndex: number, range: string) => {
    const updated = [...planExercises];
    const target = updated[weIndex];
    target.targetRepsRange = range;
    target.sets = target.sets.map((s) => ({ ...s, targetRepsRange: range }));
    setPlanExercises(updated);
  };

  const handleSetWeightChange = (weIndex: number, setIndex: number, weight: number) => {
    const updated = [...planExercises];
    updated[weIndex].sets[setIndex].weight = Math.max(0, weight);
    setPlanExercises(updated);
  };

  const handleRemoveExerciseFromPlan = (weIndex: number) => {
    const filtered = planExercises
      .filter((_, idx) => idx !== weIndex)
      .map((item, idx) => ({ ...item, order: idx + 1 }));
    setPlanExercises(filtered);
  };

  // Drag and drop reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const reordered = [...planExercises];
    const item = reordered.splice(draggedIndex, 1)[0];
    reordered.splice(index, 0, item);
    const updated = reordered.map((ex, idx) => ({ ...ex, order: idx + 1 }));
    setPlanExercises(updated);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= planExercises.length) return;
    const list = [...planExercises];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    setPlanExercises(list.map((item, idx) => ({ ...item, order: idx + 1 })));
  };

  // Save Plan
  const handleSaveTraineePlan = () => {
    if (!selectedTrainee) return;
    if (planExercises.length === 0) {
      showToast('Додайте хоча б одну вправу до плану', 'error');
      return;
    }

    const newWorkoutId = generateId('workout');
    const newWorkout: WorkoutPlan = {
      id: newWorkoutId,
      userId: selectedTrainee.id,
      assignedByCoachId: coach.id,
      title: planTitle.trim() || 'Програма від тренера',
      scheduledDate: planDate,
      status: 'planned',
      completedAt: null,
      notes: `Складено тренером ${coach.name}`,
      createdAt: new Date().toISOString(),
      exercises: planExercises.map((we) => ({
        ...we,
        workoutPlanId: newWorkoutId,
      })),
    };

    StorageService.saveWorkout(newWorkout);
    showToast(`План успішно збережено для ${selectedTrainee.firstName || selectedTrainee.name}!`, 'success');
    setIsCreatingPlan(false);
    setRefreshKey((k) => k + 1);
  };

  const handleDeleteWorkout = () => {
    if (!workoutToDelete) return;
    StorageService.deleteWorkout(workoutToDelete.id);
    showToast('Тренування видалено', 'success');
    setWorkoutToDelete(null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-16">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-4 left-4 sm:left-auto sm:w-96 z-50 rounded-2xl border p-3.5 shadow-2xl backdrop-blur-xl flex items-center space-x-2.5 text-xs font-semibold animate-fade-in ${
            toastMessage.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-300'
              : 'border-rose-500/40 bg-rose-950/90 text-rose-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[10px] font-black text-amber-300 uppercase tracking-wider flex items-center space-x-1">
                <Award className="h-3 w-3" />
                <span>Тренерський кабінет</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {coach.profileCode || coach.id}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1 flex items-center space-x-2">
              <Users className="h-7 w-7 text-amber-400" />
              <span>Меню «Підопічні»</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Керуйте атлетами, призначайте тренувальні плани на майбутні дні та контролюйте прогресію ваг.
            </p>
          </div>

          {/* Add Trainee by Code Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={newTraineeCode}
                onChange={(e) => setNewTraineeCode(e.target.value)}
                placeholder="Введіть ID підопічного (напр. USR-5519)"
                className="w-full sm:w-64 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>
            <button
              onClick={() => handleAddTrainee()}
              className="flex items-center justify-center space-x-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition"
            >
              <UserPlus className="h-4 w-4" />
              <span>Додати</span>
            </button>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/5 flex items-center space-x-2 text-[11px] text-slate-400">
          <span className="font-semibold text-amber-400">Приватний доступ:</span>
          <span>Додавання підопічного здійснюється виключно за його персональним ID з розділу «Профіль».</span>
        </div>
      </div>

      {/* Main Grid: Trainees List on Left, Active Trainee Workspace on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Trainees Navigation / Selection (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Ваші підопічні ({trainees.length})
            </h3>
          </div>

          {trainees.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center space-y-3">
              <Users className="h-10 w-10 text-slate-600 mx-auto" />
              <div className="text-xs text-slate-400">
                У вас ще немає доданих підопічних. Попросіть атлета надати свій унікальний ID з вкладки «Профіль» і додайте його вище!
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {trainees.map((trainee) => {
                const isSelected = selectedTrainee?.id === trainee.id;
                const traineeWorkoutsCount = StorageService.getWorkouts(trainee.id).length;
                return (
                  <div
                    key={trainee.id}
                    onClick={() => {
                      setSelectedTrainee(trainee);
                      setIsCreatingPlan(false);
                    }}
                    className={`group cursor-pointer rounded-2xl border p-3.5 transition flex items-center justify-between ${
                      isSelected
                        ? 'border-amber-500/50 bg-amber-500/10 shadow-lg ring-1 ring-amber-500/30'
                        : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <img
                        src={trainee.image}
                        alt={trainee.name}
                        className="h-10 w-10 rounded-xl object-cover border border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate flex items-center space-x-1.5">
                          <span>{trainee.firstName || trainee.name} {trainee.lastName || ''}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          ID: <span className="text-amber-400 font-semibold">{trainee.profileCode || trainee.id}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center space-x-2 mt-0.5">
                          <span>Тренувань: {traineeWorkoutsCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTrainee(trainee.id);
                        }}
                        title="Відкріпити підопічного"
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronRight className={`h-4 w-4 ${isSelected ? 'text-amber-400' : 'text-slate-600'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Trainee Plan Manager (8 cols) */}
        <div className="lg:col-span-8">
          {selectedTrainee ? (
            <div className="space-y-4">
              {/* Selected Trainee Profile Mini Header */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md">
                <div className="flex items-center space-x-3.5">
                  <img
                    src={selectedTrainee.image}
                    alt={selectedTrainee.name}
                    className="h-12 w-12 rounded-2xl object-cover border border-amber-500/30"
                  />
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      {selectedTrainee.firstName || selectedTrainee.name} {selectedTrainee.lastName || ''}
                    </h2>
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <span className="font-mono text-amber-400 font-semibold">{selectedTrainee.profileCode || selectedTrainee.id}</span>
                      <span>•</span>
                      <span>{selectedTrainee.email}</span>
                    </div>
                  </div>
                </div>

                {!isCreatingPlan && (
                  <button
                    onClick={handleOpenPlanCreator}
                    className="flex items-center justify-center space-x-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Скласти новий план</span>
                  </button>
                )}
              </div>

              {/* TRAINER PLAN CREATOR WORKSPACE */}
              {isCreatingPlan ? (
                <div className="rounded-3xl border border-amber-500/40 bg-slate-900/90 p-5 sm:p-6 shadow-2xl backdrop-blur-xl space-y-5 animate-fade-in ring-1 ring-amber-500/20">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="h-5 w-5 text-amber-400" />
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        Конструктор тренувального плану для {selectedTrainee.firstName || selectedTrainee.name}
                      </h3>
                    </div>
                    <button
                      onClick={() => setIsCreatingPlan(false)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Plan Settings: Title & Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Назва програми тренування
                      </label>
                      <input
                        type="text"
                        value={planTitle}
                        onChange={(e) => setPlanTitle(e.target.value)}
                        placeholder="Наприклад: Груди та дельти"
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Запланована дата виконання
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-amber-400" />
                        <input
                          type="date"
                          value={planDate}
                          onChange={(e) => setPlanDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Synchronisation Notice */}
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-300/90 flex items-start space-x-2">
                    <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Розумна актуалізація на майбутні дні:</strong> Якщо ви заплануєте одну й ту саму вправу на декілька днів вперед, будь-яка зміна діапазону повторень (наприклад 3×6-8 → 3×8-10) або ваги автоматично оновиться в усіх наступних ще не виконаних тренуваннях цього підопічного.
                    </div>
                  </div>

                  {/* Exercises in Plan */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-white flex items-center space-x-2">
                        <span>Вправи в плані ({planExercises.length})</span>
                        <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
                          (перетягуйте картки для зміни порядку)
                        </span>
                      </div>

                      <button
                        onClick={() => setIsExerciseSelectorOpen(true)}
                        className="inline-flex items-center space-x-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition shadow-sm"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Додати вправу</span>
                      </button>
                    </div>

                    {planExercises.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-850/40 p-8 text-center space-y-2">
                        <Dumbbell className="h-8 w-8 text-slate-600 mx-auto" />
                        <p className="text-xs text-slate-400">У плані ще немає вправ.</p>
                        <button
                          onClick={() => setIsExerciseSelectorOpen(true)}
                          className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition"
                        >
                          Обрати вправи з бази
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {planExercises.map((we, index) => {
                          const exercise = StorageService.getExerciseById(we.exerciseId);
                          const muscle = exercise ? MUSCLE_GROUPS[exercise.muscleGroup] : null;
                          const lastPerf = StorageService.getLastExercisePerformance(selectedTrainee.id, we.exerciseId);
                          const isDragged = draggedIndex === index;

                          return (
                            <div
                              key={we.id}
                              draggable
                              onDragStart={() => handleDragStart(index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragEnd={handleDragEnd}
                              className={`rounded-2xl border bg-slate-800/80 p-3.5 sm:p-4 transition space-y-3 ${
                                isDragged
                                  ? 'border-amber-400 bg-amber-500/10 opacity-60'
                                  : 'border-slate-700/80 hover:border-slate-600'
                              }`}
                            >
                              {/* Exercise Header */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  {/* Drag Handle & Order */}
                                  <div className="flex items-center space-x-1 cursor-grab active:cursor-grabbing text-slate-500 hover:text-amber-400 transition">
                                    <GripVertical className="h-4 w-4" />
                                    <span className="font-mono text-xs font-bold text-amber-400">
                                      #{index + 1}
                                    </span>
                                  </div>

                                  <div className="min-w-0">
                                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                                      {exercise?.name || 'Вправа'}
                                    </h4>
                                    {muscle && (
                                      <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold border ${muscle.badgeBg} ${muscle.badgeBorder} ${muscle.color} mt-0.5`}>
                                        {muscle.nameUk}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Reorder Up/Down & Delete */}
                                <div className="flex items-center space-x-1 shrink-0">
                                  <button
                                    disabled={index === 0}
                                    onClick={() => handleMoveOrder(index, 'up')}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-700 transition"
                                    title="Підняти вгору"
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </button>
                                  <button
                                    disabled={index === planExercises.length - 1}
                                    onClick={() => handleMoveOrder(index, 'down')}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-700 transition"
                                    title="Опустити вниз"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveExerciseFromPlan(index)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition ml-1"
                                    title="Видалити вправу"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Trainee Past Performance Hint */}
                              {lastPerf && lastPerf.sets.length > 0 && (
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300 flex items-center space-x-2">
                                  <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                  <span>
                                    Минулий результат підопічного: <strong>{lastPerf.maxWeight} кг</strong> (
                                    {lastPerf.sets.map((s) => `${s.weight}кг×${s.actualReps}`).join(', ')})
                                  </span>
                                </div>
                              )}

                              {/* SETTINGS FOR THIS EXERCISE: Set count (2 to 5) & Reps Range */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-700/60">
                                {/* Target Reps Range Selector (Above Set Count) */}
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                    Діапазон повторень:
                                  </label>
                                  <div className="flex items-center space-x-1.5">
                                    {(['4-6', '6-8', '8-12', '10-15'] as const).map((range) => {
                                      const active = (we.targetRepsRange || we.sets[0]?.targetRepsRange) === range;
                                      return (
                                        <button
                                          key={range}
                                          type="button"
                                          onClick={() => handleTargetRepsRangeChange(index, range)}
                                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                                            active
                                              ? 'border-amber-400 bg-amber-500 text-slate-950 shadow-md'
                                              : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750'
                                          }`}
                                        >
                                          {range}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Set Count Selector (Below Rep Range): 2, 3, 4, 5 */}
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                    Кількість підходів (від 2 до 5):
                                  </label>
                                  <div className="flex items-center space-x-1.5">
                                    {[2, 3, 4, 5].map((cnt) => {
                                      const active = (we.setCount || we.sets.length) === cnt;
                                      return (
                                        <button
                                          key={cnt}
                                          type="button"
                                          onClick={() => handleSetCountChange(index, cnt)}
                                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                                            active
                                              ? 'border-amber-400 bg-amber-500 text-slate-950 shadow-md'
                                              : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                                          }`}
                                        >
                                          {cnt}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              {/* Sets preview / weight assignment */}
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                  Параметри підходів:
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                  {we.sets.map((set, sIdx) => (
                                    <div
                                      key={set.id}
                                      className="rounded-xl border border-slate-700/60 bg-slate-850/90 p-2 text-center"
                                    >
                                      <div className="text-[10px] font-bold text-slate-400">
                                        Підхід #{set.setNumber}
                                      </div>
                                      <div className="text-[10px] font-mono text-amber-300/90 my-0.5">
                                        {set.targetRepsRange} повт.
                                      </div>
                                      <div className="flex items-center justify-center space-x-1 mt-1">
                                        <input
                                          type="number"
                                          step="2.5"
                                          min="0"
                                          value={set.weight}
                                          onChange={(e) =>
                                            handleSetWeightChange(index, sIdx, parseFloat(e.target.value) || 0)
                                          }
                                          className="w-14 rounded-lg border border-slate-700 bg-slate-800 py-1 text-center font-mono text-xs font-bold text-white focus:border-amber-500 focus:outline-none"
                                        />
                                        <span className="text-[10px] text-slate-400">кг</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-3 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsCreatingPlan(false)}
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                    >
                      Скасувати
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTraineePlan}
                      className="flex-2 flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition"
                    >
                      <Save className="h-4 w-4" />
                      <span>Зберегти план для підопічного</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* TRAINEE WORKOUT PLANS & HISTORY LIST */}
              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-amber-400" />
                    <span>Програми та історія тренувань підопічного ({traineeWorkouts.length})</span>
                  </h3>
                </div>

                {traineeWorkouts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center space-y-2">
                    <Calendar className="h-8 w-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">У підопічного ще немає запланованих або завершених тренувань.</p>
                    <button
                      onClick={handleOpenPlanCreator}
                      className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition"
                    >
                      Скласти перший план
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {traineeWorkouts.map((w) => {
                      const isAssignedByCoach = w.assignedByCoachId === coach.id;
                      const isCompleted = w.status === 'completed';
                      return (
                        <div
                          key={w.id}
                          className="rounded-2xl border border-slate-800 bg-slate-850/80 p-4 transition hover:border-slate-700 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                    isCompleted
                                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                      : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                  }`}
                                >
                                  {isCompleted ? 'Завершено' : 'Заплановано'}
                                </span>
                                {isAssignedByCoach && (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                                    Призначено вами
                                  </span>
                                )}
                                <span className="text-xs text-slate-400 font-mono flex items-center space-x-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{w.scheduledDate}</span>
                                </span>
                              </div>

                              <h4 className="text-sm font-bold text-white mt-1">{w.title}</h4>
                            </div>

                            <div className="flex items-center space-x-2">
                              {onOpenWorkoutEditor && (
                                <button
                                  onClick={() => onOpenWorkoutEditor(w)}
                                  className="inline-flex items-center space-x-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
                                >
                                  <Edit3 className="h-3.5 w-3.5 text-amber-400" />
                                  <span>Відкрити / Редагувати</span>
                                </button>
                              )}
                              <button
                                onClick={() => setWorkoutToDelete(w)}
                                className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                title="Видалити це тренування"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Exercise Badges List */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {w.exercises.map((we, eIdx) => {
                              const ex = StorageService.getExerciseById(we.exerciseId);
                              return (
                                <div
                                  key={we.id || eIdx}
                                  className="rounded-lg border border-slate-700/60 bg-slate-800/60 px-2 py-1 text-[11px] text-slate-300 flex items-center space-x-1.5"
                                >
                                  <span className="font-mono text-amber-400 font-bold">#{eIdx + 1}</span>
                                  <span>{ex?.name || 'Вправа'}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    ({we.sets.length}×{we.targetRepsRange || '8-12'})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
              <UserCheck className="h-12 w-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">Оберіть підопічного</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Оберіть користувача зі списку ліворуч, щоб переглянути його плани або сформувати нову програму тренувань.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Exercise Selector Modal */}
      {isExerciseSelectorOpen && (
        <ExerciseSelectorModal
          isOpen={isExerciseSelectorOpen}
          onClose={() => setIsExerciseSelectorOpen(false)}
          onSelect={(ex: Exercise) => {
            handleAddExerciseToPlan(ex);
            setIsExerciseSelectorOpen(false);
          }}
          onOpenCreateModal={() => {
            setIsExerciseSelectorOpen(false);
            setIsCreateExerciseOpen(true);
          }}
          userId={coach.id}
        />
      )}

      {/* Delete Confirmation Modal */}
      {workoutToDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(workoutToDelete)}
          title="Видалити тренування підопічного?"
          message={`Ви впевнені, що хочете видалити "${workoutToDelete.title}" (${workoutToDelete.scheduledDate})? Цю дію неможливо буде скасувати.`}
          onConfirm={handleDeleteWorkout}
          onClose={() => setWorkoutToDelete(null)}
        />
      )}

      {/* Create Exercise Modal */}
      {isCreateExerciseOpen && (
        <CreateExerciseModal
          isOpen={isCreateExerciseOpen}
          userId={coach.id}
          onClose={() => setIsCreateExerciseOpen(false)}
          onCreated={(newEx: Exercise) => {
            handleAddExerciseToPlan(newEx);
            setIsCreateExerciseOpen(false);
          }}
        />
      )}
    </div>
  );
};
