import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { swipeCardManager } from '../services/swipeCardManager';

export interface SwipeableActionCardProps {
  id: string;
  isDark: boolean;
  disabled?: boolean;
  onEdit?: () => void;
  onDelete: () => void;
  onQuickDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  children: React.ReactNode;
}

const ACTION_BTN_WIDTH = 76;
const TOTAL_ACTIONS_WIDTH = ACTION_BTN_WIDTH * 2; // 152pt
const SNAP_THRESHOLD = -40;

export const SwipeableActionCard: React.FC<SwipeableActionCardProps> = ({
  id,
  isDark,
  disabled = false,
  onEdit,
  onDelete,
  onQuickDelete,
  editLabel = 'Редагувати',
  deleteLabel = 'Видалити',
  children,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const QUICK_DELETE_THRESHOLD = screenWidth * 0.5;

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isPastThreshold = useSharedValue(false);
  const isOpen = useSharedValue(false);
  const [isOpenState, setIsOpenState] = useState(false);

  // Sync open state to JS
  const syncOpen = useCallback((open: boolean) => {
    setIsOpenState(open);
    if (open) {
      swipeCardManager.setActive(id);
    } else if (swipeCardManager.getActiveId() === id) {
      swipeCardManager.setActive(null);
    }
  }, [id]);

  const triggerHaptic = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    try {
      Haptics.impactAsync(style);
    } catch {}
  }, []);

  const triggerSelectionHaptic = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  const handleQuickDelete = useCallback(() => {
    if (onQuickDelete) {
      onQuickDelete();
    } else {
      onDelete();
    }
  }, [onQuickDelete, onDelete]);

  const closeSwipe = useCallback(() => {
    translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
    isOpen.value = false;
    isPastThreshold.value = false;
    syncOpen(false);
  }, [translateX, isOpen, isPastThreshold, syncOpen]);

  // Auto-close if another card opens
  useEffect(() => {
    return swipeCardManager.subscribe((activeId) => {
      if (activeId !== id && isOpen.value) {
        translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
        isOpen.value = false;
        isPastThreshold.value = false;
        setIsOpenState(false);
      }
    });
  }, [id, translateX, isOpen, isPastThreshold]);

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onTouchesDown((e, stateManager) => {
      'worklet';
      const touch = e.allTouches[0];
      if (touch) {
        startX.value = touch.absoluteX;
        // If card is NOT open, swipe MUST start in right 20% of screen
        if (!isOpen.value && touch.absoluteX < screenWidth * 0.8) {
          stateManager.fail();
        }
      }
    })
    .onBegin((e) => {
      'worklet';
      startX.value = e.absoluteX;
    })
    .onUpdate((e) => {
      'worklet';
      // 1. If card is currently open: allow dragging right to close
      if (isOpen.value) {
        if (e.translationX > 0) {
          translateX.value = Math.min(0, -TOTAL_ACTIONS_WIDTH + e.translationX);
        }
        return;
      }

      // 2. Closed card swipe MUST start in the right 20% of the screen
      if (startX.value < screenWidth * 0.8) {
        return;
      }

      // 3. Only swiping left is allowed
      if (e.translationX < 0) {
        translateX.value = e.translationX;

        // Long swipe: quick delete threshold (> 50% screen width)
        const isOver = Math.abs(e.translationX) >= QUICK_DELETE_THRESHOLD;
        if (isOver !== isPastThreshold.value) {
          isPastThreshold.value = isOver;
          if (isOver) {
            runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      }
    })
    .onEnd((e) => {
      'worklet';
      // If card was open and dragged right
      if (isOpen.value) {
        if (e.translationX > 35) {
          // Snap closed
          translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
          isOpen.value = false;
          runOnJS(syncOpen)(false);
        } else {
          // Snap back to open
          translateX.value = withSpring(-TOTAL_ACTIONS_WIDTH, { damping: 20, stiffness: 220 });
        }
        return;
      }

      // Did not start in right 20%
      if (startX.value < screenWidth * 0.8) {
        return;
      }

      // Quick delete triggered past 50% width threshold
      if (isPastThreshold.value) {
        translateX.value = withTiming(-screenWidth, { duration: 180 }, (finished) => {
          if (finished) {
            runOnJS(handleQuickDelete)();
          }
        });
        return;
      }

      // Short swipe: check snap threshold
      if (translateX.value < SNAP_THRESHOLD) {
        translateX.value = withSpring(-TOTAL_ACTIONS_WIDTH, { damping: 20, stiffness: 220 });
        isOpen.value = true;
        runOnJS(triggerSelectionHaptic)();
        runOnJS(syncOpen)(true);
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
        isOpen.value = false;
        runOnJS(syncOpen)(false);
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      backgroundColor: isPastThreshold.value
        ? isDark
          ? '#3A1519'
          : '#FEE2E2'
        : isDark
          ? '#1D2939'
          : '#FFFFFF',
    };
  });

  const animatedQuickDeleteStyle = useAnimatedStyle(() => {
    return {
      opacity: isPastThreshold.value ? 1 : 0,
    };
  });

  const animatedNormalActionsStyle = useAnimatedStyle(() => {
    return {
      opacity: isPastThreshold.value ? 0 : 1,
    };
  });

  return (
    <View
      style={[
        styles.swipeContainer,
        {
          borderColor: isDark ? '#334155' : '#E2E8F0',
          backgroundColor: isDark ? '#1D2939' : '#FFFFFF',
        },
      ]}
    >
      {/* Background Actions Row */}
      <View style={styles.swipeActionsBg}>
        {/* Quick Delete Overlay (> 50% long swipe) */}
        <Animated.View style={[styles.quickDeleteBar, animatedQuickDeleteStyle]}>
          <Ionicons name="trash" size={24} color="#FFFFFF" />
          <Text style={styles.quickDeleteText}>Відпустіть, щоб видалити</Text>
        </Animated.View>

        {/* Normal Actions: Edit (blue) and Delete (red) */}
        <Animated.View style={[styles.normalActionsRow, animatedNormalActionsStyle]}>
          {onEdit && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                closeSwipe();
                onEdit();
              }}
              style={styles.actionBtnEdit}
              accessibilityRole="button"
              accessibilityLabel={editLabel}
            >
              <Ionicons name="pencil" size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>{editLabel}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              closeSwipe();
              onDelete();
            }}
            style={styles.actionBtnDelete}
            accessibilityRole="button"
            accessibilityLabel={deleteLabel}
          >
            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>{deleteLabel}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Foreground Card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.swipeForeground,
            animatedCardStyle,
            {
              borderRightWidth: StyleSheet.hairlineWidth,
              borderRightColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              if (isOpenState) {
                closeSwipe();
              }
            }}
            disabled={!isOpenState}
          >
            {children}
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  swipeContainer: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  swipeActionsBg: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    backgroundColor: '#EF4444',
  },
  quickDeleteBar: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 24,
    gap: 10,
  },
  quickDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  normalActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: TOTAL_ACTIONS_WIDTH,
  },
  actionBtnEdit: {
    width: ACTION_BTN_WIDTH,
    backgroundColor: '#2563EB', // Ocean Blue primary
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionBtnDelete: {
    width: ACTION_BTN_WIDTH,
    backgroundColor: '#EF4444', // Danger Red
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  swipeForeground: {
    width: '100%',
  },
});
