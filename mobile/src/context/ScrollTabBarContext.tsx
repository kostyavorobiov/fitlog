import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import {
  Animated,
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
  const [isTabBarVisible, setIsTabBarVisibleState] = useState(true);
  const isTabBarVisibleRef = useRef(true);
  const translateY = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const accumulatedDelta = useRef(0);
  const lastToggleTime = useRef(0);

  const setTabBarVisible = useCallback((visible: boolean) => {
    isTabBarVisibleRef.current = visible;
    setIsTabBarVisibleState(visible);
    lastToggleTime.current = Date.now();

    Animated.spring(translateY, {
      toValue: visible ? 0 : 120,
      useNativeDriver: Platform.OS !== 'web',
      overshootClamping: true,
      tension: 80,
      friction: 14,
    }).start();

    Animated.timing(headerAnim, {
      toValue: visible ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [translateY, headerAnim]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const contentHeight = event.nativeEvent.contentSize?.height || 0;
      const layoutHeight = event.nativeEvent.layoutMeasurement?.height || 0;
      const diff = currentY - lastScrollY.current;

      // Always show when near the top (and ignore top overscroll bounce)
      if (currentY <= 15) {
        if (!isTabBarVisibleRef.current) {
          setTabBarVisible(true);
        }
        accumulatedDelta.current = 0;
        lastScrollY.current = Math.max(0, currentY);
        return;
      }

      // Avoid rubber-band bounce near the bottom on iOS
      if (contentHeight > 0 && layoutHeight > 0 && currentY >= contentHeight - layoutHeight - 10) {
        lastScrollY.current = currentY;
        return;
      }

      const now = Date.now();
      const canToggle = now - lastToggleTime.current >= 200;

      // Scrolling down -> hide tab bar and top navbar
      if (diff > 8 && currentY > 30) {
        if (accumulatedDelta.current < 0) accumulatedDelta.current = 0;
        accumulatedDelta.current += diff;

        if (isTabBarVisibleRef.current && canToggle && accumulatedDelta.current >= 20) {
          setTabBarVisible(false);
        }
      }
      // Scrolling up -> show tab bar and top navbar immediately
      else if (diff < -6) {
        if (accumulatedDelta.current > 0) accumulatedDelta.current = 0;
        accumulatedDelta.current += diff;

        if (!isTabBarVisibleRef.current && canToggle && accumulatedDelta.current <= -16) {
          setTabBarVisible(true);
        }
      }

      lastScrollY.current = currentY;
    },
    [setTabBarVisible]
  );

  return (
    <ScrollTabBarContext.Provider
      value={{
        isTabBarVisible,
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
