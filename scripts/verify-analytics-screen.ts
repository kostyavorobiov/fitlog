import dotenv from 'dotenv';
dotenv.config();

import { WorkoutPlan, MuscleGroup } from '../mobile/src/types/workout';
import { getPeriodRange } from '../mobile/src/utils/date';
import { calculateAnalytics } from '../mobile/src/utils/analytics';
import { WorkoutService } from '../mobile/src/services/workoutService';

async function runAnalyticsVerification() {
  console.log('🚀 [START] FitLog Mobile Analytics Verification Script...\n');

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

  // -------------------------------------------------------------
  // Test 1: Calendar Period Boundaries (Not rolling, strictly calendar)
  // -------------------------------------------------------------
  console.log('📌 Test 1: Calendar-Aligned Period Ranges (Day / Week / Month)');
  
  // Day: 2026-09-29
  const tuesday = new Date(2026, 8, 29); // Sept 29, 2026 (Tuesday)
  const dayRange = getPeriodRange('day', tuesday);
  assert(dayRange.startDateStr === '2026-09-29', 'Day range starts on 2026-09-29');
  assert(dayRange.endDateStr === '2026-09-29', 'Day range ends on 2026-09-29');
  assert(dayRange.type === 'day', 'Range type is day');

  // Week: should start on Monday (2026-09-28) and end on Sunday (2026-10-04)
  const weekRange = getPeriodRange('week', tuesday);
  assert(weekRange.startDateStr === '2026-09-28', 'Week starts on Monday 2026-09-28');
  assert(weekRange.endDateStr === '2026-10-04', 'Week ends on Sunday 2026-10-04');
  assert(weekRange.titleUk.includes('28') && weekRange.titleUk.includes('4'), `Week title includes boundary dates (got "${weekRange.titleUk}")`);

  // Week boundary test: Sunday (2026-10-04)
  const sunday = new Date(2026, 9, 4); // Oct 4, 2026 (Sunday)
  const weekRangeFromSunday = getPeriodRange('week', sunday);
  assert(weekRangeFromSunday.startDateStr === '2026-09-28', 'Sunday belongs to week starting Monday 2026-09-28');
  assert(weekRangeFromSunday.endDateStr === '2026-10-04', 'Sunday week ends on 2026-10-04');

  // Month: September 2026 (30 days)
  const monthRangeSep = getPeriodRange('month', tuesday);
  assert(monthRangeSep.startDateStr === '2026-09-01', 'September starts on 2026-09-01');
  assert(monthRangeSep.endDateStr === '2026-09-30', 'September ends on 2026-09-30');
  assert(monthRangeSep.titleUk.includes('Вересень') && monthRangeSep.titleUk.includes('2026'), 'Month title is "Вересень 2026"');

  // Month leap year boundary: February 2024 (29 days)
  const febLeap = new Date(2024, 1, 15);
  const monthRangeFebLeap = getPeriodRange('month', febLeap);
  assert(monthRangeFebLeap.startDateStr === '2024-02-01', 'Feb leap year starts 2024-02-01');
  assert(monthRangeFebLeap.endDateStr === '2024-02-29', 'Feb leap year ends 2024-02-29');

  // -------------------------------------------------------------
  // Test 2: Incomplete vs Completed Sets Filtering
  // completedAt != null -> counted; completedAt == null -> ignored
  // -------------------------------------------------------------
  console.log('\n📌 Test 2: Completed Sets Only (completedAt != null)');

  const mockWorkoutsForSetsTest: WorkoutPlan[] = [
    {
      id: 'w-sets-01',
      userId: 'user-sets',
      assignedByCoachId: null,
      title: 'Спина та біцепс',
      scheduledDate: '2026-09-29',
      status: 'in_progress',
      completedAt: null,
      createdAt: '2026-09-29T10:00:00Z',
      exercises: [
        {
          id: 'we-1',
          workoutPlanId: 'w-sets-01',
          exerciseId: 'ex-pullup',
          exerciseName: 'Підтягування',
          muscleGroup: 'back',
          order: 1,
          sets: [
            // 2 completed sets
            {
              id: 's-1',
              workoutExerciseId: 'we-1',
              setNumber: 1,
              targetRepsRange: '8-12',
              weight: 0,
              actualReps: 10,
              completedAt: '2026-09-29T10:15:00Z', // Completed!
            },
            {
              id: 's-2',
              workoutExerciseId: 'we-1',
              setNumber: 2,
              targetRepsRange: '8-12',
              weight: 10,
              actualReps: 8,
              completedAt: '2026-09-29T10:20:00Z', // Completed!
            },
            // 2 incomplete sets (planned)
            {
              id: 's-3',
              workoutExerciseId: 'we-1',
              setNumber: 3,
              targetRepsRange: '8-12',
              weight: 10,
              actualReps: null,
              completedAt: null, // Incomplete! Must be ignored
            },
            {
              id: 's-4',
              workoutExerciseId: 'we-1',
              setNumber: 4,
              targetRepsRange: '8-12',
              weight: 10,
              actualReps: null,
              completedAt: undefined as any, // Incomplete! Must be ignored
            },
          ],
        },
      ],
    },
  ];

  const setsResult = calculateAnalytics(mockWorkoutsForSetsTest, dayRange);
  assert(setsResult.periodCompletedSets === 2, `Counted exactly 2 completed sets (got ${setsResult.periodCompletedSets})`);
  assert(setsResult.workoutsCount === 1, 'Workout with completed sets is counted in workoutsCount');
  assert(setsResult.muscleList.length === 1 && setsResult.muscleList[0].groupKey === 'back', 'Muscle is Back');
  assert(setsResult.muscleList[0].setsCount === 2, 'Back has 2 completed sets');
  assert(setsResult.muscleList[0].percentage === 100, 'Back is 100% of sets');

  // -------------------------------------------------------------
  // Test 3: Grouping by Muscle Groups & Percentage Calculation
  // -------------------------------------------------------------
  console.log('\n📌 Test 3: Muscle Group Grouping and Percentages');

  const mockMultiMuscleWorkouts: WorkoutPlan[] = [
    {
      id: 'w-muscle-01',
      userId: 'user-muscle',
      assignedByCoachId: null,
      title: 'Full Body Тренування',
      scheduledDate: '2026-09-29',
      status: 'completed',
      completedAt: '2026-09-29T12:00:00Z',
      createdAt: '2026-09-29T10:00:00Z',
      exercises: [
        // 4 completed sets for Chest
        {
          id: 'we-chest',
          workoutPlanId: 'w-muscle-01',
          exerciseId: 'ex-bench',
          exerciseName: 'Жим лежачи',
          muscleGroup: 'chest',
          order: 1,
          sets: [1, 2, 3, 4].map((n) => ({
            id: `s-chest-${n}`,
            workoutExerciseId: 'we-chest',
            setNumber: n,
            targetRepsRange: '8-10',
            weight: 80,
            actualReps: 8,
            completedAt: '2026-09-29T10:30:00Z',
          })),
        },
        // 3 completed sets for Back
        {
          id: 'we-back',
          workoutPlanId: 'w-muscle-01',
          exerciseId: 'ex-row',
          exerciseName: 'Тяга штанги в нахилі',
          muscleGroup: 'back',
          order: 2,
          sets: [1, 2, 3].map((n) => ({
            id: `s-back-${n}`,
            workoutExerciseId: 'we-back',
            setNumber: n,
            targetRepsRange: '8-10',
            weight: 70,
            actualReps: 10,
            completedAt: '2026-09-29T10:50:00Z',
          })),
        },
        // 3 completed sets for Legs
        {
          id: 'we-legs',
          workoutPlanId: 'w-muscle-01',
          exerciseId: 'ex-squat',
          exerciseName: 'Присідання',
          muscleGroup: 'legs',
          order: 3,
          sets: [1, 2, 3].map((n) => ({
            id: `s-legs-${n}`,
            workoutExerciseId: 'we-legs',
            setNumber: n,
            targetRepsRange: '6-8',
            weight: 100,
            actualReps: 6,
            completedAt: '2026-09-29T11:15:00Z',
          })),
        },
      ],
    },
  ];

  const multiMuscleResult = calculateAnalytics(mockMultiMuscleWorkouts, dayRange);
  assert(multiMuscleResult.periodCompletedSets === 10, 'Total completed sets = 10 (4 chest + 3 back + 3 legs)');
  assert(multiMuscleResult.muscleList.length === 3, 'Exactly 3 muscle groups active');
  
  // Sorted descending: Chest (4 sets), then Back (3 sets), Legs (3 sets)
  assert(multiMuscleResult.muscleList[0].groupKey === 'chest', 'First group is chest (4 sets)');
  assert(multiMuscleResult.muscleList[0].setsCount === 4, 'Chest has 4 sets');
  assert(multiMuscleResult.muscleList[0].percentage === 40, 'Chest is 40% (4/10)');

  const backStat = multiMuscleResult.muscleList.find((m) => m.groupKey === 'back');
  const legsStat = multiMuscleResult.muscleList.find((m) => m.groupKey === 'legs');
  assert(backStat?.setsCount === 3 && backStat?.percentage === 30, 'Back has 3 sets (30%)');
  assert(legsStat?.setsCount === 3 && legsStat?.percentage === 30, 'Legs has 3 sets (30%)');

  // -------------------------------------------------------------
  // Test 4: Exercise Aggregation Across Multiple Workouts
  // -------------------------------------------------------------
  console.log('\n📌 Test 4: Exercise Aggregation Across Multiple Workouts in Period');

  const mockWeeklyWorkouts: WorkoutPlan[] = [
    // Workout 1: Monday Sept 28
    {
      id: 'w-week-mon',
      userId: 'user-agg',
      assignedByCoachId: null,
      title: 'Жим День 1',
      scheduledDate: '2026-09-28',
      status: 'completed',
      completedAt: '2026-09-28T18:00:00Z',
      createdAt: '2026-09-28T17:00:00Z',
      exercises: [
        {
          id: 'we-mon-bench',
          workoutPlanId: 'w-week-mon',
          exerciseId: 'ex-bench-press',
          exerciseName: 'Жим штанги лежачи',
          muscleGroup: 'chest',
          order: 1,
          sets: [
            {
              id: 's-m-1',
              workoutExerciseId: 'we-mon-bench',
              setNumber: 1,
              targetRepsRange: '8-10',
              weight: 80,
              actualReps: 10,
              completedAt: '2026-09-28T17:15:00Z',
            },
            {
              id: 's-m-2',
              workoutExerciseId: 'we-mon-bench',
              setNumber: 2,
              targetRepsRange: '8-10',
              weight: 90,
              actualReps: 8,
              completedAt: '2026-09-28T17:20:00Z',
            },
          ],
        },
      ],
    },
    // Workout 2: Thursday Oct 1 (Same calendar week!)
    {
      id: 'w-week-thu',
      userId: 'user-agg',
      assignedByCoachId: null,
      title: 'Жим День 2',
      scheduledDate: '2026-10-01',
      status: 'completed',
      completedAt: '2026-10-01T18:00:00Z',
      createdAt: '2026-10-01T17:00:00Z',
      exercises: [
        {
          id: 'we-thu-bench',
          workoutPlanId: 'w-week-thu',
          exerciseId: 'ex-bench-press', // Same exerciseId!
          exerciseName: 'Жим штанги лежачи',
          muscleGroup: 'chest',
          order: 1,
          sets: [
            {
              id: 's-t-1',
              workoutExerciseId: 'we-thu-bench',
              setNumber: 1,
              targetRepsRange: '5',
              weight: 100, // New max weight!
              actualReps: 5,
              completedAt: '2026-10-01T17:15:00Z',
            },
            {
              id: 's-t-2',
              workoutExerciseId: 'we-thu-bench',
              setNumber: 2,
              targetRepsRange: '5',
              weight: 105, // Absolute PR!
              actualReps: 3,
              completedAt: '2026-10-01T17:20:00Z',
            },
          ],
        },
      ],
    },
  ];

  const weeklyResult = calculateAnalytics(mockWeeklyWorkouts, weekRange);
  assert(weeklyResult.periodCompletedSets === 4, '4 total completed sets across the week');
  assert(weeklyResult.workoutsCount === 2, '2 active workouts counted in the week');
  assert(weeklyResult.exercisesList.length === 1, 'Exercise correctly aggregated into 1 single row (no duplicates)');
  
  const benchAgg = weeklyResult.exercisesList[0];
  assert(benchAgg.completedSetsCount === 4, 'Bench press has 4 aggregated completed sets');
  assert(benchAgg.maxWeight === 105, `Max weight across week is 105 kg (got ${benchAgg.maxWeight})`);
  assert(benchAgg.repsAtMaxWeight === 3, 'Reps at max weight is 3');
  
  // Tonnage:
  // Mon: (80*10 = 800) + (90*8 = 720) = 1520 kg
  // Thu: (100*5 = 500) + (105*3 = 315) = 815 kg
  // Total = 2335 kg = 2.3 tons
  assert(weeklyResult.periodVolumeKg === 2335, `Total weekly volume is 2335 kg (got ${weeklyResult.periodVolumeKg})`);
  assert(weeklyResult.periodTons === 2.3, `Tonnage formatted to 2.3 tons (got ${weeklyResult.periodTons})`);

  // -------------------------------------------------------------
  // Test 5: Period Boundary Filtering (Day vs Week vs Month)
  // -------------------------------------------------------------
  console.log('\n📌 Test 5: Period Boundary Filtering');

  // In Day mode (Sept 29), neither Monday (Sept 28) nor Thursday (Oct 1) should be included!
  const dayFilteredResult = calculateAnalytics(mockWeeklyWorkouts, dayRange);
  assert(dayFilteredResult.periodCompletedSets === 0, 'Sept 29 Day mode has 0 completed sets from other days');
  assert(dayFilteredResult.workoutsCount === 0, 'Workouts count is 0 for Day mode');
  assert(dayFilteredResult.muscleList.length === 0, 'Muscle list is empty');
  assert(dayFilteredResult.exercisesList.length === 0, 'Exercises list is empty');

  // In Month mode (September 2026), Monday Sept 28 IS included, but Thursday Oct 1 is in October so EXCLUDED!
  const monthFilteredResult = calculateAnalytics(mockWeeklyWorkouts, monthRangeSep);
  assert(monthFilteredResult.periodCompletedSets === 2, 'September month mode includes only Monday Sept 28 (2 sets)');
  assert(monthFilteredResult.periodVolumeKg === 1520, 'Volume for September only includes Sept 28 (1520 kg)');

  // -------------------------------------------------------------
  // Test 6: Trainer / Trainee Context & Data Isolation
  // -------------------------------------------------------------
  console.log('\n📌 Test 6: Trainer / Trainee User Isolation');

  const TRAINEE_1_ID = 'test-trainee-001';
  const TRAINEE_2_ID = 'test-trainee-002';

  // Save workout for trainee 1
  const t1Workout = await WorkoutService.saveWorkout({
    userId: TRAINEE_1_ID,
    assignedByCoachId: 'coach-999',
    title: 'Тренування Trainee 1',
    scheduledDate: '2026-09-29',
    status: 'completed',
    notes: 'Athlete 1 training',
    exercises: [
      {
        id: 'we-t1',
        workoutPlanId: '',
        exerciseId: 'ex-press',
        exerciseName: 'Жим гантелей',
        muscleGroup: 'shoulders',
        order: 1,
        sets: [
          {
            id: 's-t1-1',
            workoutExerciseId: 'we-t1',
            setNumber: 1,
            targetRepsRange: '10',
            weight: 24,
            actualReps: 10,
            completedAt: '2026-09-29T15:00:00Z',
          },
        ],
      },
    ],
  });

  // Save workout for trainee 2
  const t2Workout = await WorkoutService.saveWorkout({
    userId: TRAINEE_2_ID,
    assignedByCoachId: 'coach-999',
    title: 'Тренування Trainee 2',
    scheduledDate: '2026-09-29',
    status: 'completed',
    notes: 'Athlete 2 training',
    exercises: [
      {
        id: 'we-t2',
        workoutPlanId: '',
        exerciseId: 'ex-bicep-curl',
        exerciseName: 'Згинання на біцепс',
        muscleGroup: 'biceps',
        order: 1,
        sets: [
          {
            id: 's-t2-1',
            workoutExerciseId: 'we-t2',
            setNumber: 1,
            targetRepsRange: '12',
            weight: 14,
            actualReps: 12,
            completedAt: '2026-09-29T16:00:00Z',
          },
        ],
      },
    ],
  });

  // Fetch trainee 1 workouts
  const trainee1Workouts = await WorkoutService.getWorkouts(TRAINEE_1_ID);
  const trainee1Analytics = calculateAnalytics(trainee1Workouts, dayRange);
  assert(trainee1Analytics.periodCompletedSets >= 1, 'Trainee 1 has completed sets');
  assert(trainee1Analytics.muscleList.some((m) => m.groupKey === 'shoulders'), 'Trainee 1 trained shoulders');
  assert(!trainee1Analytics.muscleList.some((m) => m.groupKey === 'biceps'), 'Trainee 1 data does NOT contain Trainee 2 biceps workout');

  // Fetch trainee 2 workouts
  const trainee2Workouts = await WorkoutService.getWorkouts(TRAINEE_2_ID);
  const trainee2Analytics = calculateAnalytics(trainee2Workouts, dayRange);
  assert(trainee2Analytics.periodCompletedSets >= 1, 'Trainee 2 has completed sets');
  assert(trainee2Analytics.muscleList.some((m) => m.groupKey === 'biceps'), 'Trainee 2 trained biceps');
  assert(!trainee2Analytics.muscleList.some((m) => m.groupKey === 'shoulders'), 'Trainee 2 data does NOT contain Trainee 1 shoulders workout');

  // Cleanup test workouts
  await WorkoutService.deleteWorkout(TRAINEE_1_ID, t1Workout.id);
  await WorkoutService.deleteWorkout(TRAINEE_2_ID, t2Workout.id);

  console.log(`\n🎉 [ALL TESTS PASSED] Total assertions passed: ${passedTests}/${totalTests}`);
}

runAnalyticsVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
