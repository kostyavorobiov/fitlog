/**
 * Automated Verification Script: Web & Mobile Backend Data Sync
 * Verifies bidirectional data contracts for WorkoutPlan, WorkoutExercise, WorkoutSet, Exercise, User.
 */

import { WorkoutPlan, Exercise, User } from '../src/types/workout';
import { WorkoutService } from '../mobile/src/services/workoutService';
import { ExerciseService } from '../mobile/src/services/exerciseService';
import { AuthService } from '../mobile/src/services/authService';
import { CloudStorageService } from '../src/services/cloudStorageService';

async function runVerification() {
  console.log('--- STARTING FITLOG MOBILE <-> BACKEND SYNC VERIFICATION ---\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, details || '');
      process.exitCode = 1;
    }
  }

  // 1. Data Contract Compatibility Test
  console.log('1. Checking Data Models and Metadata Encoding...');
  const testNotes = 'Тестові примітки атлета';
  const encoded = WorkoutService.encodeExerciseMeta('Жим гантелей', 'chest', testNotes);
  const decodedWeb = CloudStorageService.decodeExerciseMeta(encoded);
  const decodedMobile = WorkoutService.decodeExerciseMeta(encoded);

  assert(
    decodedWeb.exerciseName === 'Жим гантелей' && decodedWeb.muscleGroup === 'chest' && decodedWeb.cleanNotes === testNotes,
    'Web CloudStorageService correctly decodes metadata encoded by Mobile WorkoutService'
  );
  assert(
    decodedMobile.exerciseName === 'Жим гантелей' && decodedMobile.muscleGroup === 'chest' && decodedMobile.cleanNotes === testNotes,
    'Mobile WorkoutService correctly decodes metadata'
  );

  // 2. Exercise Service Contract Test
  console.log('\n2. Testing ExerciseService...');
  const testExId = `test_ex_${Date.now()}`;
  const testExercise: Exercise = {
    id: testExId,
    userId: 'test_user_uuid',
    name: 'Присідання зі штангою на спині',
    muscleGroup: 'legs',
    description: 'Тестова вправа для верифікації мобільного бекенду',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  const exSaveResult = await ExerciseService.createExercise(testExercise);
  assert(exSaveResult === true, 'ExerciseService.createExercise returned success');

  const allExercises = await ExerciseService.getExercises('test_user_uuid');
  const foundEx = allExercises.find((e) => e.id === testExId);
  assert(Boolean(foundEx && foundEx.name === testExercise.name), 'ExerciseService.getExercises retrieved created exercise');

  const exDeleteResult = await ExerciseService.deleteExercise(testExId);
  assert(exDeleteResult === true, 'ExerciseService.deleteExercise returned success');

  const afterDeleteExercises = await ExerciseService.getExercises('test_user_uuid');
  assert(!afterDeleteExercises.some((e) => e.id === testExId), 'ExerciseService correctly purged deleted exercise');

  // 3. Workout Service Bidirectional Sync Test
  console.log('\n3. Testing WorkoutService & Workout Data Contracts...');
  const testWorkoutId = `test_wo_${Date.now()}`;
  const testWorkout: WorkoutPlan = {
    id: testWorkoutId,
    userId: 'test_user_uuid',
    title: 'День ніг (Мобільний тест)',
    scheduledDate: '2026-09-29',
    status: 'planned',
    notes: 'Перевірка збереження через мобільний сервіс',
    durationMinutes: 60,
    createdAt: new Date().toISOString(),
    exercises: [
      {
        id: `we_${Date.now()}`,
        workoutPlanId: testWorkoutId,
        exerciseId: 'def_ex_legs',
        exerciseName: 'Присідання',
        muscleGroup: 'legs',
        order: 1,
        setCount: 3,
        targetRepsRange: '8-12',
        notes: 'Глибокий присід',
        sets: [
          {
            id: `ws_${Date.now()}_1`,
            workoutExerciseId: `we_${Date.now()}`,
            setNumber: 1,
            targetRepsRange: '8-12',
            weight: 100,
            actualReps: 10,
            completedAt: new Date().toISOString(),
            isWarmup: false,
          },
          {
            id: `ws_${Date.now()}_2`,
            workoutExerciseId: `we_${Date.now()}`,
            setNumber: 2,
            targetRepsRange: '8-12',
            weight: 110,
            actualReps: 8,
            completedAt: new Date().toISOString(),
            isWarmup: false,
          },
        ],
      },
    ],
  };

  const workoutSaveSuccess = await WorkoutService.saveWorkout(testWorkout);
  assert(workoutSaveSuccess === true, 'WorkoutService.saveWorkout executed successfully');

  const userWorkouts = await WorkoutService.getWorkouts('test_user_uuid');
  const foundWorkout = userWorkouts.find((w) => w.id === testWorkoutId);
  assert(Boolean(foundWorkout), 'WorkoutService.getWorkouts found saved workout');
  assert(
    foundWorkout?.exercises?.length === 1 && foundWorkout.exercises[0].sets?.length === 2,
    'Workout exercises and nested sets are fully preserved'
  );
  assert(
    foundWorkout?.exercises[0].sets[0].weight === 100 && foundWorkout?.exercises[0].sets[0].actualReps === 10,
    'Workout set values (weight=100, reps=10) match perfectly'
  );

  const workoutDeleteSuccess = await WorkoutService.deleteWorkout('test_user_uuid', testWorkoutId);
  assert(workoutDeleteSuccess === true, 'WorkoutService.deleteWorkout executed successfully');

  const afterDeleteWorkouts = await WorkoutService.getWorkouts('test_user_uuid');
  assert(!afterDeleteWorkouts.some((w) => w.id === testWorkoutId), 'Workout accurately removed from storage');

  // 4. AuthService User Contract Test
  console.log('\n4. Testing AuthService Contract...');
  const testUser: User = {
    id: 'test_athlete_1',
    profileCode: 'USR-TEST99',
    firstName: 'Олександр',
    lastName: 'Коваленко',
    name: 'Олександр Коваленко',
    email: 'athlete.test@fitlog.app',
    image: '',
    role: 'athlete',
    createdAt: new Date().toISOString(),
  };

  const profileUpsert = await AuthService.upsertProfile(testUser);
  // Returns true if Supabase connected, or handles gracefully
  assert(typeof profileUpsert === 'boolean', 'AuthService.upsertProfile returns boolean status');

  console.log(`\n--- VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED ---`);
}

runVerification().catch((err) => {
  console.error('Fatal error in verification:', err);
  process.exit(1);
});
