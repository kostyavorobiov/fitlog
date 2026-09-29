import { Exercise } from '../types/workout';
import { MobileStorage } from '../lib/storage';

const EXERCISES_CACHE_KEY = 'mobile_exercises_cache';

export class ExerciseService {
  /**
   * Fetch all exercises available for the user (global + custom)
   */
  static async getExercises(userId?: string): Promise<Exercise[]> {
    return MobileStorage.getItem<Exercise[]>(EXERCISES_CACHE_KEY, []);
  }

  /**
   * Save a newly created exercise
   */
  static async createExercise(exercise: Exercise): Promise<boolean> {
    const list = await this.getExercises(exercise.userId || undefined);
    list.push(exercise);
    return MobileStorage.setItem(EXERCISES_CACHE_KEY, list);
  }

  /**
   * Delete an exercise by ID
   */
  static async deleteExercise(exerciseId: string): Promise<boolean> {
    const list = await this.getExercises();
    const filtered = list.filter((e) => e.id !== exerciseId);
    return MobileStorage.setItem(EXERCISES_CACHE_KEY, filtered);
  }
}
