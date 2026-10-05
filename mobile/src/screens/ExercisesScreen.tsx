import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '../context/AuthContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { ExerciseService } from '../services/exerciseService';
import { MUSCLE_GROUPS, MuscleGroup, Exercise } from '../types/workout';

const MUSCLE_ORDER: MuscleGroup[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'biceps',
  'triceps',
  'full_body',
  'other',
];

interface SwipeableExerciseCardProps {
  onDelete: () => void;
  isDark: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

const SWIPE_DELETE_WIDTH = 84;
const SWIPE_THRESHOLD = -40;

const SwipeableExerciseCard: React.FC<SwipeableExerciseCardProps> = ({
  onDelete,
  isDark,
  disabled = false,
  children,
}) => {
  const panX = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const isOpenRef = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (disabled) return false;
          return (
            Math.abs(gestureState.dx) > 10 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2
          );
        },
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (disabled) return false;
          return (
            Math.abs(gestureState.dx) > 10 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2
          );
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          panX.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          const base = isOpenRef.current ? -SWIPE_DELETE_WIDTH : 0;
          const newX = Math.min(0, Math.max(-SWIPE_DELETE_WIDTH - 20, base + gestureState.dx));
          panX.setValue(newX);
        },
        onPanResponderRelease: (_, gestureState) => {
          const currentVal = (panX as any)._value ?? (isOpenRef.current ? -SWIPE_DELETE_WIDTH : 0);
          if (gestureState.dx < -30 || currentVal < SWIPE_THRESHOLD) {
            isOpenRef.current = true;
            Animated.spring(panX, {
              toValue: -SWIPE_DELETE_WIDTH,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          } else {
            isOpenRef.current = false;
            Animated.spring(panX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          isOpenRef.current = false;
          Animated.spring(panX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [disabled, panX]
  );

  const handleDelete = () => {
    onDelete();
  };

  const closeSwipe = () => {
    if (isOpenRef.current) {
      isOpenRef.current = false;
      Animated.spring(panX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  if (disabled) {
    return <View style={styles.swipeContainer}>{children}</View>;
  }

  return (
    <Animated.View style={[styles.swipeContainer, { opacity: opacityAnim }]}>
      {/* Background Red Delete Button */}
      <View style={styles.swipeDeleteActionBg}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleDelete}
          style={styles.swipeDeleteBtn}
          accessibilityLabel="Видалити вправу"
        >
          <Ionicons name="trash" size={20} color="#ffffff" />
          <Text style={styles.swipeDeleteBtnText}>Видалити</Text>
        </TouchableOpacity>
      </View>

      {/* Foreground Swipeable Card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.swipeForeground,
          {
            transform: [{ translateX: panX }],
            backgroundColor: isDark ? '#18181b' : '#ffffff',
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

export const ExercisesScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const { user, isAdmin } = useAuth();
  const { handleScroll } = useScrollTabBar();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createMuscle, setCreateMuscle] = useState<MuscleGroup>('chest');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Edit Modal State
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [editName, setEditName] = useState('');
  const [editMuscle, setEditMuscle] = useState<MuscleGroup>('chest');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const loadExercises = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await ExerciseService.getExercises(user?.id);
      setExercises(list);
    } catch (e) {
      console.warn('[ExercisesScreen.loadExercises] Error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return exercises.filter((ex) => {
      const matchesSearch = !q || ex.name.toLowerCase().includes(q);
      const matchesMuscle = selectedMuscle === 'all' || ex.muscleGroup === selectedMuscle;
      return matchesSearch && matchesMuscle;
    });
  }, [exercises, searchQuery, selectedMuscle]);

  // Handle open create modal
  const handleOpenCreateModal = () => {
    setCreateName(searchQuery.trim());
    setCreateMuscle(selectedMuscle === 'all' ? 'chest' : selectedMuscle);
    setIsCreateOpen(true);
  };

  // Submit create private exercise
  const handleSaveCreate = async () => {
    const cleanName = createName.trim();
    if (!cleanName) {
      Alert.alert('Помилка', 'Введіть назву вправи');
      return;
    }

    if (!user?.id) {
      Alert.alert('Помилка', 'Необхідно авторизуватися для створення приватної вправи');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const newEx: Exercise = {
        id: `custom_ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: user.id,
        name: cleanName,
        muscleGroup: createMuscle,
        description: '',
        isDefault: false,
        createdAt: new Date().toISOString(),
      };

      const success = await ExerciseService.createExercise(newEx);
      if (success) {
        setIsCreateOpen(false);
        setCreateName('');
        await loadExercises();
        Alert.alert('Успішно', `Приватну вправу «${cleanName}» створено!`);
      } else {
        Alert.alert('Помилка', 'Не вдалося створити приватну вправу');
      }
    } catch (err: any) {
      Alert.alert('Помилка', err?.message || 'Помилка при створенні вправи');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handle open edit modal (only for own exercises or admin)
  const handleOpenEditModal = (ex: Exercise) => {
    const isOwner = ex.userId === user?.id;
    if (!isOwner && !isAdmin) {
      Alert.alert('Заборонено', 'Ви можете редагувати лише власні вправи');
      return;
    }

    setEditingExercise(ex);
    setEditName(ex.name);
    setEditMuscle(ex.muscleGroup || 'chest');
  };

  // Submit edit private exercise
  const handleSaveEdit = async () => {
    if (!editingExercise) return;

    const cleanName = editName.trim();
    if (!cleanName) {
      Alert.alert('Помилка', 'Назва вправи не може бути порожньою');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const updated: Exercise = {
        ...editingExercise,
        name: cleanName,
        muscleGroup: editMuscle,
      };

      const result = await ExerciseService.updateExercise(updated, user?.id, isAdmin);
      if (result.success) {
        setEditingExercise(null);
        await loadExercises();
        Alert.alert('Успішно', `Вправу «${cleanName}» оновлено!`);
      } else {
        Alert.alert('Помилка', result.error || 'Не вдалося оновити вправу');
      }
    } catch (err: any) {
      Alert.alert('Помилка', err?.message || 'Помилка при збереженні змін');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Delete exercise with confirmation
  const handleDeleteExercise = (ex: Exercise) => {
    const isOwner = ex.userId === user?.id;
    if (!isOwner && !isAdmin) {
      Alert.alert('Заборонено', 'Ви можете видаляти лише власні вправи');
      return;
    }

    Alert.alert(
      'Видалити вправу?',
      `Ви впевнені, що хочете видалити «${ex.name}»?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            const ok = await ExerciseService.deleteExercise(ex.id, user?.id, isAdmin);
            if (ok) {
              await loadExercises();
              Alert.alert('Успішно', `Вправу «${ex.name}» видалено`);
            } else {
              Alert.alert('Помилка', 'Не вдалося видалити вправу');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}
    >
      <Header
        title="База вправ"
        subtitle={`Каталог (${exercises.length} вправ)`}
        rightAction={
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleOpenCreateModal}
            style={[styles.webAddBtn, isDark ? styles.webAddBtnDark : styles.webAddBtnLight]}
          >
            <Ionicons name="add" size={16} color={isDark ? '#09090b' : '#ffffff'} />
            <Text style={[styles.webAddBtnText, isDark ? styles.webAddBtnTextDark : styles.webAddBtnTextLight]}>
              Додати вправу
            </Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Search Bar */}
        <View style={styles.filterBarContainer}>
          <View style={[styles.searchBar, isDark ? styles.searchBarDark : styles.searchBarLight]}>
            <Ionicons
              name="search"
              size={18}
              color={isDark ? '#71717a' : '#a1a1aa'}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, isDark ? styles.textDark : styles.textLight]}
              placeholder="Пошук вправи за назвою..."
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={isDark ? '#71717a' : '#a1a1aa'} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Muscle group tabs */}
        <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
          М'язові групи
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          <TouchableOpacity
            onPress={() => setSelectedMuscle('all')}
            style={[
              styles.tabChip,
              selectedMuscle === 'all'
                ? isDark
                  ? styles.tabActiveDark
                  : styles.tabActiveLight
                : isDark
                ? styles.tabInactiveDark
                : styles.tabInactiveLight,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                selectedMuscle === 'all'
                  ? isDark
                    ? styles.textPrimaryDark
                    : styles.textPrimaryLight
                  : isDark
                  ? styles.subDark
                  : styles.subLight,
              ]}
            >
              Всі ({exercises.length})
            </Text>
          </TouchableOpacity>

          {MUSCLE_ORDER.map((groupKey) => {
            const count = exercises.filter((e) => e.muscleGroup === groupKey).length;
            const isSelected = selectedMuscle === groupKey;
            return (
              <TouchableOpacity
                key={groupKey}
                onPress={() => setSelectedMuscle(groupKey)}
                style={[
                  styles.tabChip,
                  isSelected
                    ? isDark
                      ? styles.tabActiveDark
                      : styles.tabActiveLight
                    : isDark
                    ? styles.tabInactiveDark
                    : styles.tabInactiveLight,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    isSelected
                      ? isDark
                        ? styles.textPrimaryDark
                        : styles.textPrimaryLight
                      : isDark
                      ? styles.subDark
                      : styles.subLight,
                  ]}
                >
                  {MUSCLE_GROUPS[groupKey]?.nameUk || groupKey} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Exercises List */}
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#0284c7" />
            <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
              Завантаження вправ...
            </Text>
          </View>
        ) : filteredExercises.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="barbell-outline" size={36} color={isDark ? '#52525b' : '#d4d4d8'} />
            <Text style={[styles.emptyTitle, isDark ? styles.textDark : styles.textLight]}>
              Вправ не знайдено
            </Text>
            <Text style={[styles.emptyDesc, isDark ? styles.subDark : styles.subLight]}>
              {searchQuery
                ? `Вправ із назвою «${searchQuery}» не знайдено.`
                : 'У цій категорії поки що немає вправ.'}
            </Text>
            <Button
              title="+ Створити власну вправу"
              variant="primary"
              onPress={handleOpenCreateModal}
              style={{ marginTop: 14 }}
            />
          </Card>
        ) : (
          <View style={styles.grid}>
            {filteredExercises.map((ex) => {
              const muscleInfo = MUSCLE_GROUPS[ex.muscleGroup] || MUSCLE_GROUPS.full_body;
              const isOwner = ex.userId === user?.id;
              const canEdit = isOwner || isAdmin;

              return (
                <SwipeableExerciseCard
                  key={ex.id}
                  isDark={isDark}
                  disabled={!canEdit}
                  onDelete={() => handleDeleteExercise(ex)}
                >
                  <Card style={styles.exCard}>
                    <View style={styles.exCardHeader}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[styles.exTitle, isDark ? styles.textDark : styles.textLight]}>
                          {ex.name}
                        </Text>

                        <View style={styles.badgesRow}>
                          {/* Muscle group badge */}
                          <View
                            style={[
                              styles.muscleBadge,
                              { backgroundColor: muscleInfo.badgeBg, borderColor: muscleInfo.badgeBorder },
                            ]}
                          >
                            <Text style={[styles.muscleBadgeText, { color: muscleInfo.color }]}>
                              {muscleInfo.nameUk}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Action buttons: Edit for own exercises or admin */}
                      {canEdit ? (
                        <View style={styles.actionsRow}>
                          <TouchableOpacity
                            style={[styles.iconButton, isDark ? styles.btnOutlineDark : styles.btnOutlineLight]}
                            onPress={() => handleOpenEditModal(ex)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="pencil-outline" size={15} color={isDark ? '#fafafa' : '#09090b'} />
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                </SwipeableExerciseCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* CREATE MODAL */}
      <Modal
        visible={isCreateOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsCreateOpen(false)}
      >
        <SafeAreaView edges={['top', 'bottom']} style={[styles.modalContainer, isDark ? styles.bgDark : styles.bgLight]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, isDark ? styles.borderDark : styles.borderLight]}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="barbell-outline" size={20} color="#0284c7" />
                <Text style={[styles.modalTitle, isDark ? styles.textDark : styles.textLight]}>
                  Створити власну вправу
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={isDark ? '#fafafa' : '#09090b'} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, isDark ? styles.textDark : styles.textLight]}>
                  Назва вправи *
                </Text>
                <TextInput
                  style={[styles.modalInput, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="Наприклад: Жим штанги під кутом"
                  placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                  value={createName}
                  onChangeText={setCreateName}
                  autoFocus
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, isDark ? styles.textDark : styles.textLight]}>
                  Група м'язів / Категорія *
                </Text>
                <View style={styles.muscleChipsWrap}>
                  {MUSCLE_ORDER.map((group) => {
                    const isSelected = createMuscle === group;
                    const info = MUSCLE_GROUPS[group];
                    return (
                      <TouchableOpacity
                        key={group}
                        onPress={() => setCreateMuscle(group)}
                        style={[
                          styles.formChip,
                          isDark ? styles.formChipDark : styles.formChipLight,
                          isSelected && (isDark ? styles.formChipActiveDark : styles.formChipActiveLight),
                        ]}
                      >
                        <Text
                          style={[
                            styles.formChipText,
                            isSelected
                              ? (isDark ? styles.textDark : styles.textLight)
                              : (isDark ? styles.subDark : styles.subLight),
                            isSelected && { fontWeight: '700' },
                          ]}
                        >
                          {info.nameUk}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, isDark ? styles.btnOutlineDark : styles.btnOutlineLight]}
                  onPress={() => setIsCreateOpen(false)}
                  disabled={isSubmittingCreate}
                >
                  <Text style={[styles.modalCancelText, isDark ? styles.textDark : styles.textLight]}>
                    Скасувати
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSaveBtn,
                    isDark ? styles.modalSaveBtnDark : styles.modalSaveBtnLight,
                    isSubmittingCreate && styles.btnDisabled,
                  ]}
                  onPress={handleSaveCreate}
                  disabled={isSubmittingCreate}
                >
                  {isSubmittingCreate ? (
                    <ActivityIndicator size="small" color={isDark ? '#09090b' : '#ffffff'} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color={isDark ? '#09090b' : '#ffffff'} />
                      <Text style={isDark ? styles.modalSaveTextDark : styles.modalSaveTextLight}>
                        Зберегти вправу
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        visible={Boolean(editingExercise)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditingExercise(null)}
      >
        <SafeAreaView edges={['top', 'bottom']} style={[styles.modalContainer, isDark ? styles.bgDark : styles.bgLight]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, isDark ? styles.borderDark : styles.borderLight]}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="pencil" size={18} color="#0284c7" />
                <Text style={[styles.modalTitle, isDark ? styles.textDark : styles.textLight]}>
                  Редагування власної вправи
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditingExercise(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={isDark ? '#fafafa' : '#09090b'} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, isDark ? styles.textDark : styles.textLight]}>
                  Назва вправи *
                </Text>
                <TextInput
                  style={[styles.modalInput, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="Назва вправи..."
                  placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                  value={editName}
                  onChangeText={setEditName}
                  autoFocus
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, isDark ? styles.textDark : styles.textLight]}>
                  Група м'язів / Категорія *
                </Text>
                <View style={styles.muscleChipsWrap}>
                  {MUSCLE_ORDER.map((group) => {
                    const isSelected = editMuscle === group;
                    const info = MUSCLE_GROUPS[group];
                    return (
                      <TouchableOpacity
                        key={group}
                        onPress={() => setEditMuscle(group)}
                        style={[
                          styles.formChip,
                          isDark ? styles.formChipDark : styles.formChipLight,
                          isSelected && (isDark ? styles.formChipActiveDark : styles.formChipActiveLight),
                        ]}
                      >
                        <Text
                          style={[
                            styles.formChipText,
                            isSelected
                              ? (isDark ? styles.textDark : styles.textLight)
                              : (isDark ? styles.subDark : styles.subLight),
                            isSelected && { fontWeight: '700' },
                          ]}
                        >
                          {info.nameUk}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, isDark ? styles.btnOutlineDark : styles.btnOutlineLight]}
                  onPress={() => setEditingExercise(null)}
                  disabled={isSubmittingEdit}
                >
                  <Text style={[styles.modalCancelText, isDark ? styles.textDark : styles.textLight]}>
                    Скасувати
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSaveBtn,
                    isDark ? styles.modalSaveBtnDark : styles.modalSaveBtnLight,
                    isSubmittingEdit && styles.btnDisabled,
                  ]}
                  onPress={handleSaveEdit}
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? (
                    <ActivityIndicator size="small" color={isDark ? '#09090b' : '#ffffff'} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color={isDark ? '#09090b' : '#ffffff'} />
                      <Text style={isDark ? styles.modalSaveTextDark : styles.modalSaveTextLight}>
                        Зберегти зміни
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgLight: {
    backgroundColor: '#fafafa',
  },
  bgDark: {
    backgroundColor: '#09090b',
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 110,
  },
  addButton: {
    height: 36,
    paddingHorizontal: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchBarLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e7',
  },
  searchBarDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabsContainer: {
    gap: 8,
    paddingVertical: 2,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  tabActiveLight: {
    backgroundColor: '#18181b',
    borderColor: '#18181b',
  },
  tabActiveDark: {
    backgroundColor: '#f4f4f5',
    borderColor: '#f4f4f5',
  },
  tabInactiveLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e7',
  },
  tabInactiveDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textPrimaryLight: {
    color: '#ffffff',
  },
  textPrimaryDark: {
    color: '#09090b',
  },
  loaderContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyCard: {
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  grid: {
    gap: 10,
  },
  exCard: {
    padding: 12,
  },
  exCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  exTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  muscleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  muscleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  ownerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  ownerBadgeLight: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  ownerBadgeDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f59e0b',
  },
  globalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  globalBadgeLight: {
    backgroundColor: '#f4f4f5',
    borderColor: '#e4e4e7',
  },
  globalBadgeDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  globalBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnBg: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalInput: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  muscleChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  formChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  formChipLight: {
    backgroundColor: '#f4f4f5',
    borderColor: '#e4e4e7',
  },
  formChipDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  formChipActiveLight: {
    backgroundColor: '#e0e7ff',
    borderColor: '#6366f1',
  },
  formChipActiveDark: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#818cf8',
  },
  formChipText: {
    fontSize: 12,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  webAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  webAddBtnLight: {
    backgroundColor: '#18181b',
  },
  webAddBtnDark: {
    backgroundColor: '#f4f4f5',
  },
  webAddBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  webAddBtnTextLight: {
    color: '#ffffff',
  },
  webAddBtnTextDark: {
    color: '#09090b',
  },
  filterBarContainer: {
    gap: 8,
  },
  customToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  customToggleActiveLight: {
    backgroundColor: '#18181b',
    borderColor: '#18181b',
  },
  customToggleActiveDark: {
    backgroundColor: '#f4f4f5',
    borderColor: '#f4f4f5',
  },
  customToggleInactiveLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e7',
  },
  customToggleInactiveDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  customToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  modalSaveBtnLight: {
    backgroundColor: '#18181b',
  },
  modalSaveBtnDark: {
    backgroundColor: '#f4f4f5',
  },
  modalSaveTextLight: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveTextDark: {
    color: '#09090b',
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnOutlineLight: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    backgroundColor: '#ffffff',
  },
  btnOutlineDark: {
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
  },
  borderLight: {
    borderBottomColor: '#f4f4f5',
  },
  borderDark: {
    borderBottomColor: '#27272a',
  },
  inputLight: {
    backgroundColor: '#f4f4f5',
    borderColor: '#e4e4e7',
    color: '#09090b',
  },
  inputDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    color: '#fafafa',
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
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
  },
  swipeDeleteActionBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 84,
    backgroundColor: '#dc2626',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  swipeDeleteBtn: {
    width: '100%',
    height: '100%',
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
    zIndex: 1,
    borderRadius: 16,
  },
});
