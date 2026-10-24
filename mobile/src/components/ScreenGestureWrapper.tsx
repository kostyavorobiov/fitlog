import React, { useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { swipeCardManager } from '../services/swipeCardManager';

export interface ScreenGestureWrapperProps {
  currentTab?: string;
  tabOrder?: string[];
  onTabChange?: (tab: string) => void;
  enableTabSwipe?: boolean;
  enableBackSwipe?: boolean;
  onBack?: () => void;
  children: React.ReactNode;
}

let globalLastBackNavTime = 0;

export const ScreenGestureWrapper: React.FC<ScreenGestureWrapperProps> = ({
  currentTab,
  tabOrder = ['index', 'calendar', 'analytics', 'exercises'],
  onTabChange,
  enableTabSwipe = true,
  enableBackSwipe = true,
  onBack,
  children,
}) => {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const isNavigatingRef = useRef(false);
  const startX = useSharedValue(0);

  const handleBackNavigation = useCallback(() => {
    if (!enableBackSwipe) return;
    if (swipeCardManager.hasActiveCard()) {
      swipeCardManager.closeAll();
      return;
    }
    const now = Date.now();
    if (now - globalLastBackNavTime < 500) return;
    if (isNavigatingRef.current) return;

    globalLastBackNavTime = now;
    isNavigatingRef.current = true;

    try {
      Haptics.selectionAsync();
    } catch {}

    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }

    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 450);
  }, [enableBackSwipe, onBack, router]);

  const handleNextTab = useCallback(() => {
    if (!enableTabSwipe) return;
    if (swipeCardManager.hasActiveCard()) {
      swipeCardManager.closeAll();
      return;
    }
    if (isNavigatingRef.current) return;

    const currentIndex = tabOrder.indexOf(currentTab || 'index');
    if (currentIndex === -1 || currentIndex >= tabOrder.length - 1) return;

    const nextTab = tabOrder[currentIndex + 1];
    isNavigatingRef.current = true;
    try {
      Haptics.selectionAsync();
    } catch {}

    if (onTabChange) {
      onTabChange(nextTab);
    } else {
      router.navigate(nextTab === 'index' ? '/(tabs)' : (`/(tabs)/${nextTab}` as any));
    }

    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 380);
  }, [enableTabSwipe, currentTab, tabOrder, onTabChange, router]);

  const handlePrevTab = useCallback(() => {
    if (!enableTabSwipe) return;
    if (swipeCardManager.hasActiveCard()) {
      swipeCardManager.closeAll();
      return;
    }
    if (isNavigatingRef.current) return;

    const currentIndex = tabOrder.indexOf(currentTab || 'index');
    if (currentIndex <= 0) return;

    const prevTab = tabOrder[currentIndex - 1];
    isNavigatingRef.current = true;
    try {
      Haptics.selectionAsync();
    } catch {}

    if (onTabChange) {
      onTabChange(prevTab);
    } else {
      router.navigate(prevTab === 'index' ? '/(tabs)' : (`/(tabs)/${prevTab}` as any));
    }

    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 380);
  }, [enableTabSwipe, currentTab, tabOrder, onTabChange, router]);

  const isIOS = Platform.OS === 'ios';

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([-18, 18])
      .failOffsetY([-16, 16])
      .onTouchesDown((e, stateManager) => {
        'worklet';
        const touch = e.allTouches[0];
        if (touch) {
          startX.value = touch.absoluteX;
          // Left edge: when back swipe is disabled, or on iOS without custom onBack,
          // fail immediately so UIKit UIScreenEdgePanGestureRecognizer gets 100% exclusive priority.
          if (!enableBackSwipe || (isIOS && !onBack)) {
            if (touch.absoluteX < 40) {
              stateManager.fail();
              return;
            }
          }
          // Right 20%: strictly fail so cards have 100% exclusive control
          if (touch.absoluteX > screenWidth * 0.8) {
            stateManager.fail();
            return;
          }
        }
      })
      .onBegin((e) => {
        'worklet';
        startX.value = e.absoluteX;
      })
      .onEnd((e) => {
        'worklet';
        const sX = startX.value;
        const dx = e.translationX;
        const vx = e.velocityX;

        // 1. Right 20%: Strictly ignore so cards handle their own gestures
        if (sX > screenWidth * 0.8) {
          return;
        }

        // 2. Left portion: Back navigation on right swipe
        if (enableBackSwipe && (sX < screenWidth * 0.35 || (!enableTabSwipe && sX < screenWidth * 0.65))) {
          if (isIOS && !onBack) {
            // On standard iOS stack without onBack, native navigation stack interactive edge swipe handles back navigation
            return;
          }
          if (dx > 35 || vx > 250) {
            runOnJS(handleBackNavigation)();
            return;
          }
        }

        // 3. Central 60%: Tab navigation on horizontal swipe (if enabled)
        if (enableTabSwipe && sX >= screenWidth * 0.2 && sX <= screenWidth * 0.8) {
          const isSwipeLeft = dx < -45 || vx < -350;
          const isSwipeRight = dx > 45 || vx > 350;

          if (isSwipeLeft) {
            runOnJS(handleNextTab)();
          } else if (isSwipeRight) {
            runOnJS(handlePrevTab)();
          }
        }
      });
  }, [screenWidth, isIOS, enableBackSwipe, enableTabSwipe, onBack, handleBackNavigation, handleNextTab, handlePrevTab, startX]);

  // On iOS with native stack navigation, native swipe-back is handled by iOS UIKit.
  // When tab swiping is disabled AND no custom onBack handler is provided, bypass GestureDetector completely
  // so UIKit interactivePopGestureRecognizer operates without any gesture competition.
  if (isIOS && !enableTabSwipe && !onBack) {
    return (
      <View style={styles.container}>
        {children}
      </View>
    );
  }

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {children}
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
