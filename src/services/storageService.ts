import { Exercise, WorkoutPlan, PastExercisePerformance, User, WorkoutSet } from '../types/workout';
import { DEFAULT_EXERCISES } from '../data/defaultExercises';
import { CloudStorageService } from './cloudStorageService';

const STORAGE_KEYS = {
  USERS: 'workout_diary_users',
  EXERCISES: 'workout_diary_exercises',
  WORKOUTS: 'workout_diary_workouts',
  ACTIVE_USER_ID: 'workout_diary_active_user_id',
};

// Generate robust unique IDs
export const generateId = (prefix = 'id'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// Generate stable CUID-format IDs (e.g. cmug5e9xj0000j5d57meirzop)
export const generateCuid = (): string => {
  const ts = Date.now().toString(36);
  const rnd1 = Math.random().toString(36).substring(2, 8);
  const rnd2 = Math.random().toString(36).substring(2, 10);
  return `c${ts}0000${rnd1}${rnd2}`.substring(0, 25);
};

export class StorageService {
  // --- USERS ---
  static getUsers(): User[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static saveUser(user: User): void {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  static getActiveUserId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
  }

  static setActiveUserId(userId: string | null): void {
    if (userId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, userId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
    }
  }

  // --- EXERCISES ---
  static initializeExercises(): Exercise[] {
    const raw = localStorage.getItem(STORAGE_KEYS.EXERCISES);
    if (raw) {
      try {
        const stored = JSON.parse(raw) as Exercise[];
        if (stored.length > 0) return stored;
      } catch (e) {
        console.error('Failed to parse exercises', e);
      }
    }

    // Seed default exercises with stable IDs
    const seeded: Exercise[] = DEFAULT_EXERCISES.map((ex, idx) => ({
      ...ex,
      id: `def_ex_${idx + 1}`,
      createdAt: '2026-01-01T00:00:00.000Z',
    }));

    localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(seeded));
    return seeded;
  }

  static getExercises(userId: string | null): Exercise[] {
    const all = this.initializeExercises();
    return all.filter((ex) => ex.userId === null || (userId && ex.userId === userId));
  }

  static getExerciseById(id: string): Exercise | undefined {
    const all = this.initializeExercises();
    return all.find((ex) => ex.id === id);
  }

  static createExercise(exerciseData: Omit<Exercise, 'id' | 'createdAt'>): Exercise {
    const all = this.initializeExercises();
    const newExercise: Exercise = {
      ...exerciseData,
      id: generateId('custom_ex'),
      createdAt: new Date().toISOString(),
    };
    all.push(newExercise);
    localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(all));
    CloudStorageService.saveExercise(newExercise).catch((e) =>
      console.warn('CloudStorageService.saveExercise background sync error:', e)
    );
    return newExercise;
  }

  static createGlobalExercise(exerciseData: Omit<Exercise, 'id' | 'createdAt' | 'userId' | 'isDefault'>): Exercise {
    const all = this.initializeExercises();
    const newExercise: Exercise = {
      ...exerciseData,
      id: generateId('global_ex'),
      userId: null,
      isDefault: true,
      createdAt: new Date().toISOString(),
    };
    all.push(newExercise);
    localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(all));
    return newExercise;
  }

  static updateExercise(exercise: Exercise): void {
    const all = this.initializeExercises();
    const idx = all.findIndex((e) => e.id === exercise.id);
    if (idx >= 0) {
      all[idx] = exercise;
      localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(all));
    }
  }

  static deleteExercise(exerciseId: string): void {
    const all = this.initializeExercises();
    const filtered = all.filter((e) => e.id !== exerciseId);
    localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(filtered));
  }

  // --- COACH & TRAINEES RELATIONSHIPS ---
  static getTrainees(coachUserId: string): User[] {
    const users = this.getUsers();
    const coach = users.find((u) => u.id === coachUserId);
    if (!coach || !coach.traineeIds) return [];
    return users.filter((u) => coach.traineeIds?.includes(u.id));
  }

  static addTraineeByCode(
    coachUserId: string,
    profileCodeOrId: string
  ): { success: boolean; message: string; trainee?: User } {
    const users = this.getUsers();
    const coach = users.find((u) => u.id === coachUserId);
    if (!coach) {
      return { success: false, message: 'Тренера не знайдено' };
    }

    const cleanInput = profileCodeOrId.trim().toUpperCase();
    const trainee = users.find(
      (u) =>
        u.profileCode?.toUpperCase() === cleanInput ||
        u.id.toUpperCase() === cleanInput ||
        u.email.toLowerCase() === cleanInput.toLowerCase()
    );

    if (!trainee) {
      return {
        success: false,
        message: `Користувача з ID/кодом "${cleanInput}" не знайдено в базі`,
      };
    }

    if (trainee.id === coachUserId) {
      return { success: false, message: 'Неможливо додати себе у ролі підопічного' };
    }

    const currentTrainees = coach.traineeIds || [];
    if (currentTrainees.includes(trainee.id)) {
      return { success: false, message: `${trainee.name} вже є у вашому списку підопічних` };
    }

    // Update coach
    coach.traineeIds = [...currentTrainees, trainee.id];
    this.saveUser(coach);

    // Update trainee with coachId
    trainee.coachId = coach.id;
    this.saveUser(trainee);

    return {
      success: true,
      message: `Підопічного ${trainee.name} успішно прив'язано!`,
      trainee,
    };
  }

  static removeTrainee(coachUserId: string, traineeId: string): void {
    const users = this.getUsers();
    const coach = users.find((u) => u.id === coachUserId);
    if (coach && coach.traineeIds) {
      coach.traineeIds = coach.traineeIds.filter((id) => id !== traineeId);
      this.saveUser(coach);
    }
    const trainee = users.find((u) => u.id === traineeId);
    if (trainee && trainee.coachId === coachUserId) {
      trainee.coachId = null;
      this.saveUser(trainee);
    }
  }

  // --- AUTHORIZATION CHECKS (Section 8) ---
  static canAccessUserData(requesterId?: string | null, targetUserId?: string | null): boolean {
    if (!requesterId || !targetUserId) return true; // Internal or unrestricted
    if (requesterId === targetUserId) return true;
    const users = this.getUsers();
    const requester = users.find((u) => u.id === requesterId);
    if (!requester) return false;
    if (requester.role === 'admin') return true;
    if (requester.role === 'coach') {
      const targetUser = users.find((u) => u.id === targetUserId);
      const isAssigned =
        (requester.traineeIds && requester.traineeIds.includes(targetUserId)) ||
        (targetUser && targetUser.coachId === requesterId);
      return Boolean(isAssigned);
    }
    return false;
  }

  // --- WORKOUT PLANS ---
  static getWorkouts(userId: string, requesterId?: string): WorkoutPlan[] {
    if (requesterId && !this.canAccessUserData(requesterId, userId)) {
      console.warn(`[Security] Unauthorized access attempt by ${requesterId} to ${userId} workouts`);
      return [];
    }
    const raw = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
    if (!raw) return [];
    try {
      const all = JSON.parse(raw) as WorkoutPlan[];
      return all
        .filter((w) => w.userId === userId)
        .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
    } catch {
      return [];
    }
  }

  static getWorkoutById(workoutId: string): WorkoutPlan | undefined {
    const raw = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
    if (!raw) return undefined;
    try {
      const all = JSON.parse(raw) as WorkoutPlan[];
      return all.find((w) => w.id === workoutId);
    } catch {
      return undefined;
    }
  }

  static saveWorkout(workout: WorkoutPlan): void {
    const raw = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
    let all: WorkoutPlan[] = [];
    if (raw) {
      try {
        all = JSON.parse(raw);
      } catch {
        all = [];
      }
    }
    const idx = all.findIndex((w) => w.id === workout.id);
    if (idx >= 0) {
      all[idx] = workout;
    } else {
      all.push(workout);
    }
    localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(all));

    // KEY LOGIC: Synchronize future/uncompleted workouts if any exercise parameters were updated
    this.syncFutureWorkouts(workout);

    // Sync to Supabase in the background
    CloudStorageService.saveWorkout(workout).catch((e) =>
      console.warn('CloudStorageService.saveWorkout background sync error:', e)
    );
  }

  /**
   * KEY LOGIC: Synchronizes future uncompleted workouts for the same user.
   * If an exercise in day 1 is updated (e.g. 3x6-8 -> 3x8-10 or weights completed),
   * future planned workouts (scheduledDate >= current and status !== 'completed' and not already completed)
   * will automatically reflect the updated exercise target range, set count (2-5), and latest used weight.
   * COMPLETED workouts and historical completed sets are NEVER touched!
   */
  static syncFutureWorkouts(currentWorkout: WorkoutPlan): void {
    const allWorkouts = this.getWorkouts(currentWorkout.userId);
    const currentDate = currentWorkout.scheduledDate;

    // Filter only strictly future/subsequent uncompleted workouts
    const futureWorkouts = allWorkouts.filter(
      (w) => w.id !== currentWorkout.id && w.status !== 'completed' && w.scheduledDate >= currentDate
    );

    if (futureWorkouts.length === 0) return;

    let modifiedAny = false;

    currentWorkout.exercises.forEach((currentEx) => {
      // Find latest completed or target set values from currentWorkout
      const lastSet = currentEx.sets[currentEx.sets.length - 1];
      // Use highest completed weight or current target weight
      const completedSets = currentEx.sets.filter((s) => s.completedAt !== null && s.weight > 0);
      const latestWeight = completedSets.length > 0
        ? completedSets[completedSets.length - 1].weight
        : (lastSet?.weight || 0);

      const targetRange = currentEx.targetRepsRange || lastSet?.targetRepsRange || '8-12';
      const currentSetsCount = currentEx.sets.length;

      futureWorkouts.forEach((fw) => {
        const matchingFutureEx = fw.exercises.find((fe) => fe.exerciseId === currentEx.exerciseId);
        if (matchingFutureEx) {
          // If future exercise has no completed sets, update target reps range, set count, and preset weights
          const hasCompletedSets = matchingFutureEx.sets.some((s) => s.completedAt !== null || (s.actualReps !== null && s.actualReps > 0));
          if (!hasCompletedSets) {
            let exerciseChanged = false;

            // 1. Update target range
            if (matchingFutureEx.targetRepsRange !== targetRange) {
              matchingFutureEx.targetRepsRange = targetRange;
              exerciseChanged = true;
            }

            // 2. Adjust sets count if current workout explicitly changed set count and future set count differs
            if (currentSetsCount >= 2 && currentSetsCount <= 5 && matchingFutureEx.sets.length !== currentSetsCount) {
              const newSets: WorkoutSet[] = [];
              for (let i = 0; i < currentSetsCount; i++) {
                const existing = matchingFutureEx.sets[i];
                const refSet = currentEx.sets[i] || lastSet;
                newSets.push({
                  id: existing?.id || generateId('set'),
                  workoutExerciseId: matchingFutureEx.id,
                  setNumber: i + 1,
                  targetRepsRange: targetRange,
                  weight: existing?.weight && existing.weight > 0 ? existing.weight : (refSet?.weight || latestWeight || 20),
                  actualReps: null,
                  completedAt: null,
                });
              }
              matchingFutureEx.sets = newSets;
              matchingFutureEx.setCount = currentSetsCount;
              exerciseChanged = true;
            } else {
              // Update target reps range and weights on existing future sets
              matchingFutureEx.sets.forEach((s, idx) => {
                if (s.targetRepsRange !== targetRange) {
                  s.targetRepsRange = targetRange;
                  exerciseChanged = true;
                }
                const currentMatchingSet = currentEx.sets[idx] || lastSet;
                if (currentMatchingSet && (s.weight === 0 || s.weight === 20 || s.weight !== currentMatchingSet.weight)) {
                  // Only update if future set is uncompleted
                  s.weight = currentMatchingSet.weight;
                  exerciseChanged = true;
                }
              });
            }

            if (exerciseChanged) {
              modifiedAny = true;
            }
          }
        }
      });
    });

    if (modifiedAny) {
      // Save all updated future workouts
      const raw = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
      let all: WorkoutPlan[] = raw ? JSON.parse(raw) : [];
      futureWorkouts.forEach((fw) => {
        const idx = all.findIndex((w) => w.id === fw.id);
        if (idx >= 0) all[idx] = fw;
      });
      localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(all));
    }
  }

  static deleteWorkout(workoutId: string): void {
    const raw = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
    if (!raw) return;
    try {
      const all = (JSON.parse(raw) as WorkoutPlan[]).filter((w) => w.id !== workoutId);
      localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(all));
      CloudStorageService.deleteWorkout(workoutId).catch((e) =>
        console.warn('CloudStorageService.deleteWorkout background sync error:', e)
      );
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Synchronize local state with Supabase cloud database
   */
  static async syncWithCloud(userId: string): Promise<void> {
    try {
      const cloudWorkouts = await CloudStorageService.fetchWorkouts(userId);
      if (cloudWorkouts && cloudWorkouts.length > 0) {
        const raw = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
        let localWorkouts: WorkoutPlan[] = raw ? JSON.parse(raw) : [];
        const map = new Map<string, WorkoutPlan>();
        localWorkouts.forEach((w) => map.set(w.id, w));
        cloudWorkouts.forEach((cw) => map.set(cw.id, cw));
        localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(Array.from(map.values())));
      }

      const cloudExercises = await CloudStorageService.fetchExercises(userId);
      if (cloudExercises && cloudExercises.length > 0) {
        const rawEx = localStorage.getItem(STORAGE_KEYS.EXERCISES);
        let localExercises: Exercise[] = rawEx ? JSON.parse(rawEx) : [];
        const mapEx = new Map<string, Exercise>();
        localExercises.forEach((e) => mapEx.set(e.id, e));
        cloudExercises.forEach((ce) => mapEx.set(ce.id, ce));
        localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(Array.from(mapEx.values())));
      }
    } catch (err) {
      console.warn('syncWithCloud error:', err);
    }
  }


  // --- KEY LOGIC: LAST EXERCISE PERFORMANCE ---
  /**
   * Automatically retrieves the most recent completed performance data
   * (weight, actual reps per set) for a given exercise to show as a hint/preset.
   */
  static getLastExercisePerformance(
    userId: string,
    exerciseId: string,
    excludeWorkoutId?: string
  ): PastExercisePerformance | null {
    try {
      const workouts = this.getWorkouts(userId);
      if (!Array.isArray(workouts)) return null;

      // Look for previous workouts in reverse chronological order
      for (const w of workouts) {
        if (!w || (excludeWorkoutId && w.id === excludeWorkoutId)) continue;
        if (!Array.isArray(w.exercises)) continue;

        const we = w.exercises.find((item) => item && item.exerciseId === exerciseId);
        if (!we || !Array.isArray(we.sets) || we.sets.length === 0) continue;

        // Check if there are any completed sets or sets with actual reps
        const validSets = we.sets
          .filter((s) => s && s.actualReps !== null && s.actualReps > 0 && s.weight > 0)
          .sort((a, b) => a.setNumber - b.setNumber);

        if (validSets.length > 0) {
          let maxWeight = 0;
          let totalVolume = 0;
          const setSummaries = validSets.map((s) => {
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
      console.error('Error getting last exercise performance:', e);
    }

    return null;
  }

  /**
   * Retrieves all historical performances for an exercise (for charts/records)
   */
  static getAllPastPerformances(userId: string, exerciseId: string): PastExercisePerformance[] {
    try {
      const workouts = this.getWorkouts(userId);
      if (!Array.isArray(workouts)) return [];
      const results: PastExercisePerformance[] = [];

      for (const w of workouts) {
        if (!w || !Array.isArray(w.exercises)) continue;
        const we = w.exercises.find((item) => item && item.exerciseId === exerciseId);
        if (!we || !Array.isArray(we.sets)) continue;

        const validSets = we.sets
          .filter((s) => s && s.actualReps !== null && s.actualReps > 0 && s.weight > 0)
          .sort((a, b) => a.setNumber - b.setNumber);

        if (validSets.length > 0) {
          let maxWeight = 0;
          let totalVolume = 0;
          const setSummaries = validSets.map((s) => {
            if (s.weight > maxWeight) maxWeight = s.weight;
            totalVolume += s.weight * (s.actualReps || 0);
            return {
              setNumber: s.setNumber,
              weight: s.weight,
              actualReps: s.actualReps as number,
              targetRepsRange: s.targetRepsRange,
            };
          });

          results.push({
            workoutId: w.id,
            workoutTitle: w.title,
            date: w.scheduledDate,
            sets: setSummaries,
            maxWeight,
            totalVolume,
          });
        }
      }

      return results;
    } catch (e) {
      console.error('Error getting all past performances:', e);
      return [];
    }
  }

  static seedDemoDataIfEmpty(_user: User): void {
    return;
  }
}
