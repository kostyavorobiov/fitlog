import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
  LayoutAnimation,
  Platform,
  BackHandler,
  Animated,
  Easing,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { setSavedActiveTab } from '../components/InstagramTabPager';
import { Card } from '../components/Card';
import { UserAvatar } from '../components/UserAvatar';
import { ScreenGestureWrapper } from '../components/ScreenGestureWrapper';
import { useAuth } from '../context/AuthContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { TraineeService } from '../services/traineeService';
import { WorkoutService } from '../services/workoutService';
import * as Haptics from 'expo-haptics';
import { triggerRefreshSuccessHaptic } from '../utils/haptics';
import { User, WorkoutPlan, WorkoutExercise, WorkoutSet } from '../types/workout';
import { formatLocalDate, formatDateDDMMYYYY } from '../utils/date';
import { MonthGroup, getMonthKeyAndLabel, formatDateDDMMYY } from './WorkoutsScreen';
import { CreateWorkoutModal } from '../components/CreateWorkoutModal';
import { TraineeAnalyticsModal } from '../components/TraineeAnalyticsModal';
import { WorkoutTemplate, TemplateService } from '../services/templateService';
import { SwipeableActionCard } from '../components/SwipeableActionCard';

export const TraineesScreen: React.FC = () => {
  const { theme, colors, isDark } = useTheme();
  const router = useRouter();
  const { traineeId: paramTraineeId } = useLocalSearchParams<{ traineeId?: string }>();
  const { user, isAdmin, isCoach, isLoading: isAuthLoading } = useAuth();
  const isTrainer = isCoach || isAdmin || user?.role === 'coach';
  const { handleScroll } = useScrollTabBar();

  const [trainees, setTrainees] = useState<User[]>([]);
  const [selectedTrainee, setSelectedTrainee] = useState<User | null>(null);
  const [traineeWorkouts, setTraineeWorkouts] = useState<WorkoutPlan[]>([]);
  const [isLoadingTrainees, setIsLoadingTrainees] = useState<boolean>(true);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [addCodeInput, setAddCodeInput] = useState<string>('');
  const [isAddingTrainee, setIsAddingTrainee] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isCreateWorkoutModalVisible, setIsCreateWorkoutModalVisible] = useState<boolean>(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState<boolean>(false);
  const [isCreatingWorkout, setIsCreatingWorkout] = useState<boolean>(false);
  const isCreatingWorkoutRef = React.useRef(false);
  const [openTraineeMonths, setOpenTraineeMonths] = useState<Record<string, boolean>>({});
  const [expandedWorkoutIds, setExpandedWorkoutIds] = useState<Record<string, boolean>>({});

  const traineeWorkoutsRef = useRef<WorkoutPlan[]>([]);
  traineeWorkoutsRef.current = traineeWorkouts;
  const selectedTraineeRef = useRef<User | null>(null);
  selectedTraineeRef.current = selectedTrainee;
  const isInitialLoadRef = useRef(true);
  const currentTraineeIdRef = useRef<string | null>(null);

  const insets = useSafeAreaInsets();
  const topBarAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isTopBarVisibleRef = useRef(true);
  const accumulatedDown = useRef(0);
  const accumulatedUp = useRef(0);
  const [topBarHeight, setTopBarHeight] = useState(56);

  const handleBackToProfile = useCallback(() => {
    setSavedActiveTab('profile');
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackToProfile();
      return true;
    });
    return () => {
      setSavedActiveTab('profile');
      sub.remove();
    };
  }, [handleBackToProfile]);

  const handleCombinedScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScroll(event);
      const currentY = event.nativeEvent.contentOffset.y;
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
    [handleScroll, topBarAnim]
  );

  // Group trainee workouts by calendar month (YYYY-MM), sorted newest to oldest
  const sortedTraineeWorkouts = useMemo(() => {
    return [...traineeWorkouts].sort((a, b) => {
      const dateA = a.scheduledDate || a.createdAt || '';
      const dateB = b.scheduledDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
  }, [traineeWorkouts]);

  const traineeMonthGroups: MonthGroup[] = useMemo(() => {
    const map = new Map<string, { label: string; workouts: WorkoutPlan[] }>();
    for (const w of sortedTraineeWorkouts) {
      const { key, label } = getMonthKeyAndLabel(w.scheduledDate);
      if (!map.has(key)) {
        map.set(key, { label, workouts: [] });
      }
      map.get(key)!.workouts.push(w);
    }
    const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return keys.map((key) => ({
      key,
      label: map.get(key)!.label,
      workouts: map.get(key)!.workouts,
    }));
  }, [sortedTraineeWorkouts]);

  useEffect(() => {
    if (traineeMonthGroups.length > 0 && Object.keys(openTraineeMonths).length === 0) {
      setOpenTraineeMonths({ [traineeMonthGroups[0].key]: true });
    }
  }, [traineeMonthGroups]);

  const toggleTraineeMonth = (key: string) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpenTraineeMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };


  // Load trainees for the current coach
  const loadTrainees = useCallback(async () => {
    if (!user?.id || !isTrainer) {
      setIsLoadingTrainees(false);
      return;
    }

    try {
      const list = await TraineeService.getTrainees(user.id);
      setTrainees(list);

      // Select by paramTraineeId if provided, or keep currently selected, or fallback to first
      setSelectedTrainee((prev) => {
        if (paramTraineeId) {
          const matchParam = list.find((t) => t.id === paramTraineeId);
          if (matchParam) return matchParam;
        }
        if (prev) {
          const found = list.find((t) => t.id === prev.id);
          if (found) {
            if (prev.id === found.id && prev.name === found.name && prev.email === found.email) {
              return prev;
            }
            return found;
          }
          return list[0] || null;
        }
        return list[0] || null;
      });
    } catch (e) {
      console.warn('[TraineesScreen.loadTrainees] Error:', e);
    } finally {
      setIsLoadingTrainees(false);
      setIsRefreshing(false);
    }
  }, [user?.id, isTrainer, paramTraineeId]);

  // Load workouts for selected trainee
  const loadTraineeWorkouts = useCallback(async (traineeId: string, silent = false) => {
    if (!traineeId) {
      setTraineeWorkouts([]);
      currentTraineeIdRef.current = null;
      return;
    }

    const isDifferentTrainee = currentTraineeIdRef.current !== traineeId;
    currentTraineeIdRef.current = traineeId;

    // Only show full loading indicator if switching trainees or initial empty state with non-silent call
    if (!silent && (isDifferentTrainee || traineeWorkoutsRef.current.length === 0)) {
      setIsLoadingWorkouts(true);
    }
    try {
      const data = await WorkoutService.getWorkouts(traineeId);
      setTraineeWorkouts(data);
    } catch (e) {
      console.warn('[TraineesScreen.loadTraineeWorkouts] Error:', e);
    } finally {
      setIsLoadingWorkouts(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        loadTrainees();
      } else {
        // Silently refresh workouts in the background on return without any spinners or layout effects
        if (selectedTraineeRef.current?.id) {
          loadTraineeWorkouts(selectedTraineeRef.current.id, true);
        }
      }
    }, [loadTrainees, loadTraineeWorkouts])
  );

  useEffect(() => {
    if (selectedTrainee?.id) {
      loadTraineeWorkouts(selectedTrainee.id);
    } else {
      setTraineeWorkouts([]);
    }
  }, [selectedTrainee?.id, loadTraineeWorkouts]);

  useEffect(() => {
    if (paramTraineeId && trainees.length > 0) {
      const match = trainees.find((t) => t.id === paramTraineeId);
      if (match && selectedTrainee?.id !== match.id) {
        setSelectedTrainee(match);
      }
    }
  }, [paramTraineeId, trainees, selectedTrainee?.id]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadTrainees();
      if (selectedTraineeRef.current) {
        await loadTraineeWorkouts(selectedTraineeRef.current.id, true);
      }
    } catch (e) {
      console.warn('[TraineesScreen.onRefresh] Error:', e);
    } finally {
      setIsRefreshing(false);
      await triggerRefreshSuccessHaptic();
    }
  }, [loadTrainees, loadTraineeWorkouts]);

  // Copy coach code to clipboard
  const handleCopyCoachCode = async () => {
    const code = user?.profileCode || user?.id || '';
    if (!code) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      } else {
        await Share.share({ message: code, title: 'Код тренера' });
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.warn('[handleCopyCoachCode] Error:', e);
    }
  };

  // Add trainee by code, email or ID
  const handleAddTrainee = async () => {
    const clean = addCodeInput.trim();
    if (!clean) {
      Alert.alert('Помилка', 'Введіть ID, код або email підопічного');
      return;
    }
    if (!user?.id) return;

    setIsAddingTrainee(true);
    try {
      const result = await TraineeService.addTraineeByCode(user.id, clean);
      if (result.success) {
        setAddCodeInput('');
        Alert.alert('Успішно', result.message);
        await loadTrainees();
        if (result.trainee) {
          setSelectedTrainee(result.trainee);
        }
      } else {
        Alert.alert('Помилка', result.message);
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося додати підопічного');
    } finally {
      setIsAddingTrainee(false);
    }
  };

  // Unlink trainee from coach
  const handleUnlinkTrainee = (trainee: User) => {
    if (!user?.id) return;

    Alert.alert(
      'Відкріпити підопічного?',
      `Ви впевнені, що хочете відкріпити «${trainee.name}»? Його тренування залишаться в системі.`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Відкріпити',
          style: 'destructive',
          onPress: async () => {
            const ok = await TraineeService.unlinkTrainee(user.id, trainee.id);
            if (ok) {
              await loadTrainees();
            } else {
              Alert.alert('Помилка', 'Не вдалося відкріпити підопічного');
            }
          },
        },
      ]
    );
  };

  // Open create workout modal for selected trainee
  const handleCreateWorkoutForTrainee = () => {
    if (!selectedTrainee || !user) {
      Alert.alert('Помилка', 'Оберіть підопічного для створення тренування');
      return;
    }
    setIsCreateWorkoutModalVisible(true);
  };

  // Submit new workout for selected trainee (custom title + date OR from coach template)
  const handleCreateWorkoutSubmit = async (
    title: string,
    scheduledDate: string,
    notes: string,
    template?: WorkoutTemplate
  ) => {
    if (!selectedTrainee || !user) return;
    setIsCreatingWorkout(true);

    try {
      let newWorkout: WorkoutPlan;
      if (template) {
        newWorkout = TemplateService.createWorkoutFromTemplate(
          template,
          selectedTrainee.id,
          scheduledDate || formatLocalDate()
        );
        newWorkout.assignedByCoachId = user.id;
        if (title.trim()) newWorkout.title = title.trim();
        if (notes.trim()) newWorkout.notes = notes.trim();
      } else {
        const workoutId = `wo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        newWorkout = {
          id: workoutId,
          userId: selectedTrainee.id,
          assignedByCoachId: user.id,
          title: title.trim() || `Тренування для ${selectedTrainee.firstName || selectedTrainee.name}`,
          scheduledDate: scheduledDate || formatLocalDate(),
          status: 'planned',
          completedAt: null,
          notes: notes.trim(),
          createdAt: new Date().toISOString(),
          exercises: [],
        };
      }

      const ok = await WorkoutService.saveWorkout(newWorkout);
      if (ok) {
        setTraineeWorkouts((prev) => [newWorkout, ...prev.filter((w) => w.id !== newWorkout.id)]);
        setIsCreateWorkoutModalVisible(false);
        try {
          router.push({
            pathname: '/workout/[id]',
            params: { id: newWorkout.id, traineeId: selectedTrainee.id },
          });
        } catch (navErr) {
          console.warn('[TraineesScreen] Navigation to editor failed:', navErr);
        }
      } else {
        Alert.alert('Помилка', 'Не вдалося зберегти тренування');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося створити тренування');
    } finally {
      setIsCreatingWorkout(false);
    }
  };

  const toggleWorkoutExpand = (workoutId: string) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedWorkoutIds((prev) => ({
      ...prev,
      [workoutId]: !prev[workoutId],
    }));
  };

  // Normal delete workout of trainee with alert confirmation
  const handleDeleteTraineeWorkout = useCallback(
    (workout: WorkoutPlan, onCancel?: () => void) => {
      if (!selectedTrainee) return;

      Alert.alert(
        'Видалити тренування?',
        `Видалити «${workout.title || 'це тренування'}» для підопічного ${selectedTrainee.name}?`,
        [
          {
            text: 'Скасувати',
            style: 'cancel',
            onPress: () => onCancel?.(),
          },
          {
            text: 'Видалити',
            style: 'destructive',
            onPress: async () => {
              setTraineeWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
              try {
                const ok = await WorkoutService.deleteWorkout(
                  selectedTrainee.id,
                  workout.id,
                  user?.id
                );
                if (!ok) {
                  setTraineeWorkouts((prev) => [workout, ...prev]);
                  Alert.alert('Помилка', 'Не вдалося видалити тренування');
                }
              } catch (e) {
                setTraineeWorkouts((prev) => [workout, ...prev]);
                Alert.alert('Помилка', 'Помилка видалення');
              }
            },
          },
        ]
      );
    },
    [selectedTrainee, user?.id]
  );

  // Quick delete trainee workout (swipe > 50%) delegates to single confirmation
  const handleQuickDeleteTraineeWorkout = useCallback(
    (workout: WorkoutPlan, onCancel?: () => void) => {
      handleDeleteTraineeWorkout(workout, onCancel);
    },
    [handleDeleteTraineeWorkout]
  );

  // Copy trainee workout with cloned exercises and sets
  const handleCopyTraineeWorkout = useCallback(
    async (source: WorkoutPlan) => {
      if (!selectedTrainee) return;
      try {
        const today = new Date().toISOString().split('T')[0];
        const newWorkoutId = `wo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const clonedExercises: WorkoutExercise[] = (source.exercises || []).map((ex, exIdx) => {
          const weId = `we_${Date.now()}_${exIdx}_${Math.random().toString(36).substring(2, 6)}`;
          const clonedSets: WorkoutSet[] = (ex.sets || []).map((s, sIdx) => ({
            id: `set_${Date.now()}_${exIdx}_${sIdx}_${Math.random().toString(36).substring(2, 5)}`,
            workoutExerciseId: weId,
            setNumber: sIdx + 1,
            targetRepsRange: s.targetRepsRange || ex.targetRepsRange || '8-12',
            weight: Number(s.weight) || 0,
            actualReps: s.actualReps !== null && s.actualReps !== undefined ? Number(s.actualReps) : 10,
            completedAt: null,
            isWarmup: Boolean(s.isWarmup),
          }));
          return {
            ...ex,
            id: weId,
            workoutPlanId: newWorkoutId,
            sets: clonedSets,
          };
        });

        const copied: WorkoutPlan = {
          ...source,
          id: newWorkoutId,
          userId: selectedTrainee.id,
          assignedByCoachId: user?.id,
          title: `${source.title || 'Тренування'} (Копія)`,
          scheduledDate: today,
          status: 'planned',
          createdAt: new Date().toISOString(),
          completedAt: null,
          exercises: clonedExercises,
        };

        const ok = await WorkoutService.saveWorkout(copied);
        if (ok) {
          setTraineeWorkouts((prev) => [copied, ...prev]);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {}
        } else {
          Alert.alert('Помилка', 'Не вдалося скопіювати тренування');
        }
      } catch (e: any) {
        Alert.alert('Помилка', e?.message || 'Не вдалося скопіювати тренування');
      }
    },
    [selectedTrainee, user?.id]
  );

  if (isAuthLoading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Завантаження...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isTrainer) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.topBar, { backgroundColor: colors.bg, borderBottomWidth: 0 }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleBackToProfile}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text numberOfLines={1} style={[styles.topBarTitle, { color: colors.text }]}>
              Підопічні
            </Text>
            <Text numberOfLines={1} style={[styles.topBarSub, { color: colors.textSecondary }]}>
              Розділ для тренерів
            </Text>
          </View>

          <View style={styles.headerRightActions} />
        </View>
        <View style={styles.nonCoachContainer}>
          <View style={[styles.nonCoachIconWrap, { backgroundColor: colors.subCard }]}>
            <Ionicons name="shield-outline" size={48} color={colors.accent} />
          </View>
          <Text style={[styles.nonCoachTitle, { color: colors.text }]}>
            Доступ лише для тренерів
          </Text>
          <Text style={[styles.nonCoachDesc, { color: colors.textSecondary }]}>
            Цей розділ призначений для перегляду та складання тренувальних планів ваших спортсменів.
          </Text>
          <TouchableOpacity
            style={[styles.goToProfileBtn, { backgroundColor: colors.accent }]}
            onPress={handleBackToProfile}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={18} color={colors.accentText} />
            <Text style={[styles.goToProfileBtnText, { color: colors.accentText }]}>
              Перейти у профіль
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const coachCode = user?.profileCode || user?.id || '';

  return (
    <ScreenGestureWrapper enableTabSwipe={false} enableBackSwipe={true} onBack={handleBackToProfile}>
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
            { backgroundColor: colors.bg, borderBottomWidth: 0 },
            Platform.OS === 'web' && ({ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any),
            {
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
            onPress={handleBackToProfile}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text numberOfLines={1} style={[styles.topBarTitle, { color: colors.text }]}>
              Підопічні
            </Text>
            <Text numberOfLines={1} style={[styles.topBarSub, { color: colors.textSecondary }]}>
              {selectedTrainee ? `Обрано: ${selectedTrainee.name || selectedTrainee.email}` : 'Складання планів та контроль прогресу'}
            </Text>
          </View>

          <View style={styles.headerRightActions} />
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        onScroll={handleCombinedScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Coach Code Sharing Box */}
        <Card style={styles.coachCodeCard}>
          <View style={styles.coachCodeRow}>
            <View style={styles.coachCodeLeft}>
              <View style={[styles.codeIconWrap, { backgroundColor: colors.subCard }]}>
                <Ionicons name="key-outline" size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>
                  Ваш код тренера
                </Text>
                <Text style={[styles.codeValue, { color: colors.text }]}>
                  {coachCode}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.copyBtn, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}
              onPress={handleCopyCoachCode}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copiedCode ? 'checkmark' : 'copy-outline'}
                size={16}
                color={copiedCode ? '#22c55e' : colors.text}
              />
              <Text
                style={[
                  styles.copyBtnText,
                  copiedCode ? { color: '#22c55e' } : { color: colors.text },
                ]}
              >
                {copiedCode ? 'Скопійовано' : 'Копіювати'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Add Trainee Form Card */}
        <Card style={styles.addTraineeCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Прикріпити нового підопічного
          </Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
            Введіть персональний код, ID або email спортсмена
          </Text>

          <View style={styles.inputRow}>
            <View style={[styles.inputWrap, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}>
              <Ionicons name="person-add-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Код або email підопічного..."
                placeholderTextColor={colors.textSecondary}
                value={addCodeInput}
                onChangeText={setAddCodeInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.addBtn,
                { backgroundColor: colors.accent },
                isAddingTrainee && styles.addBtnDisabled,
              ]}
              onPress={handleAddTrainee}
              disabled={isAddingTrainee}
              activeOpacity={0.8}
            >
              {isAddingTrainee ? (
                <ActivityIndicator size="small" color={colors.accentText} />
              ) : (
                <>
                  <Ionicons name="add" size={18} color={colors.accentText} />
                  <Text style={[styles.addBtnText, { color: colors.accentText }]}>
                    Додати
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Trainees List Selector */}
        {isLoadingTrainees && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Завантаження підопічних...
            </Text>
          </View>
        ) : trainees.length === 0 ? (
          /* Empty Trainees State */
          <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.emptyIconBox, { backgroundColor: colors.subCard }]}>
              <Ionicons name="people-outline" size={26} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              У вас ще немає підопічних
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Поділіться кодом тренера ({coachCode}) зі своїм атлетом або введіть його код вище, щоб розпочати співпрацю.
            </Text>
          </View>
        ) : (
          <>
            {/* Trainee Horizontal Switcher */}
            <View style={styles.traineeSelectorSection}>
              <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>
                СПИСОК ПІДОПІЧНИХ ({trainees.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.traineeListScroll}
              >
                {trainees.map((t) => {
                  const isSelected = selectedTrainee?.id === t.id;
                  const initials = (t.name || 'П').slice(0, 2).toUpperCase();

                  return (
                    <TouchableOpacity
                      key={t.id}
                      activeOpacity={0.7}
                      onPress={() => setSelectedTrainee(t)}
                      style={[
                        styles.traineePill,
                        isSelected
                          ? { backgroundColor: colors.accent, borderColor: colors.accent }
                          : { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      ]}
                    >
                      <UserAvatar image={t.image} name={t.name} size="xs" />
                      <View style={styles.pillTextWrap}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.pillName,
                            isSelected
                              ? { color: colors.accentText, fontWeight: '700' }
                              : { color: colors.text },
                          ]}
                        >
                          {t.name}
                        </Text>
                        <Text
                          style={[
                            styles.pillCode,
                            isSelected
                              ? { color: colors.accentText }
                              : { color: colors.textSecondary },
                          ]}
                        >
                          {t.profileCode}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Selected Trainee Management Card */}
            {selectedTrainee && (
              <>
                <Card style={styles.selectedTraineeCard}>
                <View style={[styles.traineeHeaderRow, { borderBottomColor: colors.cardBorder }]}>
                  <View style={styles.traineeHeaderLeft}>
                    <UserAvatar image={selectedTrainee.image} name={selectedTrainee.name} size="lg" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.traineeNameTitle, { color: colors.text }]}>
                        {selectedTrainee.name}
                      </Text>
                      <Text style={[styles.traineeEmailSub, { color: colors.textSecondary }]}>
                        {selectedTrainee.email || `Код: ${selectedTrainee.profileCode}`}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.unlinkBtn}
                    onPress={() => handleUnlinkTrainee(selectedTrainee)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="person-remove-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                {/* Trainee Action Buttons */}
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={[styles.createWorkoutBtn, { backgroundColor: colors.accent }]}
                    activeOpacity={0.8}
                    onPress={handleCreateWorkoutForTrainee}
                  >
                    <Ionicons name="add-circle" size={18} color={colors.accentText} />
                    <Text style={[styles.createWorkoutBtnText, { color: colors.accentText }]}>
                      Додати тренування
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.analyticsBtn, { backgroundColor: colors.subCard, borderColor: colors.cardBorder }]}
                    activeOpacity={0.8}
                    onPress={() => setIsAnalyticsModalOpen(true)}
                  >
                    <Ionicons name="stats-chart-outline" size={16} color={colors.text} />
                    <Text style={[styles.analyticsBtnText, { color: colors.text }]}>
                      Аналітика
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>

              {/* Trainee Workouts Section */}
              <View style={styles.traineeWorkoutsSection}>
                {/* Trainee Workouts Header */}
                <View style={styles.workoutsHeaderRow}>
                  <Text style={[styles.workoutsSectionTitle, { color: colors.text }]}>
                    Тренування підопічного
                  </Text>
                  <View style={[styles.countBadge, { backgroundColor: colors.subCard }]}>
                    <Text style={[styles.countBadgeText, { color: colors.text }]}>{traineeWorkouts.length}</Text>
                  </View>
                </View>

                {/* Trainee Workouts List */}
                {isLoadingWorkouts ? (
                  <View style={styles.centerContainer}>
                    <ActivityIndicator size="small" color={colors.accent} />
                  </View>
                ) : traineeWorkouts.length === 0 ? (
                  <View style={[styles.noWorkoutsWrap, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={[styles.emptyIconBox, { backgroundColor: colors.subCard }]}>
                      <Ionicons name="barbell-outline" size={24} color={colors.textSecondary} />
                    </View>
                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                      У підопічного немає запланованих тренувань. Натисніть «Додати тренування», щоб скласти перший план.
                    </Text>
                    <TouchableOpacity
                      style={[styles.firstWorkoutBtn, { backgroundColor: colors.accent }]}
                      activeOpacity={0.8}
                      onPress={handleCreateWorkoutForTrainee}
                    >
                      <Ionicons name="add-circle" size={16} color={colors.accentText} />
                      <Text style={[styles.firstWorkoutBtnText, { color: colors.accentText }]}>
                        Скласти перше тренування
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.accordionContainer}>
                    {traineeMonthGroups.map((group) => {
                      const isOpen = Boolean(openTraineeMonths[group.key]);

                      return (
                        <View key={group.key} style={styles.monthSection}>
                          {/* Month Accordion Header */}
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => toggleTraineeMonth(group.key)}
                            style={[
                              styles.monthHeader,
                              { backgroundColor: colors.subCard },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`${group.label}, ${group.workouts.length} тренувань`}
                          >
                            <View style={styles.monthHeaderLeft}>
                              <Text style={[styles.monthTitle, { color: colors.text }]}>
                                {group.label}
                              </Text>
                              <View style={[styles.monthCountBadge, { backgroundColor: colors.card }]}>
                                <Text style={[styles.monthCountText, { color: colors.textSecondary }]}>
                                  {group.workouts.length}
                                </Text>
                              </View>
                            </View>
                            <Ionicons
                              name={isOpen ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color={colors.textSecondary}
                            />
                          </TouchableOpacity>

                          {/* Month Workouts List */}
                          {isOpen && (
                            <View style={styles.monthWorkoutsList}>
                              {group.workouts.map((w) => {
                                const isCompleted = w.status === 'completed';
                                const isInProgress = w.status === 'in_progress';
                                const exerciseCount = w.exercises?.length || 0;
                                const setsCount = (w.exercises || []).reduce(
                                  (acc, ex) => acc + (ex.sets?.length || 0),
                                  0
                                );
                                const isExpanded = Boolean(expandedWorkoutIds[w.id]);

                                return (
                                  <SwipeableActionCard
                                    key={w.id}
                                    id={w.id}
                                    isDark={isDark}
                                    onCopy={() => handleCopyTraineeWorkout(w)}
                                    onDelete={(onCancel) => handleDeleteTraineeWorkout(w, onCancel)}
                                    onQuickDelete={(onCancel) => handleQuickDeleteTraineeWorkout(w, onCancel)}
                                  >
                                    <TouchableOpacity
                                      activeOpacity={0.7}
                                      onPress={() =>
                                        router.push({
                                          pathname: '/workout/[id]',
                                          params: { id: w.id, traineeId: selectedTrainee.id },
                                        })
                                      }
                                    >
                                      <View style={styles.workoutCard}>
                                        {/* Top Row: Status, Expand Chevron */}
                                        <View style={styles.cardTopRow}>
                                          <View style={styles.cardBadgesRow}>
                                            <Text
                                              style={[
                                                styles.statusText,
                                                {
                                                  color: isCompleted
                                                    ? '#22C55E'
                                                    : isInProgress
                                                    ? colors.accent
                                                    : colors.textSecondary,
                                                  fontWeight: (isCompleted || isInProgress) ? '700' : '600',
                                                },
                                              ]}
                                            >
                                              {isCompleted ? 'Завершено' : isInProgress ? 'У процесі' : 'Заплановано'}
                                            </Text>
                                          </View>

                                          {/* Expand Exercises Button */}
                                          {exerciseCount > 0 && (
                                            <TouchableOpacity
                                              style={styles.workoutExpandBtn}
                                              onPress={() => toggleWorkoutExpand(w.id)}
                                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                              accessibilityRole="button"
                                              accessibilityLabel={isExpanded ? 'Згорнути перелік вправ' : 'Розгорнути перелік вправ'}
                                            >
                                              <Ionicons
                                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                                size={18}
                                                color={colors.textSecondary}
                                              />
                                            </TouchableOpacity>
                                          )}
                                        </View>

                                        {/* Workout Title */}
                                        <Text
                                          numberOfLines={1}
                                          style={[styles.workoutTitle, { color: colors.text }]}
                                        >
                                          {w.title || 'Тренування без назви'}
                                        </Text>

                                        {/* Metrics Row: Date · Exercises · Sets */}
                                        <View style={styles.cardMetricsRow}>
                                          <View style={styles.metricItem}>
                                            <Ionicons
                                              name="calendar-outline"
                                              size={13}
                                              color={colors.textSecondary}
                                            />
                                            <Text style={[styles.metricText, { color: colors.textSecondary }]}>
                                              {formatDateDDMMYY(w.scheduledDate)}
                                            </Text>
                                          </View>

                                          <Text style={[styles.dotSep, { color: colors.textSecondary }]}>·</Text>

                                          <View style={styles.metricItem}>
                                            <Ionicons
                                              name="layers-outline"
                                              size={14}
                                              color={colors.textSecondary}
                                            />
                                            <Text style={[styles.metricText, { color: colors.textSecondary }]}>
                                              <Text style={[styles.metricVal, { color: colors.text }]}>
                                                {exerciseCount}
                                              </Text>{' '}
                                              {exerciseCount === 1 ? 'вправа' : 'вправ'}
                                            </Text>
                                          </View>

                                          <Text style={[styles.dotSep, { color: colors.textSecondary }]}>·</Text>

                                          <View style={styles.metricItem}>
                                            <Text style={[styles.metricText, { color: colors.textSecondary }]}>
                                              <Text style={[styles.metricVal, { color: colors.text }]}>
                                                {setsCount}
                                              </Text>{' '}
                                              підходів
                                            </Text>
                                          </View>
                                        </View>

                                        {/* Expanded Exercise Badges List matching user screenshot */}
                                        {isExpanded && (w.exercises || []).length > 0 && (
                                          <View style={styles.exerciseBadgesWrap}>
                                            {(w.exercises || []).map((we, idx) => {
                                              const exName = we.exerciseName || 'Вправа';
                                              const setCount = we.sets?.length || 0;
                                              return (
                                                <TouchableOpacity
                                                  key={we.id || `${w.id}-ex-${idx}`}
                                                  style={[
                                                    styles.exerciseBadge,
                                                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                                                  ]}
                                                  activeOpacity={0.7}
                                                  onPress={() => {
                                                    if (we.exerciseId && selectedTrainee) {
                                                      router.push({
                                                        pathname: `/exercise/${we.exerciseId}` as any,
                                                        params: {
                                                          traineeId: selectedTrainee.id,
                                                          traineeName: selectedTrainee.name,
                                                          fromTab: 'trainees',
                                                        },
                                                      });
                                                    }
                                                  }}
                                                >
                                                  <Text
                                                    style={[
                                                      styles.exerciseBadgeText,
                                                      { color: colors.text },
                                                    ]}
                                                  >
                                                    {exName} ({setCount})
                                                  </Text>
                                                </TouchableOpacity>
                                              );
                                            })}
                                          </View>
                                        )}
                                      </View>
                                    </TouchableOpacity>
                                  </SwipeableActionCard>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}
          </>
        )}
      </ScrollView>

      {/* Modal for creating workout for trainee */}
      <CreateWorkoutModal
        visible={isCreateWorkoutModalVisible}
        initialDate={formatLocalDate()}
        onClose={() => setIsCreateWorkoutModalVisible(false)}
        onSubmit={handleCreateWorkoutSubmit}
        isLoading={isCreatingWorkout}
        modalTitle={selectedTrainee ? `Тренування: ${selectedTrainee.name}` : 'Нове тренування'}
        modalSub="Створіть порожнє або з вашого збереженого шаблону"
        templateUserId={user?.id}
      />

      {/* Dedicated separate window with trainee analytics */}
      <TraineeAnalyticsModal
        visible={isAnalyticsModalOpen}
        onClose={() => setIsAnalyticsModalOpen(false)}
        trainee={selectedTrainee}
      />
    </SafeAreaView>
  </ScreenGestureWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topBarLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomColor: '#E2E8F0',
  },
  topBarDark: {
    backgroundColor: 'rgba(11, 18, 32, 0.95)',
    borderBottomColor: '#334155',
  },
  iconBtn: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  topBarSub: {
    fontSize: 11,
    marginTop: 1,
  },
  topBarDateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  borderDark: {
    borderBottomColor: '#1e293b',
  },
  borderLight: {
    borderBottomColor: '#e2e8f0',
  },
  bgLight: {
    backgroundColor: '#f8fafc',
  },
  bgDark: {
    backgroundColor: '#0b1220',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 110,
  },
  coachCodeCard: {
    padding: 14,
    borderRadius: 18,
  },
  coachCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  coachCodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  codeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeLabel: {
    fontSize: 11,
  },
  codeValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  copyBtnLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  copyBtnDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addTraineeCard: {
    padding: 16,
    borderRadius: 18,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 11,
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
  },
  inputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  inputDark: {
    backgroundColor: '#0b1220',
    borderColor: '#334155',
  },
  input: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    borderRadius: 16,
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  traineeSelectorSection: {
    gap: 8,
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  traineeListScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  traineePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  pillLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  pillDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  traineePillActiveLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderColor: '#2563eb',
  },
  traineePillActiveDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderColor: '#60a5fa',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleActive: {
    backgroundColor: '#2563eb',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  avatarTextActive: {
    color: '#ffffff',
  },
  pillTextWrap: {
    maxWidth: 130,
  },
  pillName: {
    fontSize: 13,
    fontWeight: '600',
  },
  pillNameActiveLight: {
    color: '#2563eb',
    fontWeight: '700',
  },
  pillNameActiveDark: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  pillCode: {
    fontSize: 10,
  },
  pillCodeActiveLight: {
    color: '#64748b',
  },
  pillCodeActiveDark: {
    color: '#94a3b8',
  },
  selectedTraineeCard: {
    padding: 16,
    gap: 14,
  },
  traineeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  traineeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  traineeBigAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  traineeNameTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  traineeEmailSub: {
    fontSize: 12,
    marginTop: 1,
  },
  unlinkBtn: {
    padding: 8,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  createWorkoutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#2563eb',
  },
  createWorkoutBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  analyticsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  analyticsBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  analyticsBtnDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  analyticsBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  traineeWorkoutsSection: {
    gap: 12,
    marginTop: 4,
  },
  workoutsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 4,
  },
  workoutsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeText: {
    color: '#2563eb',
    fontSize: 11,
    fontWeight: '700',
  },
  noWorkoutsWrap: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 8,
  },
  noWorkoutsLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  noWorkoutsDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  firstWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 6,
  },
  firstWorkoutBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  noWorkoutsText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  workoutsList: {
    gap: 8,
  },
  workoutCard: {
    padding: 14,
    gap: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
  },
  metricVal: {
    fontWeight: '600',
  },
  dotSep: {
    fontSize: 12,
  },
  workoutExpandBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  exerciseBadgesWrap: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.25)',
  },
  exerciseBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  exerciseBadgeLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  exerciseBadgeDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  exerciseBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  exerciseBadgeTextLight: {
    color: '#0F172A',
  },
  exerciseBadgeTextDark: {
    color: '#F8FAFC',
  },
  centerContainer: {
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
  },
  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 20,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  emptyLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  emptyDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBoxLight: {
    backgroundColor: '#f1f5f9',
  },
  emptyIconBoxDark: {
    backgroundColor: '#263140',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyTitleLight: {
    color: '#0f172a',
  },
  emptyTitleDark: {
    color: '#f8fafc',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 280,
  },
  emptySubtitleLight: {
    color: '#64748b',
  },
  emptySubtitleDark: {
    color: '#94a3b8',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    gap: 10,
    borderStyle: 'dashed',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
  },
  textLight: {
    color: '#0f172a',
  },
  textDark: {
    color: '#f8fafc',
  },
  subLight: {
    color: '#64748b',
  },
  subDark: {
    color: '#94a3b8',
  },
  accordionContainer: {
    gap: 14,
  },
  monthSection: {
    gap: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  monthHeaderLight: {
    backgroundColor: '#F1F5F9',
  },
  monthHeaderDark: {
    backgroundColor: '#263140',
  },
  monthHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  monthCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  monthCountBadgeLight: {
    backgroundColor: '#FFFFFF',
  },
  monthCountBadgeDark: {
    backgroundColor: '#1D2939',
  },
  monthCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  monthCountTextLight: {
    color: '#64748B',
  },
  monthCountTextDark: {
    color: '#94A3B8',
  },
  monthWorkoutsList: {
    gap: 10,
  },
  nonCoachContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  nonCoachIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  nonCoachTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  nonCoachDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  goToProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 12,
    backgroundColor: '#2563eb',
  },
  goToProfileBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
