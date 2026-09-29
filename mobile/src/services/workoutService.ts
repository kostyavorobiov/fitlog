import { WorkoutPlan } from '../types/workout';
import { MobileStorage } from '../lib/storage';

const WORKOUTS_CACHE_KEY = 'mobile_workouts_cache';

export class WorkoutService {
  /**
   * Fetch workouts for a specific user
   */
  static async getWorkouts(userId: string): Promise<WorkoutPlan[]> {
    return MobileStorage.getItem<WorkoutPlan[]>(`${WORKOUTS_CACHE_KEY}_${userId}`, []);
  }

  /**
   * Get a single workout by ID
   */
  static async getWorkoutById(workoutId: string): Promise<WorkoutPlan | null> {
    // Scaffold ready for Supabase or local storage lookup
    return null;
  }

  /**
   * Save or update a workout plan
   */
  static async saveWorkout(workout: WorkoutPlan): Promise<boolean> {
    const list = await this.getWorkouts(workout.userId);
    const index = list.findIndex((w) => w.id === workout.id);
    if (index >= 0) {
      list[index] = workout;
    } else {
      list.push(workout);
    }
    return MobileStorage.setItem(`${WORKOUTS_CACHE_KEY}_${workout.userId}`, list);
  }

  /**
   * Delete a workout by ID
   */
  static async deleteWorkout(userId: string, workoutId: string): Promise<boolean> {
    const list = await this.getWorkouts(userId);
    const filtered = list.filter((w) => w.id !== workoutId);
    return MobileStorage.setItem(`${WORKOUTS_CACHE_KEY}_${userId}`, filtered);
  }
}
