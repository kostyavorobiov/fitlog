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
      const existing = users[index];
      users[index] = {
        ...existing,
        ...user,
        traineeIds: user.traineeIds !== undefined ? user.traineeIds : existing.traineeIds,
        coachId: user.coachId !== undefined ? user.coachId : existing.coachId,
      };
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  static getUserById(id: string): User | undefined {
    return this.getUsers().find((u) => u.id === id);
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
    let stored: Exercise[] = [];
    if (raw) {
      try {
        stored = JSON.parse(raw) as Exercise[];
      } catch (e) {
        console.error('Failed to parse exercises', e);
      }
    }

    // Filter out old def_ex_* default exercises
    let list = stored.filter((ex) => !ex.id.startsWith('def_ex_'));
    let changed = list.length !== stored.length;

    // Idempotently seed DEFAULT_EXERCISES
    const nameMap = new Map<string, Exercise>();
    list.forEach((ex) => {
      nameMap.set(ex.name.toLowerCase().trim(), ex);
    });

    DEFAULT_EXERCISES.forEach((def, idx) => {
      const cleanName = def.name.toLowerCase().trim();
      const existing = nameMap.get(cleanName);
      if (existing) {
        // Ensure it's marked global and has the updated muscle group
        if (!existing.isDefault || existing.muscleGroup !== def.muscleGroup) {
          existing.isDefault = true;
          existing.muscleGroup = def.muscleGroup;
          changed = true;
        }
      } else {
        const newGlobal: Exercise = {
          id: `global_ex_${idx + 1}`,
          name: def.name,
          muscleGroup: def.muscleGroup,
          description: '',
          isDefault: true,
          userId: null,
          createdAt: new Date().toISOString(),
        };
        list.push(newGlobal);
        nameMap.set(cleanName, newGlobal);
        changed = true;
      }
    });

    if (changed || !raw) {
      localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(list));
    }
    return list;
  }

  static async syncExercises(): Promise<Exercise[]> {
    try {
      const cloudExercises = await CloudStorageService.fetchExercises();
      if (cloudExercises && cloudExercises.length > 0) {
        const all = this.initializeExercises();
        const mapEx = new Map<string, Exercise>();
        all.forEach((e) => mapEx.set(e.id, e));
        cloudExercises.forEach((ce) => {
          if (!ce.id.startsWith('def_ex_')) {
            const existing = mapEx.get(ce.id);
            mapEx.set(ce.id, {
              ...existing,
              ...ce,
            });
          }
        });
        const merged = Array.from(mapEx.values());
        localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn('syncExercises error:', err);
    }
    return this.initializeExercises();
  }

  static getWorkoutsForUserAndCoach(userId?: string | null, otherUserId?: string | null): WorkoutPlan[] {
    const raw = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
    if (!raw) return [];
    try {
      const all = JSON.parse(raw) as WorkoutPlan[];
      return all.filter((w) => {
        if (userId && (w.userId === userId || w.assignedByCoachId === userId)) return true;
        if (otherUserId && (w.userId === otherUserId || w.assignedByCoachId === otherUserId)) return true;
        return false;
      });
    } catch {
      return [];
    }
  }

  static getExercises(targetUserId: string | null): Exercise[] {
    const all = this.initializeExercises();

    const activeUserId = this.getActiveUserId();
    const users = this.getUsers();

    const activeUser = users.find((u) => u.id === activeUserId);
    const targetUser = users.find((u) => u.id === targetUserId);

    // Admins see all exercises
    if (activeUser?.role === 'admin' || targetUser?.role === 'admin') {
      return all;
    }

    // Collect all exercise IDs used in workouts accessible to activeUser or targetUser
    const relevantWorkouts = this.getWorkoutsForUserAndCoach(targetUserId, activeUserId);
    const usedExerciseIds = new Set<string>();
    relevantWorkouts.forEach((w) => {
      (w.exercises || []).forEach((we) => {
        if (we.exerciseId) usedExerciseIds.add(we.exerciseId);
      });
    });

    return all.filter((ex) => {
      // 1. Global / default exercises are visible to all
      if (ex.isDefault || ex.userId === null || ex.id.startsWith('global_ex') || ex.id.startsWith('def_ex')) return true;

      // 2. Creator sees their own exercises (by ID or profileCode)
      if (
        (activeUserId && ex.userId === activeUserId) ||
        (targetUserId && ex.userId === targetUserId) ||
        (activeUser?.profileCode && ex.userId === activeUser.profileCode) ||
        (targetUser?.profileCode && ex.userId === targetUser.profileCode)
      ) {
        return true;
      }

      // 3. Trainee sees coach's custom exercises & Coach sees trainee's custom exercises
      if (
        (activeUser?.coachId && ex.userId === activeUser.coachId) ||
        (targetUser?.coachId && ex.userId === targetUser.coachId) ||
        (activeUser?.traineeIds && ex.userId && activeUser.traineeIds.includes(ex.userId)) ||
        (targetUser?.traineeIds && ex.userId && targetUser.traineeIds.includes(ex.userId))
      ) {
        return true;
      }

      // 4. Custom exercises created locally without userId are visible to current user
      if (ex.id.startsWith('custom_ex') && !ex.userId) return true;

      // 5. User sees custom exercise created by coach or trainee IF formed into a workout!
      if (usedExerciseIds.has(ex.id)) return true;

      return false;
    });
  }

  static getExerciseById(id: string): Exercise | undefined {
    if (!id) return undefined;
    const all = this.initializeExercises();
    const found = all.find((ex) => ex.id === id);
    if (found) return found;

    // Check by def_ex numeric suffix or raw index (e.g. def_ex_1 or 1)
    const numMatch = id.match(/^(?:def_ex_)?(\d+)$/);
    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (all[idx]) return all[idx];
    }

    // Check by case-insensitive name match
    const byName = all.find((ex) => ex.name.toLowerCase() === id.toLowerCase());
    if (byName) return byName;

    // Fallback: search stored workouts for an embedded exerciseName and muscleGroup
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
      if (raw) {
        const workouts = JSON.parse(raw) as WorkoutPlan[];
        for (const w of workouts) {
          const matchWe = w.exercises?.find((we) => we.exerciseId === id || we.id === id);
          if (matchWe && matchWe.exerciseName) {
            const reconstructed: Exercise = {
              id,
              userId: null,
              name: matchWe.exerciseName,
              muscleGroup: matchWe.muscleGroup || 'full_body',
              createdAt: '2026-01-01T00:00:00.000Z',
            };
            this.saveExercise(reconstructed);
            return reconstructed;
          }
        }
      }
    } catch {}

    return undefined;
  }

  static saveExercise(exercise: Exercise): void {
    const all = this.initializeExercises();
    const idx = all.findIndex((e) => e.id === exercise.id);
    if (idx >= 0) {
      all[idx] = exercise;
    } else {
      all.push(exercise);
    }
    localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(all));
  }

  static createExercise(exerciseData: Omit<Exercise, 'id' | 'createdAt'>): Exercise {
    const all = this.initializeExercises();
    const newExercise: Exercise = {
      ...exerciseData,
      id: generateId('custom_ex'),
      isDefault: false,
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
    CloudStorageService.saveExercise(newExercise).catch((e) =>
      console.warn('CloudStorageService.saveExercise global exercise error:', e)
    );
    return newExercise;
  }

  static updateExercise(exercise: Exercise): void {
    const all = this.initializeExercises();
    const idx = all.findIndex((e) => e.id === exercise.id);
    if (idx >= 0) {
      all[idx] = exercise;
      localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(all));

      // Also update embedded exerciseName and muscleGroup in existing workouts
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
        if (raw) {
          const workouts = JSON.parse(raw) as WorkoutPlan[];
          let updatedAny = false;
          workouts.forEach((w) => {
            (w.exercises || []).forEach((we) => {
              if (we.exerciseId === exercise.id) {
                we.exerciseName = exercise.name;
                we.muscleGroup = exercise.muscleGroup;
                updatedAny = true;
              }
            });
          });
          if (updatedAny) {
            localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
          }
        }
      } catch (e) {
        console.warn('Failed to update embedded exercise names in workouts:', e);
      }

      CloudStorageService.saveExercise(exercise).catch((e) =>
        console.warn('CloudStorageService.saveExercise update error:', e)
      );
    }
  }

  static deleteExercise(exerciseId: string): void {
    const all = this.initializeExercises();
    const filtered = all.filter((e) => e.id !== exerciseId);
    localStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(filtered));
    CloudStorageService.deleteExercise(exerciseId).catch((e) =>
      console.warn('CloudStorageService.deleteExercise error:', e)
    );
  }

  // --- COACH & TRAINEES RELATIONSHIPS ---
  static getRemovedTraineeIds(coachUserId: string): string[] {
    const raw = localStorage.getItem(`fitlog_removed_trainees_${coachUserId}`);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static setRemovedTraineeIds(coachUserId: string, ids: string[]): void {
    localStorage.setItem(`fitlog_removed_trainees_${coachUserId}`, JSON.stringify(ids));
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

    // 1. Search locally in localStorage
    let trainee = users.find(
      (u) =>
        u.profileCode?.toUpperCase() === upperInput ||
        u.profileCode?.toUpperCase() === strippedUpper ||
        u.id.toUpperCase() === upperInput ||
        u.id.toUpperCase() === strippedUpper ||
        u.email.toLowerCase() === cleanInput.toLowerCase() ||
        (u.id && u.id.replace(/[-_]/g, '').toUpperCase().startsWith(strippedUpper))
    );

    // 2. If not found locally, query Supabase profiles
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

    // Update coach locally
    coach.traineeIds = [...currentTrainees, trainee.id];
    this.saveUser(coach);

    // Update trainee with coachId locally
    trainee.coachId = coach.id;
    this.saveUser(trainee);

    // Update in Supabase
    CloudStorageService.assignTrainee(coach.id, trainee.id).catch((err) =>
      console.warn('Background assignTrainee error:', err)
    );

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
    CloudStorageService.updateProfile(athlete.id, { coachId: coach.id }).catch((err) =>
      console.warn('Background update athlete coach error:', err)
    );

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

    // 2. Remove from coach locally
    const users = this.getUsers();
    const coach = users.find((u) => u.id === coachUserId);
    if (coach && coach.traineeIds) {
      coach.traineeIds = coach.traineeIds.filter((id) => id !== traineeId);
      this.saveUser(coach);
    }

    // 3. Clear coachId on trainee locally
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
    // 1. Clear coachId locally on athlete
    const users = this.getUsers();
    const athlete = users.find((u) => u.id === athleteId);
    if (athlete) {
      athlete.coachId = null;
      this.saveUser(athlete);
    }

    // 2. Remove athlete from coach's traineeIds locally
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

      let modifiedAny = false;

      currentWorkout.exercises.forEach((currentEx) => {
        if (!currentEx || !Array.isArray(currentEx.sets) || currentEx.sets.length === 0) return;
        // Find latest completed or target set values from currentWorkout
        const lastSet = currentEx.sets[currentEx.sets.length - 1];
        // Use highest completed weight or current target weight
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
            // If future exercise has no completed sets, update target reps range, set count, and preset weights
            const hasCompletedSets = matchingFutureEx.sets.some((s) => s && (s.completedAt !== null || (s.actualReps !== null && s.actualReps > 0)));
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
                  if (!s) return;
                  if (s.targetRepsRange !== targetRange) {
                    s.targetRepsRange = targetRange;
                    exerciseChanged = true;
                  }
                  const currentMatchingSet = currentEx.sets[idx] || lastSet;
                  if (currentMatchingSet && (s.weight === 0 || s.weight === 20 || s.weight !== currentMatchingSet.weight)) {
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
    } catch (err) {
      console.warn('syncFutureWorkouts error:', err);
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
   * Authoritatively updates workouts for a given user in localStorage
   * without affecting other users' workouts and without resurrecting deleted workouts.
   */
  static setWorkoutsForUser(userId: string, userWorkouts: WorkoutPlan[]): void {
    const raw = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
    let all: WorkoutPlan[] = [];
    if (raw) {
      try {
        all = JSON.parse(raw);
      } catch {
        all = [];
      }
    }
    const otherUsersWorkouts = all.filter((w) => w.userId !== userId);
    const localUserWorkouts = all.filter((w) => w.userId === userId);
    const localMap = new Map<string, WorkoutPlan>();
    localUserWorkouts.forEach((w) => localMap.set(w.id, w));

    // Merge cloud workouts with local workouts to ensure exercises added locally are never wiped out
    const mergedUserWorkouts = (userWorkouts || []).map((cw) => {
      const local = localMap.get(cw.id);
      if (!local) return cw;

      const localExercises = Array.isArray(local.exercises) ? local.exercises : [];
      const cloudExercises = Array.isArray(cw.exercises) ? cw.exercises : [];

      if (localExercises.length > 0) {
        if (cloudExercises.length === 0) {
          return {
            ...cw,
            exercises: localExercises,
          };
        }

        // If local has exercises not present in cloud (e.g. newly added exercises), preserve them!
        const cloudExIds = new Set(cloudExercises.map((e) => e.id));
        const missingLocal = localExercises.filter((le) => !cloudExIds.has(le.id));
        if (missingLocal.length > 0) {
          return {
            ...cw,
            exercises: [...cloudExercises, ...missingLocal],
          };
        }
      }
      return cw;
    });

    // Also preserve any newly created local workouts that haven't hit the cloud yet
    const cloudIds = new Set((userWorkouts || []).map((w) => w.id));
    localUserWorkouts.forEach((lw) => {
      if (!cloudIds.has(lw.id)) {
        mergedUserWorkouts.push(lw);
      }
    });

    const updated = [...otherUsersWorkouts, ...mergedUserWorkouts];
    localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(updated));
  }

  /**
   * Synchronize local state with Supabase cloud database
   */
  static async syncWithCloud(userId: string): Promise<void> {
    try {
      // Ensure default exercises exist in Supabase
      CloudStorageService.ensureDefaultExercises().catch((e) =>
        console.warn('ensureDefaultExercises error:', e)
      );

      const cloudWorkouts = await CloudStorageService.fetchWorkouts(userId);
      if (cloudWorkouts !== null) {
        this.setWorkoutsForUser(userId, cloudWorkouts);
      }

      await this.syncExercises();
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
