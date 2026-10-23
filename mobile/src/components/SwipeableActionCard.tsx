import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Alert,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
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
  containerStyle?: StyleProp<ViewStyle>;
  onEdit?: () => void;
  onCopy?: () => void;
  onDelete: (onCancel?: () => void) => void;
  onQuickDelete?: (onCancel?: () => void) => void;
  confirmTitle?: string;
  confirmMessage?: string;
  editLabel?: string;
  deleteLabel?: string;
  copyLabel?: string;
  children: React.ReactNode;
}

const NORMAL_BTN_WIDTH = 56;
const GAP = 6;
const PADDING_RIGHT = 6;
const SNAP_THRESHOLD = -32;

const TIMING_CONFIG = {
  duration: 220,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

export const SwipeableActionCard: React.FC<SwipeableActionCardProps> = ({
  id,
  isDark,
  disabled = false,
  containerStyle,
  onEdit,
  onCopy,
  onDelete,
  onQuickDelete,
  confirmTitle,
  confirmMessage,
  children,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const QUICK_DELETE_THRESHOLD = screenWidth * 0.5;

  const hasFirstAction = Boolean(onCopy || onEdit);
  const restingWidth = hasFirstAction
    ? NORMAL_BTN_WIDTH * 2 + GAP + PADDING_RIGHT
    : NORMAL_BTN_WIDTH + PADDING_RIGHT;

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

  const triggerMediumHaptic = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  }, []);

  const triggerSelectionHaptic = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  const closeSwipe = useCallback(() => {
    translateX.value = withTiming(0, TIMING_CONFIG);
    isOpen.value = false;
    isPastThreshold.value = false;
    syncOpen(false);
  }, [translateX, isOpen, isPastThreshold, syncOpen]);

  const handleDeleteAction = useCallback(() => {
    if (confirmTitle || confirmMessage) {
      Alert.alert(
        confirmTitle || 'Підтвердження видалення',
        confirmMessage || 'Ви впевнені, що хочете видалити цей елемент?',
        [
          {
            text: 'Скасувати',
            style: 'cancel',
            onPress: () => closeSwipe(),
          },
          {
            text: 'Видалити',
            style: 'destructive',
            onPress: () => {
              if (onQuickDelete) {
                onQuickDelete(closeSwipe);
              } else {
                onDelete(closeSwipe);
              }
            },
          },
        ]
      );
    } else {
      if (onQuickDelete) {
        onQuickDelete(closeSwipe);
      } else {
        onDelete(closeSwipe);
      }
    }
  }, [confirmTitle, confirmMessage, closeSwipe, onQuickDelete, onDelete]);

  // Auto-close if another card opens
  useEffect(() => {
    return swipeCardManager.subscribe((activeId) => {
      if (activeId !== id && isOpen.value) {
        translateX.value = withTiming(0, TIMING_CONFIG);
        isOpen.value = false;
        isPastThreshold.value = false;
        setIsOpenState(false);
      }
    });
  }, [id, translateX, isOpen, isPastThreshold]);

  // Clean up active card if unmounted while open
  useEffect(() => {
    return () => {
      if (swipeCardManager.getActiveId() === id) {
        swipeCardManager.setActive(null);
      }
    };
  }, [id]);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(!disabled)
      .activeOffsetX([-12, 12])
      .failOffsetY([-12, 12])
      .onTouchesDown((e, stateManager) => {
        'worklet';
        const touch = e.allTouches[0];
        if (touch) {
          startX.value = touch.absoluteX;
          // If card is NOT open, swipe MUST start in right 25% of screen
          if (!isOpen.value && touch.absoluteX < screenWidth * 0.75) {
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
            translateX.value = Math.min(0, -restingWidth + e.translationX);
          }
          return;
        }

        // 2. Closed card swipe MUST start in the right 25% of the screen
        if (startX.value < screenWidth * 0.75) {
          return;
        }

        // 3. Only swiping left is allowed
        if (e.translationX < 0) {
          translateX.value = e.translationX;

          // Quick delete threshold (> 50% screen width)
          const isOver = Math.abs(e.translationX) >= QUICK_DELETE_THRESHOLD;
          if (isOver !== isPastThreshold.value) {
            isPastThreshold.value = isOver;
            if (isOver) {
              runOnJS(triggerMediumHaptic)();
            }
          }
        }
      })
      .onEnd((e) => {
        'worklet';
        // If card was open and dragged right
        if (isOpen.value) {
          if (e.translationX > 28) {
            // Snap closed smoothly without bounce
            translateX.value = withTiming(0, TIMING_CONFIG);
            isOpen.value = false;
            runOnJS(syncOpen)(false);
          } else {
            // Return to resting open position
            translateX.value = withTiming(-restingWidth, TIMING_CONFIG);
          }
          return;
        }

        // Did not start in right 25%
        if (startX.value < screenWidth * 0.75) {
          return;
        }

        // Reached past 50% screen width threshold
        if (isPastThreshold.value) {
          // Snap to resting width smoothly and trigger standard delete confirmation
          translateX.value = withTiming(-restingWidth, TIMING_CONFIG);
          isOpen.value = true;
          runOnJS(syncOpen)(true);
          runOnJS(handleDeleteAction)();
          return;
        }

        // Short swipe: check snap threshold
        if (translateX.value < SNAP_THRESHOLD) {
          translateX.value = withTiming(-restingWidth, TIMING_CONFIG);
          isOpen.value = true;
          runOnJS(triggerSelectionHaptic)();
          runOnJS(syncOpen)(true);
        } else {
          translateX.value = withTiming(0, TIMING_CONFIG);
          isOpen.value = false;
          runOnJS(syncOpen)(false);
        }
      });
  }, [
    disabled,
    screenWidth,
    QUICK_DELETE_THRESHOLD,
    restingWidth,
    translateX,
    startX,
    isPastThreshold,
    isOpen,
    triggerMediumHaptic,
    triggerSelectionHaptic,
    syncOpen,
    handleDeleteAction,
  ]);

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const animatedFirstBtnStyle = useAnimatedStyle(() => {
    const currentPull = -translateX.value;
    if (currentPull <= restingWidth) {
      return { opacity: 1, transform: [{ scale: 1 }] };
    }
    const progress = Math.min(
      1,
      Math.max(0, (currentPull - restingWidth) / Math.max(1, QUICK_DELETE_THRESHOLD - restingWidth))
    );
    return {
      opacity: Math.max(0, 1 - progress),
      transform: [{ scale: Math.max(0.7, 1 - progress * 0.3) }],
    };
  });

  const animatedDeleteBtnStyle = useAnimatedStyle(() => {
    const currentPull = -translateX.value;
    if (currentPull <= restingWidth) {
      return { width: NORMAL_BTN_WIDTH };
    }
    const extra = currentPull - restingWidth;
    if (hasFirstAction) {
      const progress = Math.min(
        1,
        Math.max(0, (currentPull - restingWidth) / Math.max(1, QUICK_DELETE_THRESHOLD - restingWidth))
      );
      const spaceAbsorbed = (NORMAL_BTN_WIDTH + GAP) * progress;
      return {
        width: NORMAL_BTN_WIDTH + extra + spaceAbsorbed,
      };
    }
    return {
      width: NORMAL_BTN_WIDTH + extra,
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
        containerStyle,
      ]}
    >
      {/* Background Actions Row with full-height rounded buttons */}
      <View style={styles.swipeActionsBg}>
        {hasFirstAction && (
          <Animated.View style={[styles.btnWrapper, animatedFirstBtnStyle]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                closeSwipe();
                if (onCopy) onCopy();
                else if (onEdit) onEdit();
              }}
              style={styles.actionBtnFirst}
              accessibilityRole="button"
              accessibilityLabel={onCopy ? 'Копіювати' : 'Редагувати'}
            >
              <Ionicons
                name={onCopy ? 'copy-outline' : 'pencil'}
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        <Animated.View style={[styles.btnWrapper, animatedDeleteBtnStyle]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleDeleteAction}
            style={styles.actionBtnDelete}
            accessibilityRole="button"
            accessibilityLabel="Видалити"
          >
            <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
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
              backgroundColor: isDark ? '#1D2939' : '#FFFFFF',
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
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: PADDING_RIGHT,
    gap: GAP,
    backgroundColor: 'transparent',
  },
  btnWrapper: {
    height: '100%',
  },
  actionBtnFirst: {
    width: NORMAL_BTN_WIDTH,
    height: '100%',
    borderRadius: 16,
    backgroundColor: '#2563EB', // Ocean Blue primary
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDelete: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: '#EF4444', // Danger Red
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeForeground: {
    width: '100%',
  },
});
