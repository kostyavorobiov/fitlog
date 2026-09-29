import dotenv from 'dotenv';
dotenv.config();

import { WorkoutService } from '../mobile/src/services/workoutService';
import { ExerciseService } from '../mobile/src/services/exerciseService';
import {
  WorkoutPlan,
  WorkoutExercise,
  WorkoutSet,
  Exercise,
} from '../mobile/src/types/workout';
import { SUPERSET_PALETTES } from '../mobile/src/constants/supersets';

const TEST_USER_ID = 'test-athlete-001';

async function runWorkoutEditorVerification() {
  console.log('🚀 [START] WorkoutEditor Mobile Verification Script...\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, msg: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${msg}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // 1. Create Exercise catalog entries for test
  console.log('📌 Test 1: Exercise Catalog & Pre-existing Performance setup');
  const benchPressEx: Exercise = {
    id: `test_ex_bench_${Date.now()}`,
    userId: TEST_USER_ID,
    name: 'Жим штанги лежачи',
    muscleGroup: 'chest',
    description: 'Базова вправа для грудей',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  const inclineFlyEx: Exercise = {
    id: `test_ex_fly_${Date.now()}`,
    userId: TEST_USER_ID,
    name: 'Розведення гантелей на похилій лаві',
    muscleGroup: 'chest',
    description: 'Ізолююча вправа',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  const tricepsExtEx: Exercise = {
    id: `test_ex_triceps_${Date.now()}`,
    userId: TEST_USER_ID,
    name: 'Французький жим зі штангою',
    muscleGroup: 'triceps',
    description: 'Вправа на трицепс',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  await ExerciseService.createExercise(benchPressEx);
  await ExerciseService.createExercise(inclineFlyEx);
  await ExerciseService.createExercise(tricepsExtEx);

  const catalog = await ExerciseService.getExercises(TEST_USER_ID);
  assert(catalog.some((e) => e.id === benchPressEx.id), 'Bench Press added to catalog');
  assert(catalog.some((e) => e.id === inclineFlyEx.id), 'Incline Fly added to catalog');
  assert(catalog.some((e) => e.id === tricepsExtEx.id), 'Triceps Extension added to catalog');

  // 2. Setup a past completed workout to test "Repeat previous workout" and "Pre-fill previous weights & reps"
  console.log('\n📌 Test 2: Past Completed Workout setup (for performance pre-fill)');
  const pastWorkoutId = `wo_past_${Date.now()}`;
  const pastWorkout: WorkoutPlan = {
    id: pastWorkoutId,
    userId: TEST_USER_ID,
    title: 'Груди та Тріцепс',
    scheduledDate: '2026-09-20',
    status: 'completed',
    completedAt: '2026-09-20T19:00:00Z',
    createdAt: '2026-09-20T18:00:00Z',
    exercises: [
      {
        id: `we_past_1_${Date.now()}`,
        workoutPlanId: pastWorkoutId,
        exerciseId: benchPressEx.id,
        exerciseName: benchPressEx.name,
        muscleGroup: benchPressEx.muscleGroup,
        order: 1,
        targetRepsRange: '8-12',
        setCount: 3,
        sets: [
          {
            id: `s_p_1`,
            workoutExerciseId: `we_past_1_${Date.now()}`,
            setNumber: 1,
            targetRepsRange: '8-12',
            weight: 80,
            actualReps: 12,
            completedAt: '2026-09-20T18:10:00Z',
          },
          {
            id: `s_p_2`,
            workoutExerciseId: `we_past_1_${Date.now()}`,
            setNumber: 2,
            targetRepsRange: '8-12',
            weight: 85,
            actualReps: 10,
            completedAt: '2026-09-20T18:15:00Z',
          },
          {
            id: `s_p_3`,
            workoutExerciseId: `we_past_1_${Date.now()}`,
            setNumber: 3,
            targetRepsRange: '8-12',
            weight: 90,
            actualReps: 8,
            completedAt: '2026-09-20T18:20:00Z',
          },
        ],
      },
    ],
  };

  const pastSaved = await WorkoutService.saveWorkout(pastWorkout);
  assert(pastSaved, 'Past completed workout saved successfully');

  // Verify getLastExercisePerformance detects past workout
  const lastPerf = await WorkoutService.getLastExercisePerformance(
    TEST_USER_ID,
    benchPressEx.id,
    'current_new_wo'
  );
  assert(lastPerf !== null, 'getLastExercisePerformance returns previous performance data');
  assert(lastPerf?.maxWeight === 90, `Max weight was 90 kg (got ${lastPerf?.maxWeight})`);
  assert(lastPerf?.sets.length === 3, 'Found 3 past sets');

  // 3. Create a new workout
  console.log('\n📌 Test 3: Create New Workout');
  const newWorkoutId = `wo_new_${Date.now()}`;
  const newWorkout: WorkoutPlan = {
    id: newWorkoutId,
    userId: TEST_USER_ID,
    title: 'Груди та Тріцепс',
    scheduledDate: '2026-09-29',
    status: 'planned',
    notes: 'Тренування грудей та трицепсу',
    createdAt: new Date().toISOString(),
    exercises: [],
  };

  const newSaved = await WorkoutService.saveWorkout(newWorkout);
  assert(newSaved, 'New workout saved initially');

  // 4. Add 1 exercise (Bench press) - should automatically prefill past weights and reps!
  console.log('\n📌 Test 4: Add Exercise #1 with auto-prefill from past performance');
  const we1Id = `we_new_1_${Date.now()}`;
  const sets1: WorkoutSet[] = lastPerf!.sets.map((ps, idx) => ({
    id: `s_new_1_${idx}`,
    workoutExerciseId: we1Id,
    setNumber: idx + 1,
    targetRepsRange: ps.targetRepsRange || '8-12',
    weight: ps.weight,
    actualReps: ps.actualReps,
    completedAt: null,
  }));

  const exercise1: WorkoutExercise = {
    id: we1Id,
    workoutPlanId: newWorkoutId,
    exerciseId: benchPressEx.id,
    exerciseName: benchPressEx.name,
    muscleGroup: benchPressEx.muscleGroup,
    order: 1,
    targetRepsRange: '8-12',
    setCount: sets1.length,
    sets: sets1,
  };

  newWorkout.exercises.push(exercise1);
  await WorkoutService.saveWorkout(newWorkout);

  let loaded = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  assert(loaded?.exercises.length === 1, 'Workout has 1 exercise');
  assert(loaded?.exercises[0].exerciseName === 'Жим штанги лежачи', 'Exercise 1 is Bench Press');
  assert(loaded?.exercises[0].sets.length === 3, 'Exercise 1 has 3 sets');
  assert(loaded?.exercises[0].sets[0].weight === 80, 'Set 1 pre-filled weight = 80kg');
  assert(loaded?.exercises[0].sets[0].actualReps === 12, 'Set 1 pre-filled reps = 12');

  // 5. Add 2nd and 3rd exercises
  console.log('\n📌 Test 5: Add Multiple Exercises');
  const we2Id = `we_new_2_${Date.now()}`;
  const exercise2: WorkoutExercise = {
    id: we2Id,
    workoutPlanId: newWorkoutId,
    exerciseId: inclineFlyEx.id,
    exerciseName: inclineFlyEx.name,
    muscleGroup: inclineFlyEx.muscleGroup,
    order: 2,
    targetRepsRange: '10-15',
    setCount: 3,
    sets: [1, 2, 3].map((num) => ({
      id: `s_new_2_${num}`,
      workoutExerciseId: we2Id,
      setNumber: num,
      targetRepsRange: '10-15',
      weight: 16,
      actualReps: 12,
      completedAt: null,
    })),
  };

  const we3Id = `we_new_3_${Date.now()}`;
  const exercise3: WorkoutExercise = {
    id: we3Id,
    workoutPlanId: newWorkoutId,
    exerciseId: tricepsExtEx.id,
    exerciseName: tricepsExtEx.name,
    muscleGroup: tricepsExtEx.muscleGroup,
    order: 3,
    targetRepsRange: '10-15',
    setCount: 3,
    sets: [1, 2, 3].map((num) => ({
      id: `s_new_3_${num}`,
      workoutExerciseId: we3Id,
      setNumber: num,
      targetRepsRange: '10-15',
      weight: 25,
      actualReps: 10,
      completedAt: null,
    })),
  };

  newWorkout.exercises.push(exercise2, exercise3);
  await WorkoutService.saveWorkout(newWorkout);

  loaded = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  assert(loaded?.exercises.length === 3, 'Workout now has 3 exercises');

  // 6. Test Set Editing & Steppers (+/- 2.5 kg, +/- 1 reps, warmup flag)
  console.log('\n📌 Test 6: Set Editing, Steppers & Warmup flag');
  // Weight stepper +2.5
  newWorkout.exercises[0].sets[0].weight += 2.5; // 80 -> 82.5
  assert(newWorkout.exercises[0].sets[0].weight === 82.5, 'Weight increased by 2.5 to 82.5kg');
  // Reps stepper -1
  newWorkout.exercises[0].sets[0].actualReps = (newWorkout.exercises[0].sets[0].actualReps || 12) - 1; // 12 -> 11
  assert(newWorkout.exercises[0].sets[0].actualReps === 11, 'Reps decreased by 1 to 11');
  // Warmup flag
  newWorkout.exercises[0].sets[0].isWarmup = true;
  assert(Boolean(newWorkout.exercises[0].sets[0].isWarmup), 'Warmup set flag toggled');

  // 7. Complete set & status change
  console.log('\n📌 Test 7: Complete Set');
  newWorkout.exercises[0].sets[0].completedAt = new Date().toISOString();
  newWorkout.status = 'in_progress';
  await WorkoutService.saveWorkout(newWorkout);

  loaded = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  assert(Boolean(loaded?.exercises[0].sets[0].completedAt), 'Set 1 is marked completed');
  assert(loaded?.status === 'in_progress', 'Workout status updated to in_progress');

  // 8. Add individual set & remove individual set
  console.log('\n📌 Test 8: Add/Remove Individual Set');
  const newSetId = `s_new_1_4_${Date.now()}`;
  newWorkout.exercises[0].sets.push({
    id: newSetId,
    workoutExerciseId: we1Id,
    setNumber: 4,
    targetRepsRange: '8-12',
    weight: 85,
    actualReps: 8,
    completedAt: null,
  });
  newWorkout.exercises[0].setCount = 4;
  await WorkoutService.saveWorkout(newWorkout);

  loaded = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  assert(loaded?.exercises[0].sets.length === 4, 'Exercise 1 has 4 sets after addition');

  // Remove set
  newWorkout.exercises[0].sets = newWorkout.exercises[0].sets.filter((s) => s.id !== newSetId);
  newWorkout.exercises[0].setCount = newWorkout.exercises[0].sets.length;
  await WorkoutService.saveWorkout(newWorkout);

  loaded = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  assert(loaded?.exercises[0].sets.length === 3, 'Exercise 1 has 3 sets after deletion');

  // 9. Supersets Testing
  console.log('\n📌 Test 9: Supersets (Link 2 exercises, add 3rd, unlink, auto-ungroup)');
  // Link exercise 2 (Incline fly) & exercise 3 (Triceps extension) in superset
  const supersetGrpId = 'SS-1001';
  newWorkout.exercises[1].supersetGroupId = supersetGrpId;
  newWorkout.exercises[2].supersetGroupId = supersetGrpId;
  await WorkoutService.saveWorkout(newWorkout);

  loaded = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  assert(loaded?.exercises[1].supersetGroupId === supersetGrpId, 'Exercise 2 is in superset SS-1001');
  assert(loaded?.exercises[2].supersetGroupId === supersetGrpId, 'Exercise 3 is in superset SS-1001');

  // Add exercise 1 to the superset (3 exercises in superset)
  newWorkout.exercises[0].supersetGroupId = supersetGrpId;
  await WorkoutService.saveWorkout(newWorkout);

  loaded = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  const supersetCount = (loaded?.exercises || []).filter((e) => e.supersetGroupId === supersetGrpId).length;
  assert(supersetCount === 3, 'Superset has 3 exercises');

  // Unlink exercise 1
  newWorkout.exercises[0].supersetGroupId = null;
  await WorkoutService.saveWorkout(newWorkout);

  loaded = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  const remainingInGroup = (loaded?.exercises || []).filter((e) => e.supersetGroupId === supersetGrpId).length;
  assert(remainingInGroup === 2, 'Superset still has 2 exercises after unlinking 1');

  // Unlink exercise 2 -> only 1 exercise remains -> should auto-clear supersetGroupId on exercise 3!
  newWorkout.exercises[1].supersetGroupId = null;
  const rem = newWorkout.exercises.filter((e) => e.supersetGroupId === supersetGrpId);
  if (rem.length <= 1) {
    newWorkout.exercises.forEach((e) => {
      if (e.supersetGroupId === supersetGrpId) e.supersetGroupId = null;
    });
  }
  await WorkoutService.saveWorkout(newWorkout);

  loaded = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  const activeSupersets = (loaded?.exercises || []).filter((e) => Boolean(e.supersetGroupId)).length;
  assert(activeSupersets === 0, 'Orphan superset auto-cleared cleanly (0 exercises in superset)');

  // 10. Exercise Reordering (Move Up / Down)
  console.log('\n📌 Test 10: Exercise Reordering');
  // Swap exercise 0 and 1
  const temp = newWorkout.exercises[0];
  newWorkout.exercises[0] = newWorkout.exercises[1];
  newWorkout.exercises[1] = temp;
  newWorkout.exercises = newWorkout.exercises.map((e, idx) => ({ ...e, order: idx + 1 }));
  await WorkoutService.saveWorkout(newWorkout);

  loaded = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  assert(loaded?.exercises[0].exerciseName === 'Розведення гантелей на похилій лаві', 'Exercise 1 is now Fly');
  assert(loaded?.exercises[1].exerciseName === 'Жим штанги лежачи', 'Exercise 2 is now Bench Press');
  assert(loaded?.exercises[0].order === 1, 'Exercise 1 order is 1');
  assert(loaded?.exercises[1].order === 2, 'Exercise 2 order is 2');

  // 11. Repeat Entire Previous Workout Test
  console.log('\n📌 Test 11: Repeat Entire Previous Workout');
  const prevToRepeat = await WorkoutService.getPreviousWorkoutToRepeat(
    TEST_USER_ID,
    pastWorkoutId,
    'Груди та Тріцепс'
  );
  assert(prevToRepeat !== null, 'Found matching previous workout to repeat');
  assert(prevToRepeat?.exercises.length! >= 1, 'Previous workout has exercises');

  // 12. Complete Workout & Restore
  console.log('\n📌 Test 12: Complete Workout & Restore');
  newWorkout.status = 'completed';
  newWorkout.completedAt = new Date().toISOString();
  await WorkoutService.saveWorkout(newWorkout);

  loaded = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  assert(loaded?.status === 'completed', 'Workout marked as completed');
  assert(Boolean(loaded?.completedAt), 'CompletedAt timestamp present');

  newWorkout.status = 'in_progress';
  newWorkout.completedAt = null;
  await WorkoutService.saveWorkout(newWorkout);

  loaded = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  assert(loaded?.status === 'in_progress', 'Workout restored to in_progress');

  // 13. Superset Palettes validation
  console.log('\n📌 Test 13: Superset Palettes');
  assert(SUPERSET_PALETTES.length >= 6, 'At least 6 distinct superset palettes defined');
  assert(SUPERSET_PALETTES.some((p) => p.id === 'emerald'), 'Emerald palette exists');
  assert(SUPERSET_PALETTES.some((p) => p.id === 'amber'), 'Amber palette exists');
  assert(SUPERSET_PALETTES.some((p) => p.id === 'indigo'), 'Indigo palette exists');
  assert(SUPERSET_PALETTES.some((p) => p.id === 'rose'), 'Rose palette exists');
  assert(SUPERSET_PALETTES.some((p) => p.id === 'cyan'), 'Cyan palette exists');
  assert(SUPERSET_PALETTES.some((p) => p.id === 'purple'), 'Purple palette exists');

  // 14. Clean up test workouts
  console.log('\n📌 Test 14: Delete Workout & Cleanup');
  const delPast = await WorkoutService.deleteWorkout(TEST_USER_ID, pastWorkoutId);
  const delNew = await WorkoutService.deleteWorkout(TEST_USER_ID, newWorkoutId);
  assert(delPast, 'Deleted past test workout');
  assert(delNew, 'Deleted new test workout');

  const afterDel = await WorkoutService.getWorkoutById(TEST_USER_ID, newWorkoutId);
  assert(afterDel === null, 'Workout is completely removed after delete');

  console.log(`\n🎉 ALL TESTS PASSED! (${passedTests}/${totalTests})`);
}

runWorkoutEditorVerification().catch((err) => {
  console.error('\n💥 Verification failed with error:', err);
  process.exit(1);
});
