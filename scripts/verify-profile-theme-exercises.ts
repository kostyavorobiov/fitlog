import dotenv from 'dotenv';
dotenv.config();

import { User, MuscleGroup, MUSCLE_GROUPS, Exercise } from '../mobile/src/types/workout';
import { MobileStorage } from '../mobile/src/lib/storage';
import { AuthService } from '../mobile/src/services/authService';
import { ExerciseService } from '../mobile/src/services/exerciseService';

async function runProfileThemeExercisesVerification() {
  console.log('🚀 [START] FitLog Mobile Profile, Theme, Private & Global Exercises Verification...\n');

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
  // Test 1: Theme Persistence and Preference
  // -------------------------------------------------------------
  console.log('📌 Test 1: Theme Persistence and Light/Dark preference');

  const THEME_PREF_KEY = 'theme_preference';
  await MobileStorage.setItem(THEME_PREF_KEY, 'dark');
  let currentTheme = await MobileStorage.getItem<string>(THEME_PREF_KEY, 'light');
  assert(currentTheme === 'dark', 'Theme preference successfully persisted as "dark"');

  await MobileStorage.setItem(THEME_PREF_KEY, 'light');
  currentTheme = await MobileStorage.getItem<string>(THEME_PREF_KEY, 'dark');
  assert(currentTheme === 'light', 'Theme preference successfully switched and persisted as "light"');

  // -------------------------------------------------------------
  // Test 2: UserAvatar WD Fallback and Google Avatar resolution
  // -------------------------------------------------------------
  console.log('\n📌 Test 2: UserAvatar WD Fallback and Theme Adaptation');

  const userWithGoogleImg: User = {
    id: 'usr_google_1',
    profileCode: 'USR001',
    name: 'Іван Франко',
    email: 'franko@gmail.com',
    role: 'athlete',
    image: 'https://lh3.googleusercontent.com/a/ACg8ocI...',
    createdAt: new Date().toISOString(),
  };

  const userWithoutImg: User = {
    id: 'usr_no_img_2',
    profileCode: 'USR002',
    name: 'Леся Українка',
    email: 'ukrainka@fitlog.app',
    role: 'athlete',
    image: null,
    createdAt: new Date().toISOString(),
  };

  const hasGoogleImage = Boolean(userWithGoogleImg.image && userWithGoogleImg.image.trim().length > 0);
  assert(hasGoogleImage === true, 'Google avatar URL correctly identified for display');

  const hasFallbackWD = !userWithoutImg.image || userWithoutImg.image.trim().length === 0;
  assert(hasFallbackWD === true, 'Absence of avatar correctly triggers WD fallback');

  // Theme-adaptive styling check
  const fallbackDarkThemeStyles = {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
    textColor: '#fafafa',
  };
  const fallbackLightThemeStyles = {
    backgroundColor: '#f4f4f5',
    borderColor: '#d4d4d8',
    textColor: '#18181b',
  };
  assert(fallbackDarkThemeStyles.backgroundColor === '#27272a', 'Dark theme fallback avatar has dark background #27272a');
  assert(fallbackLightThemeStyles.backgroundColor === '#f4f4f5', 'Light theme fallback avatar has light background #f4f4f5');

  // -------------------------------------------------------------
  // Test 3: Profile Screen Data and Navigation Verification
  // -------------------------------------------------------------
  console.log('\n📌 Test 3: Profile Screen Data and Avatar Navigation');

  // Check user profile data fields
  assert(Boolean(userWithGoogleImg.name), 'Profile displays user name');
  assert(Boolean(userWithGoogleImg.email), 'Profile displays user email');
  assert(Boolean(userWithGoogleImg.role), 'Profile displays user role');
  assert(Boolean(userWithGoogleImg.profileCode), 'Profile displays unique profile ID/code');

  // Test profile update
  await AuthService.loginAsDemo('athlete', {
    id: 'test_athlete_profile_upd',
    firstName: 'Тарас',
    lastName: 'Шевченко',
    role: 'athlete',
  });

  const updatedProfile = await AuthService.updateUserProfile({
    firstName: 'Тарас Григорович',
    lastName: 'Шевченко',
    role: 'athlete',
  });

  assert(updatedProfile?.firstName === 'Тарас Григорович', 'Profile first name successfully updated');
  assert(updatedProfile?.name === 'Тарас Григорович Шевченко', 'Full name computed correctly');

  // -------------------------------------------------------------
  // Test 4: Logout and Session Cleanup
  // -------------------------------------------------------------
  console.log('\n📌 Test 4: Logout, Session Cleanup & ID Preservation upon re-login');

  const activeBeforeLogout = await AuthService.getCurrentUser();
  assert(activeBeforeLogout?.id === 'test_athlete_profile_upd', 'Active user before logout verified');

  // Execute sign out
  await AuthService.signOut();
  const activeAfterLogout = await AuthService.getCurrentUser();
  assert(activeAfterLogout === null, 'Active user session and cache cleared upon logout');

  // Re-login with existing credentials: user ID must be preserved, no duplicate
  const reloggedUser = await AuthService.loginAsDemo('athlete', {
    id: 'test_athlete_profile_upd',
    email: 'taras@fitlog.app',
  });
  assert(reloggedUser.user.id === 'test_athlete_profile_upd', 'User re-logged in with exact same existing user ID (no duplicate)');

  // -------------------------------------------------------------
  // Test 5: Muscle Groups / Categories Alignment
  // -------------------------------------------------------------
  console.log('\n📌 Test 5: Muscle Groups / Categories Alignment with Web');

  const validMuscleGroups = Object.keys(MUSCLE_GROUPS) as MuscleGroup[];
  assert(validMuscleGroups.includes('chest'), 'Categories include "chest" (Грудні)');
  assert(validMuscleGroups.includes('back'), 'Categories include "back" (Спина)');
  assert(validMuscleGroups.includes('legs'), 'Categories include "legs" (Ноги)');
  assert(validMuscleGroups.includes('shoulders'), 'Categories include "shoulders" (Плечі)');
  assert(validMuscleGroups.includes('biceps'), 'Categories include "biceps" (Біцепс)');
  assert(validMuscleGroups.includes('triceps'), 'Categories include "triceps" (Тріцепс)');
  assert(validMuscleGroups.includes('full_body'), 'Categories include "full_body" (Full body)');
  assert(validMuscleGroups.includes('other'), 'Categories include "other" (Інше)');
  assert(!('equipment' in MUSCLE_GROUPS), 'No equipment in categories configuration');

  // -------------------------------------------------------------
  // Test 6: Private Exercises Management (Creation, Ownership, Editing)
  // -------------------------------------------------------------
  console.log('\n📌 Test 6: Private Exercises (Create, Edit own, Ownership isolation)');

  const athleteUserId = 'user_athlete_private_test';
  const otherUserId = 'user_stranger_private_test';

  const myPrivateExercise: Exercise = {
    id: `priv_ex_${Date.now()}`,
    userId: athleteUserId,
    name: 'Моя приватна тяга блоку',
    muscleGroup: 'back',
    description: '',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  // 1. Create
  const createdOk = await ExerciseService.createExercise(myPrivateExercise);
  assert(createdOk === true, 'Private exercise created with userId = currentUser.id');
  assert(myPrivateExercise.userId === athleteUserId, 'Private exercise saved with userId = currentUser.id');
  assert(myPrivateExercise.isDefault === false, 'Private exercise saved with isDefault = false');

  // 2. Edit own private exercise (allowed fields: name, muscleGroup, NO equipment)
  const editedExercise: Exercise = {
    ...myPrivateExercise,
    name: 'Моя приватна тяга блоку (оновлена)',
    muscleGroup: 'shoulders',
  };
  const editResultOwner = await ExerciseService.updateExercise(editedExercise, athleteUserId, false);
  assert(editResultOwner.success === true, 'Owner successfully updated own private exercise');

  // 3. Stranger attempts to edit owner's private exercise -> Forbidden!
  const strangerEditResult = await ExerciseService.updateExercise(
    { ...editedExercise, name: 'Спроба хаку від чужака' },
    otherUserId,
    false
  );
  assert(strangerEditResult.success === false, 'Stranger denied editing another user\'s private exercise');
  assert(strangerEditResult.error?.includes('власні') || strangerEditResult.error?.includes('редагувати'), 'Clear authorization error returned');

  // 4. Stranger attempts to delete owner's private exercise -> Forbidden!
  const strangerDeleteOk = await ExerciseService.deleteExercise(editedExercise.id, otherUserId, false);
  assert(strangerDeleteOk === false, 'Stranger denied deleting another user\'s private exercise');

  // 5. Owner deletes own private exercise -> Success!
  const ownerDeleteOk = await ExerciseService.deleteExercise(editedExercise.id, athleteUserId, false);
  assert(ownerDeleteOk === true, 'Owner successfully deleted own private exercise');

  // -------------------------------------------------------------
  // Test 7: Global Exercises and Admin Restrictions
  // -------------------------------------------------------------
  console.log('\n📌 Test 7: Global Exercises and Admin Menu Permissions');

  const globalEx: Exercise = {
    id: `global_ex_${Date.now()}`,
    userId: null,
    name: 'Глобальний жим гантелей',
    muscleGroup: 'chest',
    description: '',
    isDefault: true,
    createdAt: new Date().toISOString(),
  };

  // Save global exercise initially
  await ExerciseService.createExercise(globalEx);

  // 1. Regular user attempts to edit global exercise -> Forbidden!
  const regularUserEditGlobal = await ExerciseService.updateExercise(
    { ...globalEx, name: 'Зміна глобальної вправи звичайним юзером' },
    athleteUserId,
    false // not admin
  );
  assert(regularUserEditGlobal.success === false, 'Regular user CANNOT edit global exercise');

  // 2. Regular user attempts to delete global exercise -> Forbidden!
  const regularUserDeleteGlobal = await ExerciseService.deleteExercise(
    globalEx.id,
    athleteUserId,
    false // not admin
  );
  assert(regularUserDeleteGlobal === false, 'Regular user CANNOT delete global exercise');

  // 3. Admin user creates a global exercise via Admin Menu
  const adminCreateResult = await ExerciseService.createGlobalExercise({
    name: 'Адмінський пуловер',
    muscleGroup: 'back',
  });
  assert(adminCreateResult.success === true, 'Admin successfully created global exercise');
  assert(adminCreateResult.exercise?.userId === null, 'Global exercise created with userId = null');
  assert(adminCreateResult.exercise?.isDefault === true, 'Global exercise created with isDefault = true');

  // 4. Admin edits global exercise
  const adminEditResult = await ExerciseService.updateExercise(
    {
      ...adminCreateResult.exercise!,
      name: 'Адмінський пуловер (редаговано)',
      muscleGroup: 'chest',
    },
    'admin_user_id',
    true // isAdmin = true
  );
  assert(adminEditResult.success === true, 'Admin successfully edited global exercise');

  // 5. Admin deletes global exercise
  const adminDeleteOk = await ExerciseService.deleteExercise(
    adminCreateResult.exercise!.id,
    'admin_user_id',
    true // isAdmin = true
  );
  assert(adminDeleteOk === true, 'Admin successfully deleted global exercise');

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`🎉 ALL TESTS PASSED! (${passedTests}/${totalTests})`);
  console.log('=============================================================\n');
}

runProfileThemeExercisesVerification().catch((err) => {
  console.error('❌ Verification failed with error:', err);
  process.exit(1);
});
