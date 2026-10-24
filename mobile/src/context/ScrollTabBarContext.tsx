import React, { createContext, useContext, useRef, useCallback } from 'react';
import {
  Animated,
  Easing,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';

interface ScrollTabBarContextType {
  isTabBarVisible: boolean;
  setTabBarVisible: (visible: boolean) => void;
  translateY: Animated.Value;
  headerAnim: Animated.Value;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const ScrollTabBarContext = createContext<ScrollTabBarContextType | undefined>(undefined);

export const ScrollTabBarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isTabBarVisibleRef = useRef(true);
  const translateY = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const accumulatedDown = useRef(0);
  const accumulatedUp = useRef(0);

  const setTabBarVisible = useCallback((visible: boolean) => {
    if (isTabBarVisibleRef.current === visible) return;
    isTabBarVisibleRef.current = visible;

    Animated.timing(translateY, {
      toValue: visible ? 0 : 120,
      duration: 200,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    Animated.timing(headerAnim, {
      toValue: visible ? 0 : 1,
      duration: 200,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start();
  }, [translateY, headerAnim]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const contentHeight = event.nativeEvent.contentSize?.height || 0;
      const layoutHeight = event.nativeEvent.layoutMeasurement?.height || 0;
      const diff = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      // Always show when near the top (and ignore top overscroll bounce)
      if (currentY <= 25) {
        accumulatedDown.current = 0;
        accumulatedUp.current = 0;
        if (!isTabBarVisibleRef.current) {
          setTabBarVisible(true);
        }
        return;
      }

      // Check if past or at bottom overscroll on iOS
      const maxScrollY = contentHeight > layoutHeight ? contentHeight - layoutHeight : 0;
      const isPastBottom = maxScrollY > 0 && currentY >= maxScrollY;
      if (isPastBottom) {
        accumulatedDown.current = 0;
        accumulatedUp.current = 0;
        return;
      }

      // Hysteresis calculation to prevent rapid flickering / jumping:
      if (diff > 0) {
        // Scrolling down (finger swiping up)
        accumulatedUp.current = 0;
        accumulatedDown.current += diff;

        if (accumulatedDown.current > 12 && currentY > 25) {
          if (isTabBarVisibleRef.current) {
            setTabBarVisible(false);
          }
          accumulatedDown.current = 0;
        }
      } else if (diff < 0) {
        // Scrolling up (finger swiping down)
        accumulatedDown.current = 0;
        accumulatedUp.current += Math.abs(diff);

        if (accumulatedUp.current > 16) {
          if (!isTabBarVisibleRef.current) {
            setTabBarVisible(true);
          }
          accumulatedUp.current = 0;
        }
      }
    },
    [setTabBarVisible]
  );

  return (
    <ScrollTabBarContext.Provider
      value={{
        isTabBarVisible: isTabBarVisibleRef.current,
        setTabBarVisible,
        translateY,
        headerAnim,
        handleScroll,
      }}
    >
      {children}
    </ScrollTabBarContext.Provider>
  );
};

const fallbackTranslateY = new Animated.Value(0);
const fallbackHeaderAnim = new Animated.Value(0);
const defaultScrollTabBarFallback: ScrollTabBarContextType = {
  isTabBarVisible: true,
  setTabBarVisible: () => {},
  translateY: fallbackTranslateY,
  headerAnim: fallbackHeaderAnim,
  handleScroll: () => {},
};

export const useScrollTabBar = (): ScrollTabBarContextType => {
  const context = useContext(ScrollTabBarContext);
  return context || defaultScrollTabBarFallback;
};
