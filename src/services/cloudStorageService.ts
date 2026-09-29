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

      return workoutsData.map((w: any) => {
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
    } catch (err) {
      console.warn('Failed to fetch from cloud:', err);
      return null;
    }
  }

  private static workoutSavePromises = new Map<string, Promise<boolean>>();
  private static pendingWorkoutSaves = new Map<string, WorkoutPlan>();

  /**
   * Upsert a complete workout to Supabase with automatic serialization & trailing queue
   */
  static async saveWorkout(workout: WorkoutPlan): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;

    if (this.workoutSavePromises.has(workout.id)) {
      this.pendingWorkoutSaves.set(workout.id, workout);
      return this.workoutSavePromises.get(workout.id)!;
    }

    const runSave = async (wToSave: WorkoutPlan): Promise<boolean> => {
      try {
        return await this.executeSaveWorkout(wToSave);
      } finally {
        const next = this.pendingWorkoutSaves.get(wToSave.id);
        if (next) {
          this.pendingWorkoutSaves.delete(wToSave.id);
          const nextPromise = runSave(next);
          this.workoutSavePromises.set(wToSave.id, nextPromise);
          await nextPromise;
        } else {
          this.workoutSavePromises.delete(wToSave.id);
        }
      }
    };

    const promise = runSave(workout);
    this.workoutSavePromises.set(workout.id, promise);
    return promise;
  }

  private static async executeSaveWorkout(workout: WorkoutPlan): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;

    try {
      let effectiveCoachId = workout.assignedByCoachId || null;
      if (!effectiveCoachId) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id && authData.user.id !== workout.userId) {
          effectiveCoachId = authData.user.id;
        }
      }

      // 1. Upsert Workout row
      const { error: wError } = await supabase.from('workouts').upsert(
        {
          id: workout.id,
          user_id: workout.userId,
          assigned_by_coach_id: effectiveCoachId,
          title: workout.title || 'Тренування',
          scheduled_date: workout.scheduledDate,
          status: workout.status,
          completed_at: workout.completedAt || null,
          notes: workout.notes || '',
          duration_minutes: workout.durationMinutes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (wError) {
        console.warn('saveWorkout error:', wError.message);
        return false;
      }

      // 2. Manage workout_exercises deletion of removed items
      const currentWeIds = (workout.exercises || []).map((we) => we.id);

      if (currentWeIds.length > 0) {
        const { data: existingWe } = await supabase
          .from('workout_exercises')
          .select('id')
          .eq('workout_id', workout.id);

        const existingWeIds = (existingWe || []).map((r: any) => r.id);
        const toDeleteWe = existingWeIds.filter((id: string) => !currentWeIds.includes(id));
        if (toDeleteWe.length > 0) {
          await supabase.from('workout_exercises').delete().in('id', toDeleteWe);
        }
      } else {
        await supabase.from('workout_exercises').delete().eq('workout_id', workout.id);
      }

      // 3. Upsert current exercises and their sets
      if (workout.exercises && workout.exercises.length > 0) {
        // Ensure all referenced exercises exist in Supabase exercises table to prevent FK errors
        const exIds = Array.from(new Set(workout.exercises.map((e) => e.exerciseId)));
        const { data: dbExs } = await supabase.from('exercises').select('id').in('id', exIds);
        const dbExSet = new Set((dbExs || []).map((x: any) => x.id));
        const missing = exIds.filter((id) => !dbExSet.has(id));

        if (missing.length > 0) {
          const { data: authData } = await supabase.auth.getUser();
          const currentAuthId = authData?.user?.id || null;

          const missingRows = missing.map((id) => {
            const we = workout.exercises.find((e) => e.exerciseId === id);
            const local = StorageService.getExerciseById(id);
            const resolvedName = (we?.exerciseName && we.exerciseName !== 'Вправа')
              ? we.exerciseName
              : (local?.name && local.name !== 'Вправа' ? local.name : 'Вправа');
            const isDef = local?.isDefault ?? (id.startsWith('def_ex') || id.startsWith('global_ex'));
            return {
              id,
              name: resolvedName,
              muscle_group: we?.muscleGroup || local?.muscleGroup || 'full_body',
              description: '__FITLOG_DELETED__',
              is_default: isDef,
              user_id: isDef ? null : (local?.userId || currentAuthId),
            };
          });
          const { error: insErr } = await supabase.from('exercises').upsert(missingRows, { onConflict: 'id' });
          if (insErr) {
            console.warn('Could not upsert missing exercises with user_id null, retrying with auth user:', insErr.message);
            if (currentAuthId) {
              const fallbackRows = missingRows.map((r) => ({ ...r, user_id: currentAuthId }));
              await supabase.from('exercises').upsert(fallbackRows, { onConflict: 'id' });
            }
          }
        }

        // Collect exercises for upsert with embedded metadata in notes
        const weRows = workout.exercises.map((we, idx) => {
          const localEx = StorageService.getExerciseById(we.exerciseId);
          const effectiveExName = (we.exerciseName && we.exerciseName !== 'Вправа')
            ? we.exerciseName
            : (localEx?.name && localEx.name !== 'Вправа' ? localEx.name : undefined);
          const effectiveMg = we.muscleGroup || localEx?.muscleGroup || undefined;

          const notesWithMeta = CloudStorageService.encodeExerciseMeta(
            effectiveExName,
            effectiveMg,
            we.notes
          );

          return {
            id: we.id,
            workout_id: workout.id,
            exercise_id: we.exerciseId,
            order_index: we.order || idx + 1,
            set_count: we.setCount || we.sets.length,
            target_reps_range: we.targetRepsRange || '8-12',
            notes: notesWithMeta,
            superset_group_id: we.supersetGroupId || null,
          };
        });

        const { error: weError } = await supabase
          .from('workout_exercises')
          .upsert(weRows, { onConflict: 'id' });

        if (weError) {
          console.warn('saveWorkout exercises error:', weError.message);
        }

        // 4. Clean up deleted sets and upsert current sets
        const remainingWeIds = workout.exercises.map((we) => we.id);
        const currentSetIds = workout.exercises.flatMap((we) => (we.sets || []).map((s) => s.id));

        const { data: existingSets } = await supabase
          .from('workout_sets')
          .select('id')
          .in('workout_exercise_id', remainingWeIds);

        const existingSetIds = (existingSets || []).map((r: any) => r.id);
        const setsToDelete = existingSetIds.filter((id: string) => !currentSetIds.includes(id));
        if (setsToDelete.length > 0) {
          await supabase.from('workout_sets').delete().in('id', setsToDelete);
        }

        // Collect all sets for upsert
        const setRows: any[] = [];
        workout.exercises.forEach((we) => {
          (we.sets || []).forEach((s) => {
            setRows.push({
              id: s.id,
              workout_exercise_id: we.id,
              set_number: s.setNumber,
              target_reps_range: s.targetRepsRange || '8-12',
              weight: s.weight || 0,
              actual_reps: s.actualReps !== null && s.actualReps !== undefined ? s.actualReps : null,
              completed_at: s.completedAt || null,
              notes: s.notes || '',
              is_warmup: Boolean(s.isWarmup),
            });
          });
        });

        if (setRows.length > 0) {
          const { error: sError } = await supabase
            .from('workout_sets')
            .upsert(setRows, { onConflict: 'id' });

          if (sError) {
            console.warn('saveWorkout sets error:', sError.message);
          }
        }
      }

      return true;
    } catch (err) {
      console.warn('Failed to save to cloud:', err);
      return false;
    }
  }

  /**
   * Delete a workout from Supabase
   */
  static async deleteWorkout(workoutId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;

    try {
      const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
      if (error) {
        console.warn('deleteWorkout error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Failed to delete workout in cloud:', err);
      return false;
    }
  }

  /**
   * Fetch custom and global exercises from Supabase
   */
  static async fetchExercises(_userId?: string): Promise<Exercise[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name');

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
        .map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          name: item.name,
          muscleGroup: item.muscle_group,
          description: item.description,
          isDefault: Boolean(item.is_default),
          createdAt: item.created_at,
        }));
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
      // 1. Mark as deleted in Supabase immediately so no client or subsequent sync will ever return it
      await supabase
        .from('exercises')
        .update({
          description: '__FITLOG_DELETED__',
          name: '__DELETED__'
        })
        .eq('id', exerciseId);

      // 2. Try RPC function if configured in database
      try {
        await supabase.rpc('delete_exercise_by_id', { p_exercise_id: exerciseId });
      } catch {}

      // 3. Delete any workout_sets belonging to workout_exercises referencing this exercise
      const { data: weList } = await supabase
        .from('workout_exercises')
        .select('id')
        .eq('exercise_id', exerciseId);

      if (weList && weList.length > 0) {
        const weIds = weList.map((x: any) => x.id);
        const { error: setsErr } = await supabase.from('workout_sets').delete().in('workout_exercise_id', weIds);
        if (setsErr) {
          console.warn('Cascade delete workout_sets warning:', setsErr.message);
        }
        const { error: weErr } = await supabase.from('workout_exercises').delete().in('id', weIds);
        if (weErr) {
          console.warn('Cascade delete workout_exercises warning:', weErr.message);
        }
      }

      // 4. Delete the exercise row from exercises table
      const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
      if (error) {
        console.warn('Physical deleteExercise error (fallback marker applied):', error.message);
      }
      return true;
    } catch (err) {
      console.warn('Failed to delete exercise in cloud:', err);
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('fetchProfile error:', error.message);
        return null;
      }

      if (!data) return null;

      return {
        id: data.id,
        profileCode: data.profile_code,
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        email: data.email,
        role: data.role || 'athlete',
        coachId: data.coach_id,
        image: data.avatar_url || '',
        createdAt: data.created_at,
      };
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
      const { error } = await supabase
        .from('profiles')
        .update({ coach_id: coachId, updated_at: new Date().toISOString() })
        .eq('id', traineeId);

      if (error) {
        console.warn('CloudStorageService.assignTrainee error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('CloudStorageService.assignTrainee failed:', err);
      return false;
    }
  }

  /**
   * Remove trainee from coach in Supabase
   */
  static async removeTrainee(coachId: string, traineeId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;

    try {
      // 1. Try RPC unlink_trainee (bypasses RLS with security definer)
      const { data: rpcRes, error: rpcError } = await supabase.rpc('unlink_trainee', {
        p_trainee_id: traineeId,
      });

      if (!rpcError && rpcRes !== false) {
        return true;
      }

      // 2. Direct table update fallback
      const { error } = await supabase
        .from('profiles')
        .update({ coach_id: null, updated_at: new Date().toISOString() })
        .eq('id', traineeId);

      if (error) {
        console.warn('CloudStorageService.removeTrainee update error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('CloudStorageService.removeTrainee failed:', err);
      return false;
    }
  }

  /**
   * Seed default exercises into Supabase exercises table (disabled - unused exercises are purged permanently)
   */
  static async ensureDefaultExercises(): Promise<void> {
    // Unused exercises are permanently deleted. Never resurrect or seed old exercises.
    return;
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('coach_id', coachId);

      if (error || !data) return [];

      return data.map((item: any) => this.mapProfileRow(item));
    } catch (err) {
      console.warn('Failed to fetch trainees:', err);
      return [];
    }
  }
}
