import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { WorkoutPlan, WorkoutExercise, WorkoutSet } from '../types/workout';
import { MobileStorage } from '../lib/storage';

const WORKOUTS_CACHE_KEY = 'mobile_workouts_cache';

export class WorkoutService {
  /**
   * Helper to encode exercise metadata into notes (for cross-user & offline preservation)
   */
  static encodeExerciseMeta(exerciseName?: string, muscleGroup?: string, userNotes?: string): string {
    const cleanNotes = (userNotes || '').replace(/^\[meta:[^\]]+\]/, '');
    if (!exerciseName || exerciseName === 'Вправа') return cleanNotes;
    const meta = `[meta:ex=${encodeURIComponent(exerciseName)}${muscleGroup ? `&mg=${encodeURIComponent(muscleGroup)}` : ''}]`;
    return `${meta}${cleanNotes}`;
  }

  /**
   * Helper to decode exercise metadata from notes
   */
  static decodeExerciseMeta(rawNotes?: string): { exerciseName?: string; muscleGroup?: string; cleanNotes: string } {
    if (!rawNotes) return { cleanNotes: '' };
    const match = rawNotes.match(/^\[meta:ex=([^&\]]+)(?:&mg=([^\]]*))?\]/);
    if (match) {
      try {
        return {
          exerciseName: decodeURIComponent(match[1]),
          muscleGroup: match[2] ? decodeURIComponent(match[2]) : undefined,
          cleanNotes: rawNotes.slice(match[0].length),
        };
      } catch {
        return { cleanNotes: rawNotes };
      }
    }
    return { cleanNotes: rawNotes };
  }

  /**
   * Fetch all workouts for a user (from Supabase with fallback to local cache)
   */
  static async getWorkouts(userId: string): Promise<WorkoutPlan[]> {
    if (!userId) return [];

    const cacheKey = `${WORKOUTS_CACHE_KEY}_${userId}`;

    // 1. Try Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: workoutsData, error } = await supabase
          .from('workouts')
          .select(`
            id,
            user_id,
            assigned_by_coach_id,
            title,
            scheduled_date,
            status,
            completed_at,
            notes,
            duration_minutes,
            created_at,
            workout_exercises (
              id,
              workout_id,
              exercise_id,
              order_index,
              set_count,
              target_reps_range,
              notes,
              superset_group_id,
              exercises (
                id,
                user_id,
                name,
                muscle_group,
                description,
                is_default,
                created_at
              ),
              workout_sets (
                id,
                workout_exercise_id,
                set_number,
                target_reps_range,
                weight,
                actual_reps,
                completed_at,
                notes,
                is_warmup
              )
            )
          `)
          .eq('user_id', userId)
          .order('scheduled_date', { ascending: false });

        if (!error && workoutsData) {
          const mapped: WorkoutPlan[] = workoutsData.map((w: any) => {
            const exercises: WorkoutExercise[] = (w.workout_exercises || [])
              .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
              .map((we: any) => {
                const exObj = Array.isArray(we.exercises) ? we.exercises[0] : we.exercises;
                const { exerciseName: metaExName, muscleGroup: metaMg, cleanNotes } =
                  this.decodeExerciseMeta(we.notes);

                const exerciseName =
                  (metaExName && metaExName !== 'Вправа' ? metaExName : undefined) ||
                  (exObj?.name && exObj.name !== 'Вправа' ? exObj.name : undefined) ||
                  'Вправа';

                const muscleGroup = metaMg || exObj?.muscle_group || 'full_body';

                const sets: WorkoutSet[] = (we.workout_sets || [])
                  .sort((a: any, b: any) => (a.set_number ?? 0) - (b.set_number ?? 0))
                  .map((s: any) => ({
                    id: s.id,
                    workoutExerciseId: s.workout_exercise_id,
                    setNumber: s.set_number,
                    targetRepsRange: s.target_reps_range || '8-12',
                    weight: Number(s.weight) || 0,
                    actualReps: s.actual_reps !== null && s.actual_reps !== undefined ? Number(s.actual_reps) : null,
                    completedAt: s.completed_at,
                    notes: s.notes || '',
                    isWarmup: Boolean(s.is_warmup),
                  }));

                return {
                  id: we.id,
                  workoutPlanId: we.workout_id,
                  exerciseId: we.exercise_id,
                  exerciseName,
                  muscleGroup,
                  order: we.order_index || 1,
                  setCount: we.set_count || sets.length,
                  targetRepsRange: we.target_reps_range || '8-12',
                  notes: cleanNotes,
                  supersetGroupId: we.superset_group_id || null,
                  sets,
                };
              });

            return {
              id: w.id,
              userId: w.user_id,
              assignedByCoachId: w.assigned_by_coach_id || null,
              title: w.title,
              scheduledDate: w.scheduled_date,
              status: w.status,
              completedAt: w.completed_at,
              notes: w.notes || '',
              durationMinutes: w.duration_minutes || undefined,
              createdAt: w.created_at,
              exercises,
            };
          });

          // Update local cache
          await MobileStorage.setItem(cacheKey, mapped);
          return mapped;
        } else if (error) {
          console.warn('[WorkoutService.getWorkouts] Supabase query error:', error.message);
        }
      } catch (err) {
        console.warn('[WorkoutService.getWorkouts] Network or runtime error:', err);
      }
    }

    // 2. Return cached workouts if Supabase is offline or not configured
    return MobileStorage.getItem<WorkoutPlan[]>(cacheKey, []);
  }

  /**
   * Get a single workout by ID
   */
  static async getWorkoutById(userId: string, workoutId: string): Promise<WorkoutPlan | null> {
    const list = await this.getWorkouts(userId);
    return list.find((w) => w.id === workoutId) || null;
  }

  /**
   * Save or update a workout plan (Upserts to Supabase and caches locally)
   */
  static async saveWorkout(workout: WorkoutPlan): Promise<boolean> {
    const cacheKey = `${WORKOUTS_CACHE_KEY}_${workout.userId}`;

    // 1. Update local cache immediately
    const cached = await MobileStorage.getItem<WorkoutPlan[]>(cacheKey, []);
    const idx = cached.findIndex((w) => w.id === workout.id);
    if (idx >= 0) {
      cached[idx] = workout;
    } else {
      cached.unshift(workout);
    }
    await MobileStorage.setItem(cacheKey, cached);

    // 2. Upsert to Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        // A. Upsert workout record
        const { error: wError } = await supabase.from('workouts').upsert(
          {
            id: workout.id,
            user_id: workout.userId,
            assigned_by_coach_id: workout.assignedByCoachId || null,
            title: workout.title,
            scheduled_date: workout.scheduledDate,
            status: workout.status,
            completed_at: workout.completedAt || null,
            notes: workout.notes || '',
            duration_minutes: workout.durationMinutes || null,
            created_at: workout.createdAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        if (wError) {
          console.warn('[WorkoutService.saveWorkout] Workout upsert error:', wError.message);
          return false;
        }

        // B. Handle removed workout_exercises & sets
        const currentWeIds = (workout.exercises || []).map((we) => we.id);
        const { data: existingWe } = await supabase
          .from('workout_exercises')
          .select('id')
          .eq('workout_id', workout.id);

        const existingWeIds = (existingWe || []).map((r: any) => r.id);
        const toDeleteWe = existingWeIds.filter((id: string) => !currentWeIds.includes(id));

        if (toDeleteWe.length > 0) {
          await supabase.from('workout_sets').delete().in('workout_exercise_id', toDeleteWe);
          await supabase.from('workout_exercises').delete().in('id', toDeleteWe);
        }

        // C. Upsert workout exercises and sets
        if (workout.exercises && workout.exercises.length > 0) {
          const weRows = workout.exercises.map((we, index) => {
            const notesWithMeta = this.encodeExerciseMeta(
              we.exerciseName,
              we.muscleGroup,
              we.notes
            );
            return {
              id: we.id,
              workout_id: workout.id,
              exercise_id: we.exerciseId,
              order_index: we.order || index + 1,
              set_count: we.setCount || we.sets.length,
              target_reps_range: we.targetRepsRange || '8-12',
              notes: notesWithMeta,
              superset_group_id: we.supersetGroupId || null,
            };
          });

          await supabase.from('workout_exercises').upsert(weRows, { onConflict: 'id' });

          // D. Delete removed sets and upsert current sets
          for (const we of workout.exercises) {
            const currentSetIds = we.sets.map((s) => s.id);
            const { data: existingSets } = await supabase
              .from('workout_sets')
              .select('id')
              .eq('workout_exercise_id', we.id);

            const existingSetIds = (existingSets || []).map((r: any) => r.id);
            const toDeleteSets = existingSetIds.filter((id: string) => !currentSetIds.includes(id));
            if (toDeleteSets.length > 0) {
              await supabase.from('workout_sets').delete().in('id', toDeleteSets);
            }

            if (we.sets.length > 0) {
              const setRows = we.sets.map((s, sIdx) => ({
                id: s.id,
                workout_exercise_id: we.id,
                set_number: s.setNumber || sIdx + 1,
                target_reps_range: s.targetRepsRange || '8-12',
                weight: Number(s.weight) || 0,
                actual_reps: s.actualReps !== null && s.actualReps !== undefined ? Number(s.actualReps) : null,
                completed_at: s.completedAt || null,
                notes: s.notes || '',
                is_warmup: Boolean(s.isWarmup),
              }));

              await supabase.from('workout_sets').upsert(setRows, { onConflict: 'id' });
            }
          }
        }

        return true;
      } catch (e: any) {
        console.warn('[WorkoutService.saveWorkout] Error syncing to Supabase:', e?.message || e);
        return false;
      }
    }

    return true;
  }

  /**
   * Delete a workout by ID
   */
  static async deleteWorkout(userId: string, workoutId: string): Promise<boolean> {
    const cacheKey = `${WORKOUTS_CACHE_KEY}_${userId}`;

    // 1. Remove from local cache
    const cached = await MobileStorage.getItem<WorkoutPlan[]>(cacheKey, []);
    const filtered = cached.filter((w) => w.id !== workoutId);
    await MobileStorage.setItem(cacheKey, filtered);

    // 2. Delete from Supabase with safe FK order
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: weList } = await supabase
          .from('workout_exercises')
          .select('id')
          .eq('workout_id', workoutId);

        const weIds = (weList || []).map((r: any) => r.id);
        if (weIds.length > 0) {
          await supabase.from('workout_sets').delete().in('workout_exercise_id', weIds);
          await supabase.from('workout_exercises').delete().eq('workout_id', workoutId);
        }

        const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
        return !error;
      } catch (e) {
        console.warn('[WorkoutService.deleteWorkout] Error:', e);
        return false;
      }
    }

    return true;
  }
}
