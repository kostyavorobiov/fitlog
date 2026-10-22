import React, { useRef, useMemo } from 'react';
import { View, StyleSheet, PanResponder, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
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

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,

        onMoveShouldSetPanResponderCapture: () => false,

        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (isNavigatingRef.current) return false;

          // Do not switch tabs if any card is currently swiped open
          if (swipeCardManager.hasActiveCard()) {
            return false;
          }

          const startX = gestureState.x0;
          const isLeft20 = startX < screenWidth * 0.2;
          const isCenter60 = startX >= screenWidth * 0.2 && startX <= screenWidth * 0.8;
          const isRight20 = startX > screenWidth * 0.8;

          // Right 20% strictly belongs to card actions - NEVER intercept here
          if (isRight20) {
            return false;
          }

          // Strict horizontal intent check (avoid interfering with vertical scroll)
          const isHorizontal = Math.abs(gestureState.dx) > 16;
          const dominatesVertical = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2.0;

          if (!isHorizontal || !dominatesVertical) {
            return false;
          }

          // Left 20%: Back navigation
          if (isLeft20 && enableBackSwipe) {
            // Must be swiping right to go back
            if (gestureState.dx > 15 && router.canGoBack()) {
              // On iOS, system edge gesture handles extreme edge (0-24pt).
              // We handle touches between 24pt and 20% width to prevent double firing.
              if (Platform.OS === 'ios' && startX < 24) {
                return false;
              }
              return true;
            }
            return false;
          }

          // Center 60%: Tab navigation
          if (isCenter60 && enableTabSwipe && currentTab && tabOrder.length > 0) {
            const currentIndex = tabOrder.indexOf(currentTab);
            if (currentIndex === -1) return false;

            // Swiping left (next tab)
            if (gestureState.dx < -15 && currentIndex < tabOrder.length - 1) {
              return true;
            }
            // Swiping right (prev tab)
            if (gestureState.dx > 15 && currentIndex > 0) {
              return true;
            }
          }

          return false;
        },

        onPanResponderTerminationRequest: () => true,

        onPanResponderRelease: (_, gestureState) => {
          if (isNavigatingRef.current) return;

          const startX = gestureState.x0;
          const isLeft20 = startX < screenWidth * 0.2;
          const isCenter60 = startX >= screenWidth * 0.2 && startX <= screenWidth * 0.8;

          // 1. Back navigation in left 20%
          if (isLeft20 && enableBackSwipe && gestureState.dx > 45) {
            if (router.canGoBack()) {
              isNavigatingRef.current = true;
              try {
                Haptics.selectionAsync();
              } catch {}
              router.back();
              setTimeout(() => {
                isNavigatingRef.current = false;
              }, 500);
              return;
            }
          }

          // 2. Tab navigation in central 60%
          if (isCenter60 && enableTabSwipe && currentTab && tabOrder.length > 0) {
            const currentIndex = tabOrder.indexOf(currentTab);
            if (currentIndex === -1) return;

            const isSwipeLeft = gestureState.dx < -50 || gestureState.vx < -0.4;
            const isSwipeRight = gestureState.dx > 50 || gestureState.vx > 0.4;

            if (isSwipeLeft && currentIndex < tabOrder.length - 1) {
              // Next tab
              const nextTab = tabOrder[currentIndex + 1];
              isNavigatingRef.current = true;
              try {
                Haptics.selectionAsync();
              } catch {}
              if (onTabChange) {
                onTabChange(nextTab);
              } else {
                router.replace(nextTab === 'index' ? '/(tabs)' : (`/(tabs)/${nextTab}` as any));
              }
              setTimeout(() => {
                isNavigatingRef.current = false;
              }, 400);
            } else if (isSwipeRight && currentIndex > 0) {
              // Previous tab
              const prevTab = tabOrder[currentIndex - 1];
              isNavigatingRef.current = true;
              try {
                Haptics.selectionAsync();
              } catch {}
              if (onTabChange) {
                onTabChange(prevTab);
              } else {
                router.replace(prevTab === 'index' ? '/(tabs)' : (`/(tabs)/${prevTab}` as any));
              }
              setTimeout(() => {
                isNavigatingRef.current = false;
              }, 400);
            }
          }
        },

        onPanResponderTerminate: () => {},
      }),
    [
      screenWidth,
      currentTab,
      tabOrder,
      enableBackSwipe,
      enableTabSwipe,
      onTabChange,
      router,
    ]
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
