import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { ExercisesScreen } from '../screens/ExercisesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { LiquidGlassTabBar } from './LiquidGlassTabBar';
import { swipeCardManager } from '../services/swipeCardManager';

export const TAB_ORDER = ['index', 'analytics', 'exercises', 'profile'] as const;
export type TabName = (typeof TAB_ORDER)[number];

const ACTIVE_TAB_STORAGE_KEY = '@fitlog_active_tab';

let savedActiveTab: TabName = (() => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
      if (stored && TAB_ORDER.includes(stored as TabName)) {
        return stored as TabName;
      }
    } catch {}
  }
  return 'index';
})();

const tabChangeListeners = new Set<(tab: TabName) => void>();

export const setSavedActiveTab = (tab: TabName, notifyListeners = true) => {
  if (!TAB_ORDER.includes(tab)) return;
  savedActiveTab = tab;
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
    }
    AsyncStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab).catch(() => {});
  } catch {}
  if (notifyListeners) {
    tabChangeListeners.forEach((fn) => {
      try {
        fn(tab);
      } catch {}
    });
  }
};

export const getSavedActiveTab = (): TabName => {
  return savedActiveTab;
};

const resolveTargetTab = (inputTab?: string): TabName => {
  if (inputTab && TAB_ORDER.includes(inputTab as TabName)) {
    return inputTab as TabName;
  }
  return savedActiveTab;
};

interface InstagramTabPagerProps {
  initialTab?: string;
}

