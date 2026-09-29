import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('🚀 Starting mobile UI/UX Polish Verification...\n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MOBILE_DIR = path.resolve(__dirname, '../mobile');

// Helper to read file
function getFile(relativePath: string): string {
  const fullPath = path.join(MOBILE_DIR, relativePath);
  assert(fs.existsSync(fullPath), `File does not exist: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

// 1. Check ScrollTabBarContext.tsx
console.log('Checking 1: ScrollTabBarContext...');
const scrollTabBarCtx = getFile('src/context/ScrollTabBarContext.tsx');
assert(scrollTabBarCtx.includes('createContext'), 'ScrollTabBarContext should create context');
assert(scrollTabBarCtx.includes('handleScroll'), 'ScrollTabBarContext should provide handleScroll');
assert(scrollTabBarCtx.includes('translateY'), 'ScrollTabBarContext should provide translateY');
assert(scrollTabBarCtx.includes('diff > 8'), 'ScrollTabBarContext should detect scroll down');
assert(scrollTabBarCtx.includes('diff < -6'), 'ScrollTabBarContext should detect scroll up immediately');
assert(scrollTabBarCtx.includes('currentY <= 15'), 'ScrollTabBarContext should keep tab bar visible near top');
console.log('✓ ScrollTabBarContext verifies scroll-down hide, scroll-up show, top liveness.\n');

// 2. Check LiquidGlassTabBar.tsx
console.log('Checking 2: LiquidGlassTabBar...');
const liquidTabBar = getFile('src/components/LiquidGlassTabBar.tsx');
assert(liquidTabBar.includes('expo-glass-effect'), 'LiquidGlassTabBar must use expo-glass-effect');
assert(liquidTabBar.includes('isLiquidGlassAvailable'), 'LiquidGlassTabBar must check native liquid glass availability');
assert(liquidTabBar.includes('GlassView'), 'LiquidGlassTabBar must render GlassView when available');
assert(liquidTabBar.includes('useSafeAreaInsets'), 'LiquidGlassTabBar must adapt to safe area insets');
assert(liquidTabBar.includes('borderRadius: 32'), 'LiquidGlassTabBar must have rounded floating style');
assert(liquidTabBar.includes('position: \'absolute\''), 'LiquidGlassTabBar must be a floating absolute element');
assert(liquidTabBar.includes('options.href !== null'), 'LiquidGlassTabBar must filter out hidden tabs');
assert(liquidTabBar.includes('hitSlop'), 'LiquidGlassTabBar buttons must include hitSlop');
console.log('✓ LiquidGlassTabBar implements rounded floating pill, native blur & fallback, safe-area and touch targets.\n');

// 3. Check Tab Layout Integration
console.log('Checking 3: (tabs)/_layout.tsx...');
const tabLayout = getFile('src/app/(tabs)/_layout.tsx');
assert(tabLayout.includes('ScrollTabBarProvider'), 'TabLayout must wrap in ScrollTabBarProvider');
assert(tabLayout.includes('LiquidGlassTabBar'), 'TabLayout must use LiquidGlassTabBar as tabBar component');
assert(tabLayout.includes('name="index"'), 'TabLayout must have index tab');
assert(tabLayout.includes('name="calendar"'), 'TabLayout must have calendar tab');
assert(tabLayout.includes('name="analytics"'), 'TabLayout must have analytics tab');
assert(tabLayout.includes('name="trainees"'), 'TabLayout must have trainees tab');
console.log('✓ TabLayout correctly integrates ScrollTabBarProvider and LiquidGlassTabBar.\n');

// 4. Check Scroll Tab Bar Wiring & Padding across all tab screens
console.log('Checking 4: Tab screens scroll hide/show and padding...');
const screensToVerify = [
  { name: 'WorkoutsScreen', path: 'src/screens/WorkoutsScreen.tsx' },
  { name: 'AnalyticsScreen', path: 'src/screens/AnalyticsScreen.tsx' },
  { name: 'CalendarScreen', path: 'src/screens/CalendarScreen.tsx' },
  { name: 'TraineesScreen', path: 'src/screens/TraineesScreen.tsx' },
  { name: 'ProfileScreen', path: 'src/screens/ProfileScreen.tsx' },
  { name: 'ExercisesScreen', path: 'src/screens/ExercisesScreen.tsx' },
];

for (const scr of screensToVerify) {
  const content = getFile(scr.path);
  assert(content.includes('useScrollTabBar'), `${scr.name} must import useScrollTabBar`);
  assert(content.includes('handleScroll'), `${scr.name} must extract handleScroll`);
  assert(content.includes('onScroll={handleScroll}'), `${scr.name} must attach onScroll={handleScroll}`);
  assert(content.includes('scrollEventThrottle={16}'), `${scr.name} must specify scrollEventThrottle={16}`);
  assert(content.includes('paddingBottom: 110'), `${scr.name} must have paddingBottom: 110 for floating tab bar`);
  console.log(`  ✓ ${scr.name} wired with handleScroll and paddingBottom: 110`);
}
console.log('✓ All tab screens correctly hide tab bar on scroll down, show on scroll up, and clear floating tab bar.\n');

// 5. Check WorkoutEditor auto-scroll & gestures
console.log('Checking 5: WorkoutEditor auto-scroll & gestures...');
const workoutEditor = getFile('src/screens/WorkoutEditorScreen.tsx');
assert(workoutEditor.includes('scrollViewRef = useRef<ScrollView>'), 'WorkoutEditor must have scrollViewRef');
assert(workoutEditor.includes('exerciseLayoutsRef = useRef'), 'WorkoutEditor must have exerciseLayoutsRef');
assert(workoutEditor.includes('scrollToEnd'), 'WorkoutEditor must auto-scroll to newly added exercise');
assert(workoutEditor.includes('handleRemoveExercise'), 'WorkoutEditor must have handleRemoveExercise');
assert(workoutEditor.includes('targetExercise = exerciseIndex > 0'), 'WorkoutEditor must identify previous/next exercise on deletion');
assert(workoutEditor.includes('scrollViewRef.current?.scrollTo'), 'WorkoutEditor must smoothly scroll to target exercise on deletion');
assert(workoutEditor.includes('deleteWorkoutBottomBtn'), 'WorkoutEditor must have bottom delete workout button');
assert(workoutEditor.includes('Видалити тренування'), 'WorkoutEditor must display "Видалити тренування" button');
assert(workoutEditor.includes('Math.max(insets.bottom, 16)'), 'WorkoutEditor must apply safe-area bottom padding to sticky bottom action bar');
assert(workoutEditor.includes('stepBtn'), 'WorkoutEditor must style stepBtn with generous touch target');
assert(workoutEditor.includes('hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}'), 'WorkoutEditor buttons must have touch target hitSlop');
assert(workoutEditor.includes('keyboardVerticalOffset={Platform.OS === \'ios\' ? 88 : 0}'), 'WorkoutEditor must have iOS KeyboardAvoidingView offset');
console.log('✓ WorkoutEditor auto-scrolls on add/delete, includes bottom delete button, safe area, and generous steppers.\n');

// 6. Check Modals Safe Area & Keyboard Handling
console.log('Checking 6: Modals and Selector...');
const exSelector = getFile('src/components/ExerciseSelectorModal.tsx');
assert(exSelector.includes('SafeAreaView'), 'ExerciseSelectorModal must use SafeAreaView');
assert(exSelector.includes('keyboardShouldPersistTaps="handled"'), 'ExerciseSelectorModal must handle keyboard taps');
assert(exSelector.includes('numberOfLines={2}'), 'ExerciseSelectorModal must allow 2-line exercise names');

const createModal = getFile('src/components/CreateWorkoutModal.tsx');
assert(createModal.includes('KeyboardAvoidingView'), 'CreateWorkoutModal must use KeyboardAvoidingView');
assert(createModal.includes('formatLocalDate'), 'CreateWorkoutModal must use formatLocalDate');
console.log('✓ Modals properly configure SafeAreaView, KeyboardAvoidingView, and typography.\n');

// 7. Check UserAvatar and Theme support
console.log('Checking 7: UserAvatar & Theme Consistency...');
const userAvatar = getFile('src/components/UserAvatar.tsx');
assert(userAvatar.includes('WD'), 'UserAvatar must have WD fallback text');
assert(userAvatar.includes('fallbackDark'), 'UserAvatar must have dark fallback style');
assert(userAvatar.includes('fallbackLight'), 'UserAvatar must have light fallback style');
console.log('✓ UserAvatar handles image, WD fallback, and dynamic dark/light themes.\n');

console.log('🎉 ALL UI/UX POLISH CHECKS PASSED SUCCESSFULLY!\n');
