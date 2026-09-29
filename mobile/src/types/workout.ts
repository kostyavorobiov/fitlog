export type MuscleGroup =
  | 'legs'       // Ноги
  | 'back'       // Спина
  | 'chest'      // Грудні
  | 'shoulders'  // Плечі
  | 'biceps'     // Біцепс
  | 'triceps'    // Тріцепс
  | 'full_body'  // Full body
  | 'other';     // Інше

export interface MuscleGroupInfo {
  id: MuscleGroup;
  nameUk: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  iconName: string;
}

export const MUSCLE_GROUPS: Record<MuscleGroup, MuscleGroupInfo> = {
  legs: {
    id: 'legs',
    nameUk: 'Ноги',
    color: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.1)',
    badgeBorder: 'rgba(245, 158, 11, 0.3)',
    iconName: 'trending-up',
  },
  back: {
    id: 'back',
    nameUk: 'Спина',
    color: '#818cf8',
    badgeBg: 'rgba(99, 102, 241, 0.1)',
    badgeBorder: 'rgba(99, 102, 241, 0.3)',
    iconName: 'layers',
  },
  chest: {
    id: 'chest',
    nameUk: 'Грудні',
    color: '#fb7185',
    badgeBg: 'rgba(244, 63, 94, 0.1)',
    badgeBorder: 'rgba(244, 63, 94, 0.3)',
    iconName: 'shield',
  },
  shoulders: {
    id: 'shoulders',
    nameUk: 'Плечі',
    color: '#22d3ee',
    badgeBg: 'rgba(6, 182, 212, 0.1)',
    badgeBorder: 'rgba(6, 182, 212, 0.3)',
    iconName: 'crosshair',
  },
  biceps: {
    id: 'biceps',
    nameUk: 'Біцепс',
    color: '#34d399',
    badgeBg: 'rgba(16, 185, 129, 0.1)',
    badgeBorder: 'rgba(16, 185, 129, 0.3)',
    iconName: 'fitness',
  },
  triceps: {
    id: 'triceps',
    nameUk: 'Тріцепс',
    color: '#2dd4bf',
    badgeBg: 'rgba(20, 184, 166, 0.1)',
    badgeBorder: 'rgba(20, 184, 166, 0.3)',
    iconName: 'flash',
  },
  full_body: {
    id: 'full_body',
    nameUk: 'Full body',
    color: '#c084fc',
    badgeBg: 'rgba(168, 85, 247, 0.1)',
    badgeBorder: 'rgba(168, 85, 247, 0.3)',
    iconName: 'trophy',
  },
  other: {
    id: 'other',
    nameUk: 'Інше',
    color: '#a1a1aa',
    badgeBg: 'rgba(113, 113, 122, 0.1)',
    badgeBorder: 'rgba(113, 113, 122, 0.3)',
    iconName: 'ellipsis-horizontal',
  },
};

export type UserRole = 'athlete' | 'coach' | 'admin';

export interface User {
  id: string;
  profileCode: string;
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
  userId: string | null;
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
  targetRepsRange: string;
  weight: number;
  actualReps: number | null;
  completedAt: string | null;
  notes?: string;
  isWarmup?: boolean;
}

export interface WorkoutExercise {
  id: string;
  workoutPlanId: string;
  exerciseId: string;
  exerciseName?: string;
  muscleGroup?: MuscleGroup;
  order: number;
  setCount?: number;
  targetRepsRange?: string;
  notes?: string;
  supersetGroupId?: string | null;
  sets: WorkoutSet[];
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  assignedByCoachId?: string | null;
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

export const REPS_RANGES = ['4-6', '6-8', '8-10', '8-12', '10-15'] as const;
export type RepsRangeOption = (typeof REPS_RANGES)[number];
