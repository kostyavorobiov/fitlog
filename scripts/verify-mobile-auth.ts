/**
 * Workout Diary (FitLog) — Mobile Auth & Session Verification Script
 * Tests the complete lifecycle:
 * 1. Initial State (Unauthenticated)
 * 2. Login & User Retrieval
 * 3. Session Persistence (Storage check)
 * 4. App Restart & Session Restoration
 * 5. Data Access (Workouts for authenticated userId)
 * 6. Logout & Session Invalidation
 * 7. Security (No secret keys)
 */

import { AuthService } from '../mobile/src/services/authService';
import { WorkoutService } from '../mobile/src/services/workoutService';
import { MobileStorage } from '../mobile/src/lib/storage';
import { User, WorkoutPlan } from '../mobile/src/types/workout';

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

async function runVerification() {
  console.log('================================================================');
  console.log('  FitLog Mobile Auth Lifecycle & Data Sync Verification');
  console.log('================================================================\n');

  // Step 1: Ensure initial clean state
  console.log('[Step 1] Initial Unauthenticated State Check');
  await AuthService.signOut();
  const initialUser = await AuthService.getCurrentUser();
  assert(initialUser === null, 'User is initially null when signed out');

  // Step 2: Login flow
  console.log('\n[Step 2] Login Flow & User Profile Verification');
  let authListenerTriggered = false;
  let listenerReceivedUser: User | null = null;

  const unsubscribe = AuthService.onAuthStateChange((u) => {
    authListenerTriggered = true;
    listenerReceivedUser = u;
  });

  // Perform sign-in (using Admin web credentials matching kvorobiov9@gmail.com)
  const loginResult = await AuthService.loginAsDemo('admin');
  const loggedInUser = loginResult.user;

  assert(Boolean(loggedInUser), 'Login returned valid user object');
  assert(loggedInUser.id === 'cmug5e9xj0000j5d57meirzop', 'User ID matches web user ID (cmug5e9xj0000j5d57meirzop)', loggedInUser.id);
  assert(loggedInUser.email === 'kvorobiov9@gmail.com', 'Email matches web user email (kvorobiov9@gmail.com)', loggedInUser.email);
  assert(loggedInUser.role === 'admin', 'User has admin role', loggedInUser.role);
  assert(authListenerTriggered, 'Auth state change listener was notified on sign-in');
  assert(listenerReceivedUser?.id === loggedInUser.id, 'Listener received matching user');

  // Step 3: Session Persistence Verification
  console.log('\n[Step 3] Session Storage Persistence');
  const storedUser = await MobileStorage.getItem<User | null>('mobile_active_user', null);
  assert(Boolean(storedUser), 'Active user is safely persisted in MobileStorage');
  assert(storedUser?.id === loggedInUser.id, 'Stored user ID matches active user ID');
  assert(storedUser?.email === loggedInUser.email, 'Stored user email matches active user email');

  // Step 4: Simulate App Close & Reopen (Session Restoration)
  console.log('\n[Step 4] App Restart Simulation & Automatic Session Restoration');
  // Reading fresh current user from storage like app startup:
  const restoredUser = await AuthService.getCurrentUser();
  assert(Boolean(restoredUser), 'Session automatically restored upon app launch');
  assert(restoredUser?.id === loggedInUser.id, 'Restored user ID matches previous session');
  assert(restoredUser?.name === loggedInUser.name, 'Restored user profile data is fully preserved');

  // Step 5: Data Association (Workouts for this authenticated User)
  console.log('\n[Step 5] Workouts Retrieval for Authenticated User');
  const userWorkoutsBefore = await WorkoutService.getWorkouts(restoredUser!.id);
  assert(Array.isArray(userWorkoutsBefore), 'Workouts queried successfully for authenticated userId');

  // Create a workout plan for this authenticated user
  const now = new Date();
  const testWorkout: WorkoutPlan = {
    id: `m_auth_wo_${Date.now()}`,
    userId: restoredUser!.id,
    title: `Авторизоване тренування (${restoredUser!.name})`,
    scheduledDate: now.toISOString().split('T')[0],
    status: 'planned',
    notes: 'Створено в авторизованій сесії мобільного застосунку',
    createdAt: now.toISOString(),
    exercises: [
      {
        id: `m_we_auth_1`,
        workoutPlanId: `m_auth_wo_${Date.now()}`,
        exerciseId: 'def_ex_1',
        exerciseName: 'Жим штанги лежачи',
        muscleGroup: 'chest',
        order: 1,
        setCount: 1,
        targetRepsRange: '8-12',
        sets: [
          {
            id: `m_ws_auth_1`,
            workoutExerciseId: `m_we_auth_1`,
            setNumber: 1,
            targetRepsRange: '8-12',
            weight: 80,
            actualReps: 10,
            isWarmup: false,
          },
        ],
      },
    ],
  };

  const saveOk = await WorkoutService.saveWorkout(testWorkout);
  assert(saveOk === true, 'Successfully saved workout for authenticated user');

  const userWorkoutsAfter = await WorkoutService.getWorkouts(restoredUser!.id);
  const foundSaved = userWorkoutsAfter.find((w) => w.id === testWorkout.id);
  assert(Boolean(foundSaved), 'Newly created workout is retrieved for this exact userId');
  assert(foundSaved?.userId === restoredUser!.id, 'Retrieved workout has matching userId');

  // Step 6: Logout Flow Verification
  console.log('\n[Step 6] Logout & Storage Cleanup');
  let logoutListenerTriggered = false;
  AuthService.onAuthStateChange((u) => {
    if (u === null) logoutListenerTriggered = true;
  });

  await AuthService.signOut();
  const postLogoutUser = await AuthService.getCurrentUser();
  assert(postLogoutUser === null, 'getCurrentUser() returns null after logout');

  const postLogoutStorage = await MobileStorage.getItem<User | null>('mobile_active_user', null);
  assert(postLogoutStorage === null, 'Session removed from MobileStorage after logout');
  assert(logoutListenerTriggered, 'Auth listener notified of logout (null user)');

  // Step 7: Re-open App after Logout
  console.log('\n[Step 7] Re-opening App after Logout');
  const freshLaunchUser = await AuthService.getCurrentUser();
  assert(freshLaunchUser === null, 'Subsequent app launch correctly defaults to unauthenticated state');

  // Step 8: Security Verification
  console.log('\n[Step 8] Mobile Bundle Security Verification');
  const envExample = await import('fs').then((fs) =>
    fs.readFileSync('./mobile/.env.example', 'utf-8')
  );
  assert(!envExample.includes('SERVICE_ROLE_KEY'), 'mobile/.env.example does NOT configure SERVICE_ROLE_KEY');
  assert(!envExample.includes('EXPO_PUBLIC_SERVICE_ROLE'), 'mobile/.env.example does NOT configure EXPO_PUBLIC_SERVICE_ROLE');
  assert(!envExample.includes('SUPABASE_SECRET'), 'mobile/.env.example does NOT contain secret keys');


  unsubscribe();

  console.log('\n================================================================');
  console.log(`  Results: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
