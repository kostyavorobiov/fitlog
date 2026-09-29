import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { TraineeService } from '../services/traineeService';
import { WorkoutService } from '../services/workoutService';
import { User, WorkoutPlan } from '../types/workout';
import { formatLocalDate } from '../utils/date';

export const TraineesScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { user } = useAuth();

  const [trainees, setTrainees] = useState<User[]>([]);
  const [selectedTrainee, setSelectedTrainee] = useState<User | null>(null);
  const [traineeWorkouts, setTraineeWorkouts] = useState<WorkoutPlan[]>([]);
  const [isLoadingTrainees, setIsLoadingTrainees] = useState<boolean>(true);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [addCodeInput, setAddCodeInput] = useState<string>('');
  const [isAddingTrainee, setIsAddingTrainee] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Load trainees for the current coach
  const loadTrainees = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingTrainees(false);
      return;
    }

    try {
      const list = await TraineeService.getTrainees(user.id);
      setTrainees(list);

      // Select first trainee or keep currently selected if still in list
      setSelectedTrainee((prev) => {
        if (!prev && list.length > 0) return list[0];
        if (prev) {
          const found = list.find((t) => t.id === prev.id);
          return found || list[0] || null;
        }
        return null;
      });
    } catch (e) {
      console.warn('[TraineesScreen.loadTrainees] Error:', e);
    } finally {
      setIsLoadingTrainees(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

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
      await WorkoutService.saveWorkout(newWorkout);
      router.push({
        pathname: '/workout/[id]',
        params: { id: newWorkout.id, traineeId: selectedTrainee.id },
      });
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалося створити тренування');
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

  const isTrainer = user?.role === 'coach' || user?.role === 'admin';
  const coachCode = user?.profileCode || user?.id || '';

  if (!isTrainer) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
        <Header title="Підопічні" subtitle="Розділ для тренерів" />
        <View style={styles.nonCoachContainer}>
          <View style={styles.nonCoachIconWrap}>
            <Ionicons name="shield-outline" size={48} color="#0284c7" />
          </View>
          <Text style={[styles.nonCoachTitle, isDark ? styles.textDark : styles.textLight]}>
            Доступ лише для тренерів
          </Text>
          <Text style={[styles.nonCoachDesc, isDark ? styles.subDark : styles.subLight]}>
            Цей розділ призначений для перегляду та складання тренувальних планів ваших спортсменів.
          </Text>
          <TouchableOpacity
            style={styles.goToProfileBtn}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={18} color="#ffffff" />
            <Text style={styles.goToProfileBtnText}>Перейти у профіль</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
      {/* Header */}
      <Header
        title="Підопічні"
        subtitle="Складання планів та контроль прогресу"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#0284c7"
            colors={['#0284c7']}
          />
        }
      >
        {/* Coach Code Sharing Box */}
        <Card style={styles.coachCodeCard}>
          <View style={styles.coachCodeRow}>
            <View style={styles.coachCodeLeft}>
              <View style={styles.codeIconWrap}>
                <Ionicons name="key-outline" size={18} color="#0284c7" />
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
                color={copiedCode ? '#10b981' : (isDark ? '#fafafa' : '#09090b')}
              />
              <Text
                style={[
                  styles.copyBtnText,
                  copiedCode ? { color: '#10b981' } : (isDark ? styles.textDark : styles.textLight),
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
              <Ionicons name="person-add-outline" size={18} color={isDark ? '#71717a' : '#a1a1aa'} />
              <TextInput
                style={[styles.input, isDark ? styles.textDark : styles.textLight]}
                placeholder="Код або email підопічного..."
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                value={addCodeInput}
                onChangeText={setAddCodeInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.addBtn, isAddingTrainee && styles.addBtnDisabled]}
              onPress={handleAddTrainee}
              disabled={isAddingTrainee}
              activeOpacity={0.8}
            >
              {isAddingTrainee ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="add" size={18} color="#ffffff" />
                  <Text style={styles.addBtnText}>Додати</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Trainees List Selector */}
        {isLoadingTrainees && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color="#0284c7" />
            <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
              Завантаження підопічних...
            </Text>
          </View>
        ) : trainees.length === 0 ? (
          /* Empty Trainees State */
          <Card style={styles.emptyCard}>
            <Ionicons name="people-outline" size={48} color={isDark ? '#52525b' : '#d4d4d8'} />
            <Text style={[styles.emptyTitle, isDark ? styles.textDark : styles.textLight]}>
              У вас ще немає підопічних
            </Text>
            <Text style={[styles.emptySub, isDark ? styles.subDark : styles.subLight]}>
              Поділіться кодом тренера ({coachCode}) зі своїм атлетом або введіть його код вище, щоб розпочати співпрацю.
            </Text>
          </Card>
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
                        isSelected && styles.traineePillActive,
                        isDark ? styles.pillDark : styles.pillLight,
                      ]}
                    >
                      <UserAvatar image={t.image} name={t.name} size="xs" />
                      <View style={styles.pillTextWrap}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.pillName,
                            isSelected ? styles.pillNameActive : (isDark ? styles.textDark : styles.textLight),
                          ]}
                        >
                          {t.name}
                        </Text>
                        <Text
                          style={[
                            styles.pillCode,
                            isSelected ? styles.pillCodeActive : (isDark ? styles.subDark : styles.subLight),
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
                    <Text style={styles.createWorkoutBtnText}>Додати тренування</Text>
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
                    <Ionicons name="stats-chart-outline" size={16} color="#0284c7" />
                    <Text style={styles.analyticsBtnText}>Аналітика</Text>
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
                    <ActivityIndicator size="small" color="#0284c7" />
                  </View>
                ) : traineeWorkouts.length === 0 ? (
                  <View style={styles.noWorkoutsWrap}>
                    <Ionicons name="barbell-outline" size={32} color={isDark ? '#52525b' : '#d4d4d8'} />
                    <Text style={[styles.noWorkoutsText, isDark ? styles.subDark : styles.subLight]}>
                      У підопічного немає запланованих тренувань. Натисніть «Додати тренування», щоб скласти перший план.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.workoutsList}>
                    {traineeWorkouts.map((w) => {
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
                                <Ionicons name="calendar-outline" size={13} color={isDark ? '#a1a1aa' : '#71717a'} />
                                <Text style={[styles.metaText, isDark ? styles.subDark : styles.subLight]}>
                                  {w.scheduledDate}
                                </Text>
                              </View>

                              <View style={styles.metaItem}>
                                <Ionicons name="barbell-outline" size={13} color={isDark ? '#a1a1aa' : '#71717a'} />
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
  bgLight: {
    backgroundColor: '#f8fafc',
  },
  bgDark: {
    backgroundColor: '#09090b',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  coachCodeCard: {
    padding: 14,
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
    borderRadius: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
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
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  copyBtnLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  copyBtnDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addTraineeCard: {
    padding: 16,
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
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
  },
  inputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  inputDark: {
    backgroundColor: '#09090b',
    borderColor: '#27272a',
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
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
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
    borderRadius: 10,
    borderWidth: 1,
  },
  pillLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  pillDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  traineePillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleActive: {
    backgroundColor: '#ffffff',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  avatarTextActive: {
    color: '#0284c7',
  },
  pillTextWrap: {
    maxWidth: 130,
  },
  pillName: {
    fontSize: 13,
    fontWeight: '600',
  },
  pillNameActive: {
    color: '#ffffff',
  },
  pillCode: {
    fontSize: 10,
  },
  pillCodeActive: {
    color: '#e0f2fe',
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
    borderBottomColor: '#71717a20',
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
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0284c7',
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
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 8,
  },
  createWorkoutBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  analyticsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  analyticsBtnLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  analyticsBtnDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  analyticsBtnText: {
    color: '#0284c7',
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
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countBadgeText: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '700',
  },
  noWorkoutsWrap: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
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
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  workoutItemLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  workoutItemDark: {
    backgroundColor: '#09090b',
    borderColor: '#27272a',
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
    borderRadius: 4,
  },
  statusCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  statusInProgress: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  statusPlanned: {
    backgroundColor: 'rgba(113, 113, 122, 0.12)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: '#10b981',
  },
  statusTextInProgress: {
    color: '#f59e0b',
  },
  statusTextPlanned: {
    color: '#71717a',
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
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    gap: 10,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
  },
  textLight: {
    color: '#09090b',
  },
  textDark: {
    color: '#fafafa',
  },
  subLight: {
    color: '#71717a',
  },
  subDark: {
    color: '#a1a1aa',
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
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
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
    backgroundColor: '#0284c7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  goToProfileBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
