import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { triggerRefreshSuccessHaptic } from '../utils/haptics';
import { setSavedActiveTab } from '../components/InstagramTabPager';
import { Button } from '../components/Button';
import { WorkoutService } from '../services/workoutService';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { WorkoutPlan } from '../types/workout';
import { SwipeableActionCard } from '../components/SwipeableActionCard';
import { DatePickerModal } from '../components/DatePickerModal';
import { formatDateDDMMYYYY } from '../utils/date';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type WorkoutFilterStatus = 'all' | 'completed' | 'in_progress';

export function formatDateDDMMYY(dateStr?: string): string {
  return formatDateDDMMYYYY(dateStr);
}

const UKRAINIAN_DAYS = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота'];
const UKRAINIAN_MONTHS_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

const UKRAINIAN_MONTHS_SHORT = [
  'СІЧ', 'ЛЮТ', 'БЕР', 'КВІ', 'ТРА', 'ЧЕР',
  'ЛИП', 'СЕР', 'ВЕР', 'ЖОВ', 'ЛИС', 'ГРУ',
];

const UKRAINIAN_MONTHS = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

function formatTodayDateHeader(): string {
  const d = new Date();
  const dayName = UKRAINIAN_DAYS[d.getDay()];
  const dayNum = d.getDate();
  const monthName = UKRAINIAN_MONTHS_GENITIVE[d.getMonth()];
  return `${dayName}, ${dayNum} ${monthName}`;
}

export function getMonthKeyAndLabel(dateStr?: string): { key: string; label: string } {
  if (!dateStr) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return {
      key: `${y}-${m}`,
      label: `${UKRAINIAN_MONTHS[now.getMonth()]} ${y}`,
    };
  }

  const dateOnly = dateStr.split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const label = `${UKRAINIAN_MONTHS[month - 1]} ${year}`;
      return { key, label };
    }
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const label = `${UKRAINIAN_MONTHS[d.getMonth()]} ${year}`;
    return { key, label };
  }

  const now = new Date();
  return {
    key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    label: `${UKRAINIAN_MONTHS[now.getMonth()]} ${now.getFullYear()}`,
  };
}

export interface MonthGroup {
  key: string;
  label: string;
  workouts: WorkoutPlan[];
}

interface SwipeableWorkoutCardProps {
  id: string;
  onCopy?: () => void;
  onDelete: (onCancel?: () => void) => void;
  onQuickDelete?: (onCancel?: () => void) => void;
  confirmTitle?: string;
  confirmMessage?: string;
  isDark: boolean;
  children: React.ReactNode;
}

const SwipeableWorkoutCard: React.FC<SwipeableWorkoutCardProps> = ({
  id,
  onCopy,
  onDelete,
  onQuickDelete,
  confirmTitle,
  confirmMessage,
  isDark,
  children,
}) => {
  return (
    <SwipeableActionCard
      id={id}
      isDark={isDark}
      onCopy={onCopy}
      onDelete={onDelete}
      onQuickDelete={onQuickDelete}
      confirmTitle={confirmTitle}
      confirmMessage={confirmMessage}
    >
      {children}
    </SwipeableActionCard>
  );
};

