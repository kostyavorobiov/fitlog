import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Exercise, MuscleGroup } from '../types/workout';
import { MobileStorage } from '../lib/storage';
import { WorkoutService } from './workoutService';

const EXERCISES_CACHE_KEY = 'mobile_exercises_cache';

export class ExerciseService {
  private static migratedUserIds = new Set<string>();

  /**
   * Migrate global/default exercises that were used in a user's workouts
   * into that user's personal exercise library. Runs once per session per user.
   */
  static async migrateGlobalExercisesToUser(userId: string): Promise<void> {
    if (!userId || this.migratedUserIds.has(userId)) return;
    this.migratedUserIds.add(userId);

    try {
      // 1. Get user workouts to find which exercises were actually used
      const workouts = await WorkoutService.getWorkouts(userId);
      const usedExIds = new Set<string>();
      workouts.forEach((w) => {
        (w.exercises || []).forEach((we) => {
          if (we.exerciseId) usedExIds.add(we.exerciseId);
        });
      });

      if (usedExIds.size === 0) return;

      // 2. Fetch all exercises from Supabase or cache
      const cached = await MobileStorage.getItem<Exercise[]>(EXERCISES_CACHE_KEY, []);
      let allExercises = [...cached];

      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('exercises')
          .select('*')
          .or(`user_id.eq.${userId},is_default.eq.true,user_id.is.null`);
        if (!error && data) {
          allExercises = data
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
        }
      }

      const isGlobal = (ex: Exercise) =>
        ex.isDefault === true ||
        ex.userId === null ||
        !ex.userId ||
        ex.userId === 'null' ||
        ex.id.startsWith('global_ex') ||
        ex.id.startsWith('def_ex');

      const alreadyOwned = new Set(
        allExercises
          .filter((ex) => ex.userId === userId)
          .map((ex) => ex.name.toLowerCase().trim())
      );

      const toMigrate = allExercises.filter((ex) => isGlobal(ex) && usedExIds.has(ex.id));

      for (const globalEx of toMigrate) {
        const globalNameClean = globalEx.name.toLowerCase().trim();
        let targetExerciseId: string;

        if (alreadyOwned.has(globalNameClean)) {
          const ownedEx = allExercises.find(
            (e) => e.userId === userId && e.name.toLowerCase().trim() === globalNameClean
          );
          if (ownedEx) {
            targetExerciseId = ownedEx.id;
          } else {
            continue;
          }
        } else {
          const newEx: Exercise = {
            id: `custom_ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            userId,
            name: globalEx.name,
            muscleGroup: globalEx.muscleGroup,
            description: globalEx.description || '',
            isDefault: false,
            createdAt: new Date().toISOString(),
          };

          await this.createExercise(newEx);
          allExercises.push(newEx);
          alreadyOwned.add(globalNameClean);
          targetExerciseId = newEx.id;
        }

        // Remap workout references from global id -> user custom exercise id
        workouts.forEach((w) => {
          let workoutChanged = false;
          (w.exercises || []).forEach((we) => {
            if (we.exerciseId === globalEx.id) {
              we.exerciseId = targetExerciseId;
              workoutChanged = true;
            }
          });
          if (workoutChanged) {
            WorkoutService.saveWorkout(w).catch(() => {});
          }
        });
      }
    } catch (e) {
      console.warn('[ExerciseService.migrateGlobalExercisesToUser] Error:', e);
    }
  }

  /**
   * Fetch all exercises available for the user (only personal exercises post-migration)
   */
  static async getExercises(userId?: string): Promise<Exercise[]> {
    if (!userId || userId === 'null') {
      return [];
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        // Query user's own exercises + global (for migration)
        const { data, error } = await supabase
          .from('exercises')
          .select('*')
          .or(`user_id.eq.${userId},is_default.eq.true,user_id.is.null`)
          .order('name', { ascending: true });

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

          // Temporarily store in cache so migration can access global pool
          await MobileStorage.setItem(EXERCISES_CACHE_KEY, mapped);

          // Run migration to copy any used global exercises into user's personal library
          await this.migrateGlobalExercisesToUser(userId);

          // Re-fetch latest cached (which includes newly created custom exercises from migration)
          const latestCached = await MobileStorage.getItem<Exercise[]>(EXERCISES_CACHE_KEY, mapped);
          const userOnly = latestCached.filter(
            (e) => e.userId === userId && !e.isDefault && !e.id.startsWith('global_ex') && !e.id.startsWith('def_ex')
          );
          return userOnly;
        } else if (error) {
          console.warn('[ExerciseService.getExercises] Supabase error:', error.message);
        }
      } catch (err) {
        console.warn('[ExerciseService.getExercises] Network or runtime error:', err);
      }
    }

    // Offline / fallback cache
    const cached = await MobileStorage.getItem<Exercise[]>(EXERCISES_CACHE_KEY, []);
    return cached.filter(
      (e) => e.userId === userId && !e.isDefault && !e.id.startsWith('global_ex') && !e.id.startsWith('def_ex')
    );
  }

  /**
   * Create or update an exercise
   */
  static async createExercise(exercise: Exercise): Promise<boolean> {
    // 1. Update local cache
    const cached = await MobileStorage.getItem<Exercise[]>(EXERCISES_CACHE_KEY, []);
    const existingIdx = cached.findIndex((e) => e.id === exercise.id);
    if (existingIdx >= 0) {
      cached[existingIdx] = exercise;
    } else {
      cached.push(exercise);
    }
    await MobileStorage.setItem(EXERCISES_CACHE_KEY, cached);

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
   * @deprecated Global exercises are no longer supported. Returns empty list.
   */
  static async getGlobalExercises(): Promise<Exercise[]> {
    return [];
  }

  /**
   * @deprecated Global exercises are no longer supported.
   * Creates a user-scoped exercise instead.
   */
  static async createGlobalExercise(data: {
    name: string;
    muscleGroup: MuscleGroup;
    description?: string;
    userId?: string;
  }): Promise<{ success: boolean; exercise?: Exercise; error?: string }> {
    const cleanName = data.name.trim();
    if (!cleanName) return { success: false, error: 'Введіть назву вправи' };

    const newEx: Exercise = {
      id: `custom_ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: data.userId || null,
      name: cleanName,
      muscleGroup: data.muscleGroup,
      description: data.description || '',
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    const ok = await this.createExercise(newEx);
    if (ok) {
      return { success: true, exercise: newEx };
    }
    return { success: false, error: 'Не вдалося зберегти вправу' };
  }

  /**
   * Update an existing exercise with ownership / admin verification
   */
  static async updateExercise(
    exercise: Exercise,
    actingUserId?: string,
    isAdmin?: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (exercise.userId && actingUserId && exercise.userId !== actingUserId && !isAdmin) {
      return { success: false, error: 'Ви можете редагувати лише власні вправи' };
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

    if (target && target.userId && actingUserId && target.userId !== actingUserId && !isAdmin) {
      console.warn('[ExerciseService.deleteExercise] Cannot delete another user exercise');
      return false;
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('delete_exercise_by_id', { p_exercise_id: exerciseId });
        if (error || data !== true) return false;
      } catch (error) {
        console.warn('[ExerciseService.deleteExercise]', error);
        return false;
      }
    }
    await MobileStorage.setItem(EXERCISES_CACHE_KEY, all.filter((e) => e.id !== exerciseId));
    return true;
  }
}
