import { StorageService } from '../src/services/storageService';
import { User, Exercise } from '../src/types/workout';

function runTests() {
  console.log('🚀 Running Web Exercise Visibility Verification...');

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

  const strangerCatalog = StorageService.getExercises(stranger.id);
  const strangerExIds = strangerCatalog.map((e) => e.id);
  console.assert(strangerExIds.includes('def_ex_bench'), 'Stranger should see global exercise');
  console.assert(strangerExIds.includes('custom_ex_stranger'), 'Stranger should see own exercise');
  console.assert(!strangerExIds.includes('custom_ex_coach'), 'Stranger should NOT see coach exercise');
  console.assert(!strangerExIds.includes('custom_ex_trainee'), 'Stranger should NOT see trainee exercise');
  console.log('✅ Stranger catalog isolation PASSED');

  // 2. WORKOUT PLAN CONTEXT:
  console.log('\n--- Test 2: Workout Plan Context ---');
  // Coach planning workout for trainee
  StorageService.setActiveUserId(coach.id);
  const coachForTraineePlan = StorageService.getExercises(coach.id, {
    forWorkoutPlan: true,
    workoutUserId: trainee.id,
    coachId: coach.id,
  });
  const planExIds1 = coachForTraineePlan.map((e) => e.id);
  console.assert(planExIds1.includes('def_ex_bench'), 'Should include global exercise');
  console.assert(planExIds1.includes('custom_ex_coach'), 'Coach should see their own custom exercise in plan');
  console.assert(planExIds1.includes('custom_ex_trainee'), 'Coach should see trainee custom exercise in plan');
  console.assert(!planExIds1.includes('custom_ex_stranger'), 'Coach should NOT see stranger custom exercise in plan');
  console.log('✅ Coach planning for trainee PASSED');

  // Trainee planning workout for themselves
  StorageService.setActiveUserId(trainee.id);
  const traineeSelfPlan = StorageService.getExercises(trainee.id, {
    forWorkoutPlan: true,
    workoutUserId: trainee.id,
    coachId: coach.id,
  });
  const planExIds2 = traineeSelfPlan.map((e) => e.id);
  console.assert(planExIds2.includes('def_ex_bench'), 'Should include global exercise');
  console.assert(planExIds2.includes('custom_ex_trainee'), 'Trainee should see their own custom exercise in plan');
  console.assert(planExIds2.includes('custom_ex_coach'), 'Trainee should see coach custom exercise in plan');
  console.assert(!planExIds2.includes('custom_ex_stranger'), 'Trainee should NOT see stranger custom exercise in plan');
  console.log('✅ Trainee planning for themselves PASSED');

  // Stranger planning workout
  StorageService.setActiveUserId(stranger.id);
  const strangerPlan = StorageService.getExercises(stranger.id, {
    forWorkoutPlan: true,
    workoutUserId: stranger.id,
  });
  const planExIds3 = strangerPlan.map((e) => e.id);
  console.assert(planExIds3.includes('def_ex_bench'), 'Should include global exercise');
  console.assert(planExIds3.includes('custom_ex_stranger'), 'Stranger should see own custom exercise in plan');
  console.assert(!planExIds3.includes('custom_ex_coach'), 'Stranger should NOT see coach custom exercise in plan');
  console.assert(!planExIds3.includes('custom_ex_trainee'), 'Stranger should NOT see trainee custom exercise in plan');
  console.log('✅ Stranger planning PASSED');

  console.log('\n🎉 ALL WEB EXERCISE VISIBILITY TESTS PASSED SUCCESSFULLY!');
}

runTests();
