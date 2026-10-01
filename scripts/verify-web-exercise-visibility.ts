import { StorageService } from '../src/services/storageService';
import { User, Exercise, WorkoutPlan } from '../src/types/workout';

function runTests() {
  console.log('🚀 Running Web Exercise Visibility Verification (Updated Requirements)...');

  // Setup users
  const coach: User = {
    id: 'user_coach_1',
    profileCode: 'COA-001',
    firstName: 'Coach',
    lastName: 'One',
    name: 'Coach One',
    email: 'coach@test.com',
    image: '',
    role: 'coach',
    traineeIds: ['user_trainee_1'],
    createdAt: new Date().toISOString(),
  };

  const trainee: User = {
    id: 'user_trainee_1',
    profileCode: 'TRN-001',
    firstName: 'Trainee',
    lastName: 'One',
    name: 'Trainee One',
    email: 'trainee@test.com',
    image: '',
    role: 'athlete',
    coachId: 'user_coach_1',
    createdAt: new Date().toISOString(),
  };

  const stranger: User = {
    id: 'user_stranger_1',
    profileCode: 'STR-001',
    firstName: 'Stranger',
    lastName: 'Danger',
    name: 'Stranger Danger',
    email: 'stranger@test.com',
    image: '',
    role: 'athlete',
    coachId: null,
    createdAt: new Date().toISOString(),
  };

  StorageService.saveUser(coach);
  StorageService.saveUser(trainee);
  StorageService.saveUser(stranger);

  // Setup exercises
  const globalEx: Exercise = {
    id: 'def_ex_bench',
    userId: null,
    name: 'Жим лежачи (Global)',
    muscleGroup: 'chest',
    isDefault: true,
    createdAt: new Date().toISOString(),
  };

  const coachEx: Exercise = {
    id: 'custom_ex_coach',
    userId: coach.id,
    name: 'Coach Special Press',
    muscleGroup: 'chest',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  const traineeEx: Exercise = {
    id: 'custom_ex_trainee',
    userId: trainee.id,
    name: 'Trainee Special Squat',
    muscleGroup: 'legs',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  const strangerEx: Exercise = {
    id: 'custom_ex_stranger',
    userId: stranger.id,
    name: 'Stranger Secret Lift',
    muscleGroup: 'back',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  StorageService.saveExercise(globalEx);
  StorageService.saveExercise(coachEx);
  StorageService.saveExercise(traineeEx);
  StorageService.saveExercise(strangerEx);

  // 1. GENERAL CATALOG CONTEXT:
  console.log('\n--- Test 1: General Exercise Catalog ---');
  const coachCatalog = StorageService.getExercises(coach.id);
  const coachExIds = coachCatalog.map((e) => e.id);
  console.assert(coachExIds.includes('def_ex_bench'), 'Coach should see global exercise');
  console.assert(coachExIds.includes('custom_ex_coach'), 'Coach should see own exercise');
  console.assert(!coachExIds.includes('custom_ex_trainee'), 'Coach should NOT see trainee exercise in general catalog');
  console.assert(!coachExIds.includes('custom_ex_stranger'), 'Coach should NOT see stranger exercise in general catalog');
  console.log('✅ Coach catalog isolation PASSED');

  const traineeCatalog = StorageService.getExercises(trainee.id);
  const traineeExIds = traineeCatalog.map((e) => e.id);
  console.assert(traineeExIds.includes('def_ex_bench'), 'Trainee should see global exercise');
  console.assert(traineeExIds.includes('custom_ex_trainee'), 'Trainee should see own exercise');
  console.assert(!traineeExIds.includes('custom_ex_coach'), 'Trainee should NOT see coach exercise in general catalog');
  console.assert(!traineeExIds.includes('custom_ex_stranger'), 'Trainee should NOT see stranger exercise in general catalog');
  console.log('✅ Trainee catalog isolation PASSED');

  // 2. EXERCISE SELECTOR (ПРИ ДОДАВАННІ ВПРАВ):
  console.log('\n--- Test 2: Exercise Selector (When adding exercises) ---');
  // When coach is adding exercises (even for trainee's workout plan):
  // Coach must only see own custom exercises + global exercises (NOT trainee's custom exercises!)
  StorageService.setActiveUserId(coach.id);
  const coachAddingList = StorageService.getExercises(coach.id);
  const coachAddingIds = coachAddingList.map((e) => e.id);
  console.assert(coachAddingIds.includes('def_ex_bench'), 'Coach sees global exercise');
  console.assert(coachAddingIds.includes('custom_ex_coach'), 'Coach sees own custom exercise');
  console.assert(!coachAddingIds.includes('custom_ex_trainee'), 'Coach MUST NOT see trainee custom exercise when adding');
  console.assert(!coachAddingIds.includes('custom_ex_stranger'), 'Coach MUST NOT see stranger custom exercise');
  console.log('✅ Coach selector isolation (when adding exercises) PASSED');

  // When trainee is adding exercises:
  // Trainee must only see own custom exercises + global exercises (NOT coach's custom exercises!)
  StorageService.setActiveUserId(trainee.id);
  const traineeAddingList = StorageService.getExercises(trainee.id);
  const traineeAddingIds = traineeAddingList.map((e) => e.id);
  console.assert(traineeAddingIds.includes('def_ex_bench'), 'Trainee sees global exercise');
  console.assert(traineeAddingIds.includes('custom_ex_trainee'), 'Trainee sees own custom exercise');
  console.assert(!traineeAddingIds.includes('custom_ex_coach'), 'Trainee MUST NOT see coach custom exercise when adding');
  console.assert(!traineeAddingIds.includes('custom_ex_stranger'), 'Trainee MUST NOT see stranger custom exercise');
  console.log('✅ Trainee selector isolation (when adding exercises) PASSED');

  // 3. ALREADY CREATED WORKOUT PLAN (В УЖЕ СТВОРЕНОМУ ПЛАНІ ТРЕНУВАННЯ):
  console.log('\n--- Test 3: Already Created Workout Plan ---');
  // Coach creates workout for Trainee containing Coach's custom exercise
  const planCreatedByCoach: WorkoutPlan = {
    id: 'workout_coach_created',
    userId: trainee.id,
    assignedByCoachId: coach.id,
    title: 'Coach Assigned Plan',
    scheduledDate: '2026-10-02',
    status: 'planned',
    createdAt: new Date().toISOString(),
    exercises: [
      {
        id: 'we_1',
        workoutPlanId: 'workout_coach_created',
        exerciseId: coachEx.id,
        exerciseName: coachEx.name,
        muscleGroup: coachEx.muscleGroup,
        order: 1,
        sets: [
          {
            id: 's_1',
            workoutExerciseId: 'we_1',
            setNumber: 1,
            targetRepsRange: '8-12',
            weight: 50,
            actualReps: null,
            completedAt: null,
          },
        ],
      },
    ],
  };
  StorageService.saveWorkout(planCreatedByCoach);

  // When Trainee opens this created plan, Coach's custom exercise is fully accessible & visible:
  const traineeViewedPlanExercises = StorageService.getExercisesForWorkout(planCreatedByCoach);
  console.assert(
    traineeViewedPlanExercises.some((e) => e.id === coachEx.id),
    'Trainee MUST be able to see coach custom exercise in the already created workout plan'
  );
  const resolvedExForTrainee = StorageService.getExerciseById(coachEx.id);
  console.assert(
    resolvedExForTrainee?.name === 'Coach Special Press',
    'Trainee can resolve exercise name from the plan'
  );
  console.log('✅ Trainee can see coach custom exercise in created plan PASSED');

  // Trainee creates a plan containing Trainee's custom exercise
  const planCreatedByTrainee: WorkoutPlan = {
    id: 'workout_trainee_created',
    userId: trainee.id,
    title: 'Trainee Personal Plan',
    scheduledDate: '2026-10-03',
    status: 'planned',
    createdAt: new Date().toISOString(),
    exercises: [
      {
        id: 'we_2',
        workoutPlanId: 'workout_trainee_created',
        exerciseId: traineeEx.id,
        exerciseName: traineeEx.name,
        muscleGroup: traineeEx.muscleGroup,
        order: 1,
        sets: [
          {
            id: 's_2',
            workoutExerciseId: 'we_2',
            setNumber: 1,
            targetRepsRange: '10-15',
            weight: 30,
            actualReps: null,
            completedAt: null,
          },
        ],
      },
    ],
  };
  StorageService.saveWorkout(planCreatedByTrainee);

  // When Coach views trainee's workout plan, Trainee's custom exercise is fully accessible & visible:
  const coachViewedPlanExercises = StorageService.getExercisesForWorkout(planCreatedByTrainee);
  console.assert(
    coachViewedPlanExercises.some((e) => e.id === traineeEx.id),
    'Coach MUST be able to see trainee custom exercise in the already created workout plan'
  );
  const resolvedExForCoach = StorageService.getExerciseById(traineeEx.id);
  console.assert(
    resolvedExForCoach?.name === 'Trainee Special Squat',
    'Coach can resolve exercise name from the plan'
  );
  console.log('✅ Coach can see trainee custom exercise in created plan PASSED');

  console.log('\n🎉 ALL UPDATED WEB EXERCISE VISIBILITY TESTS PASSED SUCCESSFULLY!');
}

runTests();
