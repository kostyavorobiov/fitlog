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
  activeUserId: string | null;
  removedTraineesByCoach: Map<string, string[]>;
}

const memoryStore: MemoryStore = {
  users: [],
  exercises: [],
  workouts: [],
  deletedWorkoutIds: new Set(),
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

export interface GetExercisesOptions {
  forWorkoutPlan?: boolean;
  workoutUserId?: string | null;
  coachId?: string | null;
  traineeId?: string | null;
  existingExerciseIds?: string[];
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

  /**
   * Migrate global/default exercises that were used in a user's workouts
   * into that user's personal exercise library. Runs once per session.
   */
  private static migratedUserIds = new Set<string>();
  private static loadedWorkoutUsers = new Set<string>();
  private static migrations = new Map<string, Promise<void>>();
  private static workoutRevision = 0;
  private static dirtyWorkouts = new Map<string, number>();
  private static modifiedWorkouts = new Map<string, number>();
  private static fetchedRevisions = new WeakMap<WorkoutPlan[], { revision: number; pendingIds: Set<string> }>();

  static getWorkoutRevision(): number { return this.workoutRevision; }

  static getPendingWorkoutIds(): string[] { return [...this.dirtyWorkouts.keys()]; }

  static markWorkoutsFetched(workouts: WorkoutPlan[], revision: number, pendingIds: string[] = []): void {
    this.fetchedRevisions.set(workouts, { revision, pendingIds: new Set(pendingIds) });
  }

  static async migrateGlobalExercisesToUser(userId: string): Promise<void> {
    if (!userId || !this.loadedWorkoutUsers.has(userId) || this.migratedUserIds.has(userId)) return;
    const existing = this.migrations.get(userId);
    if (existing) return existing;
    const migration = this.runExerciseMigration(userId);
    this.migrations.set(userId, migration);
    try { await migration; } finally { this.migrations.delete(userId); }
  }

  private static async runExerciseMigration(userId: string): Promise<void> {
    // A previous migration may have saved the exercise but failed to save its remapped workout.
    for (const workout of this.getWorkouts(userId)) {
      if (this.dirtyWorkouts.has(workout.id) && !await this.saveWorkout(workout, false)) return;
    }
    const owned = new Map(memoryStore.exercises.filter((e) => e.userId === userId)
      .map((e) => [e.name.toLowerCase().trim(), e]));
    const usedIds = new Set(this.getWorkouts(userId).flatMap((w) => w.exercises.map((e) => e.exerciseId)));
    const globals = memoryStore.exercises.filter((e) =>
      usedIds.has(e.id) && (e.isDefault || !e.userId || e.userId === 'null'));
    let success = true;
    for (const global of globals) {
      const key = global.name.toLowerCase().trim();
      let personal = owned.get(key);
      if (!personal) {
        personal = { ...global, id: `custom_ex_migrated_${userId}_${global.id}`, userId, isDefault: false };
        if (!await CloudStorageService.saveExercise(personal)) { success = false; continue; }
        this.saveExercise(personal);
        owned.set(key, personal);
      }
      // Never remap another user's workout, including a coach's other trainees.
      for (const workout of this.getWorkouts(userId)) {
        if (!workout.exercises.some((e) => e.exerciseId === global.id)) continue;
        const updated = { ...workout, exercises: workout.exercises.map((e) =>
          e.exerciseId === global.id ? { ...e, exerciseId: personal!.id } : e) };
        if (!await this.saveWorkout(updated, false)) success = false;
      }
    }
    if (success) this.migratedUserIds.add(userId);
  }

  private static async loadExercisesFromCloud(targetUserId?: string): Promise<boolean> {
    try {
      const exercises = await CloudStorageService.fetchExercises(targetUserId);
      if (exercises === null) return false;
      memoryStore.exercises = exercises;
      return true;
    } catch (error) {
      console.warn('syncExercises error:', error);
      return false;
    }
  }

  static async syncExercises(targetUserId?: string): Promise<Exercise[]> {
    await this.loadExercisesFromCloud(targetUserId);
    return [...memoryStore.exercises];
  }

  /**
   * Returns exercises visible to the given user.
   * Post-migration: only returns user's own exercises (no global pool).
   * When coach creates/edits a trainee's workout, includes both coach and trainee exercises.
   */
  static getExercises(targetUserId?: string | null, options?: GetExercisesOptions): Exercise[] {
    const all = this.initializeExercises();
    const activeId = this.getActiveUserId();
    const effectiveUserId = targetUserId !== undefined ? targetUserId : activeId;

    if (!effectiveUserId || effectiveUserId === 'null') {
      // No user — return nothing (no more global pool)
      return [];
    }

    const coachId = options?.coachId || (activeId && activeId !== effectiveUserId ? activeId : null);
    const traineeId = options?.traineeId;

    const relevantUserIds = new Set<string>();
    relevantUserIds.add(effectiveUserId);
    if (coachId) relevantUserIds.add(coachId);
    if (traineeId) relevantUserIds.add(traineeId);

    if (relevantUserIds.size === 1) {
      return all.filter((ex) => ex.userId === effectiveUserId);
    }

    const primaryUserId = coachId || effectiveUserId;

    const primaryExercises: Exercise[] = [];
    const secondaryExercises: Exercise[] = [];

    all.forEach((ex) => {
      if (ex.userId === primaryUserId) {
        primaryExercises.push(ex);
      } else if (relevantUserIds.has(ex.userId || '')) {
        secondaryExercises.push(ex);
      }
    });

    const seenNames = new Set<string>();
    const result: Exercise[] = [];

    primaryExercises.forEach((ex) => {
      const norm = ex.name.toLowerCase().trim();
      seenNames.add(norm);
      result.push(ex);
    });

    secondaryExercises.forEach((ex) => {
      const norm = ex.name.toLowerCase().trim();
      if (!seenNames.has(norm)) {
        seenNames.add(norm);
        result.push(ex);
      }
    });

    return result;
  }

  /**
   * Retrieves all exercises for an ALREADY CREATED workout plan.
   * In a created plan, coach and trainee can both see the exercises that belong to this plan.
   */
  static getExercisesForWorkout(workout: WorkoutPlan): Exercise[] {
    const list: Exercise[] = [];
    const seen = new Set<string>();
    (workout.exercises || []).forEach((we) => {
      if (!seen.has(we.exerciseId)) {
        seen.add(we.exerciseId);
        const ex = this.getExerciseById(we.exerciseId);
        if (ex) list.push(ex);
      }
    });
    return list;
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

  /**
   * @deprecated Global exercises are no longer used.
   * Creates a user-scoped exercise instead. The userId of the active user is used.
   */
  static async createGlobalExercise(exerciseData: Omit<Exercise, 'id' | 'createdAt' | 'userId' | 'isDefault'>): Promise<Exercise> {
    const activeId = this.getActiveUserId();
    return this.createExercise({
      ...exerciseData,
      userId: activeId,
      isDefault: false,
    });
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
    const success = await CloudStorageService.deleteExercise(exerciseId);
    if (success) {
      memoryStore.exercises = memoryStore.exercises.filter((e) => e.id !== exerciseId);
      // Embedded names and historical sets remain intact.
    }
    return success;
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

    if (!await CloudStorageService.assignTrainee(coach.id, trainee.id)) {
      return { success: false, message: 'Не вдалося зберегти прив’язку на сервері' };
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

    if (!await CloudStorageService.assignTrainee(coach.id, athlete.id)) {
      return { success: false, message: 'Не вдалося зберегти прив’язку на сервері' };
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

    return {
      success: true,
      message: `Вас успішно прикріплено до тренера ${coach.name}!`,
      coach,
    };
  }

  static async removeTrainee(coachUserId: string, traineeId: string): Promise<boolean> {
    if (!await CloudStorageService.removeTrainee(coachUserId, traineeId)) return false;
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

    return true;
  }

  static async removeCoachFromAthlete(athleteId: string, coachId: string): Promise<boolean> {
    if (!await CloudStorageService.removeTrainee(coachId, athleteId)) return false;
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

    return true;
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

  static saveWorkout(workout: WorkoutPlan, propagate = true): Promise<boolean> {
    // If this workout was previously deleted, unmark it
    memoryStore.deletedWorkoutIds.delete(workout.id);

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
    if (propagate) this.syncFutureWorkouts(workout);

    const revision = ++this.workoutRevision;
    this.dirtyWorkouts.set(workout.id, revision);
    this.modifiedWorkouts.set(workout.id, revision);
    return CloudStorageService.saveWorkout(workout).then((success) => {
      if (success && this.dirtyWorkouts.get(workout.id) === revision) {
        this.dirtyWorkouts.delete(workout.id);
      }
      return success;
    }).catch((error) => {
      console.warn('Workout save failed:', error);
      return false;
    });
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

      const before = new Map(futureWorkouts.map((w) => [w.id, JSON.stringify(w)]));
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
      futureWorkouts.forEach((w) => {
        if (JSON.stringify(w) !== before.get(w.id)) void this.saveWorkout(w, false);
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
    this.loadedWorkoutUsers.add(userId);
    const read = this.fetchedRevisions.get(userWorkouts);
    const fetchedAt = read?.revision ?? this.workoutRevision;
    const local = new Map(memoryStore.workouts.filter((w) => w.userId === userId).map((w) => [w.id, w]));
    const preserveLocal = (id: string) => this.dirtyWorkouts.has(id) || read?.pendingIds.has(id) ||
      (this.modifiedWorkouts.get(id) ?? 0) > fetchedAt;
    const merged = userWorkouts.filter((w) => !memoryStore.deletedWorkoutIds.has(w.id)).map((w) =>
      preserveLocal(w.id) && local.has(w.id) ? local.get(w.id)! : w);
    const cloudIds = new Set(userWorkouts.map((w) => w.id));
    for (const w of local.values()) {
      if (!cloudIds.has(w.id) && preserveLocal(w.id) && !memoryStore.deletedWorkoutIds.has(w.id)) merged.push(w);
    }
    memoryStore.workouts = [...memoryStore.workouts.filter((w) => w.userId !== userId), ...merged];
  }

  /**
   * Synchronize local state with Supabase cloud database
   */
  static async syncWithCloud(userId: string): Promise<void> {
    try {
      // 1. Load exercises first
      const exercisesLoaded = await this.loadExercisesFromCloud(userId);

      // 2. Load workouts
      const cloudWorkouts = await CloudStorageService.fetchWorkouts(userId);
      if (cloudWorkouts !== null) {
        this.setWorkoutsForUser(userId, cloudWorkouts);
      }

      // 3. NOW run migration: workouts are in memory, we can find which global exercises were used
      if (exercisesLoaded && cloudWorkouts !== null) await this.migrateGlobalExercisesToUser(userId);
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
      let workouts = this.getWorkouts(userId);
      if (!Array.isArray(workouts) || workouts.length === 0) {
        workouts = memoryStore.workouts.filter((w) => !memoryStore.deletedWorkoutIds.has(w.id));
      }
      if (!Array.isArray(workouts)) return null;

      // Find the target exercise to match by normalized name as well
      let targetEx = this.getExerciseById(exerciseId);
      if (!targetEx) {
        for (const w of workouts) {
          const matchWe = w.exercises?.find((item) => item.exerciseId === exerciseId || item.id === exerciseId);
          if (matchWe && matchWe.exerciseName && matchWe.exerciseName !== 'Вправа') {
            targetEx = {
              id: exerciseId,
              userId: null,
              name: matchWe.exerciseName,
              muscleGroup: matchWe.muscleGroup || 'full_body',
              isDefault: false,
              createdAt: '',
            };
            break;
          }
        }
      }
      const targetName = targetEx?.name?.toLowerCase().trim();

      // Look for previous workouts in reverse chronological order
      for (const w of workouts) {
        if (!w || (excludeWorkoutId && w.id === excludeWorkoutId)) continue;
        if (!Array.isArray(w.exercises)) continue;

        // Match by exact exerciseId OR normalized exerciseName
        const we = w.exercises.find((item) => {
          if (!item) return false;
          if (item.exerciseId === exerciseId) return true;
          if (targetName && item.exerciseName && item.exerciseName.toLowerCase().trim() === targetName) {
            return true;
          }
          return false;
        });

        if (!we || !Array.isArray(we.sets) || we.sets.length === 0) continue;

        // Check if there are any completed sets or sets with actual reps
        const validSets = we.sets
          .filter((s) => s && (
            Boolean(s.completedAt) ||
            Boolean((s as any).completed) ||
            (s.actualReps !== null && s.actualReps !== undefined && s.actualReps > 0)
          ))
          .sort((a, b) => a.setNumber - b.setNumber);

        if (validSets.length > 0) {
          let maxWeight = 0;
          let totalVolume = 0;
          const setSummaries = validSets.map((s) => {
            const wVal = Number(s.weight) || 0;
            if (wVal > maxWeight) maxWeight = wVal;
            totalVolume += wVal * (s.actualReps || 0);
            return {
              setNumber: s.setNumber,
              weight: wVal,
              actualReps: s.actualReps !== null && s.actualReps !== undefined ? Number(s.actualReps) : 0,
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
      let workouts = this.getWorkouts(userId);
      if (!Array.isArray(workouts) || workouts.length === 0) {
        workouts = memoryStore.workouts.filter((w) => !memoryStore.deletedWorkoutIds.has(w.id));
      }
      if (!Array.isArray(workouts)) return [];
      const results: PastExercisePerformance[] = [];

      let targetEx = this.getExerciseById(exerciseId);
      if (!targetEx) {
        for (const w of workouts) {
          const matchWe = w.exercises?.find((item) => item.exerciseId === exerciseId || item.id === exerciseId);
          if (matchWe && matchWe.exerciseName && matchWe.exerciseName !== 'Вправа') {
            targetEx = {
              id: exerciseId,
              userId: null,
              name: matchWe.exerciseName,
              muscleGroup: matchWe.muscleGroup || 'full_body',
              isDefault: false,
              createdAt: '',
            };
            break;
          }
        }
      }
      const targetName = targetEx?.name?.toLowerCase().trim();

      for (const w of workouts) {
        if (!w || !Array.isArray(w.exercises)) continue;
        const we = w.exercises.find((item) => {
          if (!item) return false;
          if (item.exerciseId === exerciseId) return true;
          if (targetName && item.exerciseName && item.exerciseName.toLowerCase().trim() === targetName) {
            return true;
          }
          return false;
        });

        if (!we || !Array.isArray(we.sets)) continue;

        const validSets = we.sets
          .filter((s) => s && (
            Boolean(s.completedAt) ||
            Boolean((s as any).completed) ||
            (s.actualReps !== null && s.actualReps !== undefined && s.actualReps > 0)
          ))
          .sort((a, b) => a.setNumber - b.setNumber);

        if (validSets.length > 0) {
          let maxWeight = 0;
          let totalVolume = 0;
          const setSummaries = validSets.map((s) => {
            const wVal = Number(s.weight) || 0;
            if (wVal > maxWeight) maxWeight = wVal;
            totalVolume += wVal * (s.actualReps || 0);
            return {
              setNumber: s.setNumber,
              weight: wVal,
              actualReps: s.actualReps !== null && s.actualReps !== undefined ? Number(s.actualReps) : 0,
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
