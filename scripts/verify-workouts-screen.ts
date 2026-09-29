/**
 * Verification Script: Mobile Workouts Screen & Data Lifecycle
 * Tests:
 * 1. User Isolation & Auth Gating (Unauthenticated access returns empty/null)
 * 2. Real User Workout Creation
 * 3. Workouts Retrieval & Status Filtering (all, in_progress, completed)
 * 4. Workout Opening & Detail Fetch (getWorkoutById)
 * 5. Workout Status Update (Toggle Planned -> Completed)
 * 6. Workout Deletion & List Update
 * 7. Persistence Verification across Simulated App Restart
 */

import { AuthService } from '../mobile/src/services/authService';
import { WorkoutService } from '../mobile/src/services/workoutService';
import { MobileStorage } from '../mobile/src/lib/storage';
import { WorkoutPlan } from '../mobile/src/types/workout';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error('     Details:', details);
    failCount++;
  }
}

async function runWorkoutsVerification() {
  console.log('================================================================');
  console.log('  FitLog Workouts Screen & Navigation Lifecycle Verification');
  console.log('================================================================\n');

  // 1. Data Isolation Test: Empty/invalid userId cannot access data
  console.log('[Test 1] User Isolation & Security');
  const emptyUserWorkouts = await WorkoutService.getWorkouts('');
  assert(emptyUserWorkouts.length === 0, 'Unauthenticated/empty user ID returns empty workouts list');

  // 2. Authenticated user setup
  console.log('\n[Test 2] Authenticated User Session');
  const loginRes = await AuthService.loginAsDemo('admin');
  const user = loginRes.user;
  assert(Boolean(user && user.id), `Active user logged in with ID: ${user.id}`);

  // Clean test baseline
  const initialWorkouts = await WorkoutService.getWorkouts(user.id);
  assert(Array.isArray(initialWorkouts), 'Workouts query returns array for authenticated user');

  // 3. Create Real Workout
  console.log('\n[Test 3] Create Real Workout');
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const testWorkoutId = `wo_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const createdWorkout: WorkoutPlan = {
    id: testWorkoutId,
    userId: user.id,
    title: 'День Спини та Біцепса',
    scheduledDate: dateStr,
    status: 'planned',
    notes: 'Перевірка реального створення тренування з мобільного',
    createdAt: now.toISOString(),
    exercises: [
      {
        id: `we_${Date.now()}_1`,
        workoutPlanId: testWorkoutId,
        exerciseId: 'def_ex_pullup',
        exerciseName: 'Підтягування на турніку',
        muscleGroup: 'back',
        order: 1,
        setCount: 3,
        targetRepsRange: '8-12',
        notes: 'Власна вага',
        sets: [
          {
            id: `ws_${Date.now()}_1`,
            workoutExerciseId: `we_${Date.now()}_1`,
            setNumber: 1,
            targetRepsRange: '8-12',
            weight: 0,
            actualReps: 10,
            completedAt: now.toISOString(),
            notes: 'Розминковий підхід',
            isWarmup: true,
          },
          {
            id: `ws_${Date.now()}_2`,
            workoutExerciseId: `we_${Date.now()}_1`,
            setNumber: 2,
            targetRepsRange: '8-12',
            weight: 15,
            actualReps: 8,
            completedAt: now.toISOString(),
            notes: 'З додатковою вагою',
            isWarmup: false,
          },
        ],
      },
    ],
  };

  const saveSuccess = await WorkoutService.saveWorkout(createdWorkout);
  assert(saveSuccess === true, 'WorkoutService.saveWorkout successfully saved new workout');

  // 4. Retrieve & List Workouts
  console.log('\n[Test 4] List Workouts for User');
  const userWorkouts = await WorkoutService.getWorkouts(user.id);
  const found = userWorkouts.find((w) => w.id === testWorkoutId);
  assert(Boolean(found), 'Created workout appears in user workouts list');
  assert(found?.title === 'День Спини та Біцепса', 'Workout title matches');
  assert(found?.scheduledDate === dateStr, 'Scheduled date matches');
  assert(found?.status === 'planned', 'Workout initial status is planned');
  assert(found?.exercises?.length === 1, 'Workout has 1 exercise');
  assert(found?.exercises[0]?.sets?.length === 2, 'Exercise contains 2 sets');

  // 5. Open Workout Details (getWorkoutById)
  console.log('\n[Test 5] Open Workout Details');
  const detail = await WorkoutService.getWorkoutById(user.id, testWorkoutId);
  assert(Boolean(detail), 'WorkoutService.getWorkoutById returns workout detail');
  assert(detail?.id === testWorkoutId, 'Detail ID matches');
  assert(detail?.exercises[0]?.exerciseName === 'Підтягування на турніку', 'Exercise name retrieved');
  assert(detail?.exercises[0]?.muscleGroup === 'back', 'Muscle group retrieved');

  // 6. Update Status (Planned -> Completed)
  console.log('\n[Test 6] Update Workout Status');
  const updatedWorkout: WorkoutPlan = {
    ...createdWorkout,
    status: 'completed',
    completedAt: new Date().toISOString(),
    durationMinutes: 45,
  };
  await WorkoutService.saveWorkout(updatedWorkout);

  const detailAfterUpdate = await WorkoutService.getWorkoutById(user.id, testWorkoutId);
  assert(detailAfterUpdate?.status === 'completed', 'Workout status updated to completed');
  assert(detailAfterUpdate?.durationMinutes === 45, 'Duration saved accurately');

  // 7. Data Persistence Simulation (Simulate app close & reopen)
  console.log('\n[Test 7] Persistence Check across App Reload');
  // Read directly from storage cache
  const cachedList = await MobileStorage.getItem<WorkoutPlan[]>(`mobile_workouts_cache_${user.id}`, []);
  const foundInStorage = cachedList.find((w) => w.id === testWorkoutId);
  assert(Boolean(foundInStorage), 'Workout persists in mobile storage cache across restarts');
  assert(foundInStorage?.status === 'completed', 'Persisted status is retained');

  // 8. Delete Workout
  console.log('\n[Test 8] Delete Workout');
  const deleteOk = await WorkoutService.deleteWorkout(user.id, testWorkoutId);
  assert(deleteOk === true, 'WorkoutService.deleteWorkout returned success');

  const afterDeleteList = await WorkoutService.getWorkouts(user.id);
  const foundAfterDelete = afterDeleteList.find((w) => w.id === testWorkoutId);
  assert(foundAfterDelete === undefined, 'Deleted workout no longer in user workouts list');

  const detailAfterDelete = await WorkoutService.getWorkoutById(user.id, testWorkoutId);
  assert(detailAfterDelete === null, 'getWorkoutById returns null after deletion');

  console.log('\n================================================================');
  console.log(`  Results: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runWorkoutsVerification().catch((e) => {
  console.error('Fatal error in verification:', e);
  process.exit(1);
});
