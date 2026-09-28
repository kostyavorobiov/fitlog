import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { WorkoutPlan, Exercise, User, WorkoutExercise, WorkoutSet } from '../types/workout';
import { StorageService } from './storageService';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';

export class CloudStorageService {
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
            if (exObj && exObj.name) {
              try {
                StorageService.saveExercise({
                  id: exObj.id || we.exercise_id,
                  userId: exObj.user_id || null,
                  name: exObj.name,
                  muscleGroup: exObj.muscle_group || 'full_body',
                  description: exObj.description || '',
                  isDefault: Boolean(exObj.is_default),
                  createdAt: exObj.created_at || '2026-01-01T00:00:00.000Z',
                });
              } catch {}
            }

            const localEx = StorageService.getExerciseById(we.exercise_id);
            const exerciseName = exObj?.name || localEx?.name || undefined;
            const muscleGroup = exObj?.muscle_group || localEx?.muscleGroup || undefined;

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
              notes: we.notes || '',
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

  /**
   * Upsert a complete workout to Supabase
   */
  static async saveWorkout(workout: WorkoutPlan): Promise<boolean> {
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
          const missingRows = missing.map((id) => {
            const we = workout.exercises.find((e) => e.exerciseId === id);
            const local = StorageService.getExerciseById(id);
            return {
              id,
              name: we?.exerciseName || local?.name || 'Вправа',
              muscle_group: we?.muscleGroup || local?.muscleGroup || 'full_body',
              description: local?.description || '',
              is_default: local?.isDefault ?? false,
              user_id: local?.userId || null,
            };
          });
          try {
            await supabase.from('exercises').insert(missingRows);
          } catch (e) {
            console.warn('Could not insert missing exercises:', e);
          }
        }

        // Collect exercises for upsert
        const weRows = workout.exercises.map((we, idx) => ({
          id: we.id,
          workout_id: workout.id,
          exercise_id: we.exerciseId,
          order_index: we.order || idx + 1,
          set_count: we.setCount || we.sets.length,
          target_reps_range: we.targetRepsRange || '8-12',
          notes: we.notes || '',
          superset_group_id: we.supersetGroupId || null,
        }));

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
   * Fetch custom and global exercises
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

      return data.map((item: any) => ({
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
      const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
      if (error) {
        console.warn('deleteExercise error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Failed to delete exercise in cloud:', err);
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
   * Seed default exercises into Supabase exercises table
   */
  static async ensureDefaultExercises(): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      if (DEFAULT_EXERCISES.length === 0) return;

      const { data: existingRows } = await supabase.from('exercises').select('id, name');
      const existingNames = new Map<string, string>();
      (existingRows || []).forEach((r: any) => {
        if (r.name) existingNames.set(r.name.toLowerCase().trim(), r.id);
      });

      const defaultRows = DEFAULT_EXERCISES.map((ex, idx) => {
        const existingId = existingNames.get(ex.name.toLowerCase().trim());
        return {
          id: existingId || `global_ex_${idx + 1}`,
          name: ex.name,
          muscle_group: ex.muscleGroup,
          description: ex.description || '',
          is_default: true,
          user_id: null,
        };
      });

      for (let i = 0; i < defaultRows.length; i += 50) {
        const chunk = defaultRows.slice(i, i + 50);
        await supabase.from('exercises').upsert(chunk, { onConflict: 'id' });
      }
    } catch (err) {
      console.warn('ensureDefaultExercises error:', err);
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