export const WorkoutsScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { handleScroll } = useScrollTabBar();

  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

  // Creation modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDate, setNewDate] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isModalDatePickerOpen, setIsModalDatePickerOpen] = useState<boolean>(false);
  const isCreatingRef = useRef<boolean>(false);

  const loadData = useCallback(async () => {
    if (!user) {
      setWorkouts([]);
      setIsLoading(false);
      return;
    }
    try {
      const data = await WorkoutService.getWorkouts(user.id);
      setWorkouts(data);
    } catch (e) {
      console.error('WorkoutsScreen.loadData error:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setSavedActiveTab('index');
    await loadData();
    await triggerRefreshSuccessHaptic();
  }, [loadData]);

  const handleCreateWorkoutSubmit = async () => {
    if (isCreatingRef.current) return;
    if (!newTitle.trim()) {
      Alert.alert('Помилка', 'Введіть назву тренування');
      return;
    }
    if (!user) return;

    isCreatingRef.current = true;
    setIsCreating(true);

    try {
      const newPlan: WorkoutPlan = {
        id: `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: user.id,
        title: newTitle.trim(),
        scheduledDate: newDate || new Date().toISOString().split('T')[0],
        status: 'planned',
        notes: newNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
        exercises: [],
      };

      const ok = await WorkoutService.saveWorkout(newPlan);
      if (ok) {
        setIsModalOpen(false);
        setNewTitle('');
        setNewNotes('');
        setNewDate('');
        setWorkouts((prev) => [newPlan, ...prev]);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        setSavedActiveTab('index');
        router.push({ pathname: '/workout/[id]', params: { id: newPlan.id } });
      } else {
        Alert.alert('Помилка', 'Не вдалося створити тренування');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося створити тренування');
    } finally {
      setIsCreating(false);
      isCreatingRef.current = false;
    }
  };

  const handleDeleteWorkout = async (w: WorkoutPlan, onCancel?: () => void) => {
    Alert.alert(
      'Видалити тренування?',
      `Ви впевнені, що хочете видалити тренування "${w.title || 'Без назви'}"?`,
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
          onPress: async () => {
            try {
              const ok = await WorkoutService.deleteWorkout(user?.id || '', w.id);
              if (ok) {
                setWorkouts((prev) => prev.filter((item) => item.id !== w.id));
                try {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch {}
              } else {
                Alert.alert('Помилка', 'Не вдалося видалити тренування');
                onCancel?.();
              }
            } catch (e: any) {
              Alert.alert('Помилка', e?.message || 'Не вдалося видалити тренування');
              onCancel?.();
            }
          },
        },
      ]
    );
  };

  const handleQuickDeleteWorkout = async (w: WorkoutPlan, onCancel?: () => void) => {
    try {
      const ok = await WorkoutService.deleteWorkout(user?.id || '', w.id);
      if (ok) {
        setWorkouts((prev) => prev.filter((item) => item.id !== w.id));
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      } else {
        Alert.alert('Помилка', 'Не вдалося видалити тренування');
        onCancel?.();
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося видалити тренування');
      onCancel?.();
    }
  };

  const handleCopyWorkout = async (source: WorkoutPlan) => {
    if (!user) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const newWorkoutId = `wp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const clonedExercises = (source.exercises || []).map((ex) => {
        const weId = `we_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const clonedSets = (ex.sets || []).map((s, sIdx) => ({
          ...s,
          id: `ws_${Date.now()}_${sIdx}_${Math.random().toString(36).substring(2, 7)}`,
          completedAt: null,
          actualReps: s.actualReps !== null && s.actualReps !== undefined ? s.actualReps : 0,
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
        userId: user.id,
        title: `${source.title || 'Тренування'} (Копія)`,
        scheduledDate: today,
        status: 'planned',
        createdAt: new Date().toISOString(),
        completedAt: null,
        exercises: clonedExercises,
      };

      const ok = await WorkoutService.saveWorkout(copied);
      if (ok) {
        setWorkouts((prev) => [copied, ...prev]);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      } else {
        Alert.alert('Помилка', 'Не вдалося скопіювати тренування');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося скопіювати тренування');
    }
  };

  // Sort workouts within each month: in_progress ascending, completed descending
  const sortedWorkouts = useMemo(() => {
    return [...workouts].sort((a, b) => {
      const isProgA = a.status === 'in_progress';
      const isProgB = b.status === 'in_progress';

      if (isProgA && !isProgB) return -1;
      if (!isProgA && isProgB) return 1;

      const dateA = a.scheduledDate || a.createdAt || '';
      const dateB = b.scheduledDate || b.createdAt || '';

      if (isProgA && isProgB) {
        return dateA.localeCompare(dateB);
      }

      return dateB.localeCompare(dateA);
    });
  }, [workouts]);

  // Active workout for Hero Card
  const activeWorkout = useMemo(() => {
    return sortedWorkouts.find((w) => w.status === 'in_progress');
  }, [sortedWorkouts]);

  // Week strip calculation (Monday to Sunday)
  const weekDays = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, []);

  const weekTitle = useMemo(() => {
    const start = weekDays[0].getDate();
    const end = weekDays[6].getDate();
    const monthAbbr = UKRAINIAN_MONTHS_SHORT[weekDays[6].getMonth()];
    return `ТИЖДЕНЬ ${start} — ${end} ${monthAbbr}`;
  }, [weekDays]);

  // Group workouts by calendar month (YYYY-MM), sorted newest to oldest
  const monthGroups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, { label: string; workouts: WorkoutPlan[] }>();
    for (const w of sortedWorkouts) {
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
  }, [sortedWorkouts]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const defaultOpenKey = useMemo(() => {
    if (monthGroups.length === 0) return null;
    const hasCurrent = monthGroups.some((g) => g.key === currentMonthKey);
    return hasCurrent ? currentMonthKey : monthGroups[0].key;
  }, [monthGroups, currentMonthKey]);

  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (defaultOpenKey && Object.keys(openMonths).length === 0) {
      setOpenMonths({ [defaultOpenKey]: true });
    }
  }, [defaultOpenKey, openMonths]);

  const toggleMonth = (key: string) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpenMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
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
        {/* Top Header matching design */}
        <View style={styles.headerSection}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Тренування</Text>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            {formatTodayDateHeader()}
          </Text>
        </View>

        {/* Hero Active Workout Banner if in_progress exists */}
        {activeWorkout && (
          <View style={[styles.heroCard, { backgroundColor: colors.heroCardBg }]}>
            {(() => {
              const exList = activeWorkout.exercises || [];
              const allSets = exList.flatMap((e) => e.sets || []);
              const doneSets = allSets.filter((s) => Boolean(s.completedAt)).length;
              const totalSets = allSets.length;
              const supersets = new Set(exList.map((e) => e.supersetGroupId).filter(Boolean)).size;

              let dateTag = 'СЬОГОДНІ';
              if (activeWorkout.scheduledDate) {
                const parts = activeWorkout.scheduledDate.split('T')[0].split('-');
                if (parts.length === 3) dateTag = `${parts[2]}/${parts[1]}`;
              }

              return (
                <>
                  <Text style={[styles.heroTag, { color: colors.heroCardText }]}>
                    У ПРОЦЕСІ · {dateTag}
                  </Text>
                  <Text numberOfLines={2} style={[styles.heroTitle, { color: colors.heroCardText }]}>
                    {activeWorkout.title || 'Тренування'}
                  </Text>
                  <Text style={[styles.heroSubtitle, { color: colors.heroCardText }]}>
                    {exList.length} вправ · {doneSets} з {totalSets} підходів
                    {supersets > 0 ? ` · ${supersets} ${supersets === 1 ? 'суперсет' : 'суперсети'}` : ''}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      setSavedActiveTab('index');
                      router.push({ pathname: '/workout/[id]', params: { id: activeWorkout.id } });
                    }}
                    style={[styles.heroBtn, { backgroundColor: colors.heroBtnBg }]}
                  >
                    <Text style={[styles.heroBtnText, { color: colors.heroBtnText }]}>
                      Продовжити
                    </Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        )}

        {/* Week Strip Calendar Card */}
        <View style={[styles.weekCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.weekTitle, { color: colors.textSecondary }]}>{weekTitle}</Text>
          <View style={styles.weekRow}>
            {weekDays.map((d, index) => {
              const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const hasWorkout = workouts.some((w) => (w.scheduledDate || '').startsWith(isoDate));
              const isToday = d.toDateString() === new Date().toDateString();
              const isSelected = selectedDayDate === isoDate;

              return (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedDayDate(isSelected ? null : isoDate);
                  }}
                  style={styles.dayCol}
                >
                  <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>
                    {DAY_LABELS[index]}
                  </Text>
                  <View
                    style={[
                      styles.dayPill,
                      {
                        backgroundColor: hasWorkout
                          ? colors.accent
                          : colors.subCard,
                        borderColor: (isSelected || isToday) ? colors.accent : 'transparent',
                        borderWidth: (isSelected || isToday) ? 2 : 0,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        {
                          color: hasWorkout
                            ? colors.accentText
                            : colors.text,
                          fontWeight: (hasWorkout || isSelected || isToday) ? '800' : '600',
                        },
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Завантаження тренувань...
            </Text>
          </View>
        ) : workouts.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Ionicons name="barbell-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Тренувань ще немає
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Створіть своє перше тренування для відстеження підходів, ваги та прогресу.
            </Text>
          </View>
        ) : (
          <View style={styles.accordionContainer}>
            {monthGroups.map((group) => {
              const isOpen = Boolean(openMonths[group.key]);

              return (
                <View key={group.key} style={styles.monthSection}>
                  {/* Month Accordion Header */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleMonth(group.key)}
                    style={[
                      styles.monthHeader,
                      { backgroundColor: colors.subCard, borderColor: colors.subCardBorder },
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
                        const exercises = w.exercises || [];
                        const totalSets = exercises.reduce((acc, ex) => acc + (ex.sets ? ex.sets.length : 0), 0);

                        return (
                          <SwipeableWorkoutCard
                            key={w.id}
                            id={w.id}
                            isDark={isDark}
                            onCopy={() => handleCopyWorkout(w)}
                            onDelete={(onCancel) => handleDeleteWorkout(w, onCancel)}
                            onQuickDelete={(onCancel) => handleQuickDeleteWorkout(w, onCancel)}
                          >
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                setSavedActiveTab('index');
                                router.push({ pathname: '/workout/[id]', params: { id: w.id } });
                              }}
                              style={[
                                styles.workoutCard,
                                {
                                  backgroundColor: colors.card,
                                  borderColor: colors.cardBorder,
                                },
                              ]}
                            >
                              {/* Status Header */}
                              <View style={styles.cardTopRow}>
                                <Text
                                  style={[
                                    styles.statusText,
                                    {
                                      color: isInProgress
                                        ? colors.accent
                                        : isCompleted
                                        ? colors.textSecondary
                                        : colors.textMuted,
                                      fontWeight: isInProgress ? '800' : '600',
                                    },
                                  ]}
                                >
                                  {isInProgress ? '● У процесі' : isCompleted ? 'Завершено' : 'Заплановано'}
                                </Text>
                              </View>

                              {/* Workout Title */}
                              <Text
                                numberOfLines={1}
                                style={[styles.workoutTitle, { color: colors.text }]}
                              >
                                {w.title || 'Тренування без назви'}
                              </Text>

                              {/* Subtitle Details */}
                              <Text style={[styles.workoutSubtitle, { color: colors.textSecondary }]}>
                                {formatDateDDMMYY(w.scheduledDate)} · {exercises.length} вправ · {totalSets} підходів
                              </Text>
                            </TouchableOpacity>
                          </SwipeableWorkoutCard>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Create Workout Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Нове тренування
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Назва тренування
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Наприклад: Силове тренування"
                placeholderTextColor={colors.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
              />
            </View>

            {/* Date Input with Interactive Calendar */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Дата (ДД/ММ/РРРР)
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setIsModalDatePickerOpen(true)}
                style={[
                  styles.input,
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Оберіть дату тренування"
              >
                <Ionicons name="calendar-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 14, color: colors.text }}>
                  {formatDateDDMMYYYY(newDate)}
                </Text>
              </TouchableOpacity>

              <View style={styles.quickDateRow}>
                <TouchableOpacity
                  onPress={() => setNewDate(new Date().toISOString().split('T')[0])}
                  style={[styles.quickChip, { backgroundColor: colors.subCard }]}
                >
                  <Text style={[styles.quickChipText, { color: colors.text }]}>
                    Сьогодні
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const tmr = new Date();
                    tmr.setDate(tmr.getDate() + 1);
                    setNewDate(tmr.toISOString().split('T')[0]);
                  }}
                  style={[styles.quickChip, { backgroundColor: colors.subCard }]}
                >
                  <Text style={[styles.quickChipText, { color: colors.text }]}>
                    Завтра
                  </Text>
                </TouchableOpacity>
              </View>

              <DatePickerModal
                visible={isModalDatePickerOpen}
                selectedDate={newDate}
                onClose={() => setIsModalDatePickerOpen(false)}
                onSelectDate={(newIso: string) => {
                  setNewDate(newIso);
                  setIsModalDatePickerOpen(false);
                }}
              />
            </View>

            {/* Notes Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Примітки (необов’язково)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Цілі, самопочуття або план на день..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={newNotes}
                onChangeText={setNewNotes}
              />
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <Button
                title="Скасувати"
                variant="outline"
                disabled={isCreating}
                onPress={() => setIsModalOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Створити"
                loading={isCreating}
                disabled={isCreating}
                onPress={handleCreateWorkoutSubmit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 110,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  screenTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  screenSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
  },
  heroCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 24,
    padding: 22,
  },
  heroTag: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    opacity: 0.8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 20,
    opacity: 0.9,
  },
  heroBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
  },
  weekTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayCol: {
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayPill: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 15,
  },
  accordionContainer: {
    gap: 12,
  },
  monthSection: {
    marginBottom: 4,
  },
  monthHeader: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  monthCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  monthCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  monthWorkoutsList: {
    gap: 10,
  },
  workoutCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 13,
  },
  workoutTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  workoutSubtitle: {
    fontSize: 13,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    marginHorizontal: 20,
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 22,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
});
