import React, { useRef, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
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

  const panX = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const isOpenRef = useRef(false);
  const isPastThresholdRef = useRef(false);
  const [isPastThreshold, setIsPastThreshold] = useState(false);

  // Auto-close if another card opens
  useEffect(() => {
    return swipeCardManager.subscribe((activeId) => {
      if (activeId !== id && isOpenRef.current) {
        closeSwipe();
      }
    });
  }, [id]);

  const closeSwipe = () => {
    if (isOpenRef.current) {
      isOpenRef.current = false;
      setIsPastThreshold(false);
      isPastThresholdRef.current = false;
      Animated.spring(panX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
      if (swipeCardManager.getActiveId() === id) {
        swipeCardManager.setActive(null);
      }
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,

        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (disabled) return false;

          // If card is already open, any rightward swipe closes it
          if (isOpenRef.current) {
            return (
              Math.abs(gestureState.dx) > 10 &&
              Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
            );
          }

          // Card swipe MUST start in the right 20% of the screen
          const isRight20 = gestureState.x0 >= screenWidth * 0.8;
          if (!isRight20) return false;

          // Must be horizontal gesture towards left with horizontal dominating vertical
          const isHorizontal = Math.abs(gestureState.dx) > 12;
          const isLeft = gestureState.dx < -5;
          const dominatesVertical = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;

          return isHorizontal && isLeft && dominatesVertical;
        },

        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (disabled) return false;

          if (isOpenRef.current) {
            return (
              Math.abs(gestureState.dx) > 10 &&
              Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
            );
          }

          const isRight20 = gestureState.x0 >= screenWidth * 0.8;
          if (!isRight20) return false;

          const isHorizontal = Math.abs(gestureState.dx) > 12;
          const isLeft = gestureState.dx < -5;
          const dominatesVertical = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;

          return isHorizontal && isLeft && dominatesVertical;
        },

        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: () => {
          panX.stopAnimation();
          swipeCardManager.setActive(id);
        },

        onPanResponderMove: (_, gestureState) => {
          const base = isOpenRef.current ? -TOTAL_ACTIONS_WIDTH : 0;
          // Card only moves left (negative x) or back to 0
          const newX = Math.min(0, base + gestureState.dx);
          panX.setValue(newX);

          // Check long-swipe quick delete threshold (> 50% screen width)
          const isOver = Math.abs(newX) >= QUICK_DELETE_THRESHOLD;
          if (isOver !== isPastThresholdRef.current) {
            isPastThresholdRef.current = isOver;
            setIsPastThreshold(isOver);
            try {
              if (isOver) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } else {
                Haptics.selectionAsync();
              }
            } catch {}
          }
        },

        onPanResponderRelease: (_, gestureState) => {
          const currentVal = (panX as any)._value ?? 0;
          const isOver = Math.abs(currentVal) >= QUICK_DELETE_THRESHOLD;

          if (isOver) {
            // Quick delete triggered by long swipe!
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {}

            isOpenRef.current = false;
            setIsPastThreshold(false);
            isPastThresholdRef.current = false;
            swipeCardManager.setActive(null);

            // Animate card flying off screen and fading out
            Animated.parallel([
              Animated.timing(panX, {
                toValue: -screenWidth - 40,
                duration: 220,
                useNativeDriver: true,
              }),
              Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
              }),
            ]).start(() => {
              if (onQuickDelete) {
                onQuickDelete();
              } else {
                onDelete();
              }
            });
            return;
          }

          // Regular swipe release
          if (gestureState.dx < -30 || currentVal < SNAP_THRESHOLD) {
            // Snap open to reveal actions
            isOpenRef.current = true;
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
            Animated.spring(panX, {
              toValue: -TOTAL_ACTIONS_WIDTH,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          } else {
            // Snap closed
            isOpenRef.current = false;
            swipeCardManager.setActive(null);
            Animated.spring(panX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        },

        onPanResponderTerminate: () => {
          isOpenRef.current = false;
          setIsPastThreshold(false);
          isPastThresholdRef.current = false;
          swipeCardManager.setActive(null);
          Animated.spring(panX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [disabled, id, onDelete, onQuickDelete, panX, opacityAnim, screenWidth, QUICK_DELETE_THRESHOLD]
  );

  const handleEditPress = () => {
    closeSwipe();
    onEdit?.();
  };

  const handleDeletePress = () => {
    closeSwipe();
    onDelete();
  };

  if (disabled) {
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
        {children}
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.swipeContainer,
        {
          opacity: opacityAnim,
          borderColor: isDark ? '#334155' : '#E2E8F0',
          backgroundColor: isDark ? '#1D2939' : '#FFFFFF',
        },
      ]}
    >
      {/* Background Actions Layer */}
      <View style={styles.swipeActionsBg}>
        {isPastThreshold ? (
          /* Full danger bar when dragged > 50% width */
          <View style={styles.quickDeleteBar}>
            <Ionicons name="trash" size={24} color="#FFFFFF" />
            <Text style={styles.quickDeleteText}>Відпустіть, щоб видалити</Text>
          </View>
        ) : (
          /* Standard 2 actions: Edit (Blue) & Delete (Red) */
          <View style={styles.normalActionsRow}>
            {onEdit && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleEditPress}
                style={styles.actionBtnEdit}
                accessibilityLabel={editLabel}
              >
                <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>{editLabel}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleDeletePress}
              style={[styles.actionBtnDelete, !onEdit && { width: TOTAL_ACTIONS_WIDTH }]}
              accessibilityLabel={deleteLabel}
            >
              <Ionicons name="trash" size={20} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>{deleteLabel}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Foreground Card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.swipeForeground,
          {
            transform: [{ translateX: panX }],
            backgroundColor: isPastThreshold
              ? isDark
                ? '#3A1519'
                : '#FEE2E2'
              : isDark
                ? '#1D2939'
                : '#FFFFFF',
            borderRightWidth: StyleSheet.hairlineWidth,
            borderRightColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={closeSwipe}
          disabled={!isOpenRef.current}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
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