const TIMING_CONFIG = {
  duration: 240,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

export const InstagramTabPager: React.FC<InstagramTabPagerProps> = ({ initialTab }) => {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const getTabIndex = (name: string): number => {
    const idx = TAB_ORDER.indexOf(name as TabName);
    return idx >= 0 ? idx : 0;
  };

  const initialTarget = useMemo(() => resolveTargetTab(initialTab), []);
  const [activeTab, setActiveTab] = useState<TabName>(initialTarget);
  const activeTabRef = useRef<TabName>(initialTarget);
  activeTabRef.current = activeTab;

  const initialIdx = getTabIndex(initialTarget);
  const translateX = useSharedValue(-initialIdx * screenWidth);
  const startTranslateX = useSharedValue(-initialIdx * screenWidth);
  const activeTabShared = useSharedValue(initialIdx);
  const isGestureActive = useSharedValue(false);

  // Restore stored active tab on startup if available
  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_TAB_STORAGE_KEY)
      .then((stored) => {
        if (stored && TAB_ORDER.includes(stored as TabName)) {
          savedActiveTab = stored as TabName;
          if (stored !== activeTabRef.current) {
            const targetIdx = getTabIndex(stored);
            activeTabRef.current = stored as TabName;
            setActiveTab(stored as TabName);
            activeTabShared.value = targetIdx;
            translateX.value = withTiming(-targetIdx * screenWidth, TIMING_CONFIG);
          }
        }
      })
      .catch(() => {});
  }, [screenWidth, activeTabShared, translateX]);

  // Subscribe to external tab updates (e.g., returning from exercise detail)
  useEffect(() => {
    const handleExternalTabChange = (newTab: TabName) => {
      if (!TAB_ORDER.includes(newTab)) return;
      if (newTab === activeTabRef.current) return;

      activeTabRef.current = newTab;
      const targetIdx = getTabIndex(newTab);
      setActiveTab(newTab);
      activeTabShared.value = targetIdx;
      translateX.value = withTiming(-targetIdx * screenWidth, TIMING_CONFIG);
    };

    tabChangeListeners.add(handleExternalTabChange);
    return () => {
      tabChangeListeners.delete(handleExternalTabChange);
    };
  }, [screenWidth, activeTabShared, translateX]);

  const prevInitialTabRef = useRef(initialTab);

  // Sync state if initialTab genuinely changes from outside (e.g. router navigation)
  useEffect(() => {
    if (initialTab && initialTab !== prevInitialTabRef.current) {
      prevInitialTabRef.current = initialTab;
      const resolved = resolveTargetTab(initialTab);
      if (resolved === activeTabRef.current) return;

      const targetIdx = getTabIndex(resolved);
      const targetTab = TAB_ORDER[targetIdx];
      activeTabRef.current = targetTab;
      setSavedActiveTab(targetTab, false);
      setActiveTab(targetTab);
      activeTabShared.value = targetIdx;
      translateX.value = withTiming(-targetIdx * screenWidth, TIMING_CONFIG);
    }
  }, [initialTab, screenWidth, activeTabShared, translateX]);

  // Adjust on screen dimension change (e.g., orientation change)
  const prevWidthRef = useRef(screenWidth);
  useEffect(() => {
    if (prevWidthRef.current !== screenWidth) {
      prevWidthRef.current = screenWidth;
      translateX.value = -getTabIndex(activeTabRef.current) * screenWidth;
    }
  }, [screenWidth, translateX]);

  const onTabSwiped = useCallback((newIndex: number) => {
    const newTabName = TAB_ORDER[newIndex];
    if (newTabName === activeTabRef.current) return;

    activeTabRef.current = newTabName;
    setSavedActiveTab(newTabName, false);
    setActiveTab(newTabName);
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  const closeAnyOpenCard = useCallback(() => {
    if (swipeCardManager.hasActiveCard()) {
      swipeCardManager.closeAll();
    }
  }, []);

  const handleSelectTab = useCallback((tabName: string) => {
    closeAnyOpenCard();
    const idx = getTabIndex(tabName);
    const newTab = TAB_ORDER[idx];
    if (newTab === activeTabRef.current) return;

    activeTabRef.current = newTab;
    setSavedActiveTab(newTab, false);
    setActiveTab(newTab);
    activeTabShared.value = idx;
    translateX.value = withTiming(-idx * screenWidth, TIMING_CONFIG);
    try {
      Haptics.selectionAsync();
    } catch {}
  }, [screenWidth, closeAnyOpenCard, activeTabShared, translateX]);

  const isIOS = Platform.OS === 'ios';

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([-14, 14])
      .failOffsetY([-18, 18])
      .onTouchesDown((e, stateManager) => {
        'worklet';
        const touch = e.allTouches[0];
        if (!touch) return;

        // 1. Prevent conflict with iOS system back edge swipe (left 24pt)
        if (isIOS && touch.absoluteX < 24) {
          stateManager.fail();
          return;
        }

        // 2. Prevent conflict with card swiping (starts in right 25% of screen)
        if (touch.absoluteX >= screenWidth * 0.75) {
          stateManager.fail();
          return;
        }
      })
      .onBegin(() => {
        'worklet';
        startTranslateX.value = translateX.value;
        isGestureActive.value = true;
        runOnJS(closeAnyOpenCard)();
      })
      .onUpdate((e) => {
        'worklet';
        // Follow finger interactively 1:1 in real time
        const rawTranslate = startTranslateX.value + e.translationX;
        const minTranslate = -3 * screenWidth;
        const maxTranslate = 0;

        // Soft elastic clamp at bounds
        if (rawTranslate > maxTranslate) {
          translateX.value = maxTranslate + (rawTranslate - maxTranslate) * 0.2;
        } else if (rawTranslate < minTranslate) {
          translateX.value = minTranslate + (rawTranslate - minTranslate) * 0.2;
        } else {
          translateX.value = rawTranslate;
        }
      })
      .onEnd((e) => {
        'worklet';
        isGestureActive.value = false;
        const curIndex = activeTabShared.value;
        const dx = e.translationX;
        const vx = e.velocityX;

        let targetIndex = curIndex;
        const SWIPE_DIST_THRESHOLD = screenWidth * 0.22;
        const VELOCITY_THRESHOLD = 360;

        if (dx < -SWIPE_DIST_THRESHOLD || vx < -VELOCITY_THRESHOLD) {
          // Swiped left -> advance to next tab
          targetIndex = Math.min(3, curIndex + 1);
        } else if (dx > SWIPE_DIST_THRESHOLD || vx > VELOCITY_THRESHOLD) {
          // Swiped right -> go to previous tab
          targetIndex = Math.max(0, curIndex - 1);
        }

        // Smooth springless timing animation (NO bounce, NO pendulum)
        translateX.value = withTiming(-targetIndex * screenWidth, TIMING_CONFIG);

        if (targetIndex !== curIndex) {
          activeTabShared.value = targetIndex;
          runOnJS(onTabSwiped)(targetIndex);
        }
      });
  }, [screenWidth, isIOS, onTabSwiped]);

  const pagerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.pagerTrack,
            { width: screenWidth * 4 },
            pagerAnimatedStyle,
          ]}
        >
          {/* Tab 0: Workouts (Тренування) */}
          <View style={[styles.page, { width: screenWidth }]}>
            <WorkoutsScreen />
          </View>

          {/* Tab 1: Analytics (Аналітика) */}
          <View style={[styles.page, { width: screenWidth }]}>
            <AnalyticsScreen />
          </View>

          {/* Tab 2: Exercises (Вправи) */}
          <View style={[styles.page, { width: screenWidth }]}>
            <ExercisesScreen />
          </View>

          {/* Tab 3: Profile (Профіль) */}
          <View style={[styles.page, { width: screenWidth }]}>
            <ProfileScreen />
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Floating Liquid Glass Tab Bar */}
      <LiquidGlassTabBar
        activeTab={activeTab}
        onTabChange={handleSelectTab}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  pagerTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  page: {
    flex: 1,
    height: '100%',
  },
});
