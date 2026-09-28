export type MuscleGroup =
  | 'chest'      // Груди
  | 'back'       // Спина
  | 'legs'       // Ноги
  | 'shoulders'  // Плечі
  | 'biceps'     // Біцепс
  | 'triceps'    // Тріцепс
  | 'core'       // Прес / Кор
  | 'cardio'     // Кардіо
  | 'full_body'; // Все тіло

export interface MuscleGroupInfo {
  id: MuscleGroup;
  nameUk: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  iconName: string;
}

export const MUSCLE_GROUPS: Record<MuscleGroup, MuscleGroupInfo> = {
  chest: {
    id: 'chest',
    nameUk: 'Груди',
    color: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    badgeBorder: 'border-rose-500/30',
    iconName: 'Shield',
  },
  back: {
    id: 'back',
    nameUk: 'Спина',
    color: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    badgeBorder: 'border-indigo-500/30',
    iconName: 'Layers',
  },
  legs: {
    id: 'legs',
    nameUk: 'Ноги',
    color: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    badgeBorder: 'border-amber-500/30',
    iconName: 'Activity',
  },
  shoulders: {
    id: 'shoulders',
    nameUk: 'Плечі',
    color: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    badgeBorder: 'border-cyan-500/30',
    iconName: 'Crosshair',
  },
  biceps: {
    id: 'biceps',
    nameUk: 'Біцепс',
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    badgeBorder: 'border-emerald-500/30',
    iconName: 'Dumbbell',
  },
  triceps: {
    id: 'triceps',
    nameUk: 'Тріцепс',
    color: 'text-teal-400',
    badgeBg: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
    badgeBorder: 'border-teal-500/30',
    iconName: 'Zap',
  },
  core: {
    id: 'core',
    nameUk: 'Прес / Кор',
    color: 'text-orange-400',
    badgeBg: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
    badgeBorder: 'border-orange-500/30',
    iconName: 'Flame',
  },
  cardio: {
    id: 'cardio',
    nameUk: 'Кардіо',
    color: 'text-pink-400',
    badgeBg: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
    badgeBorder: 'border-pink-500/30',
    iconName: 'HeartPulse',
  },
  full_body: {
    id: 'full_body',
    nameUk: 'Все тіло',
    color: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    badgeBorder: 'border-purple-500/30',
    iconName: 'Trophy',
  },
};

export type UserRole = 'athlete' | 'coach' | 'admin';

export interface User {
  id: string;
  profileCode: string; // e.g. "USR-7492" for trainee lookup
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  image: string;
  role: UserRole;
  coachId?: string | null;
  traineeIds?: string[];
  createdAt: string;
}

export interface Exercise {
  id: string;
  userId: string | null; // null for default/global exercises
  name: string;
  muscleGroup: MuscleGroup;
  description?: string;
  isDefault?: boolean;
  createdAt: string;
}

export interface WorkoutSet {
  id: string;
  workoutExerciseId: string;
  setNumber: number;
  targetRepsRange: string; // e.g. "6-8", "8-12", "10-15"
  weight: number; // in kg
  actualReps: number | null; // completed reps
  completedAt: string | null; // ISO string if done
  notes?: string;
  isWarmup?: boolean;
}

export interface WorkoutExercise {
  id: string;
  workoutPlanId: string;
  exerciseId: string;
  exerciseName?: string; // Embedded exercise name for offline and cross-user display
  muscleGroup?: MuscleGroup; // Embedded muscle group
  order: number;
  setCount?: number; // 2, 3, 4, 5
  targetRepsRange?: string; // "6-8" | "8-12" | "10-15"
  notes?: string;
  supersetGroupId?: string | null; // e.g. "SS-1" for supersets grouping
  sets: WorkoutSet[];
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  assignedByCoachId?: string | null; // ID of the coach who assigned this workout
  title: string;
  scheduledDate: string; // YYYY-MM-DD
  status: 'planned' | 'in_progress' | 'completed';
  completedAt?: string | null;
  notes?: string;
  durationMinutes?: number;
  createdAt: string;
  exercises: WorkoutExercise[];
}

export interface PastExerciseSetSummary {
  setNumber: number;
  weight: number;
  actualReps: number;
  targetRepsRange?: string;
}

export interface PastExercisePerformance {
  workoutId: string;
  workoutTitle: string;
  date: string;
  sets: PastExerciseSetSummary[];
  maxWeight: number;
  totalVolume: number;
}

export const REPS_RANGES = ['6-8', '8-12', '10-15'] as const;
export type RepsRangeOption = (typeof REPS_RANGES)[number];

