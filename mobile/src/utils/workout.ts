import { WorkoutSet } from '../types/workout';

/**
 * Calculate 1RM (one-rep maximum) using the Brzycki formula.
 * For reps === 1, 1RM is the weight itself.
 * If weight <= 0 or reps <= 0, returns 0.
 */
export const calculate1RM = (weight: number, reps: number): number => {
  if (!weight || weight <= 0 || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  if (reps >= 37) return Math.round(weight * (1 + reps / 30) * 10) / 10;
  // Brzycki: weight * (36 / (37 - reps))
  const est1RM = weight * (36 / (37 - reps));
  return Math.round(est1RM * 10) / 10;
};

/**
 * Calculate the best estimated 1RM for an exercise.
 * Considers current workout sets (any valid weight > 0 and actualReps > 0)
 * and falls back to past performance history (pastPerf) so 1RM is always visible if exercise was ever done.
 * Returns 0 if no valid records exist.
 */
export const getExercise1RM = (
  sets?: WorkoutSet[],
  pastPerf?: import('../types/workout').PastExercisePerformance | null
): number => {
  let best1RM = 0;

  // 1. Check current sets (any set with weight and reps)
  if (sets && Array.isArray(sets) && sets.length > 0) {
    for (const s of sets) {
      const w = Number(s.weight);
      const r = Number(s.actualReps);
      if (w > 0 && r > 0) {
        const est1RM = calculate1RM(w, r);
        if (est1RM > best1RM) {
          best1RM = est1RM;
        }
      }
    }
  }

  // 2. Fall back to past performance if current sets don't have recorded 1RM
  if (best1RM === 0 && pastPerf) {
    if (pastPerf.sets && Array.isArray(pastPerf.sets)) {
      for (const ps of pastPerf.sets) {
        const w = Number(ps.weight);
        const r = Number(ps.actualReps);
        if (w > 0 && r > 0) {
          const est = calculate1RM(w, r);
          if (est > best1RM) {
            best1RM = est;
          }
        }
      }
    }
    if (best1RM === 0 && pastPerf.maxWeight && pastPerf.maxWeight > 0) {
      best1RM = pastPerf.maxWeight;
    }
  }

  return best1RM;
};

/**
 * Format 1RM for UI display:
 * Returns e.g. "85 кг" or "85.5 кг", or "—" if 0.
 */
export const format1RM = (val: number): string => {
  return val > 0 ? `${val} кг` : '—';
};

/**
 * Extract minimum reps from a target reps range string
 * (e.g. "6-10" -> 6, "10-15" -> 10, "8-12" -> 8, "4-6" -> 4).
 */
export const getMinRepsFromRange = (range?: string): number => {
  if (!range) return 8;
  const match = String(range).trim().match(/^(\d+)/);
  if (match) {
    const min = parseInt(match[1], 10);
    if (!isNaN(min) && min > 0) return min;
  }
  return 8;
};
