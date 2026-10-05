import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { WorkoutPlan, Exercise, User, WorkoutExercise, WorkoutSet } from '../types/workout';
import { StorageService } from './storageService';

export class CloudStorageService {
  /**
   * Helper to encode exercise metadata into notes
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
   * Fetch all workouts for user (including assigned trainee workouts)
   */
  static async fetchWorkouts(userId: string): Promise<WorkoutPlan[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    try {
      const fetchRevision = StorageService.getWorkoutRevision();
      const pendingAtStart = StorageService.getPendingWorkoutIds();
      let query = supabase
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
        `);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: workoutsData, error } = await query.order('scheduled_date', { ascending: false });

      if (error) {
        console.warn('CloudStorageService.fetchWorkouts error:', error.message);
        return null;
      }

      if (!workoutsData) return [];

      const mapped = workoutsData.map((w: any) => {
        const exercises: WorkoutExercise[] = (w.workout_exercises || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((we: any) => {
            const exObj = Array.isArray(we.exercises) ? we.exercises[0] : we.exercises;
            const { exerciseName: metaExName, muscleGroup: metaMg, cleanNotes } = CloudStorageService.decodeExerciseMeta(we.notes);

            const localEx = StorageService.getExerciseById(we.exercise_id);
            
            let exerciseName: string | undefined;
            if (metaExName && metaExName !== 'Вправа') {
              exerciseName = metaExName;
            } else if (exObj?.name && exObj.name !== 'Вправа') {
              exerciseName = exObj.name;
            } else if (localEx?.name && localEx.name !== 'Вправа') {
              exerciseName = localEx.name;
            } else {
              exerciseName = metaExName || exObj?.name || localEx?.name || undefined;
            }

            const muscleGroup = metaMg || exObj?.muscle_group || localEx?.muscleGroup || undefined;

            const sets: WorkoutSet[] = (we.workout_sets || [])
              .sort((a: any, b: any) => a.set_number - b.set_number)
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
              order: we.order_index,
              setCount: we.set_count,
              targetRepsRange: we.target_reps_range,
              notes: cleanNotes,
              supersetGroupId: we.superset_group_id,
              sets,
            };
          });

        return {
          id: w.id,
          userId: w.user_id,
          assignedByCoachId: w.assigned_by_coach_id,
          title: w.title,
          scheduledDate: w.scheduled_date,
          status: w.status,
          completedAt: w.completed_at,
          notes: w.notes || '',
          durationMinutes: w.duration_minutes,
          createdAt: w.created_at,
          exercises,
        };
      });
      StorageService.markWorkoutsFetched(mapped, fetchRevision, pendingAtStart);
      return mapped;
    } catch (err) {
      console.warn('Failed to fetch from cloud:', err);
      return null;
    }
  }

  private static workoutSavePromises = new Map<string, Promise<boolean>>();

  // Each caller receives the result for its own immutable snapshot.
  static saveWorkout(workout: WorkoutPlan): Promise<boolean> {
    const snapshot = JSON.parse(JSON.stringify(workout)) as WorkoutPlan;
    return this.enqueueWorkoutWrite(workout.id, () => this.executeSaveWorkout(snapshot));
  }

  private static enqueueWorkoutWrite(id: string, write: () => Promise<boolean>): Promise<boolean> {
    const previous = this.workoutSavePromises.get(id) || Promise.resolve(true);
    const next = previous.catch(() => false).then(write).catch((error) => {
      console.warn('Workout write failed:', error);
      return false;
    });
    this.workoutSavePromises.set(id, next);
    void next.finally(() => {
      if (this.workoutSavePromises.get(id) === next) this.workoutSavePromises.delete(id);
    });
    return next;
  }

  private static async executeSaveWorkout(workout: WorkoutPlan): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    const payload = {
      ...workout,
      exercises: workout.exercises.map((we) => ({
        ...we,
        notes: this.encodeExerciseMeta(we.exerciseName, we.muscleGroup, we.notes),
      })),
    };
    const { data, error } = await supabase.rpc('save_workout', { p_workout: payload });
    if (error) console.warn('save_workout failed:', error.message);
    return !error && data === true;
  }

  /**
   * Delete a workout from Supabase
   */
  static deleteWorkout(workoutId: string): Promise<boolean> {
    return this.enqueueWorkoutWrite(workoutId, async () => {
      if (!isSupabaseConfigured() || !supabase) return false;
      // Child rows are deleted by the existing ON DELETE CASCADE constraints.
      const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
      return !error;
    });
  }

  /**
   * Fetch user-owned and global exercises from Supabase.
   * Global exercises are included here so the client-side migration can copy
   * them into user-owned records. After migration, getExercises() filters to user-only.
   */
  static async fetchExercises(targetUserId?: string): Promise<Exercise[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentAuthId = authData?.user?.id || null;

      // Fetch: user's own exercises + target user's exercises (e.g. trainee) + global/default exercises
      let query = supabase
        .from('exercises')
        .select('*')
        .order('name');

      if (currentAuthId || targetUserId) {
        const filters: string[] = ['is_default.eq.true', 'user_id.is.null'];
        if (currentAuthId) filters.push(`user_id.eq.${currentAuthId}`);
        if (targetUserId && targetUserId !== currentAuthId) filters.push(`user_id.eq.${targetUserId}`);

        query = supabase
          .from('exercises')
          .select('*')
          .or(filters.join(','))
          .order('name');
      }

      const { data, error } = await query;

      if (error) {
        console.warn('fetchExercises error:', error.message);
        return null;
      }

      if (!data) return [];

      return data
        .filter((item: any) =>
          !item.description?.includes('__FITLOG_DELETED__') &&
          !item.name?.startsWith('__DELETED__')
        )
        .map((item: any) => {
          const isDef = Boolean(item.is_default) || item.id.startsWith('def_ex') || item.id.startsWith('global_ex');
          return {
            id: item.id,
            userId: isDef ? null : item.user_id,
            name: item.name,
            muscleGroup: item.muscle_group,
            description: item.description,
            isDefault: isDef,
            createdAt: item.created_at,
          };
        });
    } catch (err) {
      console.warn('Failed to fetch exercises from cloud:', err);
      return null;
    }
  }

  /**
   * Save custom exercise to cloud
   */
  static async saveExercise(exercise: Exercise): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;

    try {
      let effectiveUserId = exercise.userId;
      if (exercise.isDefault) {
        effectiveUserId = null;
      } else {
        const isUuid =
          effectiveUserId &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveUserId);
        if (!isUuid) {
          const { data: authData } = await supabase.auth.getUser();
          effectiveUserId = authData?.user?.id || null;
        }
      }

      // 1. Try RPC save_exercise (bypasses RLS with security definer)
      try {
        const { data: rpcRes, error: rpcError } = await supabase.rpc('save_exercise', {
          p_id: exercise.id,
          p_user_id: effectiveUserId,
          p_name: exercise.name,
          p_muscle_group: exercise.muscleGroup,
          p_description: exercise.description || '',
          p_is_default: Boolean(exercise.isDefault),
        });

        if (!rpcError && rpcRes !== false) {
          return true;
        }
      } catch {}

      // 2. Direct table upsert fallback
      const { error } = await supabase.from('exercises').upsert(
        {
          id: exercise.id,
          user_id: effectiveUserId,
          name: exercise.name,
          muscle_group: exercise.muscleGroup,
          description: exercise.description || '',
          is_default: Boolean(exercise.isDefault),
          created_at: exercise.createdAt,
        },
        { onConflict: 'id' }
      );

      if (error) {
        console.warn('saveExercise error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Failed to save exercise in cloud:', err);
      return false;
    }
  }

  /**
   * Delete exercise from cloud
   */
  static async deleteExercise(exerciseId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      const { data, error } = await supabase.rpc('delete_exercise_by_id', {
        p_exercise_id: exerciseId,
      });
      return !error && data === true;
    } catch (error) {
      console.warn('Failed to archive exercise:', error);
      return false;
    }
  }

  /**
   * Delete all exercises from Supabase exercises table
   */
  static async deleteAllExercises(): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      // First delete workout_exercises if any exist to clear foreign keys
      await supabase.from('workout_exercises').delete().neq('id', '');
      const { error } = await supabase.from('exercises').delete().neq('id', '');
      if (error) {
        console.warn('deleteAllExercises error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Failed to delete all exercises:', err);
      return false;
    }
  }

  /**
   * Fetch user profile from Supabase profiles table
   */
  static async fetchProfile(userId: string): Promise<User | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    try {
      // 1. Direct table select
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        return this.mapProfileRow(data);
      }

      // 2. RPC fallback get_profile_by_id
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_profile_by_id', {
          p_user_id: userId,
        });
        if (!rpcErr && rpcData && rpcData.length > 0) {
          return this.mapProfileRow(rpcData[0]);
        }
      } catch {}

      if (error) {
        console.warn('fetchProfile error:', error.message);
      }
      return null;
    } catch (err) {
      console.warn('Failed to fetch profile in cloud:', err);
      return null;
    }
  }

  /**
   * Update profile in Supabase
   */
  static async updateProfile(userId: string, updates: Partial<User>): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;

    try {
      const payload: any = { updated_at: new Date().toISOString() };
      if (updates.firstName !== undefined) payload.first_name = updates.firstName;
      if (updates.lastName !== undefined) payload.last_name = updates.lastName;
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.image !== undefined) payload.avatar_url = updates.image;
      if (updates.coachId !== undefined) payload.coach_id = updates.coachId;

      const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
      if (error) {
        console.warn('updateProfile error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Failed to update profile in cloud:', err);
      return false;
    }
  }

  /**
   * Upsert profile in Supabase
   */
  static async upsertProfile(user: User): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;

    try {
      const payload: any = {
        id: user.id,
        profile_code: user.profileCode,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        name: user.name,
        avatar_url: user.image,
        role: user.role,
        coach_id: user.coachId || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.warn('upsertProfile error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Failed to upsert profile in cloud:', err);
      return false;
    }
  }

  /**
   * Search for a user profile in Supabase by profile_code, email, id, or partial match
   */
  static async findProfile(query: string): Promise<User | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    const raw = query.trim();
    if (!raw) return null;

    // Normalizations
    const clean = raw;
    const stripped = raw.replace(/^u_/i, '');
    const cleanNoDashes = raw.replace(/[-_]/g, '').toLowerCase();
    const strippedNoDashes = stripped.replace(/[-_]/g, '').toLowerCase();

    try {
      // 1. Direct UUID match (if input is a valid 36-char UUID)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
      if (isUuid) {
        const { data } = await supabase.from('profiles').select('*').eq('id', clean).maybeSingle();
        if (data) return this.mapProfileRow(data);
      }

      // 2. Exact match on profile_code (case-insensitive)
      const { data: codeMatch } = await supabase
        .from('profiles')
        .select('*')
        .or(`profile_code.ilike.${clean},profile_code.ilike.${stripped}`)
        .limit(1);
      if (codeMatch && codeMatch.length > 0) {
        return this.mapProfileRow(codeMatch[0]);
      }

      // 3. Exact match on email (case-insensitive)
      const { data: emailMatch } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', clean)
        .limit(1);
      if (emailMatch && emailMatch.length > 0) {
        return this.mapProfileRow(emailMatch[0]);
      }

      // 4. Broad search across profiles (handles partial matches and shortened IDs)
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .limit(200);

      if (allProfiles && allProfiles.length > 0) {
        const found = allProfiles.find((p: any) => {
          const pId = (p.id || '').toLowerCase().replace(/[-_]/g, '');
          const pCode = (p.profile_code || '').toLowerCase();
          const pEmail = (p.email || '').toLowerCase();

          return (
            pCode === clean.toLowerCase() ||
            pCode === stripped.toLowerCase() ||
            pEmail === clean.toLowerCase() ||
            pId === cleanNoDashes ||
            pId === strippedNoDashes ||
            pId.startsWith(strippedNoDashes) ||
            pId.startsWith(cleanNoDashes) ||
            pCode.includes(clean.toLowerCase()) ||
            pCode.includes(stripped.toLowerCase()) ||
            pEmail.includes(clean.toLowerCase())
          );
        });

        if (found) {
          return this.mapProfileRow(found);
        }
      }

      return null;
    } catch (err) {
      console.warn('CloudStorageService.findProfile error:', err);
      return null;
    }
  }

  private static mapProfileRow(item: any): User {
    return {
      id: item.id,
      profileCode: item.profile_code,
      firstName: item.first_name || '',
      lastName: item.last_name || '',
      name: item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Підопічний',
      email: item.email,
      role: item.role || 'athlete',
      coachId: item.coach_id,
      image: item.avatar_url || '',
      createdAt: item.created_at,
    };
  }

  /**
   * Assign trainee to coach in Supabase
   */
  static async assignTrainee(coachId: string, traineeId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      const { data, error } = await supabase.rpc('assign_trainee_to_coach', {
        p_coach_id: coachId, p_trainee_id: traineeId,
      });
      return !error && data === true;
    } catch { return false; }
  }

  static async removeTrainee(_coachId: string, traineeId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      const { data, error } = await supabase.rpc('unlink_trainee', { p_trainee_id: traineeId });
      return !error && data === true;
    } catch { return false; }
  }

  /**
   * Delete all exercises from Supabase except those currently used in workout_exercises
   */
  static async cleanupUnusedExercises(): Promise<{ deletedCount: number; keptCount: number }> {
    if (!isSupabaseConfigured() || !supabase) return { deletedCount: 0, keptCount: 0 };
    try {
      // 1. First attempt to call the security-definer Postgres RPC function
      try {
        const { data: rpcDeleted, error: rpcErr } = await supabase.rpc('cleanup_unused_exercises');
        if (!rpcErr && typeof rpcDeleted === 'number') {
          return { deletedCount: rpcDeleted, keptCount: 0 };
        }
      } catch {}

      // 2. Fetch all distinct exercise_ids used in workout_exercises
      const { data: usedRows, error: weErr } = await supabase
        .from('workout_exercises')
        .select('exercise_id');

      if (weErr) {
        console.warn('cleanupUnusedExercises error fetching workout_exercises:', weErr);
        return { deletedCount: 0, keptCount: 0 };
      }

      const usedIdSet = new Set(
        (usedRows || []).map((r: any) => r.exercise_id).filter(Boolean)
      );

      // 3. Fetch all exercises from exercises table
      const { data: allExercises, error: exErr } = await supabase
        .from('exercises')
        .select('id, name, user_id, is_default');

      if (exErr || !allExercises) {
        console.warn('cleanupUnusedExercises error fetching exercises:', exErr);
        return { deletedCount: 0, keptCount: 0 };
      }

      const unusedExercises = allExercises.filter((ex: any) => {
        if (usedIdSet.has(ex.id)) return false;
        // Keep active custom user exercise if created
        if (ex.user_id && !ex.is_default && !ex.id.startsWith('global_ex') && !ex.id.startsWith('def_ex')) return false;
        return true;
      });

      if (unusedExercises.length === 0) {
        return { deletedCount: 0, keptCount: allExercises.length };
      }

      const unusedIds = unusedExercises.map((ex: any) => ex.id);

      // 4. Delete unused exercises from database in chunks of 50
      for (let i = 0; i < unusedIds.length; i += 50) {
        const chunk = unusedIds.slice(i, i + 50);
        await supabase.from('exercises').delete().in('id', chunk);
      }

      return { deletedCount: unusedIds.length, keptCount: usedIdSet.size };
    } catch (err) {
      console.warn('cleanupUnusedExercises error:', err);
      return { deletedCount: 0, keptCount: 0 };
    }
  }

  /**
   * Fetch trainees for coach
   */
  static async fetchTrainees(coachId: string): Promise<User[]> {
    if (!isSupabaseConfigured() || !supabase) return [];

    try {
      // 1. Direct table select
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('coach_id', coachId);

      if (!error && data && data.length > 0) {
        return data.map((item: any) => this.mapProfileRow(item));
      }

      // 2. RPC fallback get_coach_trainees
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_coach_trainees', {
          p_coach_id: coachId,
        });
        if (!rpcErr && rpcData && rpcData.length > 0) {
          return rpcData.map((item: any) => this.mapProfileRow(item));
        }
      } catch {}

      return data ? data.map((item: any) => this.mapProfileRow(item)) : [];
    } catch (err) {
      console.warn('Failed to fetch trainees:', err);
      return [];
    }
  }
}
