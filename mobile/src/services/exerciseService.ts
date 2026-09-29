import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Exercise } from '../types/workout';
import { MobileStorage } from '../lib/storage';

const EXERCISES_CACHE_KEY = 'mobile_exercises_cache';

export class ExerciseService {
  /**
   * Fetch all exercises available for the user (global + custom)
   */
  static async getExercises(userId?: string): Promise<Exercise[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('exercises').select('*');

        if (userId) {
          query = query.or(`is_default.eq.true,user_id.is.null,user_id.eq.${userId}`);
        } else {
          query = query.or('is_default.eq.true,user_id.is.null');
        }

        const { data, error } = await query.order('name', { ascending: true });

        if (!error && data) {
          const mapped: Exercise[] = data
            .filter((e: any) => e.description !== '__FITLOG_DELETED__')
            .map((e: any) => ({
              id: e.id,
              userId: e.user_id,
              name: e.name,
              muscleGroup: e.muscle_group,
              description: e.description || '',
              isDefault: Boolean(e.is_default),
              createdAt: e.created_at,
            }));

          await MobileStorage.setItem(EXERCISES_CACHE_KEY, mapped);
          return mapped;
        } else if (error) {
          console.warn('[ExerciseService.getExercises] Supabase error:', error.message);
        }
      } catch (err) {
        console.warn('[ExerciseService.getExercises] Network or runtime error:', err);
      }
    }

    const cached = await MobileStorage.getItem<Exercise[]>(EXERCISES_CACHE_KEY, []);
    if (userId) {
      return cached.filter((e) => e.isDefault || !e.userId || e.userId === userId);
    }
    return cached.filter((e) => e.isDefault || !e.userId);
  }

  /**
   * Create or update an exercise
   */
  static async createExercise(exercise: Exercise): Promise<boolean> {
    // 1. Update local cache
    const list = await this.getExercises(exercise.userId || undefined);
    const existingIdx = list.findIndex((e) => e.id === exercise.id);
    if (existingIdx >= 0) {
      list[existingIdx] = exercise;
    } else {
      list.push(exercise);
    }
    await MobileStorage.setItem(EXERCISES_CACHE_KEY, list);

    // 2. Persist to Supabase
    if (isSupabaseConfigured() && supabase) {
      try {
        // Try RPC save_exercise first
        const { data: rpcRes, error: rpcError } = await supabase.rpc('save_exercise', {
          p_id: exercise.id,
          p_user_id: exercise.isDefault ? null : exercise.userId,
          p_name: exercise.name,
          p_muscle_group: exercise.muscleGroup,
          p_description: exercise.description || '',
          p_is_default: Boolean(exercise.isDefault),
        });

        if (!rpcError && rpcRes !== false) {
          return true;
        }

        // Direct table upsert fallback
        const { error: upsertErr } = await supabase.from('exercises').upsert(
          {
            id: exercise.id,
            user_id: exercise.isDefault ? null : exercise.userId,
            name: exercise.name,
            muscle_group: exercise.muscleGroup,
            description: exercise.description || '',
            is_default: Boolean(exercise.isDefault),
            created_at: exercise.createdAt,
          },
          { onConflict: 'id' }
        );

        return !upsertErr;
      } catch (e) {
        console.warn('[ExerciseService.createExercise] Error:', e);
        return false;
      }
    }

    return true;
  }

  /**
   * Delete an exercise by ID
   */
  static async deleteExercise(exerciseId: string): Promise<boolean> {
    // 1. Update local cache
    const list = await this.getExercises();
    const filtered = list.filter((e) => e.id !== exerciseId);
    await MobileStorage.setItem(EXERCISES_CACHE_KEY, filtered);

    // 2. Persist deletion in Supabase
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: rpcRes, error: rpcError } = await supabase.rpc('delete_exercise_by_id', {
          p_exercise_id: exerciseId,
        });

        if (!rpcError && rpcRes) {
          return true;
        }

        // Fallback soft delete / direct delete
        const { error } = await supabase
          .from('exercises')
          .update({ description: '__FITLOG_DELETED__' })
          .eq('id', exerciseId);

        return !error;
      } catch (e) {
        console.warn('[ExerciseService.deleteExercise] Error:', e);
        return false;
      }
    }

    return true;
  }
}
