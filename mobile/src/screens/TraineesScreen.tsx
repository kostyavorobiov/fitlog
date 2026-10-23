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
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setSavedActiveTab } from '../components/InstagramTabPager';
import { Card } from '../components/Card';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { TraineeService } from '../services/traineeService';
import { WorkoutService } from '../services/workoutService';
import { User, WorkoutPlan } from '../types/workout';
import { formatLocalDate, formatDateDDMMYYYY } from '../utils/date';
import { MonthGroup, getMonthKeyAndLabel } from './WorkoutsScreen';

export const TraineesScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { traineeId: paramTraineeId } = useLocalSearchParams<{ traineeId?: string }>();
  const { user, isAdmin, isLoading: isAuthLoading } = useAuth();
  const isTrainer = user?.role === 'coach' || isAdmin;
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
  const isCreatingWorkoutRef = React.useRef(false);
  const [openTraineeMonths, setOpenTraineeMonths] = useState<Record<string, boolean>>({});

  const topBarAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const [isTopBarVisible, setIsTopBarVisible] = useState(true);
  const [topBarHeight, setTopBarHeight] = useState(56);

  const handleBackToProfile = useCallback(() => {
    setSavedActiveTab('profile');
    router.replace('/(tabs)/profile');
  }, [router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackToProfile();
      return true;
    });
    return () => sub.remove();
  }, [handleBackToProfile]);

  const handleCombinedScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScroll(event);
      const currentY = event.nativeEvent.contentOffset.y;
      const diff = currentY - lastScrollY.current;

      // Always show when near the top
      if (currentY <= 15) {
        if (!isTopBarVisible) {
          setIsTopBarVisible(true);
          Animated.timing(topBarAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start();
        }
        lastScrollY.current = currentY;
        return;
      }

      // Scrolling down -> hide top bar
      if (diff > 8 && currentY > 30) {
        if (isTopBarVisible) {
          setIsTopBarVisible(false);
          Animated.timing(topBarAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }).start();
        }
      }
      // Scrolling up -> show top bar immediately
      else if (diff < -6) {
        if (!isTopBarVisible) {
          setIsTopBarVisible(true);
          Animated.timing(topBarAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start();
        }
      }

      lastScrollY.current = currentY;
    },
    [handleScroll, isTopBarVisible, topBarAnim]
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

  // Route protection: redirect athletes away from coach screen
  useEffect(() => {
    if (!isAuthLoading && !isTrainer) {
      router.replace('/(tabs)');
    }
  }, [isAuthLoading, isTrainer, router]);

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
          return found || list[0] || null;
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
  const loadTraineeWorkouts = useCallback(async (traineeId: string) => {
    if (!traineeId) {
      setTraineeWorkouts([]);
      return;
    }

    setIsLoadingWorkouts(true);
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
      loadTrainees();
    }, [loadTrainees])
  );

  useEffect(() => {
    if (selectedTrainee) {
      loadTraineeWorkouts(selectedTrainee.id);
    } else {
      setTraineeWorkouts([]);
    }
  }, [selectedTrainee, loadTraineeWorkouts]);

  useEffect(() => {
    if (paramTraineeId && trainees.length > 0) {
      const match = trainees.find((t) => t.id === paramTraineeId);
      if (match && selectedTrainee?.id !== match.id) {
        setSelectedTrainee(match);
      }
    }
  }, [paramTraineeId, trainees, selectedTrainee?.id]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadTrainees().then(() => {
      if (selectedTrainee) {
        loadTraineeWorkouts(selectedTrainee.id);
      }
    });
  }, [loadTrainees, selectedTrainee, loadTraineeWorkouts]);

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

  // Create new workout for selected trainee
  const handleCreateWorkoutForTrainee = async () => {
    if (!selectedTrainee || !user) return;
    if (isCreatingWorkoutRef.current) return;
    isCreatingWorkoutRef.current = true;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrow);

    const newWorkout: WorkoutPlan = {
      id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: selectedTrainee.id,
      assignedByCoachId: user.id,
      title: `Тренування для ${selectedTrainee.firstName || selectedTrainee.name}`,
      scheduledDate: tomorrowStr,
      status: 'planned',
      completedAt: null,
      notes: '',
      createdAt: new Date().toISOString(),
      exercises: [],
    };

    try {
      const ok = await WorkoutService.saveWorkout(newWorkout);
      if (ok) {
        setTraineeWorkouts((prev) => [newWorkout, ...prev.filter((w) => w.id !== newWorkout.id)]);
        try {
          router.push({
            pathname: '/workout/[id]',
            params: { id: newWorkout.id, traineeId: selectedTrainee.id },
          });
        } catch (navErr) {
          console.warn('[TraineesScreen] Navigation to editor failed:', navErr);
        }
      } else {
        Alert.alert('Помилка', 'Не вдалося створити тренування');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося створити тренування');
    } finally {
      isCreatingWorkoutRef.current = false;
    }
  };

  // Delete workout of trainee
  const handleDeleteTraineeWorkout = (workout: WorkoutPlan) => {
    if (!selectedTrainee) return;

    Alert.alert(
      'Видалити тренування?',
      `Видалити «${workout.title || 'це тренування'}» для підопічного ${selectedTrainee.name}?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            const ok = await WorkoutService.deleteWorkout(
              selectedTrainee.id,
              workout.id,
              user?.id
            );
            if (ok) {
              await loadTraineeWorkouts(selectedTrainee.id);
            } else {
              Alert.alert('Помилка', 'Не вдалося видалити тренування');
            }
          },
        },
      ]
    );
  };

  const coachCode = user?.profileCode || user?.id || '';

  if (!isTrainer) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
        <View style={[styles.topBar, isDark ? styles.borderDark : styles.borderLight]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleBackToProfile}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <Ionicons name="arrow-back" size={22} color={isDark ? '#F8FAFC' : '#0F172A'} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text numberOfLines={1} style={[styles.topBarTitle, isDark ? styles.textDark : styles.textLight]}>
              Підопічні
            </Text>
            <Text numberOfLines={1} style={[styles.topBarSub, isDark ? styles.subDark : styles.subLight]}>
              Розділ для тренерів
            </Text>
          </View>

          <View style={styles.headerRightActions} />
        </View>
        <View style={styles.nonCoachContainer}>
          <View style={styles.nonCoachIconWrap}>
            <Ionicons name="shield-outline" size={48} color="#2563eb" />
          </View>
          <Text style={[styles.nonCoachTitle, isDark ? styles.textDark : styles.textLight]}>
            Доступ лише для тренерів
          </Text>
          <Text style={[styles.nonCoachDesc, isDark ? styles.subDark : styles.subLight]}>
            Цей розділ призначений для перегляду та складання тренувальних планів ваших спортсменів.
          </Text>
          <TouchableOpacity
            style={styles.goToProfileBtn}
            onPress={handleBackToProfile}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={18} color="#ffffff" />
            <Text style={styles.goToProfileBtnText}>
              Перейти у профіль
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
      {/* Top Header Bar matching WorkoutEditorScreen */}
      <Animated.View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - topBarHeight) > 2) {
            setTopBarHeight(h);
          }
        }}
        style={[
          styles.topBar,
          isDark ? styles.borderDark : styles.borderLight,
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
          <Ionicons name="arrow-back" size={22} color={isDark ? '#F8FAFC' : '#0F172A'} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={[styles.topBarTitle, isDark ? styles.textDark : styles.textLight]}>
            Підопічні
          </Text>
          <Text numberOfLines={1} style={[styles.topBarSub, isDark ? styles.subDark : styles.subLight]}>
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
            tintColor="#2563eb"
            colors={['#2563eb']}
          />
        }
      >
        {/* Coach Code Sharing Box */}
        <Card style={styles.coachCodeCard}>
          <View style={styles.coachCodeRow}>
            <View style={styles.coachCodeLeft}>
              <View style={styles.codeIconWrap}>
                <Ionicons name="key-outline" size={18} color={isDark ? '#60a5fa' : '#2563eb'} />
              </View>
              <View>
                <Text style={[styles.codeLabel, isDark ? styles.subDark : styles.subLight]}>
                  Ваш код тренера
                </Text>
                <Text style={[styles.codeValue, isDark ? styles.textDark : styles.textLight]}>
                  {coachCode}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.copyBtn, isDark ? styles.copyBtnDark : styles.copyBtnLight]}
              onPress={handleCopyCoachCode}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copiedCode ? 'checkmark' : 'copy-outline'}
                size={16}
                color={copiedCode ? '#22c55e' : (isDark ? '#f8fafc' : '#0f172a')}
              />
              <Text
                style={[
                  styles.copyBtnText,
                  copiedCode ? { color: '#22c55e' } : (isDark ? styles.textDark : styles.textLight),
                ]}
              >
                {copiedCode ? 'Скопійовано' : 'Копіювати'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Add Trainee Form Card */}
        <Card style={styles.addTraineeCard}>
          <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
            Прикріпити нового підопічного
          </Text>
          <Text style={[styles.sectionSub, isDark ? styles.subDark : styles.subLight]}>
            Введіть персональний код, ID або email спортсмена
          </Text>

          <View style={styles.inputRow}>
            <View style={[styles.inputWrap, isDark ? styles.inputDark : styles.inputLight]}>
              <Ionicons name="person-add-outline" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
              <TextInput
                style={[styles.input, isDark ? styles.textDark : styles.textLight]}
                placeholder="Код або email підопічного..."
                placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
                value={addCodeInput}
                onChangeText={setAddCodeInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.addBtn,
                isAddingTrainee && styles.addBtnDisabled,
              ]}
              onPress={handleAddTrainee}
              disabled={isAddingTrainee}
              activeOpacity={0.8}
            >
              {isAddingTrainee ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="add" size={18} color="#ffffff" />
                  <Text style={styles.addBtnText}>
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
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
              Завантаження підопічних...
            </Text>
          </View>
        ) : trainees.length === 0 ? (
          /* Empty Trainees State */
          <View style={[styles.emptyContainer, isDark ? styles.emptyDark : styles.emptyLight]}>
            <View style={[styles.emptyIconBox, isDark ? styles.emptyIconBoxDark : styles.emptyIconBoxLight]}>
              <Ionicons name="people-outline" size={26} color={isDark ? '#94A3B8' : '#64748B'} />
            </View>
            <Text style={[styles.emptyTitle, isDark ? styles.emptyTitleDark : styles.emptyTitleLight]}>
              У вас ще немає підопічних
            </Text>
            <Text style={[styles.emptySubtitle, isDark ? styles.emptySubtitleDark : styles.emptySubtitleLight]}>
              Поділіться кодом тренера ({coachCode}) зі своїм атлетом або введіть його код вище, щоб розпочати співпрацю.
            </Text>
          </View>
        ) : (
          <>
            {/* Trainee Horizontal Switcher */}
            <View style={styles.traineeSelectorSection}>
              <Text style={[styles.selectorLabel, isDark ? styles.subDark : styles.subLight]}>
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
                        isDark ? styles.pillDark : styles.pillLight,
                        isSelected && (isDark ? styles.traineePillActiveDark : styles.traineePillActiveLight),
                      ]}
                    >
                      <UserAvatar image={t.image} name={t.name} size="xs" />
                      <View style={styles.pillTextWrap}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.pillName,
                            isSelected
                              ? (isDark ? styles.pillNameActiveDark : styles.pillNameActiveLight)
                              : (isDark ? styles.textDark : styles.textLight),
                          ]}
                        >
                          {t.name}
                        </Text>
                        <Text
                          style={[
                            styles.pillCode,
                            isSelected
                              ? (isDark ? styles.pillCodeActiveDark : styles.pillCodeActiveLight)
                              : (isDark ? styles.subDark : styles.subLight),
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
              <Card style={styles.selectedTraineeCard}>
                <View style={styles.traineeHeaderRow}>
                  <View style={styles.traineeHeaderLeft}>
                    <UserAvatar image={selectedTrainee.image} name={selectedTrainee.name} size="lg" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.traineeNameTitle, isDark ? styles.textDark : styles.textLight]}>
                        {selectedTrainee.name}
                      </Text>
                      <Text style={[styles.traineeEmailSub, isDark ? styles.subDark : styles.subLight]}>
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
                    style={styles.createWorkoutBtn}
                    activeOpacity={0.8}
                    onPress={handleCreateWorkoutForTrainee}
                  >
                    <Ionicons name="add-circle" size={18} color="#ffffff" />
                    <Text style={styles.createWorkoutBtnText}>
                      Додати тренування
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.analyticsBtn, isDark ? styles.analyticsBtnDark : styles.analyticsBtnLight]}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: '/(tabs)/analytics',
                        params: {
                          traineeId: selectedTrainee.id,
                          traineeName: selectedTrainee.name,
                        },
                      })
                    }
                  >
                    <Ionicons name="stats-chart-outline" size={16} color={isDark ? '#f8fafc' : '#0f172a'} />
                    <Text style={[styles.analyticsBtnText, isDark ? styles.textDark : styles.textLight]}>
                      Аналітика
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Trainee Workouts Header */}
                <View style={styles.workoutsHeaderRow}>
                  <Text style={[styles.workoutsSectionTitle, isDark ? styles.textDark : styles.textLight]}>
                    Тренування підопічного
                  </Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{traineeWorkouts.length}</Text>
                  </View>
                </View>

                {/* Trainee Workouts List */}
                {isLoadingWorkouts ? (
                  <View style={styles.centerContainer}>
                    <ActivityIndicator size="small" color="#2563eb" />
                  </View>
                ) : traineeWorkouts.length === 0 ? (
                  <View style={[styles.noWorkoutsWrap, isDark ? styles.noWorkoutsDark : styles.noWorkoutsLight]}>
                    <View style={[styles.emptyIconBox, isDark ? styles.emptyIconBoxDark : styles.emptyIconBoxLight]}>
                      <Ionicons name="barbell-outline" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
                    </View>
                    <Text style={[styles.emptySubtitle, isDark ? styles.emptySubtitleDark : styles.emptySubtitleLight]}>
                      У підопічного немає запланованих тренувань. Натисніть «Додати тренування», щоб скласти перший план.
                    </Text>
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
                              isDark ? styles.monthHeaderDark : styles.monthHeaderLight,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`${group.label}, ${group.workouts.length} тренувань`}
                          >
                            <View style={styles.monthHeaderLeft}>
                              <Text style={[styles.monthTitle, isDark ? styles.textDark : styles.textLight]}>
                                {group.label}
                              </Text>
                              <View style={[styles.monthCountBadge, isDark ? styles.monthCountBadgeDark : styles.monthCountBadgeLight]}>
                                <Text style={[styles.monthCountText, isDark ? styles.monthCountTextDark : styles.monthCountTextLight]}>
                                  {group.workouts.length}
                                </Text>
                              </View>
                            </View>
                            <Ionicons
                              name={isOpen ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color={isDark ? '#94A3B8' : '#64748B'}
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

                                return (
                                  <TouchableOpacity
                                    key={w.id}
                                    activeOpacity={0.7}
                                    onPress={() =>
                                      router.push({
                                        pathname: '/workout/[id]',
                                        params: { id: w.id, traineeId: selectedTrainee.id },
                                      })
                                    }
                                    style={[
                                      styles.workoutItem,
                                      isDark ? styles.workoutItemDark : styles.workoutItemLight,
                                    ]}
                                  >
                                    <View style={styles.workoutItemMain}>
                                      <View style={styles.workoutItemHeader}>
                                        <Text
                                          numberOfLines={1}
                                          style={[styles.workoutTitle, isDark ? styles.textDark : styles.textLight]}
                                        >
                                          {w.title}
                                        </Text>

                                        <View
                                          style={[
                                            styles.statusBadge,
                                            isCompleted
                                              ? styles.statusCompleted
                                              : isInProgress
                                              ? styles.statusInProgress
                                              : styles.statusPlanned,
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.statusText,
                                              isCompleted
                                                ? styles.statusTextCompleted
                                                : isInProgress
                                                ? styles.statusTextInProgress
                                                : styles.statusTextPlanned,
                                            ]}
                                          >
                                            {isCompleted
                                              ? 'Завершено'
                                              : isInProgress
                                              ? 'В процесі'
                                              : 'Заплановано'}
                                          </Text>
                                        </View>
                                      </View>

                                      <View style={styles.workoutMetaRow}>
                                        <View style={styles.metaItem}>
                                          <Ionicons name="calendar-outline" size={13} color={isDark ? '#94A3B8' : '#64748B'} />
                                          <Text style={[styles.metaText, isDark ? styles.subDark : styles.subLight]}>
                                            {formatDateDDMMYYYY(w.scheduledDate)}
                                          </Text>
                                        </View>

                                        <View style={styles.metaItem}>
                                          <Ionicons name="barbell-outline" size={13} color={isDark ? '#94A3B8' : '#64748B'} />
                                          <Text style={[styles.metaText, isDark ? styles.subDark : styles.subLight]}>
                                            {exerciseCount} {exerciseCount === 1 ? 'вправа' : 'вправ'} ({setsCount} підх.)
                                          </Text>
                                        </View>
                                      </View>
                                    </View>

                                    <TouchableOpacity
                                      style={styles.workoutDeleteBtn}
                                      onPress={() => handleDeleteTraineeWorkout(w)}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                    </TouchableOpacity>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  workoutsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  noWorkoutsText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  workoutsList: {
    gap: 8,
  },
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  workoutItemLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  workoutItemDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  workoutItemMain: {
    flex: 1,
    gap: 4,
  },
  workoutItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  workoutTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  statusInProgress: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
  },
  statusPlanned: {
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: '#22c55e',
  },
  statusTextInProgress: {
    color: '#60a5fa',
  },
  statusTextPlanned: {
    color: '#64748b',
  },
  workoutMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
  },
  workoutDeleteBtn: {
    padding: 6,
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
