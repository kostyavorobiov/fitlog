import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
  Easing,
  NativeSyntheticEvent,
  NativeScrollEvent,
  BackHandler,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ExerciseSelectorModal } from '../components/ExerciseSelectorModal';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/authService';
import { WorkoutService } from '../services/workoutService';
import { TemplateService } from '../services/templateService';
import { ExerciseService } from '../services/exerciseService';
import {
  WorkoutPlan,
  WorkoutExercise,
  WorkoutSet,
  Exercise,
  MuscleGroup,
  MUSCLE_GROUPS,
  PastExercisePerformance,
  REPS_RANGES,
  DEFAULT_REPS_RANGES,
} from '../types/workout';

import { SupersetPalette, SUPERSET_PALETTES, getSupersetPalette } from '../constants/supersets';
import { getExercise1RM, format1RM, getMinRepsFromRange } from '../utils/workout';
import { SwipeableActionCard } from '../components/SwipeableActionCard';
import { ScreenGestureWrapper } from '../components/ScreenGestureWrapper';
import { DatePickerModal } from '../components/DatePickerModal';
import { formatDateDDMMYYYY } from '../utils/date';
import { setSavedActiveTab } from '../components/InstagramTabPager';

export const computeWorkoutStatus = (exercises: WorkoutExercise[]): 'completed' | 'in_progress' => {
  if (!exercises || exercises.length === 0) return 'in_progress';
  const totalSets = exercises.reduce((acc, ex) => acc + (ex.sets ? ex.sets.length : 0), 0);
  if (totalSets === 0) return 'in_progress';
  const allSetsDone = exercises.every(
    (ex) => ex.sets && ex.sets.length > 0 && ex.sets.every((s) => Boolean(s.completedAt))
  );
  return allSetsDone ? 'completed' : 'in_progress';
};

