import dotenv from 'dotenv';
dotenv.config();

import { WorkoutService } from '../mobile/src/services/workoutService';
import { WorkoutPlan } from '../mobile/src/types/workout';
import { formatLocalDate, formatUkFullDate } from '../mobile/src/utils/date';

const TEST_USER_ID = 'test-athlete-cal-001';

async function runCalendarVerification() {
  console.log('🚀 [START] FitLog Mobile Calendar Verification Script...\n');

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

  // 1. Timezone & Local Date Safety
  console.log('📌 Test 1: Local Date Formatting & Timezone Safety');
  const d1 = new Date(2026, 8, 29); // Month is 0-indexed: 8 is September
  assert(formatLocalDate(d1) === '2026-09-29', 'formatLocalDate handles local September date without offset');

  const d2 = new Date(2026, 0, 1, 0, 5, 0); // Jan 1st 00:05 local time
  assert(formatLocalDate(d2) === '2026-01-01', 'formatLocalDate handles midnight times without slipping into previous day');

  const d3 = new Date(2026, 11, 31, 23, 55, 0); // Dec 31st 23:55 local time
  assert(formatLocalDate(d3) === '2026-12-31', 'formatLocalDate handles late night times without slipping into next day');

  // 2. Ukrainian Date Formatting
  console.log('\n📌 Test 2: Ukrainian Date Formatting');
  const formattedUk = formatUkFullDate('2026-09-29');
  assert(formattedUk.includes('29 вересня 2026'), `Date contains "29 вересня 2026" (got "${formattedUk}")`);
  assert(formattedUk.includes('Вівторок'), `Date contains day of week "Вівторок" (got "${formattedUk}")`);

  // 3. Calendar Grid & Monday-First Calculation
  console.log('\n📌 Test 3: Calendar Grid & Day of Week Alignment (Monday first)');
  // September 2026: Sept 1st 2026 was a Tuesday (idx 1 if Mon=0)
  const sep1 = new Date(2026, 8, 1);
  const sep1StartDay = (sep1.getDay() + 6) % 7;
  assert(sep1StartDay === 1, `Sept 1st 2026 startDayOfWeek is 1 (Tuesday, Monday-first index)`);

  const daysInSep = new Date(2026, 9, 0).getDate();
  assert(daysInSep === 30, 'September 2026 has 30 days');

  // Month navigation logic
  let curY = 2026;
  let curM = 8; // September
  // Next month -> October
  const nextMonth = new Date(curY, curM + 1, 1);
  assert(nextMonth.getMonth() === 9 && nextMonth.getFullYear() === 2026, 'Next month is October 2026');
  // Prev month -> August
  const prevMonth = new Date(curY, curM - 1, 1);
  assert(prevMonth.getMonth() === 7 && prevMonth.getFullYear() === 2026, 'Prev month is August 2026');

  // Year wrap around (Dec -> Jan)
  const dec2026 = new Date(2026, 11, 1);
  const jan2027 = new Date(dec2026.getFullYear(), dec2026.getMonth() + 1, 1);
  assert(jan2027.getFullYear() === 2027 && jan2027.getMonth() === 0, 'December -> January properly advances year');

  // 4. Backend Workout Retrieval for Calendar
  console.log('\n📌 Test 4: Creating and indexing multiple workouts on calendar dates');
  const targetDate1 = '2026-09-29';
  const targetDate2 = '2026-09-30';

  const wo1: WorkoutPlan = {
    id: `wo_cal_1_${Date.now()}`,
    userId: TEST_USER_ID,
    title: 'Груди та Тріцепс',
    scheduledDate: targetDate1,
    status: 'completed',
    completedAt: '2026-09-29T18:00:00Z',
    createdAt: new Date().toISOString(),
    exercises: [
      {
        id: `we_cal_1`,
        workoutPlanId: `wo_cal_1_${Date.now()}`,
        exerciseId: 'ex_bench',
        exerciseName: 'Жим штанги лежачи',
        muscleGroup: 'chest',
        order: 1,
        setCount: 3,
        sets: [
          {
            id: `s_1`,
            workoutExerciseId: 'we_cal_1',
            setNumber: 1,
            targetRepsRange: '8-12',
            weight: 80,
            actualReps: 10,
            completedAt: '2026-09-29T18:10:00Z',
          },
        ],
      },
    ],
  };

  const wo2: WorkoutPlan = {
    id: `wo_cal_2_${Date.now()}`,
    userId: TEST_USER_ID,
    title: 'Кардіо та Розтяжка',
    scheduledDate: targetDate1, // Same date to test multiple workouts on 1 day!
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    exercises: [],
  };

  const wo3: WorkoutPlan = {
    id: `wo_cal_3_${Date.now()}`,
    userId: TEST_USER_ID,
    title: 'День ніг',
    scheduledDate: targetDate2,
    status: 'planned',
    createdAt: new Date().toISOString(),
    exercises: [],
  };

  await WorkoutService.saveWorkout(wo1);
  await WorkoutService.saveWorkout(wo2);
  await WorkoutService.saveWorkout(wo3);

  const userWorkouts = await WorkoutService.getWorkouts(TEST_USER_ID);
  assert(userWorkouts.length >= 3, `Retrieved ${userWorkouts.length} workouts for user`);

  // 5. Indexing workouts by Date
  console.log('\n📌 Test 5: Date Map grouping');
  const dateMap = new Map<string, WorkoutPlan[]>();
  userWorkouts.forEach((w) => {
    const list = dateMap.get(w.scheduledDate) || [];
    list.push(w);
    dateMap.set(w.scheduledDate, list);
  });

  const day1Workouts = dateMap.get(targetDate1) || [];
  assert(day1Workouts.length === 2, `Date ${targetDate1} contains 2 workouts`);
  assert(day1Workouts.some((w) => w.title === 'Груди та Тріцепс'), 'Contains Bench workout');
  assert(day1Workouts.some((w) => w.title === 'Кардіо та Розтяжка'), 'Contains Cardio workout');

  // Check status indicator determination
  const hasWorkouts = day1Workouts.length > 0;
  const allDone = hasWorkouts && day1Workouts.every((w) => w.status === 'completed');
  const hasInProgress = hasWorkouts && day1Workouts.some((w) => w.status === 'in_progress');
  assert(hasWorkouts, 'Day 1 has workouts');
  assert(!allDone, 'Not all done because one is in_progress');
  assert(hasInProgress, 'Day 1 correctly flagged as having in_progress workout');

  // 6. Creating workout directly on a selected date
  console.log('\n📌 Test 6: Creating a workout on a selected date');
  const targetDate3 = '2026-10-05';
  const newWoOnDate: WorkoutPlan = {
    id: `wo_cal_new_${Date.now()}`,
    userId: TEST_USER_ID,
    title: 'Спина та Біцепс',
    scheduledDate: targetDate3,
    status: 'planned',
    notes: 'Заплановано через календар',
    createdAt: new Date().toISOString(),
    exercises: [],
  };

  const saveOk = await WorkoutService.saveWorkout(newWoOnDate);
  assert(saveOk, 'Workout on 2026-10-05 created successfully');

  const afterCreate = await WorkoutService.getWorkoutById(TEST_USER_ID, newWoOnDate.id);
  assert(afterCreate !== null, 'Workout is retrievable by ID');
  assert(afterCreate?.scheduledDate === targetDate3, `Scheduled date matches ${targetDate3}`);
  assert(afterCreate?.title === 'Спина та Біцепс', 'Title matches preset');

  // 7. Cleanup test workouts
  console.log('\n📌 Test 7: Cleanup test workouts');
  await WorkoutService.deleteWorkout(TEST_USER_ID, wo1.id);
  await WorkoutService.deleteWorkout(TEST_USER_ID, wo2.id);
  await WorkoutService.deleteWorkout(TEST_USER_ID, wo3.id);
  await WorkoutService.deleteWorkout(TEST_USER_ID, newWoOnDate.id);

  const cleanList = await WorkoutService.getWorkouts(TEST_USER_ID);
  assert(cleanList.length === 0, 'All test workouts cleaned up');

  console.log(`\n🎉 ALL CALENDAR TESTS PASSED! (${passedTests}/${totalTests})`);
}

runCalendarVerification().catch((err) => {
  console.error('\n💥 Calendar verification failed with error:', err);
  process.exit(1);
});
