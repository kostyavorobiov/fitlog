export type MuscleGroup =
  | 'legs'       // Ноги
  | 'glutes'     // Сідниці
  | 'back'       // Спина
  | 'chest'      // Грудні
  | 'shoulders'  // Плечі
  | 'biceps'     // Біцепс
  | 'triceps'    // Тріцепс
  | 'other'      // Інше
  | 'full_body'  // Застаріле (перенаправляється на Сідниці)
  | string;      // Підтримка користувацьких категорій

export interface MuscleGroupInfo {
  id: string;
  nameUk: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  iconName: string;
}

export interface ExerciseCategory {
  id: string;
  nameUk: string;
  color?: string;
  badgeBg?: string;
  badgeBorder?: string;
  iconName?: string;
  isDefault?: boolean;
}

export const DEFAULT_CATEGORIES: ExerciseCategory[] = [
  {
    id: 'chest',
    nameUk: 'Грудні',
    color: '#fb7185',
    badgeBg: 'rgba(244, 63, 94, 0.1)',
    badgeBorder: 'rgba(244, 63, 94, 0.3)',
    iconName: 'shield',
    isDefault: true,
  },
  {
    id: 'back',
    nameUk: 'Спина',
    color: '#818cf8',
    badgeBg: 'rgba(99, 102, 241, 0.1)',
    badgeBorder: 'rgba(99, 102, 241, 0.3)',
    iconName: 'layers',
    isDefault: true,
  },
  {
    id: 'legs',
    nameUk: 'Ноги',
    color: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.1)',
    badgeBorder: 'rgba(245, 158, 11, 0.3)',
    iconName: 'trending-up',
    isDefault: true,
  },
  {
    id: 'glutes',
    nameUk: 'Сідниці',
    color: '#ec4899',
    badgeBg: 'rgba(236, 72, 153, 0.1)',
    badgeBorder: 'rgba(236, 72, 153, 0.3)',
    iconName: 'flame',
    isDefault: true,
  },
  {
    id: 'shoulders',
    nameUk: 'Плечі',
    color: '#22d3ee',
    badgeBg: 'rgba(6, 182, 212, 0.1)',
    badgeBorder: 'rgba(6, 182, 212, 0.3)',
    iconName: 'crosshair',
    isDefault: true,
  },
  {
    id: 'biceps',
    nameUk: 'Біцепс',
    color: '#34d399',
    badgeBg: 'rgba(16, 185, 129, 0.1)',
    badgeBorder: 'rgba(16, 185, 129, 0.3)',
    iconName: 'fitness',
    isDefault: true,
  },
  {
    id: 'triceps',
    nameUk: 'Тріцепс',
    color: '#2dd4bf',
    badgeBg: 'rgba(20, 184, 166, 0.1)',
    badgeBorder: 'rgba(20, 184, 166, 0.3)',
    iconName: 'flash',
    isDefault: true,
  },
  {
    id: 'other',
    nameUk: 'Інше',
    color: '#a1a1aa',
    badgeBg: 'rgba(113, 113, 122, 0.1)',
    badgeBorder: 'rgba(113, 113, 122, 0.3)',
    iconName: 'ellipsis-horizontal',
    isDefault: true,
  },
];

export const MUSCLE_GROUPS: Record<string, MuscleGroupInfo> = {
  legs: {
    id: 'legs',
    nameUk: 'Ноги',
    color: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.1)',
    badgeBorder: 'rgba(245, 158, 11, 0.3)',
    iconName: 'trending-up',
  },
  glutes: {
    id: 'glutes',
    nameUk: 'Сідниці',
    color: '#ec4899',
    badgeBg: 'rgba(236, 72, 153, 0.1)',
    badgeBorder: 'rgba(236, 72, 153, 0.3)',
    iconName: 'flame',
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
    id: 'glutes',
    nameUk: 'Сідниці',
    color: '#ec4899',
    badgeBg: 'rgba(236, 72, 153, 0.1)',
    badgeBorder: 'rgba(236, 72, 153, 0.3)',
    iconName: 'flame',
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

export const getMuscleGroupInfo = (
  mg?: string,
  categories?: ExerciseCategory[]
): MuscleGroupInfo => {
  if (!mg) return MUSCLE_GROUPS.other;
  if (mg === 'full_body') return MUSCLE_GROUPS.glutes;
  if (MUSCLE_GROUPS[mg]) return MUSCLE_GROUPS[mg];
  if (categories) {
    const custom = categories.find((c) => c.id === mg || c.nameUk === mg);
    if (custom) {
      return {
        id: custom.id,
        nameUk: custom.nameUk,
        color: custom.color || '#a855f7',
        badgeBg: custom.badgeBg || 'rgba(168, 85, 247, 0.1)',
        badgeBorder: custom.badgeBorder || 'rgba(168, 85, 247, 0.3)',
        iconName: custom.iconName || 'barbell-outline',
      };
    }
  }
  return {
    id: mg,
    nameUk: mg,
    color: '#a855f7',
    badgeBg: 'rgba(168, 85, 247, 0.1)',
    badgeBorder: 'rgba(168, 85, 247, 0.3)',
    iconName: 'barbell-outline',
  };
};

export type UserRole = 'athlete' | 'coach' | 'admin';
export type Gender = 'male' | 'female';
export type ActivityLevel = 1.2 | 1.375 | 1.55 | 1.725 | 1.9;
export type NutritionGoal = 'weight_loss' | 'maintenance' | 'weight_gain';

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
  customRepRanges?: string[];
  createdAt: string;

  // Biometrics & Nutrition
  gender?: Gender;
  birthDate?: string; // YYYY-MM-DD
  age?: number;
  weight?: number; // kg
  height?: number; // cm
  activityLevel?: ActivityLevel;
  goal?: NutritionGoal;
  calorieAdjustmentPercent?: number; // % deficit or surplus
  proteinPerKg?: number; // g/kg
  fatPerKg?: number; // g/kg
  carbsPerKg?: number; // g/kg
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

export const isCustomExercise = (ex: Exercise): boolean => {
  if (!ex) return false;
  if (ex.isDefault === true) return false;
  if (ex.id.startsWith('global_ex') || ex.id.startsWith('def_ex')) return false;
  if (!ex.userId || ex.userId === 'null') return false;
  return true;
};

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

export const DEFAULT_REPS_RANGES = ['4-6', '6-8', '8-10', '8-12', '10-15', '12-15'] as const;
export const REPS_RANGES = DEFAULT_REPS_RANGES;
export type RepsRangeOption = string;
