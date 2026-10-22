import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from './ThemeContext';

export interface UndoItem {
  id: string;
  title?: string;
  type: 'workout' | 'exercise';
  onUndo: () => void | Promise<void>;
  onCommit: () => void | Promise<void>;
}

interface SwipeUndoContextType {
  showUndoToast: (item: UndoItem) => void;
  dismissUndo: () => void;
}

const SwipeUndoContext = createContext<SwipeUndoContextType | undefined>(undefined);

export const useSwipeUndo = () => {
  const ctx = useContext(SwipeUndoContext);
  if (!ctx) {
    throw new Error('useSwipeUndo must be used within a SwipeUndoProvider');
  }
  return ctx;
};

const UNDO_DURATION = 5000;

export const SwipeUndoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [activeItem, setActiveItem] = useState<UndoItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeItemRef = useRef<UndoItem | null>(null);
  activeItemRef.current = activeItem;

  // Animations
  const translateYAnim = useRef(new Animated.Value(80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  const commitCurrent = useCallback(() => {
    if (activeItemRef.current) {
      const item = activeItemRef.current;
      setActiveItem(null);
      activeItemRef.current = null;
      try {
        item.onCommit();
      } catch (err) {
        console.error('[SwipeUndo] Error during onCommit:', err);
      }
    }
  }, []);

  const dismissToast = useCallback(
    (animate = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (animate) {
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: 60,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setActiveItem(null);
          activeItemRef.current = null;
        });
      } else {
        opacityAnim.setValue(0);
        translateYAnim.setValue(60);
        setActiveItem(null);
        activeItemRef.current = null;
      }
    },
    [opacityAnim, translateYAnim]
  );

  const showUndoToast = useCallback(
    (item: UndoItem) => {
      // If there is already an item pending, commit it immediately
      if (activeItemRef.current) {
        commitCurrent();
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setActiveItem(item);
      activeItemRef.current = item;

      // Reset animations
      translateYAnim.setValue(60);
      opacityAnim.setValue(0);
      progressAnim.setValue(1);

      // Trigger appearance
      Animated.parallel([
        Animated.spring(translateYAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: UNDO_DURATION,
          useNativeDriver: false,
        }),
      ]).start();

      // Auto commit after 5 seconds
      timerRef.current = setTimeout(() => {
        dismissToast(true);
        if (activeItemRef.current?.id === item.id) {
          try {
            item.onCommit();
          } catch (e) {
            console.error('[SwipeUndo] Commit failed:', e);
          }
          activeItemRef.current = null;
          setActiveItem(null);
        }
      }, UNDO_DURATION);
    },
    [commitCurrent, dismissToast, opacityAnim, progressAnim, translateYAnim]
  );

  const handleUndoPress = useCallback(async () => {
    if (!activeItem) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const itemToUndo = activeItem;
    dismissToast(true);

    try {
      await itemToUndo.onUndo();
    } catch (err) {
      console.error('[SwipeUndo] Undo action failed:', err);
    }
  }, [activeItem, dismissToast]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (activeItemRef.current) {
        try {
          activeItemRef.current.onCommit();
        } catch {}
      }
    };
  }, []);

  const toastBottom = Math.max(insets.bottom, 12) + 72; // Float safely above tab bar

  return (
    <SwipeUndoContext.Provider value={{ showUndoToast, dismissUndo: () => dismissToast(true) }}>
      {children}

      {activeItem && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              bottom: toastBottom,
              width: Math.min(screenWidth - 32, 420),
              transform: [{ translateY: translateYAnim }],
              opacity: opacityAnim,
              backgroundColor: isDark ? '#1D2939' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.toastInner}>
            <View style={styles.toastLeft}>
              <View style={[styles.iconWrap, { backgroundColor: isDark ? '#263140' : '#F1F5F9' }]}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </View>
              <View style={styles.textWrap}>
                <Text style={[styles.toastTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]} numberOfLines={1}>
                  Видалено
                </Text>
                {activeItem.title ? (
                  <Text style={[styles.toastSub, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                    {activeItem.title}
                  </Text>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleUndoPress}
              style={styles.undoBtn}
              accessibilityLabel="Скасувати видалення"
            >
              <Ionicons name="arrow-undo" size={15} color="#2563EB" />
              <Text style={styles.undoText}>Скасувати</Text>
            </TouchableOpacity>
          </View>

          {/* 5-second animated progress bar */}
          <View style={[styles.progressTrack, { backgroundColor: isDark ? '#263140' : '#F1F5F9' }]}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </Animated.View>
      )}
    </SwipeUndoContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 9999,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  toastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  toastSub: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
  },
  undoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  progressTrack: {
    height: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
});
