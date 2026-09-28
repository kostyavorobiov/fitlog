import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { WorkoutPlan, Exercise, User, WorkoutExercise, WorkoutSet } from '../types/workout';

export class CloudStorageService {
  /**
   * Fetch all workouts for user (including assigned trainee workouts)
   */
  static async fetchWorkouts(userId: string): Promise<WorkoutPlan[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

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
        .order('scheduled_date', { ascending: false });

      if (error) {
        console.warn('CloudStorageService.fetchWorkouts error:', error.message);
        return null;
      }

      if (!workoutsData) return [];

      return workoutsData.map((w: any) => {
        const exercises: WorkoutExercise[] = (w.workout_exercises || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((we: any) => {
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
      // 1. Upsert Workout row
      const { error: wError } = await supabase.from('workouts').upsert(
        {
          id: workout.id,
          user_id: workout.userId,
          assigned_by_coach_id: workout.assignedByCoachId || null,
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

      // 2. Upsert exercises & sets
      if (workout.exercises && workout.exercises.length > 0) {
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
  static async fetchExercises(userId: string): Promise<Exercise[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${userId}`)
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
      const { error } = await supabase.from('exercises').upsert(
        {
          id: exercise.id,
          user_id: exercise.userId,
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
      const { error } = await supabase
        .from('profiles')
        .update({ coach_id: null, updated_at: new Date().toISOString() })
        .eq('id', traineeId)
        .eq('coach_id', coachId);

      if (error) {
        console.warn('CloudStorageService.removeTrainee error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('CloudStorageService.removeTrainee failed:', err);
      return false;
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
