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
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const ScrollTabBarContext = createContext<ScrollTabBarContextType | undefined>(undefined);

export const ScrollTabBarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isTabBarVisible, setIsTabBarVisibleState] = useState(true);
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isAnimating = useRef(false);

  const setTabBarVisible = useCallback((visible: boolean) => {
    setIsTabBarVisibleState(visible);
    Animated.spring(translateY, {
      toValue: visible ? 0 : 120,
      useNativeDriver: Platform.OS !== 'web',
      tension: 80,
      friction: 12,
    }).start();
  }, [translateY]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const diff = currentY - lastScrollY.current;

      // Always show when near the top
      if (currentY <= 15) {
        if (!isTabBarVisible) {
          setTabBarVisible(true);
        }
        lastScrollY.current = currentY;
        return;
      }

      // Scrolling down -> hide tab bar
      if (diff > 8 && currentY > 30) {
        if (isTabBarVisible) {
          setTabBarVisible(false);
        }
      }
      // Scrolling up -> show tab bar immediately
      else if (diff < -6) {
        if (!isTabBarVisible) {
          setTabBarVisible(true);
        }
      }

      lastScrollY.current = currentY;
    },
    [isTabBarVisible, setTabBarVisible]
  );

  return (
    <ScrollTabBarContext.Provider
      value={{
        isTabBarVisible,
        setTabBarVisible,
        translateY,
        handleScroll,
      }}
    >
      {children}
    </ScrollTabBarContext.Provider>
  );
};

export const useScrollTabBar = (): ScrollTabBarContextType => {
  const context = useContext(ScrollTabBarContext);
  if (!context) {
    // Return safe fallback if used outside provider
    const fallbackTranslateY = new Animated.Value(0);
    return {
      isTabBarVisible: true,
      setTabBarVisible: () => {},
      translateY: fallbackTranslateY,
      handleScroll: () => {},
    };
  }
  return context;
};
