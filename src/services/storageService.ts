import { Exercise, WorkoutPlan, PastExercisePerformance, User, WorkoutSet } from '../types/workout';
import { CloudStorageService } from './cloudStorageService';

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

// In-memory application store
interface MemoryStore {
  users: User[];
  exercises: Exercise[];
  workouts: WorkoutPlan[];
  deletedWorkoutIds: Set<string>;
  deletedWorkoutExerciseIds: Set<string>;
  activeUserId: string | null;
  removedTraineesByCoach: Map<string, string[]>;
}

const memoryStore: MemoryStore = {
  users: [],
  exercises: [],
  workouts: [],
  deletedWorkoutIds: new Set(),
  deletedWorkoutExerciseIds: new Set(),
  activeUserId: null,
  removedTraineesByCoach: new Map(),
};

// Ensure localStorage is purged of any legacy exercise data
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('fitlog_exercises_v2');
    localStorage.removeItem('fitlog_exercises');
  } catch {}
}

export class StorageService {
  // --- USERS ---
  static getUsers(): User[] {
    return [...memoryStore.users];
  }

  static saveUser(user: User): void {
    const index = memoryStore.users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      const existing = memoryStore.users[index];
      memoryStore.users[index] = {
        ...existing,
        ...user,
        traineeIds: user.traineeIds !== undefined ? user.traineeIds : existing.traineeIds,
        coachId: user.coachId !== undefined ? user.coachId : existing.coachId,
      };
    } else {
      memoryStore.users.push(user);
    }
  }

  static getUserById(id: string): User | undefined {
    return memoryStore.users.find((u) => u.id === id);
  }

  static getActiveUserId(): string | null {
    return memoryStore.activeUserId;
  }

  static setActiveUserId(userId: string | null): void {
    memoryStore.activeUserId = userId;
  }

  // --- EXERCISES (STORED ONLY IN SUPABASE DATABASE) ---
  static initializeExercises(): Exercise[] {
    return [...memoryStore.exercises];
  }

  static async purgeAllExercises(): Promise<void> {
    memoryStore.exercises = [];
    try {
      await CloudStorageService.deleteAllExercises();
    } catch (e) {
      console.warn('purgeAllExercises error:', e);
    }
  }

  static async syncExercises(): Promise<Exercise[]> {
    try {
      const cloudExercises = await CloudStorageService.fetchExercises();
      if (cloudExercises !== null) {
        memoryStore.exercises = cloudExercises;
        return [...memoryStore.exercises];
      }
    } catch (err) {
      console.warn('syncExercises error:', err);
    }
    return [...memoryStore.exercises];
  }

  static getExercises(_targetUserId?: string | null): Exercise[] {
    return this.initializeExercises();
  }

  static getExerciseById(id: string): Exercise | undefined {
    if (!id) return undefined;
    const all = this.initializeExercises();
    const found = all.find((ex) => ex.id === id);
    if (found) return found;

    // Check by def_ex numeric suffix or raw index (e.g. def_ex_1, ex_1, or 1)
    const numMatch = id.match(/^(?:def_ex_|ex_|custom_ex_|exercise_)?(\d+)$/);
    if (numMatch) {
      const targetDefId = `def_ex_${numMatch[1]}`;
      const defFound = all.find((ex) => ex.id === targetDefId);
      if (defFound) return defFound;

      const idx = parseInt(numMatch[1], 10) - 1;
      if (all[idx]) return all[idx];
    }

    // Check by case-insensitive name match
    const byName = all.find((ex) => ex.name.toLowerCase() === id.toLowerCase());
    if (byName) return byName;

    // Fallback: search stored workouts for an embedded exerciseName and muscleGroup (display only)
    for (const w of memoryStore.workouts) {
      const matchWe = w.exercises?.find((we) => (we.exerciseId === id || we.id === id) && we.exerciseName && we.exerciseName !== 'Вправа');
      if (matchWe && matchWe.exerciseName) {
        return {
          id,
          userId: null,
          name: matchWe.exerciseName,
          muscleGroup: matchWe.muscleGroup || 'full_body',
          description: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          isDefault: id.startsWith('def_ex') || id.startsWith('global_ex'),
        };
      }
    }

    return undefined;
  }

  static saveExercise(exercise: Exercise): void {
    const idx = memoryStore.exercises.findIndex((e) => e.id === exercise.id);
    if (idx >= 0) {
      memoryStore.exercises[idx] = exercise;
    } else {
      memoryStore.exercises.push(exercise);
    }
  }

  static async createExercise(exerciseData: Omit<Exercise, 'id' | 'createdAt'>): Promise<Exercise> {
    const newExercise: Exercise = {
      ...exerciseData,
      id: generateId('custom_ex'),
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    memoryStore.exercises.push(newExercise);
    try {
      await CloudStorageService.saveExercise(newExercise);
    } catch (e) {
      console.warn('CloudStorageService.saveExercise error:', e);
    }
    return newExercise;
  }

  static async createGlobalExercise(exerciseData: Omit<Exercise, 'id' | 'createdAt' | 'userId' | 'isDefault'>): Promise<Exercise> {
    const newExercise: Exercise = {
      ...exerciseData,
      id: generateId('global_ex'),
      userId: null,
      isDefault: true,
      createdAt: new Date().toISOString(),
    };
    memoryStore.exercises.push(newExercise);
    try {
      await CloudStorageService.saveExercise(newExercise);
    } catch (e) {
      console.warn('CloudStorageService.saveExercise global exercise error:', e);
    }
    return newExercise;
  }

  static updateExercise(exercise: Exercise): void {
    const idx = memoryStore.exercises.findIndex((e) => e.id === exercise.id);
    if (idx >= 0) {
      memoryStore.exercises[idx] = exercise;

      // Update embedded in workouts in memory
      memoryStore.workouts.forEach((w) => {
        (w.exercises || []).forEach((we) => {
          if (we.exerciseId === exercise.id) {
            we.exerciseName = exercise.name;
            we.muscleGroup = exercise.muscleGroup;
          }
        });
      });

      CloudStorageService.saveExercise(exercise).catch((e) =>
        console.warn('CloudStorageService.saveExercise update error:', e)
      );
    }
  }

  static async deleteExercise(exerciseId: string): Promise<boolean> {
    memoryStore.exercises = memoryStore.exercises.filter((e) => e.id !== exerciseId);

    // Also remove from all workouts in memory so it's not referenced or revived
    memoryStore.workouts.forEach((w) => {
      if (Array.isArray(w.exercises)) {
        w.exercises = w.exercises.filter((we) => we.exerciseId !== exerciseId);
      }
    });

    try {
      const res = await CloudStorageService.deleteExercise(exerciseId);
      const cloudExercises = await CloudStorageService.fetchExercises();
      if (cloudExercises !== null) {
        memoryStore.exercises = cloudExercises.filter((e) => e.id !== exerciseId);
      }
      return res;
    } catch (e) {
      console.warn('CloudStorageService.deleteExercise error:', e);
      return false;
    }
  }

  /**
   * Delete all exercises except those that are already used or recorded in workouts
   */
  static async cleanupUnusedExercises(): Promise<{ deletedCount: number; keptCount: number }> {
    // 1. Gather all exercise IDs and names referenced in any workouts in memory
    const usedIds = new Set<string>();
    const usedNames = new Set<string>();

    memoryStore.workouts.forEach((w) => {
      (w.exercises || []).forEach((we) => {
        if (we.exerciseId) usedIds.add(we.exerciseId);
        if (we.exerciseName) usedNames.add(we.exerciseName.toLowerCase().trim());
      });
    });

    // 2. Perform cleanup in Supabase cloud
    let cloudResult = { deletedCount: 0, keptCount: 0 };
    try {
      cloudResult = await CloudStorageService.cleanupUnusedExercises();
    } catch (e) {
      console.warn('Cloud cleanup error:', e);
    }

    // 3. Filter memoryStore.exercises: keep only used ones
    const initialCount = memoryStore.exercises.length;
    memoryStore.exercises = memoryStore.exercises.filter((ex) => {
      if (usedIds.has(ex.id) || usedNames.has(ex.name.toLowerCase().trim())) return true;
      if (ex.userId && !ex.isDefault && !ex.id.startsWith('global_ex') && !ex.id.startsWith('def_ex')) return true;
      return false;
    });
    const memoryDeleted = initialCount - memoryStore.exercises.length;

    // 4. If Supabase is connected, refresh from cloud
    try {
      const refreshed = await CloudStorageService.fetchExercises();
      if (refreshed && refreshed.length > 0) {
        memoryStore.exercises = refreshed;
      }
    } catch (e) {
      console.warn('Refresh after cleanup error:', e);
    }

    return {
      deletedCount: Math.max(cloudResult.deletedCount, memoryDeleted),
      keptCount: memoryStore.exercises.length,
    };
  }

  // --- COACH & TRAINEES RELATIONSHIPS ---
  static getRemovedTraineeIds(coachUserId: string): string[] {
    return memoryStore.removedTraineesByCoach.get(coachUserId) || [];
  }

  static setRemovedTraineeIds(coachUserId: string, ids: string[]): void {
    memoryStore.removedTraineesByCoach.set(coachUserId, ids);
  }

  static getTrainees(coachUserId: string): User[] {
    const users = this.getUsers();
    const coach = users.find((u) => u.id === coachUserId);
    if (!coach || !coach.traineeIds) return [];
    const removedIds = this.getRemovedTraineeIds(coachUserId);
    return users
      .filter((u) => coach.traineeIds?.includes(u.id))
      .filter((u) => !removedIds.includes(u.id));
  }

  static async syncTraineesFromCloud(coachUserId: string): Promise<User[]> {
    try {
      const cloudTrainees = await CloudStorageService.fetchTrainees(coachUserId);
      if (cloudTrainees && cloudTrainees.length > 0) {
        const removedIds = this.getRemovedTraineeIds(coachUserId);
        const activeCloudTrainees = cloudTrainees.filter((t) => !removedIds.includes(t.id));

        activeCloudTrainees.forEach((t) => this.saveUser(t));
        const users = this.getUsers();
        const coach = users.find((u) => u.id === coachUserId);
        if (coach) {
          coach.traineeIds = Array.from(
            new Set([
              ...(coach.traineeIds || []).filter((id) => !removedIds.includes(id)),
              ...activeCloudTrainees.map((t) => t.id),
            ])
          );
          this.saveUser(coach);
        }
      }
    } catch (err) {
      console.warn('syncTraineesFromCloud error:', err);
    }
    return this.getTrainees(coachUserId);
  }

  static async addTraineeByCode(
    coachUserId: string,
    profileCodeOrId: string
  ): Promise<{ success: boolean; message: string; trainee?: User }> {
    const users = this.getUsers();
    const coach = users.find((u) => u.id === coachUserId);
    if (!coach) {
      return { success: false, message: 'Тренера не знайдено' };
    }

    const cleanInput = profileCodeOrId.trim();
    const upperInput = cleanInput.toUpperCase();
    const strippedUpper = upperInput.replace(/^U_/i, '');

    // 1. Search in memory
    let trainee = users.find(
      (u) =>
        u.profileCode?.toUpperCase() === upperInput ||
        u.profileCode?.toUpperCase() === strippedUpper ||
        u.id.toUpperCase() === upperInput ||
        u.id.toUpperCase() === strippedUpper ||
        u.email.toLowerCase() === cleanInput.toLowerCase() ||
        (u.id && u.id.replace(/[-_]/g, '').toUpperCase().startsWith(strippedUpper))
    );

    // 2. If not found in memory, query Supabase profiles
    if (!trainee) {
      try {
        const cloudTrainee = await CloudStorageService.findProfile(cleanInput);
        if (cloudTrainee) {
          trainee = cloudTrainee;
          this.saveUser(trainee);
        }
      } catch (e) {
        console.warn('Cloud search failed:', e);
      }
    }

    if (!trainee) {
      return {
        success: false,
        message: `Користувача з ID/кодом "${cleanInput}" не знайдено в базі`,
      };
    }

    if (trainee.id === coachUserId) {
      return { success: false, message: 'Неможливо додати себе у ролі підопічного' };
    }

    // Unmark as removed if previously unlinked
    const removedIds = this.getRemovedTraineeIds(coachUserId);
    if (removedIds.includes(trainee.id)) {
      this.setRemovedTraineeIds(
        coachUserId,
        removedIds.filter((id) => id !== trainee.id)
      );
    }

    const currentTrainees = coach.traineeIds || [];
    if (currentTrainees.includes(trainee.id)) {
      return { success: false, message: `${trainee.name} вже є у вашому списку підопічних` };
    }

    // Update coach in memory
    coach.traineeIds = [...currentTrainees, trainee.id];
    this.saveUser(coach);

    // Update trainee with coachId in memory
    trainee.coachId = coach.id;
    this.saveUser(trainee);

    // Update in Supabase
    try {
      await CloudStorageService.assignTrainee(coach.id, trainee.id);
    } catch (err) {
      console.warn('addTraineeByCode assignTrainee error:', err);
    }

    return {
      success: true,
      message: `Підопічного ${trainee.name} успішно прив'язано!`,
      trainee,
    };
  }

  static async assignCoachToAthlete(
    athleteUserId: string,
    coachCodeOrId: string
  ): Promise<{ success: boolean; message: string; coach?: User }> {
    const users = this.getUsers();
    const athlete = users.find((u) => u.id === athleteUserId);
    if (!athlete) {
      return { success: false, message: 'Користувача не знайдено' };
    }

    const cleanInput = coachCodeOrId.trim();
    const upperInput = cleanInput.toUpperCase();
    const strippedUpper = upperInput.replace(/^U_/i, '');

    let coach = users.find(
      (u) =>
        u.profileCode?.toUpperCase() === upperInput ||
        u.profileCode?.toUpperCase() === strippedUpper ||
        u.id.toUpperCase() === upperInput ||
        u.id.toUpperCase() === strippedUpper ||
        u.email.toLowerCase() === cleanInput.toLowerCase()
    );

    if (!coach) {
      try {
        const cloudCoach = await CloudStorageService.findProfile(cleanInput);
        if (cloudCoach) {
          coach = cloudCoach;
          this.saveUser(coach);
        }
      } catch (e) {
        console.warn('Cloud coach search failed:', e);
      }
    }

    if (!coach) {
      return { success: false, message: `Тренера з кодом "${cleanInput}" не знайдено` };
    }

    if (coach.id === athleteUserId) {
      return { success: false, message: 'Неможливо призначити себе тренером' };
    }

    // Remove athlete from coach's removed list if present
    const removedIds = this.getRemovedTraineeIds(coach.id);
    if (removedIds.includes(athlete.id)) {
      this.setRemovedTraineeIds(
        coach.id,
        removedIds.filter((id) => id !== athlete.id)
      );
    }

    athlete.coachId = coach.id;
    this.saveUser(athlete);

    coach.traineeIds = Array.from(new Set([...(coach.traineeIds || []), athlete.id]));
    this.saveUser(coach);

    // Update in Supabase
    try {
      await CloudStorageService.assignTrainee(coach.id, athlete.id);
      await CloudStorageService.updateProfile(athlete.id, { coachId: coach.id });
    } catch (err) {
      console.warn('assignCoachToAthlete cloud update error:', err);
    }

    return {
      success: true,
      message: `Вас успішно прикріплено до тренера ${coach.name}!`,
      coach,
    };
  }

  static async removeTrainee(coachUserId: string, traineeId: string): Promise<boolean> {
    // 1. Add to coach's removed list to immediately block sync resurrection
    const removedIds = this.getRemovedTraineeIds(coachUserId);
    if (!removedIds.includes(traineeId)) {
      this.setRemovedTraineeIds(coachUserId, [...removedIds, traineeId]);
    }

    // 2. Remove from coach in memory
    const users = this.getUsers();
    const coach = users.find((u) => u.id === coachUserId);
    if (coach && coach.traineeIds) {
      coach.traineeIds = coach.traineeIds.filter((id) => id !== traineeId);
      this.saveUser(coach);
    }

    // 3. Clear coachId on trainee in memory
    const trainee = users.find((u) => u.id === traineeId);
    if (trainee && trainee.coachId === coachUserId) {
      trainee.coachId = null;
      this.saveUser(trainee);
    }

    // 4. Update in Supabase
    let cloudSuccess = false;
    try {
      cloudSuccess = await CloudStorageService.removeTrainee(coachUserId, traineeId);
    } catch (err) {
      console.warn('removeTrainee cloud error:', err);
    }
    return cloudSuccess;
  }

  static async removeCoachFromAthlete(athleteId: string, coachId: string): Promise<boolean> {
    // 1. Clear coachId on athlete in memory
    const users = this.getUsers();
    const athlete = users.find((u) => u.id === athleteId);
    if (athlete) {
      athlete.coachId = null;
      this.saveUser(athlete);
    }

    // 2. Remove athlete from coach's traineeIds in memory
    const coach = users.find((u) => u.id === coachId);
    if (coach && coach.traineeIds) {
      coach.traineeIds = coach.traineeIds.filter((id) => id !== athleteId);
      this.saveUser(coach);
    }

    // 3. Mark in coach's removed list
    const removedIds = this.getRemovedTraineeIds(coachId);
    if (!removedIds.includes(athleteId)) {
      this.setRemovedTraineeIds(coachId, [...removedIds, athleteId]);
    }

    // 4. Update in Supabase
    let cloudSuccess = false;
    try {
      cloudSuccess = await CloudStorageService.removeTrainee(coachId, athleteId);
    } catch (err) {
      console.warn('removeCoachFromAthlete cloud error:', err);
    }
    return cloudSuccess;
  }

  // --- AUTHORIZATION CHECKS ---
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
    return memoryStore.workouts
      .filter((w) => w.userId === userId && !memoryStore.deletedWorkoutIds.has(w.id))
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
  }

  static getWorkoutById(workoutId: string): WorkoutPlan | undefined {
    return memoryStore.workouts.find((w) => w.id === workoutId);
  }

  static saveWorkout(workout: WorkoutPlan): void {
    // If this workout was previously deleted, unmark it
    memoryStore.deletedWorkoutIds.delete(workout.id);

    // Track which exercises were removed from this workout
    const existing = memoryStore.workouts.find((w) => w.id === workout.id);
    if (existing && Array.isArray(existing.exercises)) {
      const currentExIds = new Set((workout.exercises || []).map((e) => e.id));
      existing.exercises.forEach((ex) => {
        if (!currentExIds.has(ex.id)) {
          memoryStore.deletedWorkoutExerciseIds.add(ex.id);
        }
      });
    }

    // Ensure all exercises in this workout have exerciseName and muscleGroup resolved
    if (workout.exercises && Array.isArray(workout.exercises)) {
      workout.exercises.forEach((we) => {
        if (!we.exerciseName || we.exerciseName === 'Вправа') {
          const ex = this.getExerciseById(we.exerciseId);
          if (ex && ex.name && ex.name !== 'Вправа') {
            we.exerciseName = ex.name;
          }
        }
        if (!we.muscleGroup) {
          const ex = this.getExerciseById(we.exerciseId);
          if (ex && ex.muscleGroup) {
            we.muscleGroup = ex.muscleGroup;
          }
        }
      });
    }

    const idx = memoryStore.workouts.findIndex((w) => w.id === workout.id);
    if (idx >= 0) {
      memoryStore.workouts[idx] = workout;
    } else {
      memoryStore.workouts.push(workout);
    }

    // Synchronize future/uncompleted workouts if any exercise parameters were updated
    this.syncFutureWorkouts(workout);

    // Sync to Supabase in the background
    CloudStorageService.saveWorkout(workout).catch((e) =>
      console.warn('CloudStorageService.saveWorkout background sync error:', e)
    );
  }

  /**
   * Synchronizes future uncompleted workouts for the same user in memory.
   * If an exercise in day 1 is updated (e.g. 3x6-8 -> 3x8-10 or weights completed),
   * future planned workouts (scheduledDate >= current and status !== 'completed' and not already completed)
   * will automatically reflect the updated exercise target range, set count (2-5), and latest used weight.
   * COMPLETED workouts and historical completed sets are NEVER touched!
   */
  static syncFutureWorkouts(currentWorkout: WorkoutPlan): void {
    try {
      if (!currentWorkout || !Array.isArray(currentWorkout.exercises)) return;

      const allWorkouts = this.getWorkouts(currentWorkout.userId);
      if (!Array.isArray(allWorkouts)) return;
      const currentDate = currentWorkout.scheduledDate;

      // Filter only strictly future/subsequent uncompleted workouts
      const futureWorkouts = allWorkouts.filter(
        (w) => w && w.id !== currentWorkout.id && w.status !== 'completed' && w.scheduledDate >= currentDate
      );

      if (futureWorkouts.length === 0) return;

      currentWorkout.exercises.forEach((currentEx) => {
        if (!currentEx || !Array.isArray(currentEx.sets) || currentEx.sets.length === 0) return;
        const lastSet = currentEx.sets[currentEx.sets.length - 1];
        const completedSets = currentEx.sets.filter((s) => s && s.completedAt !== null && s.weight > 0);
        const latestWeight = completedSets.length > 0
          ? completedSets[completedSets.length - 1].weight
          : (lastSet?.weight || 0);

        const targetRange = currentEx.targetRepsRange || lastSet?.targetRepsRange || '8-12';
        const currentSetsCount = currentEx.sets.length;

        futureWorkouts.forEach((fw) => {
          if (!fw || !Array.isArray(fw.exercises)) return;
          const matchingFutureEx = fw.exercises.find((fe) => fe && fe.exerciseId === currentEx.exerciseId);
          if (matchingFutureEx && Array.isArray(matchingFutureEx.sets)) {
            const hasCompletedSets = matchingFutureEx.sets.some((s) => s && (s.completedAt !== null || (s.actualReps !== null && s.actualReps > 0)));
            if (!hasCompletedSets) {
              if (matchingFutureEx.targetRepsRange !== targetRange) {
                matchingFutureEx.targetRepsRange = targetRange;
              }

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
              } else {
                matchingFutureEx.sets.forEach((s, idx) => {
                  if (!s) return;
                  if (s.targetRepsRange !== targetRange) {
                    s.targetRepsRange = targetRange;
                  }
                  const currentMatchingSet = currentEx.sets[idx] || lastSet;
                  if (currentMatchingSet && (s.weight === 0 || s.weight === 20 || s.weight !== currentMatchingSet.weight)) {
                    s.weight = currentMatchingSet.weight;
                  }
                });
              }
            }
          }
        });
      });
    } catch (err) {
      console.warn('syncFutureWorkouts error:', err);
    }
  }

  static deleteWorkout(workoutId: string): void {
    memoryStore.deletedWorkoutIds.add(workoutId);
    memoryStore.workouts = memoryStore.workouts.filter((w) => w.id !== workoutId);
    CloudStorageService.deleteWorkout(workoutId).catch((e) =>
      console.warn('CloudStorageService.deleteWorkout background sync error:', e)
    );
  }

  /**
   * Authoritatively updates workouts for a given user in memory
   * without affecting other users' workouts and without resurrecting deleted workouts.
   */
  static setWorkoutsForUser(userId: string, userWorkouts: WorkoutPlan[]): void {
    const otherUsersWorkouts = memoryStore.workouts.filter((w) => w.userId !== userId);
    const localUserWorkouts = memoryStore.workouts.filter(
      (w) => w.userId === userId && !memoryStore.deletedWorkoutIds.has(w.id)
    );
    const localMap = new Map<string, WorkoutPlan>();
    localUserWorkouts.forEach((w) => localMap.set(w.id, w));

    // Filter out any workouts that were deleted locally
    const filteredCloudWorkouts = (userWorkouts || []).filter(
      (cw) => !memoryStore.deletedWorkoutIds.has(cw.id)
    );

    // Merge cloud workouts with local workouts
    const mergedUserWorkouts = filteredCloudWorkouts.map((cw) => {
      const local = localMap.get(cw.id);
      if (!local) {
        // Strip any exercises that were deleted locally
        const cleanExercises = (cw.exercises || []).filter(
          (we) => !memoryStore.deletedWorkoutExerciseIds.has(we.id)
        );
        return { ...cw, exercises: cleanExercises };
      }

      // If local exists, local has the authoritative in-memory state of exercises for this workout
      const localExercises = (Array.isArray(local.exercises) ? local.exercises : []).filter(
        (le) => !memoryStore.deletedWorkoutExerciseIds.has(le.id)
      );
      const cloudExercises = (Array.isArray(cw.exercises) ? cw.exercises : []).filter(
        (we) => !memoryStore.deletedWorkoutExerciseIds.has(we.id)
      );

      // Preserve local exercises; if cloud has new exercises not seen locally, include them
      const localExIds = new Set(localExercises.map((e) => e.id));
      const newFromCloud = cloudExercises.filter((ce) => !localExIds.has(ce.id));

      return {
        ...cw,
        exercises: localExercises.length > 0 ? localExercises : (newFromCloud.length > 0 ? newFromCloud : []),
      };
    });

    // Also preserve any newly created local workouts that haven't hit the cloud yet
    const cloudIds = new Set(filteredCloudWorkouts.map((w) => w.id));
    localUserWorkouts.forEach((lw) => {
      if (!cloudIds.has(lw.id) && !memoryStore.deletedWorkoutIds.has(lw.id)) {
        mergedUserWorkouts.push(lw);
      }
    });

    memoryStore.workouts = [...otherUsersWorkouts, ...mergedUserWorkouts];
  }

  /**
   * Synchronize local state with Supabase cloud database
   */
  static async syncWithCloud(userId: string): Promise<void> {
    try {
      // Ensure exercises are synchronized before loading workouts
      await this.syncExercises();

      const cloudWorkouts = await CloudStorageService.fetchWorkouts(userId);
      if (cloudWorkouts !== null) {
        this.setWorkoutsForUser(userId, cloudWorkouts);
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
}
