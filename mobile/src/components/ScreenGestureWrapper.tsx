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
  children: React.ReactNode;
}

export const ScreenGestureWrapper: React.FC<ScreenGestureWrapperProps> = ({
  currentTab,
  tabOrder = ['index', 'calendar', 'analytics', 'exercises'],
  onTabChange,
  enableTabSwipe = true,
  enableBackSwipe = true,
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
    if (isNavigatingRef.current) return;
    if (!router.canGoBack()) return;

    isNavigatingRef.current = true;
    try {
      Haptics.selectionAsync();
    } catch {}
    router.back();

    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 450);
  }, [enableBackSwipe, router]);

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

        // 2. Left 20%: Back navigation on right swipe
        if (sX < screenWidth * 0.2) {
          if (dx > 35) {
            // On iOS, system edge swipe handles extreme edge (0-24pt)
            if (isIOS && sX < 24) {
              return;
            }
            runOnJS(handleBackNavigation)();
          }
          return;
        }

        // 3. Central 60%: Tab navigation on horizontal swipe
        if (sX >= screenWidth * 0.2 && sX <= screenWidth * 0.8) {
          const isSwipeLeft = dx < -45 || vx < -350;
          const isSwipeRight = dx > 45 || vx > 350;

          if (isSwipeLeft) {
            runOnJS(handleNextTab)();
          } else if (isSwipeRight) {
            runOnJS(handlePrevTab)();
          }
        }
      });
  }, [screenWidth, isIOS, handleBackNavigation, handleNextTab, handlePrevTab, startX]);

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
