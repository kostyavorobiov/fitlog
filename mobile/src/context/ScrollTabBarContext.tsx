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

  const setTabBarVisible = useCallback((visible: boolean) => {
    isTabBarVisibleRef.current = visible;
    setIsTabBarVisibleState(visible);

    Animated.spring(translateY, {
      toValue: visible ? 0 : 120,
      useNativeDriver: Platform.OS !== 'web',
      overshootClamping: true,
      tension: 85,
      friction: 14,
    }).start();

    Animated.spring(headerAnim, {
      toValue: visible ? 0 : 1,
      tension: 85,
      friction: 14,
      overshootClamping: true,
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
        lastScrollY.current = Math.max(0, currentY);
        return;
      }

      // Check if past or at bottom overscroll on iOS
      const maxScrollY = contentHeight > layoutHeight ? contentHeight - layoutHeight : 0;
      const isPastBottom = maxScrollY > 0 && currentY >= maxScrollY;

      // Scrolling down -> hide tab bar and top navbar on minimal swipe
      if ((diff > 8 || diff > 2) && currentY > 15) {
        if (isTabBarVisibleRef.current) {
          setTabBarVisible(false);
        }
      }
      // Scrolling up -> show tab bar and top navbar immediately (ignore rubber-band bounce from past bottom)
      else if (diff < -6 && !isPastBottom) {
        if (!isTabBarVisibleRef.current) {
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
