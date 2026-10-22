import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { ExercisesScreen } from '../screens/ExercisesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { LiquidGlassTabBar } from './LiquidGlassTabBar';
import { swipeCardManager } from '../services/swipeCardManager';

const TAB_ORDER = ['index', 'analytics', 'exercises', 'profile'] as const;
type TabName = (typeof TAB_ORDER)[number];

interface InstagramTabPagerProps {
  initialTab?: string;
}

const TIMING_CONFIG = {
  duration: 240,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

export const InstagramTabPager: React.FC<InstagramTabPagerProps> = ({ initialTab = 'index' }) => {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const getTabIndex = (name: string): number => {
    const idx = TAB_ORDER.indexOf(name as TabName);
    return idx >= 0 ? idx : 0;
  };

  const [activeTab, setActiveTab] = useState<TabName>(() => {
    return TAB_ORDER.includes(initialTab as TabName) ? (initialTab as TabName) : 'index';
  });

  const translateX = useSharedValue(-getTabIndex(initialTab) * screenWidth);
  const startTranslateX = useSharedValue(-getTabIndex(initialTab) * screenWidth);
  const activeTabShared = useSharedValue(getTabIndex(initialTab));
  const isGestureActive = useSharedValue(false);

  // Sync state if initialTab changes from outside (e.g. router)
  useEffect(() => {
    const targetIdx = getTabIndex(initialTab);
    if (TAB_ORDER[targetIdx] !== activeTab) {
      setActiveTab(TAB_ORDER[targetIdx]);
      activeTabShared.value = targetIdx;
      translateX.value = withTiming(-targetIdx * screenWidth, TIMING_CONFIG);
    }
  }, [initialTab, screenWidth]);

  // Adjust on screen dimension change
  useEffect(() => {
    translateX.value = -getTabIndex(activeTab) * screenWidth;
  }, [screenWidth, activeTab]);

  const onTabSwiped = useCallback((newIndex: number) => {
    const newTabName = TAB_ORDER[newIndex];
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
    setActiveTab(TAB_ORDER[idx]);
    activeTabShared.value = idx;
    translateX.value = withTiming(-idx * screenWidth, TIMING_CONFIG);
    try {
      Haptics.selectionAsync();
    } catch {}
  }, [screenWidth, closeAnyOpenCard]);

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
