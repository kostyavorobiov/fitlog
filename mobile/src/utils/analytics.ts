import { WorkoutPlan, MuscleGroup, MUSCLE_GROUPS } from '../types/workout';
import { PeriodRange } from './date';

export type AnalyticsPeriod = 'day' | 'week' | 'month';

export interface AggregatedExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  completedSetsCount: number;
  totalVolumeKg: number;
  maxWeight: number;
  repsAtMaxWeight: number;
}

export interface MuscleGroupStats {
  groupKey: MuscleGroup;
  nameUk: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  setsCount: number;
  percentage: number;
}

export interface AnalyticsResult {
  periodVolumeKg: number;
  periodTons: number;
  periodCompletedSets: number;
  workoutsCount: number;
  muscleList: MuscleGroupStats[];
  exercisesList: AggregatedExercise[];
}

/**
 * Calculates analytics metrics strictly based on completed sets (completedAt != null)
 * within the specified calendar period range.
 */
export function calculateAnalytics(
  workouts: WorkoutPlan[],
  periodRange: PeriodRange
): AnalyticsResult {
  let periodVolumeKg = 0;
  let periodCompletedSets = 0;
  const workoutsWithCompletedSets = new Set<string>();
  const muscleSetsMap: Record<string, number> = {};
  const exerciseAggMap: Record<string, AggregatedExercise> = {};

  workouts.forEach((w) => {
    const rawDateStr =
      w.scheduledDate ||
      (w.completedAt ? w.completedAt.split('T')[0] : '') ||
      (w.createdAt ? w.createdAt.split('T')[0] : '');

    if (!rawDateStr) return;
    const workoutDateStr = rawDateStr.split('T')[0];

    // Filter by calendar period boundaries [startDateStr, endDateStr]
    const inPeriod =
      workoutDateStr >= periodRange.startDateStr &&
      workoutDateStr <= periodRange.endDateStr;

    if (!inPeriod) return;

    let workoutHasCompletedSets = false;

    (w.exercises || []).forEach((we) => {
      let rawMuscle = (we.muscleGroup || 'other').toLowerCase() as MuscleGroup;
      const muscle: MuscleGroup = MUSCLE_GROUPS[rawMuscle] ? rawMuscle : 'other';

      // Aggregate exercises across workouts: match by exerciseId or normalized exerciseName
      const exKey =
        we.exerciseId ||
        (we.exerciseName ? we.exerciseName.trim().toLowerCase() : 'unknown');

      if (!exerciseAggMap[exKey]) {
        exerciseAggMap[exKey] = {
          exerciseId: we.exerciseId || exKey,
          exerciseName: we.exerciseName || 'Вправа',
          muscleGroup: muscle,
          completedSetsCount: 0,
          totalVolumeKg: 0,
          maxWeight: 0,
          repsAtMaxWeight: 0,
        };
      }

      (we.sets || []).forEach((s) => {
        // Strictly count completed sets: completedAt != null
        const isDone = s.completedAt != null && String(s.completedAt).trim() !== '';
        if (!isDone) return;

        periodCompletedSets += 1;
        workoutHasCompletedSets = true;
        muscleSetsMap[muscle] = (muscleSetsMap[muscle] || 0) + 1;

        exerciseAggMap[exKey].completedSetsCount += 1;

        const weight = Number(s.weight) || 0;
        const reps = s.actualReps !== null && s.actualReps !== undefined ? Number(s.actualReps) : 0;

        if (weight > 0 && reps > 0) {
          const vol = weight * reps;
          periodVolumeKg += vol;
          exerciseAggMap[exKey].totalVolumeKg += vol;
        }

        if (
          weight > exerciseAggMap[exKey].maxWeight ||
          (weight === exerciseAggMap[exKey].maxWeight && reps > exerciseAggMap[exKey].repsAtMaxWeight)
        ) {
          exerciseAggMap[exKey].maxWeight = weight;
          exerciseAggMap[exKey].repsAtMaxWeight = reps;
        }
      });
    });

    if (workoutHasCompletedSets) {
      workoutsWithCompletedSets.add(w.id);
    }
  });

  // Muscle groups distribution sorted descending by completed sets
  const muscleList = (Object.keys(MUSCLE_GROUPS) as MuscleGroup[])
    .map((groupKey) => {
      const info = MUSCLE_GROUPS[groupKey];
      const setsCount = muscleSetsMap[groupKey] || 0;
      const percentage =
        periodCompletedSets > 0 ? Math.round((setsCount / periodCompletedSets) * 100) : 0;
      return {
        groupKey,
        nameUk: info.nameUk,
        color: info.color,
        badgeBg: info.badgeBg,
        badgeBorder: info.badgeBorder,
        setsCount,
        percentage,
      };
    })
    .filter((m) => m.setsCount > 0)
    .sort((a, b) => b.setsCount - a.setsCount);

  // Aggregated exercises sorted descending by completed sets
  const exercisesList = Object.values(exerciseAggMap)
    .filter((e) => e.completedSetsCount > 0)
    .sort((a, b) => b.completedSetsCount - a.completedSetsCount);

  return {
    periodVolumeKg,
    periodTons: Math.round((periodVolumeKg / 1000) * 10) / 10,
    periodCompletedSets,
    workoutsCount: workoutsWithCompletedSets.size,
    muscleList,
    exercisesList,
  };
}
