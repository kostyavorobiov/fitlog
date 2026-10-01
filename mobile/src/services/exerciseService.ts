import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Exercise, MuscleGroup } from '../types/workout';
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
            .map((e: any) => {
              const isDef = Boolean(e.is_default) || e.id.startsWith('def_ex') || e.id.startsWith('global_ex');
              return {
                id: e.id,
                userId: isDef ? null : e.user_id,
                name: e.name,
                muscleGroup: e.muscle_group,
                description: e.description || '',
                isDefault: isDef,
                createdAt: e.created_at,
              };
            });

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
    const normalized = cached.map((e) => {
      const isDef = Boolean(e.isDefault) || e.id.startsWith('def_ex') || e.id.startsWith('global_ex');
      return {
        ...e,
        userId: isDef ? null : e.userId,
        isDefault: isDef,
      };
    });
    if (userId) {
      return normalized.filter((e) => e.isDefault || !e.userId || e.userId === userId);
    }
    return normalized.filter((e) => e.isDefault || !e.userId);
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
   * Fetch only global / system default exercises (userId is null or isDefault is true)
   */
  static async getGlobalExercises(): Promise<Exercise[]> {
    const list = await this.getExercises(undefined);
    return list.filter((e) => e.isDefault || e.userId === null);
  }

  /**
   * Create a global exercise (Admin only)
   */
  static async createGlobalExercise(data: {
    name: string;
    muscleGroup: MuscleGroup;
    description?: string;
  }): Promise<{ success: boolean; exercise?: Exercise; error?: string }> {
    const cleanName = data.name.trim();
    if (!cleanName) return { success: false, error: 'Введіть назву вправи' };

    const newEx: Exercise = {
      id: `global_ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: null,
      name: cleanName,
      muscleGroup: data.muscleGroup,
      description: data.description || '',
      isDefault: true,
      createdAt: new Date().toISOString(),
    };

    const ok = await this.createExercise(newEx);
    if (ok) {
      return { success: true, exercise: newEx };
    }
    return { success: false, error: 'Не вдалося зберегти глобальну вправу' };
  }

  /**
   * Update an existing exercise with ownership / admin verification
   */
  static async updateExercise(
    exercise: Exercise,
    actingUserId?: string,
    isAdmin?: boolean
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Authorization check
    if (exercise.userId === null || exercise.isDefault) {
      if (!isAdmin) {
        return { success: false, error: 'Лише адміністратор може редагувати глобальні вправи' };
      }
    } else if (exercise.userId && actingUserId) {
      if (exercise.userId !== actingUserId && !isAdmin) {
        return { success: false, error: 'Ви можете редагувати лише власні приватні вправи' };
      }
    }

    const ok = await this.createExercise(exercise);
    return { success: ok, error: ok ? undefined : 'Помилка при оновленні вправи' };
  }

  /**
   * Delete an exercise by ID with ownership / admin verification
   */
  static async deleteExercise(
    exerciseId: string,
    actingUserId?: string,
    isAdmin?: boolean
  ): Promise<boolean> {
    const all = await MobileStorage.getItem<Exercise[]>(EXERCISES_CACHE_KEY, []);
    const target = all.find((e) => e.id === exerciseId);

    if (target) {
      if ((target.userId === null || target.isDefault) && !isAdmin) {
        console.warn('[ExerciseService.deleteExercise] Non-admin cannot delete global exercise');
        return false;
      }
      if (target.userId && actingUserId && target.userId !== actingUserId && !isAdmin) {
        console.warn('[ExerciseService.deleteExercise] Cannot delete another user private exercise');
        return false;
      }
    }

    // 1. Update local cache
    const filtered = all.filter((e) => e.id !== exerciseId);
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