export function generateSupersetGroupId(): string {
  return `ss_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function normalizeSupersetGroupId(id?: string | null): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  return trimmed;
}

export function ensureContiguousSupersets(exercises: WorkoutExercise[]): WorkoutExercise[] {
  if (!exercises || exercises.length === 0) return [];

  // 1. Normalize all supersetGroupIds first
  const normalized = exercises.map((ex) => ({
    ...ex,
    supersetGroupId: normalizeSupersetGroupId(ex.supersetGroupId),
  }));

  // 2. Clean up orphan groups (groups with <= 1 exercise)
  const groupCounts = new Map<string, number>();
  for (const ex of normalized) {
    if (ex.supersetGroupId) {
      groupCounts.set(ex.supersetGroupId, (groupCounts.get(ex.supersetGroupId) || 0) + 1);
    }
  }

  const cleaned = normalized.map((ex) => {
    if (ex.supersetGroupId && (groupCounts.get(ex.supersetGroupId) || 0) <= 1) {
      return { ...ex, supersetGroupId: null };
    }
    return ex;
  });

  // 3. Ensure contiguous arrangement
  const result: WorkoutExercise[] = [];
  const handledGroups = new Set<string>();

  for (const ex of cleaned) {
    if (!ex.supersetGroupId) {
      result.push(ex);
    } else {
      if (!handledGroups.has(ex.supersetGroupId)) {
        handledGroups.add(ex.supersetGroupId);
        const groupMembers = cleaned.filter((e) => e.supersetGroupId === ex.supersetGroupId);
        result.push(...groupMembers);
      }
    }
  }

  // 4. Renumber order 1..N
  return result.map((ex, idx) => ({
    ...ex,
    order: idx + 1,
  }));
}

export function combineExercisesIntoSuperset(
  exercises: WorkoutExercise[],
  draggedId: string,
  targetId: string
): WorkoutExercise[] {
  if (!exercises || exercises.length === 0 || draggedId === targetId) {
    return exercises || [];
  }

  const cleanedInput = ensureContiguousSupersets(exercises);
  const dragged = cleanedInput.find((e) => e.id === draggedId);
  const target = cleanedInput.find((e) => e.id === targetId);
  if (!dragged || !target) return cleanedInput;

  // Already in the same superset
  if (
    dragged.supersetGroupId &&
    target.supersetGroupId &&
    dragged.supersetGroupId === target.supersetGroupId
  ) {
    return cleanedInput;
  }

  // Final superset group ID:
  // If target already belongs to a superset, dragged joins target's superset.
  // Otherwise, create a brand-new superset with a guaranteed unique ID.
  const finalGroupId = target.supersetGroupId || generateSupersetGroupId();

  // Remove dragged exercise from list
  const withoutDragged = cleanedInput.filter((e) => e.id !== draggedId);

  // If dragged was previously in another superset, clean up its old group if it only has <=1 member left
  const oldDraggedGroup = dragged.supersetGroupId;
  let preparedList = withoutDragged;
  if (oldDraggedGroup) {
    const remainingInOld = preparedList.filter((e) => e.supersetGroupId === oldDraggedGroup);
    if (remainingInOld.length <= 1) {
      preparedList = preparedList.map((e) =>
        e.supersetGroupId === oldDraggedGroup ? { ...e, supersetGroupId: null } : e
      );
    }
  }

  // Updated dragged exercise
  const updatedDragged: WorkoutExercise = { ...dragged, supersetGroupId: finalGroupId };

  // Find target index in preparedList
  const targetIndex = preparedList.findIndex((e) => e.id === targetId);
  if (targetIndex === -1) return cleanedInput;

  // If target had no superset group yet, assign finalGroupId to target
  if (!preparedList[targetIndex].supersetGroupId) {
    preparedList[targetIndex] = { ...preparedList[targetIndex], supersetGroupId: finalGroupId };
  }

  // Insert dragged strictly at the END of target's superset group
  const groupIndices: number[] = [];
  preparedList.forEach((e, idx) => {
    if (e.supersetGroupId === finalGroupId) {
      groupIndices.push(idx);
    }
  });

  const lastMemberIndex = groupIndices.length > 0 ? Math.max(...groupIndices) : targetIndex;
  const insertIndex = lastMemberIndex + 1;

  const newExercises = [
    ...preparedList.slice(0, insertIndex),
    updatedDragged,
    ...preparedList.slice(insertIndex),
  ];

  return ensureContiguousSupersets(newExercises);
}

export function removeExerciseFromSuperset(
  exercises: WorkoutExercise[],
  draggedId: string,
  targetPosition: 'above' | 'below' | 'stay' = 'stay'
): WorkoutExercise[] {
  if (!exercises || exercises.length === 0) return exercises || [];

  const cleanedInput = ensureContiguousSupersets(exercises);
  const draggedIndex = cleanedInput.findIndex((e) => e.id === draggedId);
  if (draggedIndex === -1) return cleanedInput;

  const dragged = cleanedInput[draggedIndex];
  const oldGroupId = normalizeSupersetGroupId(dragged.supersetGroupId);
  if (!oldGroupId) return cleanedInput;

  // Find all indices of exercises in this superset
  const groupIndices = cleanedInput
    .map((e, idx) => (e.supersetGroupId === oldGroupId ? idx : -1))
    .filter((idx) => idx !== -1);
  const minGroupIndex = groupIndices.length > 0 ? Math.min(...groupIndices) : draggedIndex;
  const maxGroupIndex = groupIndices.length > 0 ? Math.max(...groupIndices) : draggedIndex;

  const unlinkedDragged: WorkoutExercise = {
    ...dragged,
    supersetGroupId: null,
  };

  const withoutDragged = cleanedInput.filter((e) => e.id !== draggedId);

  // If only 1 exercise remains in the superset, automatically dissolve it
  const remainingMembers = withoutDragged.filter((e) => e.supersetGroupId === oldGroupId);
  const shouldDissolveGroup = remainingMembers.length <= 1;

  const processedList = withoutDragged.map((e) =>
    e.supersetGroupId === oldGroupId && shouldDissolveGroup
      ? { ...e, supersetGroupId: null }
      : e
  );

  let insertIndex: number;
  if (targetPosition === 'above') {
    insertIndex = Math.max(0, minGroupIndex);
  } else if (targetPosition === 'below') {
    const remainingIndices = withoutDragged
      .map((e, idx) => (groupIndices.includes(idx >= draggedIndex ? idx + 1 : idx) ? idx : -1))
      .filter((idx) => idx !== -1);
    const lastRemainingIdx =
      remainingIndices.length > 0 ? Math.max(...remainingIndices) : Math.max(0, maxGroupIndex - 1);
    insertIndex = Math.min(processedList.length, lastRemainingIdx + 1);
  } else {
    insertIndex = Math.min(processedList.length, maxGroupIndex);
  }

  const updatedList = [
    ...processedList.slice(0, insertIndex),
    unlinkedDragged,
    ...processedList.slice(insertIndex),
  ];

  return ensureContiguousSupersets(updatedList);
}

const safeHaptic = (type: 'medium' | 'light' | 'success') => {
  try {
    if (Platform.OS !== 'web') {
      if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch {
    // ignore
  }
};

interface DraggableExerciseItemProps {
  exerciseId: string;
  scrollRef?: React.RefObject<any>;
  isHoveredTarget: boolean;
  isUnlinkTarget?: boolean;
  isDark: boolean;
  onDragStart: (id: string, initialY: number, screenY: number) => void;
  onDragUpdate: (id: string, translationX: number, translationY: number, screenY: number) => void;
  onDragEnd: (id: string) => void;
  onMeasureLayout: (id: string, y: number, height: number) => void;
  children: React.ReactNode;
}

const DraggableExerciseItem: React.FC<DraggableExerciseItemProps> = React.memo(({
  exerciseId,
  scrollRef,
  isHoveredTarget,
  isUnlinkTarget = false,
  isDark,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  onMeasureLayout,
  children,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(1);
  const isDragActive = useSharedValue(false);
  const lastUpdateCallTime = useSharedValue(0);

  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragUpdateRef = useRef(onDragUpdate);
  onDragUpdateRef.current = onDragUpdate;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  const panGesture = useMemo(() => {
    let g = Gesture.Pan()
      .activateAfterLongPress(250)
      .shouldCancelWhenOutside(false);

    if (scrollRef) {
      g = g.blocksExternalGesture(scrollRef);
    }

    return g
      .onStart((e) => {
        'worklet';
        isDragActive.value = true;
        scale.value = withTiming(1.03, { duration: 150 });
        zIndex.value = 9999;
        runOnJS(safeHaptic)('medium');
        runOnJS(onDragStartRef.current)(exerciseId, e.y, e.absoluteY);
      })
      .onUpdate((e) => {
        'worklet';
        if (!isDragActive.value) return;
        translateX.value = e.translationX;
        translateY.value = e.translationY;

        const now = Date.now();
        if (now - lastUpdateCallTime.value >= 16) {
          lastUpdateCallTime.value = now;
          runOnJS(onDragUpdateRef.current)(exerciseId, e.translationX, e.translationY, e.absoluteY);
        }
      })
      .onEnd((e) => {
        'worklet';
        if (isDragActive.value) {
          runOnJS(onDragUpdateRef.current)(exerciseId, e.translationX, e.translationY, e.absoluteY);
          isDragActive.value = false;
          translateX.value = withTiming(0, { duration: 180 });
          translateY.value = withTiming(0, { duration: 180 });
          scale.value = withTiming(1, { duration: 180 });
          zIndex.value = 1;
          runOnJS(onDragEndRef.current)(exerciseId);
        }
      })
      .onFinalize(() => {
        'worklet';
        if (isDragActive.value) {
          isDragActive.value = false;
          translateX.value = withTiming(0, { duration: 180 });
          translateY.value = withTiming(0, { duration: 180 });
          scale.value = withTiming(1, { duration: 180 });
          zIndex.value = 1;
          runOnJS(onDragEndRef.current)(exerciseId);
        }
      });
  }, [exerciseId, scrollRef]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      zIndex: zIndex.value,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: isDragActive.value ? 10 : 0 },
      shadowOpacity: isDragActive.value ? 0.35 : 0,
      shadowRadius: isDragActive.value ? 16 : 0,
      elevation: isDragActive.value ? 12 : 0,
      opacity: isDragActive.value ? 0.96 : 1,
    };
  });

  return (
    <View
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        onMeasureLayout(exerciseId, y, height);
      }}
      style={styles.draggableItemContainer}
    >
      <GestureDetector gesture={panGesture}>
        <AnimatedReanimated.View
          style={[
            styles.draggableCardWrapper,
            animatedStyle,
            isHoveredTarget && (isDark ? styles.cardHoveredTargetDark : styles.cardHoveredTargetLight),
            isUnlinkTarget && (isDark ? styles.cardUnlinkTargetDark : styles.cardUnlinkTargetLight),
          ]}
        >
          {isHoveredTarget && (
            <View style={styles.hoverTargetBadge}>
              <Ionicons name="link" size={13} color="#10b981" />
              <Text style={styles.hoverTargetBadgeText}>Об'єднати в суперсет</Text>
            </View>
          )}
          {isUnlinkTarget && (
            <View style={styles.unlinkTargetBadge}>
              <Ionicons name="unlink" size={13} color="#f59e0b" />
              <Text style={styles.unlinkTargetBadgeText}>Прибрати з суперсету</Text>
            </View>
          )}
          {children}
        </AnimatedReanimated.View>
      </GestureDetector>
    </View>
  );
});

const TITLE_PRESETS = [
  'Груди та Тріцепс',
  'Спина та Біцепс',
  'День ніг',
  'Плечі та Прес',
  'Full Body',
  'Кардіо + Кор',
];

interface SwipeableExerciseCardProps {
  id: string;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  cardBackgroundColor?: string;
  borderColor?: string;
  onDelete: (onCancel?: () => void) => void;
  onQuickDelete?: (onCancel?: () => void) => void;
  confirmTitle?: string;
  confirmMessage?: string;
  onChangeExercise?: () => void;
  isDark: boolean;
  children: React.ReactNode;
}

const SwipeableExerciseCard: React.FC<SwipeableExerciseCardProps> = ({
  id,
  disabled = false,
  containerStyle,
  cardBackgroundColor,
  borderColor,
  onDelete,
  onQuickDelete,
  confirmTitle,
  confirmMessage,
  onChangeExercise,
  isDark,
  children,
}) => {
  return (
    <SwipeableActionCard
      id={id}
      disabled={disabled}
      containerStyle={containerStyle}
      cardBackgroundColor={cardBackgroundColor}
      borderColor={borderColor}
      isDark={isDark}
      onEdit={onChangeExercise}
      onDelete={onDelete}
      onQuickDelete={onQuickDelete}
      confirmTitle={confirmTitle}
      confirmMessage={confirmMessage}
      editLabel="Змінити"
      deleteLabel="Видалити"
    >
      {children}
    </SwipeableActionCard>
  );
};

interface ExerciseProgressRingProps {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  isDark?: boolean;
}

const ExerciseProgressRing: React.FC<ExerciseProgressRingProps> = ({
  completed,
  total,
  size = 30,
  strokeWidth = 2.5,
  isDark = false,
}) => {
  const isAllDone = total > 0 && completed >= total;
  const progress = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;
  const halfSize = size / 2;

  const color = isAllDone ? '#22C55E' : '#60A5FA';
  const trackColor = isDark ? '#334155' : '#E2E8F0';
  const bgFill = isAllDone
    ? 'rgba(34, 197, 94, 0.08)'
    : progress > 0
      ? 'rgba(96, 165, 250, 0.08)'
      : 'transparent';

  const rightAngle = -135 + Math.min(progress, 0.5) * 360;
  const leftAngle = progress <= 0.5 ? 45 : 45 + (progress - 0.5) * 360;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
      accessibilityLabel={`Прогрес вправи: ${completed} з ${total} підходів`}
    >
      {/* Background track circle */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: halfSize,
          borderWidth: strokeWidth,
          borderColor: trackColor,
          backgroundColor: bgFill,
        }}
      />

      {/* Progress Ring */}
      {isAllDone ? (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: halfSize,
            borderWidth: strokeWidth,
            borderColor: '#22C55E',
          }}
        />
      ) : progress > 0 ? (
        <>
          {/* Right half (0 - 180 deg) */}
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: halfSize,
              height: size,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: size,
                height: size,
                borderRadius: halfSize,
                borderWidth: strokeWidth,
                borderColor: 'transparent',
                borderTopColor: color,
                borderRightColor: color,
                transform: [{ rotate: `${rightAngle}deg` }],
              }}
            />
          </View>

          {/* Left half (180 - 360 deg) */}
          {progress > 0.5 && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: halfSize,
                height: size,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: size,
                  height: size,
                  borderRadius: halfSize,
                  borderWidth: strokeWidth,
                  borderColor: 'transparent',
                  borderTopColor: color,
                  borderRightColor: color,
                  transform: [{ rotate: `${leftAngle}deg` }],
                }}
              />
            </View>
          )}
        </>
      ) : null}

      {/* Center Label / Checkmark */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isAllDone ? (
          <Ionicons name="checkmark" size={13} color="#22C55E" />
        ) : (
          <Text
            style={{
              fontSize: 9,
              fontWeight: '700',
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              color:
                progress > 0
                  ? isDark
                    ? '#60A5FA'
                    : '#2563EB'
                  : isDark
                    ? '#94A3B8'
                    : '#64748B',
              includeFontPadding: false,
              textAlign: 'center',
            }}
          >
            {total > 0 ? `${completed}/${total}` : '0'}
          </Text>
        )}
      </View>
    </View>
  );
};

export const WorkoutEditorScreen: React.FC = () => {
  const { theme, colors, isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, traineeId } = useLocalSearchParams<{ id: string; traineeId?: string }>();
  const { user } = useAuth();
  const targetUserId = traineeId || user?.id || '';
  const [targetUserWeight, setTargetUserWeight] = useState<number>(user?.weight || 0);

  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);

  useEffect(() => {
    const effectiveId = traineeId || (workout && workout.userId && workout.userId !== user?.id ? workout.userId : user?.id);
    if (!effectiveId) return;

    if (user && effectiveId === user.id) {
      setTargetUserWeight(user.weight || 0);
    } else {
      AuthService.fetchProfile(effectiveId)
        .then((prof) => {
          if (prof?.weight && prof.weight > 0) {
            setTargetUserWeight(prof.weight);
          }
        })
        .catch(() => {});
    }
  }, [traineeId, workout?.userId, user]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);
  const [saveNoticeMsg, setSaveNoticeMsg] = useState<string>('Збережено ✓');
  const [isTitleModalOpen, setIsTitleModalOpen] = useState<boolean>(false);
  const [isEditTitleModalOpen, setIsEditTitleModalOpen] = useState<boolean>(false);
  const [editTitleValue, setEditTitleValue] = useState<string>('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [templateName, setTemplateName] = useState<string>('');
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false);

  const handleSaveAsTemplate = async () => {
    if (!workout || !user) return;
    const cleanName = templateName.trim();
    if (!cleanName) {
      Alert.alert('Помилка', 'Введіть назву шаблону');
      return;
    }

    setIsSavingTemplate(true);
    try {
      const templateId = `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const effectiveUserId = workout.userId || user.id;

      const ok = await TemplateService.saveTemplate({
        id: templateId,
        userId: effectiveUserId,
        title: cleanName,
        notes: workout.notes || '',
        exercises: workout.exercises || [],
        createdAt: new Date().toISOString(),
      });

      if (ok) {
        setIsTemplateModalOpen(false);
        setSaveNoticeMsg('Шаблон збережено успішно!');
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 2500);
      } else {
        Alert.alert('Помилка', 'Не вдалося зберегти шаблон');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Помилка при збереженні шаблону');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleSaveEditedTitle = () => {
    if (!workout) return;
    const clean = editTitleValue.trim() || 'Тренування';
    handleUpdateTitle(clean);
    setIsEditTitleModalOpen(false);
  };
  const [lastPerformances, setLastPerformances] = useState<Record<string, PastExercisePerformance | null>>({});
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [exerciseToReplaceId, setExerciseToReplaceId] = useState<string | null>(null);
  const [activeRepsPickerWeId, setActiveRepsPickerWeId] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);

  const handleChangeExercise = (weId: string) => {
    setExerciseToReplaceId(weId);
    setIsSelectorOpen(true);
  };

  const handleToggleExpand = (weId: string) => {
    setExpandedExerciseId((prev) => (prev === weId ? null : weId));
  };

  const workoutRef = useRef<WorkoutPlan | null>(null);
  workoutRef.current = workout;

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const exerciseLayoutsRef = useRef<{ [weId: string]: number }>({});

  const isTraineeWorkout = Boolean(
    traineeId ||
    (workout && workout.userId && user && workout.userId !== user.id) ||
    (workout && workout.assignedByCoachId)
  );
  const effectiveTraineeId = traineeId || (workout && user && workout.userId !== user.id ? workout.userId : undefined);

  const handleBack = useCallback(() => {
    if (isTraineeWorkout) {
      setSavedActiveTab('profile');
      if (router.canGoBack()) {
        router.back();
      } else {
        try {
          router.replace({
            pathname: '/trainees',
            params: effectiveTraineeId ? { traineeId: effectiveTraineeId } : undefined,
          });
        } catch {
          router.replace('/trainees');
        }
      }
      return;
    }

    setSavedActiveTab('index');
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router, isTraineeWorkout, effectiveTraineeId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => {
      if (isTraineeWorkout) {
        setSavedActiveTab('profile');
      } else {
        setSavedActiveTab('index');
      }
      sub.remove();
    };
  }, [handleBack, isTraineeWorkout]);

  const topBarAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isTopBarVisibleRef = useRef(true);
  const accumulatedDown = useRef(0);
  const accumulatedUp = useRef(0);
  const [topBarHeight, setTopBarHeight] = useState(56);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      scrollYRef.current = currentY;
      const contentHeight = event.nativeEvent.contentSize?.height || 0;
      const layoutHeight = event.nativeEvent.layoutMeasurement?.height || 0;
      const diff = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      // Always show when near the top (and ignore top overscroll bounce)
      if (currentY <= 25) {
        accumulatedDown.current = 0;
        accumulatedUp.current = 0;
        if (!isTopBarVisibleRef.current) {
          isTopBarVisibleRef.current = true;
          Animated.timing(topBarAnim, {
            toValue: 0,
            duration: 200,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: false,
          }).start();
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
          if (isTopBarVisibleRef.current) {
            isTopBarVisibleRef.current = false;
            Animated.timing(topBarAnim, {
              toValue: 1,
              duration: 200,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: false,
            }).start();
          }
          accumulatedDown.current = 0;
        }
      } else if (diff < 0) {
        // Scrolling up (finger swiping down)
        accumulatedDown.current = 0;
        accumulatedUp.current += Math.abs(diff);

        if (accumulatedUp.current > 16) {
          if (!isTopBarVisibleRef.current) {
            isTopBarVisibleRef.current = true;
            Animated.timing(topBarAnim, {
              toValue: 0,
              duration: 200,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: false,
            }).start();
          }
          accumulatedUp.current = 0;
        }
      }
    },
    [topBarAnim]
  );

  // Load workout details
  const loadWorkout = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await WorkoutService.getWorkoutById(id, targetUserId);
      if (data) {
        setWorkout(data);
        workoutRef.current = data;
        loadPerformancesForWorkout(data, data.userId);
      }
    } catch (e) {
      console.warn('[WorkoutEditorScreen.loadWorkout] Error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [id, targetUserId]);

  const scrollToExerciseCard = (weId: string) => {
    setTimeout(() => {
      const y = exerciseLayoutsRef.current[weId];
      if (typeof y === 'number') {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
      }
    }, 120);
  };

  const loadPerformancesForWorkout = async (w: WorkoutPlan, ownerUserId?: string) => {
    const effectiveUserId = ownerUserId || w.userId || targetUserId;
    if (!effectiveUserId || !w.exercises) return;
    const perfs: Record<string, PastExercisePerformance | null> = {};
    for (const ex of w.exercises) {
      try {
        const perf = await WorkoutService.getLastExercisePerformance(effectiveUserId, ex.exerciseId, w.id, ex.exerciseName);
        perfs[ex.exerciseId] = perf;
      } catch {
        perfs[ex.exerciseId] = null;
      }
    }
    setLastPerformances(perfs);
  };

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  // Clean up autoSave timer
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
        if (workoutRef.current) void WorkoutService.saveWorkout(workoutRef.current);
      }
    };
  }, []);

  // Central update & persist helper
  const updateAndSave = (updated: WorkoutPlan, immediateSave: boolean = false) => {
    // Preserve trainee context: if coach is editing trainee's workout, ensure coach ID is assigned
    if (user?.id && updated.userId !== user.id && !updated.assignedByCoachId) {
      updated.assignedByCoachId = user.id;
    }

    const autoStatus = computeWorkoutStatus(updated.exercises || []);
    updated.status = autoStatus;
    updated.completedAt = autoStatus === 'completed' ? (updated.completedAt || new Date().toISOString()) : null;

    setWorkout(updated);
    workoutRef.current = updated;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (immediateSave) {
      WorkoutService.saveWorkout(updated);
    } else {
      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveTimerRef.current = null;
        if (workoutRef.current) {
          WorkoutService.saveWorkout(workoutRef.current);
        }
      }, 500);
    }
  };

  // Map superset groups to palettes
  const supersetColorMap = useMemo(() => {
    const map = new Map<string, SupersetPalette>();
    if (!workout || !workout.exercises) return map;

    const uniqueGroups: string[] = [];
    workout.exercises.forEach((e) => {
      if (e.supersetGroupId && !uniqueGroups.includes(e.supersetGroupId)) {
        uniqueGroups.push(e.supersetGroupId);
      }
    });

    uniqueGroups.forEach((groupId, idx) => {
      map.set(groupId, getSupersetPalette(idx, colors.accent, colors.accentText));
    });
    return map;
  }, [workout?.exercises, colors.accent, colors.accentText]);

  interface ExerciseGroup {
    id: string;
    isSuperset: boolean;
    supersetGroupId?: string | null;
    palette?: SupersetPalette | null;
    exercises: { ex: WorkoutExercise; globalIndex: number }[];
  }

  const workoutExercisesList = useMemo(() => workout?.exercises || [], [workout?.exercises]);

  const exerciseGroups = useMemo(() => {
    const groups: ExerciseGroup[] = [];
    let currentGroup: ExerciseGroup | null = null;

    workoutExercisesList.forEach((ex, index) => {
      if (ex.supersetGroupId) {
        if (currentGroup && currentGroup.isSuperset && currentGroup.supersetGroupId === ex.supersetGroupId) {
          currentGroup.exercises.push({ ex, globalIndex: index });
        } else {
          if (currentGroup) groups.push(currentGroup);
          currentGroup = {
            id: ex.supersetGroupId,
            isSuperset: true,
            supersetGroupId: ex.supersetGroupId,
            palette: supersetColorMap.get(ex.supersetGroupId) || SUPERSET_PALETTES[0],
            exercises: [{ ex, globalIndex: index }],
          };
        }
      } else {
        if (currentGroup) {
          groups.push(currentGroup);
          currentGroup = null;
        }
        groups.push({
          id: ex.id,
          isSuperset: false,
          exercises: [{ ex, globalIndex: index }],
        });
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }, [workoutExercisesList, supersetColorMap]);

  const exerciseToGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of exerciseGroups) {
      if (group.isSuperset) {
        for (const item of group.exercises) {
          map.set(item.ex.id, group.id);
        }
      }
    }
    return map;
  }, [exerciseGroups]);

  // Drag & Drop superset states and layout tracking
  const activeDragIdRef = useRef<string | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const hoveredTargetIdRef = useRef<string | null>(null);
  const [isUnlinkMode, setIsUnlinkMode] = useState<boolean>(false);
  const isUnlinkModeRef = useRef<boolean>(false);
  const unlinkPositionRef = useRef<'above' | 'below' | 'stay'>('stay');
  const cardLayoutsRef = useRef<{ [weId: string]: { y: number; height: number } }>({});
  const scrollYRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const dragCardHeightRef = useRef<number>(100);
  const accumulatedScrollDeltaRef = useRef<number>(0);
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoScrollSpeedRef = useRef<number>(0);
  const lastHoverIdRef = useRef<string | null>(null);
  const currentTranslationXRef = useRef<number>(0);
  const currentTranslationYRef = useRef<number>(0);
  const { height: windowHeight } = useWindowDimensions();

  const getExerciseContentLayout = useCallback((exId: string) => {
    return cardLayoutsRef.current[exId] || null;
  }, []);

  const handleMeasureCardLayout = useCallback((exId: string, y: number, height: number) => {
    cardLayoutsRef.current[exId] = { y, height };
    exerciseLayoutsRef.current[exId] = y;
  }, []);

  const checkHoverTargetAtPosition = useCallback(
    (draggedId: string, translationX: number, translationY: number) => {
      const currentWorkout = workoutRef.current || workout;
      const exercisesList = currentWorkout?.exercises || [];
      const draggedEx = exercisesList.find((e) => e.id === draggedId);
      const isDraggedInSuperset = Boolean(draggedEx?.supersetGroupId);

      const currentCenterY =
        dragStartYRef.current +
        dragCardHeightRef.current / 2 +
        translationY +
        accumulatedScrollDeltaRef.current;

      // 1. Horizontal pull out of superset threshold
      const isHorizontalPull = isDraggedInSuperset && Math.abs(translationX) > 55;

      // 2. Vertical position outside superset group bounds
      let isVerticalOutsideSuperset = false;
      let targetRelativePosition: 'above' | 'below' | 'stay' = 'stay';
      if (isDraggedInSuperset && draggedEx?.supersetGroupId) {
        const groupMembers = exercisesList.filter(
          (e) => e.supersetGroupId === draggedEx.supersetGroupId
        );
        let supersetTop = Infinity;
        let supersetBottom = -Infinity;
        for (const m of groupMembers) {
          const l = getExerciseContentLayout(m.id);
          if (l) {
            if (l.y < supersetTop) supersetTop = l.y;
            if (l.y + l.height > supersetBottom) supersetBottom = l.y + l.height;
          }
        }
        if (supersetTop !== Infinity && supersetBottom !== -Infinity) {
          if (currentCenterY < supersetTop - 12) {
            isVerticalOutsideSuperset = true;
            targetRelativePosition = 'above';
          } else if (currentCenterY > supersetBottom + 12) {
            isVerticalOutsideSuperset = true;
            targetRelativePosition = 'below';
          }
        }
      }

      // 3. Determine if we should unlink or combine:
      // If the exercise is already in a superset and the user dragged it outside the superset bounds
      // (above the first exercise, below the last exercise, or horizontally), it's strictly UNLINK mode.
      // We NEVER combine with neighboring exercises in this mode!
      const shouldUnlink =
        isDraggedInSuperset && (isHorizontalPull || isVerticalOutsideSuperset);

      let targetId: string | null = null;
      if (!shouldUnlink) {
        // Only look for a combine target if we are NOT in unlink mode
        for (const otherEx of exercisesList) {
          if (otherEx.id === draggedId) continue;
          if (
            draggedEx?.supersetGroupId &&
            otherEx.supersetGroupId === draggedEx.supersetGroupId
          ) {
            continue;
          }
          const layout = getExerciseContentLayout(otherEx.id);
          if (layout) {
            if (currentCenterY >= layout.y && currentCenterY <= layout.y + layout.height) {
              targetId = otherEx.id;
              break;
            }
          }
        }
      }

      unlinkPositionRef.current = shouldUnlink ? targetRelativePosition : 'stay';

      if (shouldUnlink !== isUnlinkModeRef.current) {
        isUnlinkModeRef.current = shouldUnlink;
        setIsUnlinkMode(shouldUnlink);
        if (shouldUnlink) {
          safeHaptic('light');
        }
      }

      if (targetId !== lastHoverIdRef.current) {
        lastHoverIdRef.current = targetId;
        hoveredTargetIdRef.current = targetId;
        setHoveredTargetId(targetId);
        if (targetId) {
          safeHaptic('light');
        }
      }
    },
    [workout, getExerciseContentLayout]
  );

  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimerRef.current !== null) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
    autoScrollSpeedRef.current = 0;
  }, []);

  const startAutoScroll = useCallback(
    (speed: number) => {
      autoScrollSpeedRef.current = speed;
      if (autoScrollTimerRef.current !== null) return;

      autoScrollTimerRef.current = setInterval(() => {
        if (!autoScrollSpeedRef.current || !activeDragIdRef.current) {
          stopAutoScroll();
          return;
        }
        const currentScrollY = scrollYRef.current;
        const nextY = Math.max(0, currentScrollY + autoScrollSpeedRef.current);
        const delta = nextY - currentScrollY;
        if (delta !== 0) {
          accumulatedScrollDeltaRef.current += delta;
          scrollYRef.current = nextY;
          scrollViewRef.current?.scrollTo({ y: nextY, animated: false });
          if (activeDragIdRef.current) {
            checkHoverTargetAtPosition(
              activeDragIdRef.current,
              currentTranslationXRef.current,
              currentTranslationYRef.current
            );
          }
        }
      }, 16);
    },
    [checkHoverTargetAtPosition, stopAutoScroll]
  );

  useEffect(() => {
    return () => {
      if (autoScrollTimerRef.current !== null) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, []);

  const handleStartDrag = useCallback(
    (draggedId: string, initialY: number, screenY: number) => {
      activeDragIdRef.current = draggedId;
      hoveredTargetIdRef.current = null;
      lastHoverIdRef.current = null;
      isUnlinkModeRef.current = false;
      unlinkPositionRef.current = 'stay';
      accumulatedScrollDeltaRef.current = 0;
      currentTranslationXRef.current = 0;
      currentTranslationYRef.current = 0;

      const layout = getExerciseContentLayout(draggedId);
      dragStartYRef.current = layout?.y || 0;
      dragCardHeightRef.current = layout?.height || 100;
    },
    [getExerciseContentLayout]
  );

  const handleUpdateDrag = useCallback(
    (draggedId: string, translationX: number, translationY: number, screenY: number) => {
      currentTranslationXRef.current = translationX;
      currentTranslationYRef.current = translationY;

      // Auto-scroll check
      const TOP_THRESHOLD = 180;
      const BOTTOM_THRESHOLD = windowHeight - 160;

      if (screenY < TOP_THRESHOLD) {
        const speed = -Math.min(18, Math.max(4, Math.round((TOP_THRESHOLD - screenY) / 6)));
        startAutoScroll(speed);
      } else if (screenY > BOTTOM_THRESHOLD) {
        const speed = Math.min(18, Math.max(4, Math.round((screenY - BOTTOM_THRESHOLD) / 6)));
        startAutoScroll(speed);
      } else {
        stopAutoScroll();
      }

      checkHoverTargetAtPosition(draggedId, translationX, translationY);
    },
    [windowHeight, startAutoScroll, stopAutoScroll, checkHoverTargetAtPosition]
  );

  const handleEndDrag = useCallback(
    (draggedId: string) => {
      stopAutoScroll();
      const targetId = hoveredTargetIdRef.current;
      const shouldUnlink = isUnlinkModeRef.current;
      const relPos = unlinkPositionRef.current;
      const currentWorkout = workoutRef.current || workout;

      if (shouldUnlink && currentWorkout) {
        safeHaptic('success');
        const updated = removeExerciseFromSuperset(currentWorkout.exercises || [], draggedId, relPos);
        updateAndSave({ ...currentWorkout, exercises: updated }, true);
      } else if (targetId && targetId !== draggedId && currentWorkout) {
        safeHaptic('success');
        const updated = combineExercisesIntoSuperset(currentWorkout.exercises || [], draggedId, targetId);
        updateAndSave({ ...currentWorkout, exercises: updated }, true);
      }

      activeDragIdRef.current = null;
      hoveredTargetIdRef.current = null;
      lastHoverIdRef.current = null;
      setHoveredTargetId(null);
      isUnlinkModeRef.current = false;
      setIsUnlinkMode(false);
      unlinkPositionRef.current = 'stay';
      accumulatedScrollDeltaRef.current = 0;
      currentTranslationXRef.current = 0;
      currentTranslationYRef.current = 0;
    },
    [workout, stopAutoScroll, updateAndSave]
  );

  // Handle title change
  const handleUpdateTitle = (newTitle: string) => {
    if (!workout) return;
    const updated = { ...workout, title: newTitle };
    updateAndSave(updated);
  };

  // Handle date change
  const handleUpdateDate = (newDate: string) => {
    if (!workout) return;
    const updated = { ...workout, scheduledDate: newDate };
    updateAndSave(updated);
  };

  // Add exercise to workout
  const handleSelectExercise = async (exercise: Exercise) => {
    if (!workout || !user) return;

    const effectiveUserId = workout.userId || targetUserId || user.id;

    // Check if exercise has previous performance across workout history
    let lastPerf: PastExercisePerformance | null = null;
    try {
      lastPerf = await WorkoutService.getLastExercisePerformance(effectiveUserId, exercise.id, workout.id, exercise.name);
      setLastPerformances((prev) => ({ ...prev, [exercise.id]: lastPerf }));
    } catch (e) {
      console.warn('Error getting last exercise performance:', e);
    }

    // If coach is creating/adding exercise for trainee, automatically copy it into trainee's custom catalog
    const isTraineeWorkout = Boolean(traineeId || (workout && workout.userId && workout.userId !== user.id) || (workout && workout.assignedByCoachId));
    const effectiveTraineeId = workout.userId || traineeId;
    if (isTraineeWorkout && effectiveTraineeId && exercise.userId !== effectiveTraineeId) {
      try {
        const traineeExercises = await ExerciseService.getExercises(effectiveTraineeId);
        const exists = traineeExercises.some(
          (e) => e.name.toLowerCase().trim() === exercise.name.toLowerCase().trim()
        );
        if (!exists) {
          const cloned: Exercise = {
            ...exercise,
            id: `custom_ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            userId: effectiveTraineeId,
            isDefault: false,
            createdAt: new Date().toISOString(),
          };
          await ExerciseService.createExercise(cloned);
        }
      } catch (err) {
        console.warn('Failed to add exercise to trainee library:', err);
      }
    }

    const targetRange = (lastPerf?.sets?.[0]?.targetRepsRange || '8-12') as string;

    // Handle replace existing exercise
    if (exerciseToReplaceId) {
      const currentExercises = workout.exercises || [];
      const exIndex = currentExercises.findIndex((e) => e.id === exerciseToReplaceId);
      if (exIndex === -1) {
        setExerciseToReplaceId(null);
        setIsSelectorOpen(false);
        return;
      }

      const existingWe = currentExercises[exIndex];
      const hasCompletedSets = (existingWe.sets || []).some((s) => Boolean(s.completedAt));
      let updatedSets = existingWe.sets || [];

      if (!hasCompletedSets) {
        if (lastPerf && Array.isArray(lastPerf.sets) && lastPerf.sets.length > 0) {
          updatedSets = lastPerf.sets.map((ps, idx) => ({
            id: (existingWe.sets && existingWe.sets[idx]) ? existingWe.sets[idx].id : `set_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
            workoutExerciseId: existingWe.id,
            setNumber: idx + 1,
            targetRepsRange: ps.targetRepsRange || targetRange,
            weight: ps.weight !== null && ps.weight !== undefined && !isNaN(Number(ps.weight)) ? Number(ps.weight) : 0,
            actualReps: ps.actualReps !== null && ps.actualReps !== undefined ? Number(ps.actualReps) : getMinRepsFromRange(ps.targetRepsRange || targetRange),
            completedAt: null,
          }));
        } else {
          const minReps = getMinRepsFromRange(targetRange);
          updatedSets = updatedSets.map((s) => ({
            ...s,
            targetRepsRange: targetRange,
            weight: 0,
            actualReps: minReps,
          }));
        }
      }

      const updatedExercise: WorkoutExercise = {
        ...existingWe,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        muscleGroup: exercise.muscleGroup,
        targetRepsRange: targetRange,
        setCount: updatedSets.length,
        sets: updatedSets,
      };

      const updatedExercises = [...currentExercises];
      updatedExercises[exIndex] = updatedExercise;

      const updated: WorkoutPlan = {
        ...workout,
        exercises: updatedExercises,
      };

      updateAndSave(updated, true);
      setExerciseToReplaceId(null);
      setIsSelectorOpen(false);
      return;
    }

    const weId = `we_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Initial sets: prefill with past workout data if available
    let initialSets: WorkoutSet[] = [];
    if (lastPerf && Array.isArray(lastPerf.sets) && lastPerf.sets.length > 0) {
      initialSets = lastPerf.sets.map((ps, idx) => ({
        id: `set_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
        workoutExerciseId: weId,
        setNumber: idx + 1,
        targetRepsRange: ps.targetRepsRange || targetRange,
        weight: ps.weight !== null && ps.weight !== undefined && !isNaN(Number(ps.weight)) ? Number(ps.weight) : 0,
        actualReps: ps.actualReps !== null && ps.actualReps !== undefined ? Number(ps.actualReps) : getMinRepsFromRange(ps.targetRepsRange || targetRange),
        completedAt: null,
      }));
    } else {
      const minReps = getMinRepsFromRange(targetRange);
      initialSets = [1, 2, 3].map((num) => ({
        id: `set_${Date.now()}_${num}_${Math.random().toString(36).substring(2, 5)}`,
        workoutExerciseId: weId,
        setNumber: num,
        targetRepsRange: targetRange,
        weight: 0,
        actualReps: minReps,
        completedAt: null,
      }));
    }

    const currentExercises = workout.exercises || [];
    const newWorkoutExercise: WorkoutExercise = {
      id: weId,
      workoutPlanId: workout.id,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      order: currentExercises.length + 1,
      targetRepsRange: targetRange,
      setCount: initialSets.length,
      sets: initialSets,
    };

    const updated: WorkoutPlan = {
      ...workout,
      exercises: [...currentExercises, newWorkoutExercise],
    };

    updateAndSave(updated, true);
    setIsSelectorOpen(false);

    // Automatically expand newly added exercise card
    setExpandedExerciseId(weId);

    // Auto-scroll to newly added exercise smoothly
    setTimeout(() => {
      scrollToExerciseCard(weId);
    }, 150);
  };

  // Remove exercise with confirmation Alert
  const handleRemoveExercise = useCallback(
    (weId: string, onCancel?: () => void) => {
      if (!workout) return;
      const currentExercises = workout.exercises || [];
      const exerciseIndex = currentExercises.findIndex((e) => e.id === weId);
      if (exerciseIndex === -1) return;

      const exerciseToRemove = currentExercises[exerciseIndex];
      const exerciseName = exerciseToRemove.exerciseName || 'цю вправу';

      Alert.alert(
        'Видалити вправу?',
        `Ви впевнені, що хочете видалити «${exerciseName}»?`,
        [
          {
            text: 'Скасувати',
            style: 'cancel',
            onPress: () => {
              onCancel?.();
            },
          },
          {
            text: 'Видалити',
            style: 'destructive',
            onPress: () => {
              if (expandedExerciseId === weId) {
                setExpandedExerciseId(null);
              }

              // Determine target exercise to scroll to:
              // If deleted is not first -> previous exercise (exerciseIndex - 1)
              // If deleted is first -> next exercise (exerciseIndex + 1)
              const targetExercise = exerciseIndex > 0
                ? currentExercises[exerciseIndex - 1]
                : currentExercises[exerciseIndex + 1];

              const targetY = targetExercise ? exerciseLayoutsRef.current[targetExercise.id] : undefined;

              let updatedExercises = currentExercises
                .filter((e) => e.id !== weId)
                .map((e, idx) => ({ ...e, order: idx + 1 }));

              // If removed exercise was in a superset, clean up any orphan
              if (exerciseToRemove?.supersetGroupId) {
                const remainingInGroup = updatedExercises.filter(
                  (e) => e.supersetGroupId === exerciseToRemove.supersetGroupId
                );
                if (remainingInGroup.length <= 1) {
                  updatedExercises = updatedExercises.map((e) =>
                    e.supersetGroupId === exerciseToRemove.supersetGroupId
                      ? { ...e, supersetGroupId: null }
                      : e
                  );
                }
              }

              delete exerciseLayoutsRef.current[weId];
              delete cardLayoutsRef.current[weId];

              updateAndSave({ ...workout, exercises: ensureContiguousSupersets(updatedExercises) }, true);

              // Smoothly scroll to previous or next exercise without jarring jump
              if (typeof targetY === 'number') {
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 16), animated: true });
                }, 100);
              }
            },
          },
        ]
      );
    },
    [workout, expandedExerciseId, updateAndSave]
  );

  const handleQuickDeleteExercise = useCallback(
    (weId: string, onCancel?: () => void) => {
      handleRemoveExercise(weId, onCancel);
    },
    [handleRemoveExercise]
  );

  // Move exercise Up / Down (respecting superset groups)
  const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
    const currentWorkout = workoutRef.current || workout;
    if (!currentWorkout) return;
    const items = [...(currentWorkout.exercises || [])];
    const current = items[index];
    if (!current) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const currentGid = current.supersetGroupId;
    const target = items[targetIndex];
    const targetGid = target.supersetGroupId;

    if (currentGid && currentGid === targetGid) {
      // Both in same superset: reorder within superset
      const temp = items[index];
      items[index] = items[targetIndex];
      items[targetIndex] = temp;
    } else if (currentGid && (!targetGid || targetGid !== currentGid)) {
      // Current is in a superset, target is outside. Move entire superset block as a unit.
      const groupIndices = items
        .map((e, idx) => (e.supersetGroupId === currentGid ? idx : -1))
        .filter((idx) => idx !== -1);
      const minGroupIdx = Math.min(...groupIndices);
      const maxGroupIdx = Math.max(...groupIndices);
      const groupExercises = items.filter((e) => e.supersetGroupId === currentGid);
      const withoutGroup = items.filter((e) => e.supersetGroupId !== currentGid);

      if (direction === 'up') {
        if (minGroupIdx === 0) return;
        const prevItem = items[minGroupIdx - 1];
        let insertIdx = minGroupIdx - 1;
        if (prevItem.supersetGroupId) {
          const prevGroupIndices = withoutGroup
            .map((e, idx) => (e.supersetGroupId === prevItem.supersetGroupId ? idx : -1))
            .filter((idx) => idx !== -1);
          if (prevGroupIndices.length > 0) {
            insertIdx = Math.min(...prevGroupIndices);
          }
        }
        items.length = 0;
        items.push(...withoutGroup.slice(0, insertIdx), ...groupExercises, ...withoutGroup.slice(insertIdx));
      } else {
        if (maxGroupIdx >= items.length - 1) return;
        const nextItem = items[maxGroupIdx + 1];
        let insertIdx = minGroupIdx + 1;
        if (nextItem.supersetGroupId) {
          const nextGroupIndices = withoutGroup
            .map((e, idx) => (e.supersetGroupId === nextItem.supersetGroupId ? idx : -1))
            .filter((idx) => idx !== -1);
          if (nextGroupIndices.length > 0) {
            insertIdx = Math.max(...nextGroupIndices) + 1;
          }
        }
        items.length = 0;
        items.push(...withoutGroup.slice(0, insertIdx), ...groupExercises, ...withoutGroup.slice(insertIdx));
      }
    } else if (!currentGid && targetGid) {
      // Standalone moving past a superset
      const targetGroupIndices = items
        .map((e, idx) => (e.supersetGroupId === targetGid ? idx : -1))
        .filter((idx) => idx !== -1);
      const minTargetIdx = Math.min(...targetGroupIndices);
      const maxTargetIdx = Math.max(...targetGroupIndices);
      const withoutCurrent = items.filter((_, idx) => idx !== index);

      if (direction === 'up') {
        const insertIdx = minTargetIdx;
        items.length = 0;
        items.push(...withoutCurrent.slice(0, insertIdx), current, ...withoutCurrent.slice(insertIdx));
      } else {
        const insertIdx = maxTargetIdx;
        items.length = 0;
        items.push(...withoutCurrent.slice(0, insertIdx), current, ...withoutCurrent.slice(insertIdx));
      }
    } else {
      // Normal swap between standalone exercises
      const temp = items[index];
      items[index] = items[targetIndex];
      items[targetIndex] = temp;
    }

    const renumbered = items.map((item, idx) => ({
      ...item,
      order: idx + 1,
    }));

    updateAndSave({ ...currentWorkout, exercises: ensureContiguousSupersets(renumbered) }, true);
  };

  // Superset toggle logic: join adjacent or unlink
  const handleToggleSuperset = (weIndex: number) => {
    const currentWorkout = workoutRef.current || workout;
    if (!currentWorkout) return;
    const items = [...(currentWorkout.exercises || [])];
    const current = items[weIndex];
    if (!current) return;

    if (current.supersetGroupId) {
      // Unlink current exercise
      const oldGroup = current.supersetGroupId;
      let updated = items.map((e) => (e.id === current.id ? { ...e, supersetGroupId: null } : e));

      // If only 1 remains in old group, clear it too (automatically dissolve superset)
      const remaining = updated.filter((e) => e.supersetGroupId === oldGroup);
      if (remaining.length <= 1) {
        updated = updated.map((e) => (e.supersetGroupId === oldGroup ? { ...e, supersetGroupId: null } : e));
      }
      updateAndSave({ ...currentWorkout, exercises: ensureContiguousSupersets(updated) }, true);
    } else {
      // Connect with neighbor
      const next = items[weIndex + 1];
      const prev = items[weIndex - 1];

      if (next && next.supersetGroupId) {
        // Join next superset
        const updated = items.map((e, idx) =>
          idx === weIndex ? { ...e, supersetGroupId: next.supersetGroupId } : e
        );
        updateAndSave({ ...currentWorkout, exercises: ensureContiguousSupersets(updated) }, true);
      } else if (prev && prev.supersetGroupId) {
        // Join prev superset
        const updated = items.map((e, idx) =>
          idx === weIndex ? { ...e, supersetGroupId: prev.supersetGroupId } : e
        );
        updateAndSave({ ...currentWorkout, exercises: ensureContiguousSupersets(updated) }, true);
      } else if (next) {
        // Create new superset with next
        const newGroupId = generateSupersetGroupId();
        const updated = items.map((e, idx) =>
          idx === weIndex || idx === weIndex + 1 ? { ...e, supersetGroupId: newGroupId } : e
        );
        updateAndSave({ ...currentWorkout, exercises: ensureContiguousSupersets(updated) }, true);
      } else if (prev) {
        // Create new superset with prev
        const newGroupId = generateSupersetGroupId();
        const updated = items.map((e, idx) =>
          idx === weIndex || idx === weIndex - 1 ? { ...e, supersetGroupId: newGroupId } : e
        );
        updateAndSave({ ...currentWorkout, exercises: ensureContiguousSupersets(updated) }, true);
      }
    }
  };

  // Change target reps range
  const handleTargetRepsRangeChange = (weId: string, range: string) => {
    if (!workout) return;
    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const updatedSets = (e.sets || []).map((s) => ({ ...s, targetRepsRange: range }));
        return { ...e, targetRepsRange: range, sets: updatedSets };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Quick set count change (2, 3, 4, 5)
  const handleSetCountChange = (weId: string, count: number) => {
    if (!workout) return;
    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        let sets = [...(e.sets || [])];
        if (count > sets.length) {
          const lastSet = sets[sets.length - 1];
          const minReps = getMinRepsFromRange(e.targetRepsRange || lastSet?.targetRepsRange || '8-12');
          for (let i = sets.length; i < count; i++) {
            sets.push({
              id: `set_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
              workoutExerciseId: weId,
              setNumber: i + 1,
              targetRepsRange: e.targetRepsRange || lastSet?.targetRepsRange || '8-12',
              weight: lastSet?.weight ?? 0,
              actualReps: lastSet?.actualReps ?? minReps,
              completedAt: null,
            });
          }
        } else if (count < sets.length) {
          sets = sets.slice(0, count);
        }
        return { ...e, setCount: count, sets };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises }, true);
  };

  // Add individual set
  const handleAddSet = (weId: string) => {
    if (!workout) return;
    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const sets = e.sets || [];
        const lastSet = sets[sets.length - 1];
        const minReps = getMinRepsFromRange(e.targetRepsRange || lastSet?.targetRepsRange || '8-12');
        const newSet: WorkoutSet = {
          id: `set_${Date.now()}_${sets.length}_${Math.random().toString(36).substring(2, 5)}`,
          workoutExerciseId: weId,
          setNumber: sets.length + 1,
          targetRepsRange: e.targetRepsRange || lastSet?.targetRepsRange || '8-12',
          weight: lastSet?.weight ?? 0,
          actualReps: lastSet?.actualReps ?? minReps,
          completedAt: null,
        };
        const newSets = [...sets, newSet];
        return { ...e, setCount: newSets.length, sets: newSets };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises }, true);
  };

  // Remove individual set
  const handleRemoveSet = (weId: string, setId: string) => {
    if (!workout) return;
    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const filtered = (e.sets || []).filter((s) => s.id !== setId);
        const renumbered = filtered.map((s, idx) => ({ ...s, setNumber: idx + 1 }));
        return { ...e, setCount: renumbered.length, sets: renumbered };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises }, true);
  };

  // Update set weight / reps directly
  const handleUpdateSet = (
    weId: string,
    setId: string,
    field: 'weight' | 'actualReps',
    value: number | null
  ) => {
    if (!workout) return;
    const currentEx = (workout.exercises || []).find((e) => e.id === weId);
    const currentSet = currentEx?.sets?.find((s) => s.id === setId);

    let shouldResetReps = false;
    let newReps: number | null = null;

    if (field === 'weight' && currentSet) {
      const currentWeight = currentSet.weight ?? 0;
      const targetWeight = value ?? 0;
      if (currentWeight !== targetWeight) {
        shouldResetReps = true;
        const range = currentSet.targetRepsRange || currentEx?.targetRepsRange || '8-12';
        newReps = getMinRepsFromRange(range);
      }
    }

    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const updatedSets = (e.sets || []).map((s) => {
          if (s.id === setId) {
            if (shouldResetReps) {
              return { ...s, weight: value ?? 0, actualReps: newReps };
            }
            if (field === 'weight') {
              return { ...s, weight: value ?? 0 };
            }
            return { ...s, actualReps: value };
          }
          return s;
        });
        return { ...e, sets: updatedSets };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises });
  };

  // Step adjust weight (+/- 1) or reps (+/- 1)
  const handleStepAdjust = (
    weId: string,
    setId: string,
    field: 'weight' | 'actualReps',
    delta: number
  ) => {
    if (!workout) return;
    const currentEx = (workout.exercises || []).find((e) => e.id === weId);
    const currentSet = currentEx?.sets?.find((s) => s.id === setId);
    if (!currentSet) return;

    const currentVal = field === 'weight' ? currentSet.weight : (currentSet.actualReps ?? 10);
    const nextVal = Math.max(0, Math.round((currentVal + delta) * 10) / 10);
    handleUpdateSet(weId, setId, field, nextVal);
  };

  // Toggle set completed
  const handleToggleCompleteSet = (weId: string, setItem: WorkoutSet) => {
    if (!workout) return;
    const isNowCompleted = !setItem.completedAt;
    const completedAt = isNowCompleted ? new Date().toISOString() : null;

    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const updatedSets = (e.sets || []).map((s) => {
          if (s.id === setItem.id) {
            return { ...s, completedAt };
          }
          return s;
        });
        return { ...e, sets: updatedSets };
      }
      return e;
    });

    const updatedWorkout: WorkoutPlan = {
      ...workout,
      exercises: updatedExercises,
    };

    updateAndSave(updatedWorkout, true);

    // Auto-advance logic
    if (isNowCompleted) {
      const currentEx = updatedExercises.find((e) => e.id === weId);
      if (currentEx) {
        // Superset navigation: cycle exercises or advance when superset is completed
        if (currentEx.supersetGroupId) {
          const supersetExercises = updatedExercises.filter(
            (e) => e.supersetGroupId === currentEx.supersetGroupId
          );
          if (supersetExercises.length > 1) {
            // Check if all sets of all exercises in this superset are completed
            const isAllSupersetCompleted = supersetExercises.every(
              (e) => e.sets && e.sets.length > 0 && e.sets.every((s) => Boolean(s.completedAt))
            );

            if (isAllSupersetCompleted) {
              // Find the index of the last exercise belonging to this superset in the workout
              let lastSupersetExIndex = -1;
              for (let i = 0; i < updatedExercises.length; i++) {
                if (updatedExercises[i].supersetGroupId === currentEx.supersetGroupId) {
                  lastSupersetExIndex = i;
                }
              }

              if (lastSupersetExIndex >= 0 && lastSupersetExIndex < updatedExercises.length - 1) {
                // Next exercise in workout after the superset
                const nextExAfterSuperset = updatedExercises[lastSupersetExIndex + 1];
                setExpandedExerciseId(nextExAfterSuperset.id);
                scrollToExerciseCard(nextExAfterSuperset.id);
              } else {
                // Superset is at the end of workout: open the last exercise
                const lastEx = updatedExercises[updatedExercises.length - 1];
                if (lastEx) {
                  setExpandedExerciseId(lastEx.id);
                  scrollToExerciseCard(lastEx.id);
                }
              }
              return;
            }

            // Superset is still in progress: find next exercise with remaining sets, cycling forward
            const currentIdxInSuperset = supersetExercises.findIndex((e) => e.id === currentEx.id);
            let nextEx: WorkoutExercise | null = null;
            for (let step = 1; step <= supersetExercises.length; step++) {
              const candidate = supersetExercises[(currentIdxInSuperset + step) % supersetExercises.length];
              if (candidate.sets && candidate.sets.some((s) => !s.completedAt)) {
                nextEx = candidate;
                break;
              }
            }
            if (!nextEx) {
              const nextIdxInSuperset = (currentIdxInSuperset + 1) % supersetExercises.length;
              nextEx = supersetExercises[nextIdxInSuperset];
            }

            if (nextEx) {
              setExpandedExerciseId(nextEx.id);
              scrollToExerciseCard(nextEx.id);
            }
            return;
          }
        }

        // Regular exercise: after all sets are completed, advance to next exercise in workout
        const isAllSetsOfExCompleted =
          currentEx.sets &&
          currentEx.sets.length > 0 &&
          currentEx.sets.every((s) => Boolean(s.completedAt));

        if (isAllSetsOfExCompleted) {
          const currentExIndex = updatedExercises.findIndex((e) => e.id === weId);
          if (currentExIndex < updatedExercises.length - 1) {
            const nextEx = updatedExercises[currentExIndex + 1];
            if (nextEx) {
              setExpandedExerciseId(nextEx.id);
              scrollToExerciseCard(nextEx.id);
            }
          }
        }
      }
    }
  };

  // Toggle warmup flag
  const handleToggleWarmup = (weId: string, setId: string) => {
    if (!workout) return;
    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const updatedSets = (e.sets || []).map((s) => {
          if (s.id === setId) {
            return { ...s, isWarmup: !s.isWarmup };
          }
          return s;
        });
        return { ...e, sets: updatedSets };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises }, true);
  };

  // Refill this exercise with previous performance
  const handleApplyPreviousPerformance = (weId: string, exerciseId: string) => {
    const perf = lastPerformances[exerciseId];
    if (!workout || !perf || !perf.sets || perf.sets.length === 0) {
      Alert.alert('Інформація', 'Для цієї вправи ще немає попередніх записів');
      return;
    }

    const updatedExercises = (workout.exercises || []).map((e) => {
      if (e.id === weId) {
        const sets: WorkoutSet[] = perf.sets.map((ps, idx) => ({
          id: `set_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
          workoutExerciseId: weId,
          setNumber: idx + 1,
          targetRepsRange: ps.targetRepsRange || e.targetRepsRange || '8-12',
          weight: Number(ps.weight) || 20,
          actualReps: ps.actualReps !== null && ps.actualReps !== undefined ? Number(ps.actualReps) : 10,
          completedAt: null,
        }));
        return {
          ...e,
          setCount: sets.length,
          sets,
        };
      }
      return e;
    });

    updateAndSave({ ...workout, exercises: updatedExercises }, true);
    Alert.alert('Успішно', 'Попередні підходи та ваги заповнено!');
  };

  // Repeat entire previous workout
  const handleRepeatPreviousWorkout = async () => {
    if (!workout) return;
    const effectiveUserId = workout.userId || targetUserId;
    if (!effectiveUserId) return;

    try {
      const prev = await WorkoutService.getPreviousWorkoutToRepeat(effectiveUserId, workout.id, workout.title);
      if (!prev || !prev.exercises || prev.exercises.length === 0) {
        Alert.alert(
          'Немає тренувань',
          'Попередніх тренувань з вправами для повторення не знайдено.'
        );
        return;
      }

      Alert.alert(
        'Повторити тренування?',
        `Завантажити вправи з «${prev.title}» (${prev.scheduledDate}) із попередніми вагою та повтореннями?`,
        [
          { text: 'Скасувати', style: 'cancel' },
          {
            text: 'Повторити',
            style: 'default',
            onPress: () => {
              const newExercises: WorkoutExercise[] = prev.exercises.map((pe, exIdx) => {
                const weId = `we_${Date.now()}_${exIdx}_${Math.random().toString(36).substring(2, 6)}`;
                const newSets: WorkoutSet[] = (pe.sets || []).map((ps, sIdx) => ({
                  id: `set_${Date.now()}_${exIdx}_${sIdx}_${Math.random().toString(36).substring(2, 5)}`,
                  workoutExerciseId: weId,
                  setNumber: sIdx + 1,
                  targetRepsRange: ps.targetRepsRange || '8-12',
                  weight: Number(ps.weight) || 20,
                  actualReps: ps.actualReps !== null && ps.actualReps !== undefined ? Number(ps.actualReps) : 10,
                  completedAt: null,
                  isWarmup: Boolean(ps.isWarmup),
                }));

                return {
                  id: weId,
                  workoutPlanId: workout.id,
                  exerciseId: pe.exerciseId,
                  exerciseName: pe.exerciseName,
                  muscleGroup: pe.muscleGroup,
                  order: exIdx + 1,
                  targetRepsRange: pe.targetRepsRange || '8-12',
                  setCount: newSets.length,
                  supersetGroupId: pe.supersetGroupId || null,
                  sets: newSets,
                };
              });

              const updated: WorkoutPlan = {
                ...workout,
                exercises: newExercises,
              };

              updateAndSave(updated, true);
              loadPerformancesForWorkout(updated);
              setSaveNoticeMsg('Тренування заповнено з попереднього!');
              setSaveSuccessNotice(true);
              setTimeout(() => setSaveSuccessNotice(false), 3000);
            },
          },
        ]
      );
    } catch (e) {
      console.warn('Error repeating previous workout:', e);
    }
  };

  // Explicit Save
  const handleSaveWorkout = async () => {
    if (!workout) return;
    setIsSaving(true);
    try {
      const ok = await WorkoutService.saveWorkout(workout);
      if (ok) {
        setSaveNoticeMsg('Зміни успішно збережено!');
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 2500);
      } else {
        Alert.alert('Помилка', 'Не вдалося зберегти тренування');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося зберегти тренування');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Completed status
  const handleToggleStatus = async () => {
    if (!workout) return;
    const isNowDone = workout.status !== 'completed';
    const updated: WorkoutPlan = {
      ...workout,
      status: isNowDone ? 'completed' : 'in_progress',
      completedAt: isNowDone ? new Date().toISOString() : null,
    };
    updateAndSave(updated, true);
  };

  // Delete workout
  const handleDeleteWorkout = () => {
    if (!workout || !user) return;

    Alert.alert(
      'Видалити тренування?',
      `Ви впевнені, що хочете видалити «${workout.title || 'це тренування'}»?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
              }
              const effectiveUserId = workout.userId || targetUserId;
              const ok = await WorkoutService.deleteWorkout(
                effectiveUserId,
                workout.id,
                user?.id
              );
              if (ok) {
                handleBack();
              } else {
                Alert.alert('Помилка', 'Не вдалося видалити тренування');
              }
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
            Завантаження тренування...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#F8FAFC' : '#0F172A'} />
          </TouchableOpacity>
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={[styles.errorTitle, isDark ? styles.textDark : styles.textLight]}>
            Тренування не знайдено
          </Text>
          <Button title="Назад" variant="outline" onPress={handleBack} style={{ marginTop: 12 }} />
        </View>
      </SafeAreaView>
    );
  }

  const exercises = workout.exercises || [];
  const isCompleted = workout.status === 'completed';
  const totalSets = exercises.reduce((acc, ex) => acc + (ex.sets ? ex.sets.length : 0), 0);
  const completedSets = exercises.reduce(
    (acc, ex) => acc + (ex.sets || []).filter((s) => Boolean(s.completedAt)).length,
    0
  );

  let totalVolume = 0;
  exercises.forEach((ex) => {
    (ex.sets || []).forEach((s) => {
      if ((s.completedAt || isCompleted) && s.actualReps) {
        // If set weight is 0 (bodyweight exercise), use body weight from target user profile
        const effectiveWeight = (typeof s.weight === 'number' && s.weight > 0)
          ? s.weight
          : (targetUserWeight > 0 ? targetUserWeight : 0);
        totalVolume += effectiveWeight * s.actualReps;
      }
    });
  });

  const renderExerciseCard = (ex: WorkoutExercise, exIndex: number) => {
    const muscle = MUSCLE_GROUPS[ex.muscleGroup || 'other'] || MUSCLE_GROUPS.other;
    const isSuperset = Boolean(ex.supersetGroupId);
    const palette = ex.supersetGroupId ? supersetColorMap.get(ex.supersetGroupId) : null;
    const pastPerf = lastPerformances[ex.exerciseId];
    const isExpanded = expandedExerciseId === ex.id;

    return (
      <View style={styles.exerciseCardWrap}>
        <SwipeableExerciseCard
          id={ex.id}
          cardBackgroundColor={colors.card}
          borderColor={colors.cardBorder}
          containerStyle={styles.swipeExerciseContainer}
          onDelete={(onCancel) => handleRemoveExercise(ex.id, onCancel)}
          onQuickDelete={(onCancel) => handleQuickDeleteExercise(ex.id, onCancel)}
          onChangeExercise={() => handleChangeExercise(ex.id)}
          isDark={isDark}
        >
          <View style={styles.exerciseCardInner}>
            {/* Superset Full Height Left Stripe */}
            {isSuperset && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 5,
                  backgroundColor: palette?.color || colors.accent,
                  borderTopLeftRadius: 20,
                  borderBottomLeftRadius: 20,
                  zIndex: 10,
                }}
              />
            )}

            {/* Exercise Card Header */}
            <View style={[styles.exHeader, isExpanded && { borderBottomWidth: 1, borderBottomColor: colors.cardBorder, paddingBottom: 10 }]}>
              {/* Name & Collapsed Summary */}
              <View style={styles.exHeaderTitleRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleToggleExpand(ex.id)}
                  style={styles.exHeaderLeftTouchable}
                >
                  <View style={styles.exTitleContainer}>
                    <Text
                      numberOfLines={2}
                      style={[styles.exTitleText, { color: colors.text }]}
                    >
                      {ex.exerciseName || 'Вправа'}
                    </Text>
                    {isSuperset && (
                      <View style={styles.exBadgeRow}>
                        <View
                          style={[
                            styles.supersetBadge,
                            {
                              backgroundColor: palette?.color || colors.accent,
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderWidth: 0,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.supersetBadgeText,
                              {
                                color: palette?.textColor || colors.accentText,
                                fontWeight: '800',
                                fontSize: 10,
                              },
                            ]}
                          >
                            {t('editor.superset', 'Суперсет')}
                          </Text>
                        </View>
                      </View>
                    )}
                    {!isExpanded && (
                      <View style={styles.collapsedSummaryRow}>
                        <Text style={[styles.collapsedSummaryText, { color: colors.textSecondary }]}>
                          {(() => {
                            const setsCount = (ex.sets || []).length;
                            const repsRange = ex.targetRepsRange || ex.sets?.[0]?.targetRepsRange || '8-12';
                            const oneRmVal = format1RM(getExercise1RM(ex.sets, pastPerf));
                            return `${setsCount} ${t('common.sets', 'підходів')} · ${repsRange} ${t('common.reps_short', 'повт.')} · 1RM ${oneRmVal}`;
                          })()}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Action buttons (Superset Link & Count Badge) */}
                <View style={styles.exCardActions}>
                  {exercises.length > 1 && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleToggleSuperset(exIndex)}
                      style={[
                        styles.supersetToggleBtn,
                        {
                          backgroundColor: colors.subCard,
                          borderColor: colors.cardBorder,
                          width: 36,
                          height: 36,
                          borderRadius: 12,
                        },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <Ionicons
                        name={isSuperset ? "link" : "link-outline"}
                        size={16}
                        color={isSuperset ? (palette?.color || colors.accent) : colors.textSecondary}
                      />
                    </TouchableOpacity>
                  )}

                  {(() => {
                    const completed = (ex.sets || []).filter((s) => Boolean(s.completedAt)).length;
                    const total = (ex.sets || []).length;
                    const isAllDone = total > 0 && completed === total;
                    return (
                      <View
                        style={{
                          backgroundColor: isAllDone ? colors.accent : colors.subCard,
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          borderRadius: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 38,
                          height: 36,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: isAllDone ? colors.accentText : colors.text,
                          }}
                        >
                          {total > 0 ? `${completed}/${total}` : '0/0'}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>
            </View>

            {isExpanded && (
              <>
                {/* Target Rep Range Dropdown Bar */}
                <View style={[styles.quickSelectorsRow, { backgroundColor: colors.subCard, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }]}>
                  <View style={styles.repsDropdownRow}>
                    <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>
                      {t('common.reps', 'ПОВТОРЕНЬ').toUpperCase()}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setActiveRepsPickerWeId(ex.id)}
                      style={[
                        styles.repsDropdownBtn,
                        { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
                      ]}
                    >
                      <Text style={[styles.repsDropdownBtnText, { color: colors.text, fontWeight: '700' }]}>
                        {ex.targetRepsRange || ex.sets?.[0]?.targetRepsRange || '8-12'}
                      </Text>
                      <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.repsDropdownRow}>
                    <Text style={[styles.selectorLabel, { color: colors.textSecondary, marginRight: 4 }]}>
                      1RM
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                      {format1RM(getExercise1RM(ex.sets, pastPerf))}
                    </Text>
                  </View>
                </View>

                {/* Sets Table */}
                <View style={styles.setsTable}>
                  {/* Table Header */}
                  <View style={[styles.tableHeaderRow, { borderBottomColor: colors.cardBorder }]}>
                    <Text style={[styles.thCell, styles.thSet, { color: colors.textSecondary }]}>
                      {t('editor.set', 'СЕТ')}
                    </Text>
                    <Text style={[styles.thCell, styles.thWeight, { color: colors.textSecondary }]}>
                      {t('editor.weight_kg', 'ВАГА, КГ')}
                    </Text>
                    <Text style={[styles.thCell, styles.thReps, { color: colors.textSecondary }]}>
                      {t('editor.reps', 'ПОВТОР.')}
                    </Text>
                    <View style={styles.thDone} />
                    <View style={styles.thAction} />
                  </View>

                  {/* Table Rows */}
                  {(ex.sets || []).map((s, sIndex) => {
                    const isDone = Boolean(s.completedAt);
                    return (
                      <View
                        key={s.id || `s_${sIndex}`}
                        style={[
                          styles.setTableRow,
                          sIndex > 0 && { borderTopWidth: 1, borderTopColor: colors.cardBorder },
                        ]}
                      >
                        {/* Set number */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleToggleWarmup(ex.id, s.id)}
                          style={styles.tdSet}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text
                            style={[
                              styles.setNumberText,
                              { color: s.isWarmup ? colors.accent : colors.text },
                            ]}
                          >
                            {s.setNumber || sIndex + 1}
                            {s.isWarmup ? ' (Р)' : ''}
                          </Text>
                        </TouchableOpacity>

                        {/* Weight numeric input + steppers */}
                        <View style={styles.tdWeight}>
                          <View style={styles.stepperContainer}>
                            <TouchableOpacity
                              activeOpacity={0.6}
                              onPress={() => handleStepAdjust(ex.id, s.id, 'weight', -1)}
                              style={[styles.stepBtn, { backgroundColor: colors.subCard }]}
                              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            >
                              <Text style={[styles.stepBtnText, { color: colors.text }]}>
                                −
                              </Text>
                            </TouchableOpacity>

                            <TextInput
                              style={[styles.numberInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.text }]}
                              keyboardType="decimal-pad"
                              inputMode="decimal"
                              value={s.weight !== null && s.weight !== undefined ? String(s.weight) : ''}
                              onChangeText={(val) => {
                                const clean = val.replace(',', '.');
                                const parsed = parseFloat(clean);
                                handleUpdateSet(ex.id, s.id, 'weight', isNaN(parsed) ? 0 : parsed);
                              }}
                              selectTextOnFocus
                            />

                            <TouchableOpacity
                              activeOpacity={0.6}
                              onPress={() => handleStepAdjust(ex.id, s.id, 'weight', 1)}
                              style={[styles.stepBtn, { backgroundColor: colors.subCard }]}
                              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            >
                              <Text style={[styles.stepBtnText, { color: colors.text }]}>
                                +
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Actual Reps numeric input + steppers */}
                        <View style={styles.tdReps}>
                          <View style={styles.stepperContainer}>
                            <TouchableOpacity
                              activeOpacity={0.6}
                              onPress={() => handleStepAdjust(ex.id, s.id, 'actualReps', -1)}
                              style={[styles.stepBtn, { backgroundColor: colors.subCard }]}
                              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            >
                              <Text style={[styles.stepBtnText, { color: colors.text }]}>
                                −
                              </Text>
                            </TouchableOpacity>

                            <TextInput
                              style={[styles.numberInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.text }]}
                              keyboardType="number-pad"
                              inputMode="numeric"
                              value={s.actualReps !== null && s.actualReps !== undefined ? String(s.actualReps) : ''}
                              onChangeText={(val) => {
                                const parsed = parseInt(val, 10);
                                handleUpdateSet(ex.id, s.id, 'actualReps', isNaN(parsed) ? 0 : parsed);
                              }}
                              selectTextOnFocus
                            />

                            <TouchableOpacity
                              activeOpacity={0.6}
                              onPress={() => handleStepAdjust(ex.id, s.id, 'actualReps', 1)}
                              style={[styles.stepBtn, { backgroundColor: colors.subCard }]}
                              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            >
                              <Text style={[styles.stepBtnText, { color: colors.text }]}>
                                +
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Completed toggle */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleToggleCompleteSet(ex.id, s)}
                          style={styles.tdDone}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          {isDone ? (
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: colors.accent,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons name="checkmark" size={15} color={colors.accentText} />
                            </View>
                          ) : (
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                borderWidth: 2,
                                borderColor: colors.border,
                              }}
                            />
                          )}
                        </TouchableOpacity>

                        {/* Remove set */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleRemoveSet(ex.id, s.id)}
                          style={styles.tdAction}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                {/* Add set button */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleAddSet(ex.id)}
                  style={[styles.addSetBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.addSetBtnText, { color: colors.text }]}>
                    {t('editor.add_set', '+ Додати підхід')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </SwipeableExerciseCard>
      </View>
    );
  };

  return (
    <ScreenGestureWrapper enableTabSwipe={false} enableBackSwipe={true} onBack={handleBack}>
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Header Bar */}
      <Animated.View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - topBarHeight) > 2) {
            setTopBarHeight(h);
          }
        }}
        style={[
          styles.topBar,
          {
            backgroundColor: colors.bg,
            marginTop: topBarAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -topBarHeight],
            }),
            opacity: topBarAnim.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [1, 0.2, 0],
            }),
            overflow: 'hidden',
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBack}
          style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Назад"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setEditTitleValue(workout.title || 'Тренування');
              setIsEditTitleModalOpen(true);
            }}
            style={styles.headerTitleRow}
            accessibilityRole="button"
            accessibilityLabel="Редагувати назву тренування"
          >
            <Text numberOfLines={1} style={[styles.topBarTitle, { color: colors.text }]}>
              {workout.title || 'Тренування'}
            </Text>
            <Ionicons name="pencil" size={13} color={colors.textSecondary} style={{ marginLeft: 5 }} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsDatePickerOpen(true)}
            style={styles.headerDateRow}
            accessibilityRole="button"
            accessibilityLabel="Вибрати дату тренування"
          >
            <Text style={[styles.topBarDateText, { color: colors.textSecondary }]}>
              {formatDateDDMMYYYY(workout.scheduledDate)}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setTemplateName(workout.title || 'Моє тренування');
              setIsTemplateModalOpen(true);
            }}
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Зберегти як шаблон"
          >
            <Ionicons name="bookmark-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <DatePickerModal
        visible={isDatePickerOpen}
        selectedDate={workout.scheduledDate}
        onClose={() => setIsDatePickerOpen(false)}
        onSelectDate={(newIso: string) => {
          handleUpdateDate(newIso);
          setIsDatePickerOpen(false);
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.contentScroll,
            { paddingBottom: 40 + Math.max(insets.bottom, 16) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Empty Prompt if empty */}
          {exercises.length === 0 && (
            <Card style={styles.emptyPromptCard}>
              <Ionicons name="barbell-outline" size={36} color={isDark ? '#71717a' : '#a1a1aa'} />
              <Text style={[styles.emptyPromptTitle, isDark ? styles.textDark : styles.textLight]}>
                У цьому тренуванні ще немає вправ
              </Text>
              <Text style={[styles.emptyPromptSub, isDark ? styles.subDark : styles.subLight]}>
                Додайте вправи з каталогу нижче, щоб розпочати тренування.
              </Text>
            </Card>
          )}

          {/* Exercises List (Grouped with Supersets & Drag and Drop) */}
          {exerciseGroups.map((group) => (
            <React.Fragment key={group.id}>
              {group.exercises.map(({ ex, globalIndex }) => (
                <DraggableExerciseItem
                  key={ex.id || `ex_${globalIndex}`}
                  exerciseId={ex.id}
                  scrollRef={scrollViewRef}
                  isHoveredTarget={hoveredTargetId === ex.id}
                  isUnlinkTarget={isUnlinkMode && activeDragIdRef.current === ex.id}
                  isDark={isDark}
                  onDragStart={handleStartDrag}
                  onDragUpdate={handleUpdateDrag}
                  onDragEnd={handleEndDrag}
                  onMeasureLayout={handleMeasureCardLayout}
                >
                  {renderExerciseCard(ex, globalIndex)}
                </DraggableExerciseItem>
              ))}
            </React.Fragment>
          ))}

          {/* Add Exercise Big Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsSelectorOpen(true)}
            style={[styles.bigAddExerciseBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Ionicons name="add" size={20} color={colors.accent} />
            <Text style={[styles.bigAddExerciseText, { color: colors.text }]}>
              {t('editor.add_exercise', 'Додати вправу з каталогу')}
            </Text>
          </TouchableOpacity>

          {/* Delete Workout Secondary Option at Bottom */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleDeleteWorkout}
            style={[
              styles.deleteWorkoutBottomBtn,
              isDark ? styles.deleteWorkoutBottomBtnDark : styles.deleteWorkoutBottomBtnLight,
            ]}
          >
            <Ionicons name="trash-outline" size={17} color="#ef4444" />
            <Text style={styles.deleteWorkoutBottomBtnText}>{t('editor.delete_workout', 'Видалити тренування')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Exercise Selector Modal */}
      <ExerciseSelectorModal
        visible={isSelectorOpen}
        userId={user?.id || (workout?.userId || traineeId)}
        traineeId={
          workout?.userId && user?.id && workout.userId !== user.id
            ? workout.userId
            : (traineeId && user?.id && traineeId !== user.id ? traineeId : undefined)
        }
        onClose={() => {
          setIsSelectorOpen(false);
          setExerciseToReplaceId(null);
        }}
        onSelectExercise={handleSelectExercise}
      />

      {/* Reps Range Picker Modal */}
      <Modal
        visible={Boolean(activeRepsPickerWeId)}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveRepsPickerWeId(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setActiveRepsPickerWeId(null)}
          style={styles.repsModalOverlay}
        >
          <View
            style={[
              styles.repsModalContent,
              isDark ? styles.repsModalDark : styles.repsModalLight,
            ]}
          >
            <View style={styles.repsModalHeader}>
              <Text style={[styles.repsModalTitle, isDark ? styles.textDark : styles.textLight]}>
                Повторити:
              </Text>
              <TouchableOpacity
                onPress={() => setActiveRepsPickerWeId(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={isDark ? '#a1a1aa' : '#71717a'} />
              </TouchableOpacity>
            </View>

            <View style={styles.repsModalList}>
              {(() => {
                const list = user?.customRepRanges && user.customRepRanges.length > 0
                  ? [...user.customRepRanges]
                  : [...DEFAULT_REPS_RANGES];
                const currentEx = exercises.find((e) => e.id === activeRepsPickerWeId);
                const currentVal = currentEx?.targetRepsRange || currentEx?.sets?.[0]?.targetRepsRange;
                if (currentVal && !list.includes(currentVal)) {
                  list.push(currentVal);
                }
                return list.map((rng) => {
                  const isSelected = (currentVal || '8-12') === rng;

                  return (
                    <TouchableOpacity
                      key={rng}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (activeRepsPickerWeId) {
                          handleTargetRepsRangeChange(activeRepsPickerWeId, rng);
                        }
                        setActiveRepsPickerWeId(null);
                      }}
                      style={[
                        styles.repsModalItem,
                        isSelected && (isDark ? styles.repsModalItemActiveDark : styles.repsModalItemActiveLight),
                      ]}
                    >
                      <Text
                        style={[
                          styles.repsModalItemText,
                          isSelected
                            ? (isDark ? styles.repsModalItemTextActiveDark : styles.repsModalItemTextActiveLight)
                            : (isDark ? styles.textDark : styles.textLight),
                        ]}
                      >
                        {rng}
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={isDark ? '#F8FAFC' : '#0F172A'}
                        />
                      )}
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Title Modal */}
      <Modal
        visible={isEditTitleModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditTitleModalOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsEditTitleModalOpen(false)}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.simpleModalContent,
              isDark ? styles.modalContentDark : styles.modalContentLight,
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.simpleModalTitle, isDark ? styles.textDark : styles.textLight]}>
              Назва тренування
            </Text>
            <TextInput
              style={[
                styles.simpleModalInput,
                isDark ? styles.modalInputDark : styles.modalInputLight,
              ]}
              value={editTitleValue}
              onChangeText={setEditTitleValue}
              placeholder="Введіть назву..."
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveEditedTitle}
            />
            <View style={styles.simpleModalButtons}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsEditTitleModalOpen(false)}
                style={[styles.simpleModalCancelBtn, isDark ? styles.modalBtnDark : styles.modalBtnLight]}
              >
                <Text style={[styles.simpleModalCancelText, isDark ? styles.subDark : styles.subLight]}>
                  Скасувати
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleSaveEditedTitle}
                style={styles.simpleModalConfirmBtn}
              >
                <Text style={styles.simpleModalConfirmText}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Save Template Modal */}
      <Modal
        visible={isTemplateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !isSavingTemplate && setIsTemplateModalOpen(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => !isSavingTemplate && setIsTemplateModalOpen(false)}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.simpleModalContent,
              isDark ? styles.modalContentDark : styles.modalContentLight,
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.simpleModalTitle, isDark ? styles.textDark : styles.textLight]}>
              Зберегти як шаблон
            </Text>
            <Text style={[styles.simpleModalSub, isDark ? styles.subDark : styles.subLight]}>
              Введіть назву для нового шаблону тренування
            </Text>
            <TextInput
              style={[
                styles.simpleModalInput,
                isDark ? styles.modalInputDark : styles.modalInputLight,
              ]}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="Назва шаблону..."
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveAsTemplate}
            />
            <View style={styles.simpleModalButtons}>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isSavingTemplate}
                onPress={() => setIsTemplateModalOpen(false)}
                style={[styles.simpleModalCancelBtn, isDark ? styles.modalBtnDark : styles.modalBtnLight]}
              >
                <Text style={[styles.simpleModalCancelText, isDark ? styles.subDark : styles.subLight]}>
                  Скасувати
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isSavingTemplate || !templateName.trim()}
                onPress={handleSaveAsTemplate}
                style={[
                  styles.simpleModalConfirmBtn,
                  (!templateName.trim() || isSavingTemplate) && { opacity: 0.5 },
                ]}
              >
                {isSavingTemplate ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.simpleModalConfirmText}>Зберегти</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      </SafeAreaView>
    </ScreenGestureWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgLight: {
    backgroundColor: '#F8FAFC',
  },
  bgDark: {
    backgroundColor: '#0B1220',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0,
  },
  topBarLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  topBarDark: {
    backgroundColor: 'rgba(11, 18, 32, 0.95)',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  topBarSub: {
    fontSize: 11,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerDateRow: {
    marginTop: 2,
  },
  topBarDateText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  saveTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  saveTemplateBtnLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  saveTemplateBtnDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  saveTemplateBtnText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  simpleModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalContentLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  modalContentDark: {
    backgroundColor: '#182032',
    borderColor: '#334155',
  },
  simpleModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  simpleModalSub: {
    fontSize: 13,
    marginBottom: 14,
  },
  simpleModalInput: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalInputLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    color: '#0f172a',
  },
  modalInputDark: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    color: '#f8fafc',
  },
  simpleModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  simpleModalCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalBtnLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  modalBtnDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  simpleModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  simpleModalConfirmBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleModalConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  saveBannerText: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '600',
  },
  contentScroll: {
    padding: 14,
    gap: 14,
    paddingBottom: 110,
  },
  metaCard: {
    padding: 14,
    gap: 12,
  },
  metaHeaderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  titleInput: {
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 4,
  },
  dateInput: {
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 4,
  },
  presetsList: {
    gap: 6,
    paddingVertical: 4,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetChipLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  presetChipDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  presetChipActiveLight: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  presetChipActiveDark: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  presetChipTextActiveLight: {
    color: '#ffffff',
  },
  presetChipTextActiveDark: {
    color: '#ffffff',
  },
  metaDivider: {
    height: 1,
    borderTopWidth: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 2,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '700',
  },
  metricLbl: {
    fontSize: 10,
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 20,
    borderRightWidth: 1,
  },
  emptyPromptCard: {
    alignItems: 'center',
    padding: 24,
    gap: 10,
    borderStyle: 'dashed',
  },
  emptyPromptTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyPromptSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyPromptButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    width: '100%',
  },
  exerciseCardWrap: {
    borderRadius: 20,
  },
  swipeExerciseContainer: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  exerciseCardInner: {
    padding: 16,
    gap: 12,
  },
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
  },
  swipeActionsBg: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 152,
    flexDirection: 'row',
    borderRadius: 18,
    overflow: 'hidden',
    zIndex: 1,
  },
  swipeChangeBtn: {
    width: 76,
    height: '100%',
    backgroundColor: '#60A5FA',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeChangeBtnText: {
    color: '#0B1220',
    fontSize: 11,
    fontWeight: '700',
  },
  swipeDeleteBtn: {
    width: 76,
    height: '100%',
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeDeleteBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  swipeForeground: {
    borderRadius: 18,
    zIndex: 2,
  },
  exerciseCard: {
    padding: 14,
    gap: 10,
    borderRadius: 19,
  },
  exHeader: {
    gap: 6,
  },
  borderBottomLight: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  borderBottomDark: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
  },
  exHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reorderColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
    marginTop: -2,
  },
  reorderBtn: {
    paddingVertical: 0,
    paddingHorizontal: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exHeaderLeftTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  collapsedSummaryRow: {
    marginTop: 3,
  },
  collapsedSummaryText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  exIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1,
  },
  exIndexLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  exIndexDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  exIndexText: {
    fontSize: 11,
    fontWeight: '700',
  },
  exTitleContainer: {
    flex: 1,
  },
  exTitleText: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  exBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  muscleTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  muscleTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  supersetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  supersetBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  exCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    padding: 7,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  actionBtnDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  supersetToggleBtn: {
    padding: 7,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
  pastPerfBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pastPerfLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  pastPerfDark: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
  },
  pastPerfText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '500',
  },
  pastPerfApply: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
  },
  quickSelectorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickSelectorsRowLight: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  quickSelectorsRowDark: {
    backgroundColor: '#263140',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  repsDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectorLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  repsDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  repsDropdownBtnLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  repsDropdownBtnDark: {
    backgroundColor: '#1D2939',
    borderColor: '#334155',
  },
  repsDropdownBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  repsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  repsModalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  repsModalLight: {
    backgroundColor: '#FFFFFF',
  },
  repsModalDark: {
    backgroundColor: '#1D2939',
    borderWidth: 1,
    borderColor: '#334155',
  },
  repsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  repsModalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  repsModalList: {
    gap: 4,
  },
  repsModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  repsModalItemActiveLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  repsModalItemActiveDark: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
  },
  repsModalItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  repsModalItemTextActiveLight: {
    fontWeight: '700',
    color: '#2563EB',
  },
  repsModalItemTextActiveDark: {
    fontWeight: '700',
    color: '#60A5FA',
  },
  setsTable: {
    marginTop: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  thCell: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  thSet: {
    width: 32,
    textAlign: 'center',
  },
  thWeight: {
    flex: 1.35,
    textAlign: 'center',
  },
  thReps: {
    flex: 0.95,
    textAlign: 'center',
  },
  thDone: {
    width: 40,
    textAlign: 'center',
  },
  thAction: {
    width: 24,
  },
  setTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  setRowDivider: {
    borderTopWidth: 1,
  },
  setRowDoneLight: {
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
  },
  setRowDoneDark: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  tdSet: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberText: {
    fontSize: 12,
    fontWeight: '700',
  },
  warmupText: {
    color: '#60A5FA',
  },
  tdWeight: {
    flex: 1.35,
    paddingHorizontal: 2,
  },
  tdReps: {
    flex: 0.95,
    paddingHorizontal: 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stepBtn: {
    width: 30,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnLight: {
    backgroundColor: '#F1F5F9',
  },
  stepBtnDark: {
    backgroundColor: '#263140',
  },
  stepBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  numberInput: {
    flex: 1,
    height: 32,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    borderWidth: 1,
    paddingHorizontal: 2,
  },
  inputLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    color: '#0F172A',
  },
  inputDark: {
    backgroundColor: '#0B1220',
    borderColor: '#334155',
    color: '#F8FAFC',
  },
  tdDone: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tdAction: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 10,
  },
  addSetBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bigAddExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  bigAddExerciseText: {
    fontSize: 13,
    fontWeight: '600',
  },
  finishWorkoutBtn: {
    marginTop: 12,
    marginBottom: 6,
  },
  deleteWorkoutBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 16,
  },
  deleteWorkoutBottomBtnLight: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  deleteWorkoutBottomBtnDark: {
    backgroundColor: '#3f1218',
    borderColor: '#7f1d1d',
  },
  deleteWorkoutBottomBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  bottomLight: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
  },
  bottomDark: {
    backgroundColor: '#0B1220',
    borderTopColor: '#334155',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  textLight: {
    color: '#0F172A',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subLight: {
    color: '#64748B',
  },
  subDark: {
    color: '#94A3B8',
  },
  borderLight: {
    borderColor: '#E2E8F0',
  },
  borderDark: {
    borderColor: '#334155',
  },
  draggableItemContainer: {
    width: '100%',
  },
  draggableCardWrapper: {
    width: '100%',
    borderRadius: 20,
  },
  cardActiveDrag: {
    opacity: 0.96,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  cardHoveredTargetDark: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    borderRadius: 20,
  },
  cardHoveredTargetLight: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 20,
  },
  hoverTargetBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 100,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  hoverTargetBadgeText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  cardUnlinkTargetDark: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 20,
  },
  cardUnlinkTargetLight: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 20,
  },
  unlinkTargetBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: '#78350f',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 100,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  unlinkTargetBadgeText: {
    color: '#fef3c7',
    fontSize: 11,
    fontWeight: '700',
  },
});
