import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { WorkoutPlan, WorkoutExercise, WorkoutSet, PastExercisePerformance, PastExerciseSetSummary } from '../types/workout';
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
   * Get a single workout by ID (supports trainer/trainee context and direct Supabase lookup)
   */
  static async getWorkoutById(param1: string, param2?: string): Promise<WorkoutPlan | null> {
    if (!param1) return null;

    let targetUserId = '';
    let workoutId = '';

    if (param2) {
      // Check cache with param1 as userId, param2 as workoutId
      const list1 = await this.getWorkouts(param1);
      const match1 = list1.find((w) => w.id === param2);
      if (match1) return match1;

      // Check cache with param2 as userId, param1 as workoutId
      const list2 = await this.getWorkouts(param2);
      const match2 = list2.find((w) => w.id === param1);
      if (match2) return match2;

      workoutId = param2.startsWith('w') || param2.includes('-') ? param2 : param1;
      targetUserId = workoutId === param2 ? param1 : param2;
    } else {
      workoutId = param1;
    }

    // Direct Supabase query (Server-side RLS allows reading if user is owner or coach of trainee!)
    if (isSupabaseConfigured() && supabase && workoutId) {
      try {
        const { data, error } = await supabase
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
          .eq('id', workoutId)
          .maybeSingle();

        if (!error && data) {
          const exercises: WorkoutExercise[] = (data.workout_exercises || [])
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

          const mapped: WorkoutPlan = {
            id: data.id,
            userId: data.user_id,
            assignedByCoachId: data.assigned_by_coach_id || null,
            title: data.title,
            scheduledDate: data.scheduled_date,
            status: data.status,
            completedAt: data.completed_at,
            notes: data.notes || '',
            durationMinutes: data.duration_minutes || undefined,
            createdAt: data.created_at,
            exercises,
          };

          // Cache in user's list
          const cacheKey = `${WORKOUTS_CACHE_KEY}_${data.user_id}`;
          const currentCached = await MobileStorage.getItem<WorkoutPlan[]>(cacheKey, []);
          const cIdx = currentCached.findIndex((w) => w.id === mapped.id);
          if (cIdx >= 0) {
            currentCached[cIdx] = mapped;
          } else {
            currentCached.unshift(mapped);
          }
          await MobileStorage.setItem(cacheKey, currentCached);

          return mapped;
        }
      } catch (err) {
        console.warn('[WorkoutService.getWorkoutById] Supabase query error:', err);
      }
    }

    return null;
  }

  /**
   * Retrieves the last performance for an exercise from previous workouts
   */
  static async getLastExercisePerformance(
    userId: string,
    exerciseId: string,
    excludeWorkoutId?: string
  ): Promise<PastExercisePerformance | null> {
    try {
      const workouts = await this.getWorkouts(userId);
      if (!Array.isArray(workouts)) return null;

      for (const w of workouts) {
        if (!w || (excludeWorkoutId && w.id === excludeWorkoutId)) continue;
        if (!Array.isArray(w.exercises)) continue;

        const we = w.exercises.find((item) => item && item.exerciseId === exerciseId);
        if (!we || !Array.isArray(we.sets) || we.sets.length === 0) continue;

        const validSets = we.sets
          .filter((s) => s && s.actualReps !== null && s.actualReps > 0 && s.weight > 0)
          .sort((a, b) => a.setNumber - b.setNumber);

        if (validSets.length > 0) {
          let maxWeight = 0;
          let totalVolume = 0;
          const setSummaries: PastExerciseSetSummary[] = validSets.map((s) => {
            if (s.weight > maxWeight) maxWeight = s.weight;
            totalVolume += s.weight * (s.actualReps || 0);
            return {
              setNumber: s.setNumber,
              weight: s.weight,
              actualReps: s.actualReps as number,
              targetRepsRange: s.targetRepsRange,
            };
          });

          return {
            workoutId: w.id,
            workoutTitle: w.title,
            date: w.scheduledDate,
            sets: setSummaries,
            maxWeight,
            totalVolume,
          };
        }
      }
    } catch (e) {
      console.warn('[WorkoutService.getLastExercisePerformance] Error:', e);
    }
    return null;
  }

  /**
   * Retrieves previous workout to repeat (by matching title, or latest completed workout)
   */
  static async getPreviousWorkoutToRepeat(
    userId: string,
    excludeWorkoutId?: string,
    titleMatch?: string
  ): Promise<WorkoutPlan | null> {
    try {
      const workouts = await this.getWorkouts(userId);
      if (!Array.isArray(workouts)) return null;

      // 1. Try matching by title first
      if (titleMatch && titleMatch.trim() && titleMatch !== 'Нове тренування' && titleMatch !== 'Тренування') {
        const titleMatchWorkout = workouts.find(
          (w) =>
            w.id !== excludeWorkoutId &&
            w.title.toLowerCase().trim() === titleMatch.toLowerCase().trim() &&
            w.exercises &&
            w.exercises.length > 0
        );
        if (titleMatchWorkout) return titleMatchWorkout;
      }

      // 2. Otherwise return the most recent completed or non-empty workout
      const prev = workouts.find(
        (w) => w.id !== excludeWorkoutId && w.exercises && w.exercises.length > 0
      );
      return prev || null;
    } catch (e) {
      console.warn('[WorkoutService.getPreviousWorkoutToRepeat] Error:', e);
      return null;
    }
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
  static async deleteWorkout(
    userId: string,
    workoutId: string,
    additionalUserId?: string
  ): Promise<boolean> {
    // 1. Remove from local cache for primary user
    const cacheKey = `${WORKOUTS_CACHE_KEY}_${userId}`;
    const cached = await MobileStorage.getItem<WorkoutPlan[]>(cacheKey, []);
    const filtered = cached.filter((w) => w.id !== workoutId);
    await MobileStorage.setItem(cacheKey, filtered);

    // Also clear from additionalUserId cache if provided (e.g. coach deleting trainee's workout or vice-versa)
    if (additionalUserId && additionalUserId !== userId) {
      const extraKey = `${WORKOUTS_CACHE_KEY}_${additionalUserId}`;
      const extraCached = await MobileStorage.getItem<WorkoutPlan[]>(extraKey, []);
      const extraFiltered = extraCached.filter((w) => w.id !== workoutId);
      await MobileStorage.setItem(extraKey, extraFiltered);
    }

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
