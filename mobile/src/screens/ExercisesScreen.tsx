import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import {
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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { setSavedActiveTab } from '../components/InstagramTabPager';
import { triggerRefreshSuccessHaptic } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { ExerciseService } from '../services/exerciseService';
import { ExerciseDetailModal } from '../components/ExerciseDetailModal';
import { MUSCLE_GROUPS, MuscleGroup, Exercise, ExerciseCategory, DEFAULT_CATEGORIES, getMuscleGroupInfo } from '../types/workout';
import { SwipeableActionCard } from '../components/SwipeableActionCard';
import { CategoryService } from '../services/categoryService';

interface SwipeableExerciseCardProps {
  id: string;
  onEdit?: () => void;
  onDelete: (onCancel?: () => void) => void;
  onQuickDelete?: (onCancel?: () => void) => void;
  confirmTitle?: string;
  confirmMessage?: string;
  isDark: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

const SwipeableExerciseCard: React.FC<SwipeableExerciseCardProps> = ({
  id,
  onEdit,
  onDelete,
  onQuickDelete,
  confirmTitle,
  confirmMessage,
  isDark,
  disabled = false,
  children,
}) => {
  return (
    <SwipeableActionCard
      id={id}
      isDark={isDark}
      disabled={disabled}
      onEdit={onEdit}
      onDelete={onDelete}
      onQuickDelete={onQuickDelete}
      confirmTitle={confirmTitle}
      confirmMessage={confirmMessage}
      editLabel="Редагувати"
      deleteLabel="Видалити"
    >
      {children}
    </SwipeableActionCard>
  );
};

export const ExercisesScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { user, isAdmin } = useAuth();
  const { handleScroll } = useScrollTabBar();
  const router = useRouter();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<ExerciseCategory[]>(DEFAULT_CATEGORIES);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createMuscle, setCreateMuscle] = useState<MuscleGroup>('chest');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const isSubmittingCreateRef = useRef(false);

  const handleOpenExerciseDetail = (ex: Exercise) => {
    setSavedActiveTab('exercises');
    router.push({
      pathname: `/exercise/${ex.id}` as any,
      params: {
        id: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        fromTab: 'exercises',
      },
    });
  };

  const handleOpenEdit = (ex: Exercise) => {
    const isOwner = ex.userId === user?.id;
    if (!isOwner && !isAdmin) {
      Alert.alert('Заборонено', 'Ви можете редагувати лише власні вправи');
      return;
    }
    setSavedActiveTab('exercises');
    router.push({
      pathname: '/exercise/edit' as any,
      params: {
        id: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        fromTab: 'exercises',
      },
    });
  };

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadExercises = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setIsLoading(true);
    }
    try {
      const list = await ExerciseService.getExercises(user?.id);
      setExercises(list);
    } catch (e) {
      console.warn('[ExercisesScreen.loadExercises] Error:', e);
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadExercises(true);
    CategoryService.getCategories(user?.id).then(setCategories);
    const unsub = CategoryService.subscribe(setCategories);
    return () => unsub();
  }, [loadExercises, user?.id]);

  useFocusEffect(
    useCallback(() => {
      CategoryService.getCategories(user?.id).then(setCategories);
      if (exercises.length === 0) {
        loadExercises(true);
      }
    }, [loadExercises, exercises.length, user?.id])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setSavedActiveTab('exercises');
    try {
      const list = await ExerciseService.getExercises(user?.id);
      setExercises(list);
    } catch (e) {
      console.warn('[ExercisesScreen.onRefresh] Error:', e);
    } finally {
      setIsRefreshing(false);
      await triggerRefreshSuccessHaptic();
    }
  }, [user?.id]);

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

    if (isSubmittingCreateRef.current) return;
    isSubmittingCreateRef.current = true;
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

      // 1. Primary write to DB & local cache
      const success = await ExerciseService.createExercise(newEx);
      if (success) {
        setIsCreateOpen(false);
        setCreateName('');
        setExercises((prev) => [newEx, ...prev.filter((e) => e.id !== newEx.id)]);

        // 2. Secondary operation: background reload without causing creation failure alert
        loadExercises().catch((loadErr) => {
          console.warn('[ExercisesScreen] Background refresh failed after create exercise:', loadErr);
        });
      } else {
        Alert.alert('Помилка', 'Не вдалося створити приватну вправу');
      }
    } catch (err: any) {
      Alert.alert('Помилка', err?.message || 'Помилка при створенні вправи');
    } finally {
      setIsSubmittingCreate(false);
      isSubmittingCreateRef.current = false;
    }
  };

  // Delete exercise with confirmation alert
  const handleDeleteExercise = useCallback(
    (ex: Exercise, onCancel?: () => void) => {
      const isOwner = ex.userId === user?.id;
      if (!isOwner && !isAdmin) {
        Alert.alert('Заборонено', 'Ви можете видаляти лише власні вправи');
        onCancel?.();
        return;
      }

      Alert.alert(
        'Видалити вправу?',
        `Ви впевнені, що хочете видалити «${ex.name}»?`,
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
              setExercises((prev) => prev.filter((item) => item.id !== ex.id));
              try {
                const ok = await ExerciseService.deleteExercise(ex.id, user?.id, isAdmin);
                if (!ok) {
                  await loadExercises();
                }
              } catch {
                await loadExercises();
              }
            },
          },
        ]
      );
    },
    [user?.id, isAdmin, loadExercises]
  );

  const handleQuickDeleteExercise = useCallback(
    (ex: Exercise, onCancel?: () => void) => {
      handleDeleteExercise(ex, onCancel);
    },
    [handleDeleteExercise]
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, { backgroundColor: colors.bg }]}
    >
      <Header
        title={t('exercises.title', 'База вправ')}
        rightAction={
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleOpenCreateModal}
            style={[styles.webAddBtn, { backgroundColor: colors.accent }]}
          >
            <Ionicons name="add" size={16} color={colors.accentText} />
            <Text style={[styles.webAddBtnText, { color: colors.accentText }]}>
              {t('common.add', 'Додати')}
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
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Search Bar */}
        <View style={styles.filterBarContainer}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Ionicons
              name="search"
              size={18}
              color={colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('exercises.search_placeholder', 'Пошук вправи за назвою...')}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Muscle group tabs */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t('analytics.muscle_groups', "М'язові групи")}
        </Text>

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            onPress={() => setSelectedMuscle('all')}
            style={[
              styles.tabChip,
              selectedMuscle === 'all'
                ? { backgroundColor: colors.accent, borderColor: colors.accent }
                : { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                selectedMuscle === 'all'
                  ? { color: colors.accentText, fontWeight: '700' }
                  : { color: colors.textSecondary },
              ]}
            >
              {t('exercises.all_categories', 'Всі')} ({exercises.length})
            </Text>
          </TouchableOpacity>

          {categories.map((cat) => {
            const count = exercises.filter((e) => e.muscleGroup === cat.id).length;
            const isSelected = selectedMuscle === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedMuscle(cat.id)}
                style={[
                  styles.tabChip,
                  isSelected
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    isSelected
                      ? { color: colors.accentText, fontWeight: '700' }
                      : { color: colors.textSecondary },
                  ]}
                >
                  {t(`muscles.${cat.id}`, cat.nameUk)} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Exercises List */}
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Завантаження вправ...
            </Text>
          </View>
        ) : filteredExercises.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.emptyIconBox, { backgroundColor: colors.subCard }]}>
              <Ionicons name="barbell-outline" size={26} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Вправ не знайдено
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {searchQuery
                ? `Вправ із назвою «${searchQuery}» не знайдено.`
                : 'У цій категорії поки що немає вправ.'}
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.8}
              onPress={handleOpenCreateModal}
            >
              <Ionicons name="add" size={16} color={colors.accentText} />
              <Text style={[styles.emptyBtnText, { color: colors.accentText }]}>
                Створити власну вправу
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredExercises.map((ex) => {
              const muscleInfo = getMuscleGroupInfo(ex.muscleGroup, categories);
              const isOwner = ex.userId === user?.id;
              const canEdit = isOwner || isAdmin;

              return (
                <SwipeableExerciseCard
                  key={ex.id}
                  id={ex.id}
                  isDark={isDark}
                  disabled={!canEdit}
                  onEdit={canEdit ? () => handleOpenEdit(ex) : undefined}
                  onDelete={(onCancel) => handleDeleteExercise(ex, onCancel)}
                  onQuickDelete={(onCancel) => handleQuickDeleteExercise(ex, onCancel)}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleOpenExerciseDetail(ex)}
                    style={[styles.exCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}
                  >
                    <View style={styles.exCardHeader}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[styles.exTitle, { color: colors.text }]}>
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
                    </View>
                  </TouchableOpacity>
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
        <SafeAreaView edges={['top', 'bottom']} style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.cardBorder }]}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="barbell-outline" size={20} color={colors.accent} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Створити власну вправу
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  Назва вправи *
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.text }]}
                  placeholder="Наприклад: Жим штанги під кутом"
                  placeholderTextColor={colors.textSecondary}
                  value={createName}
                  onChangeText={setCreateName}
                  autoFocus
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  Група м'язів / Категорія *
                </Text>
                <View style={styles.muscleChipsWrap}>
                  {categories.map((cat) => {
                    const isSelected = createMuscle === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setCreateMuscle(cat.id as MuscleGroup)}
                        style={[
                          styles.formChip,
                          isSelected
                            ? { backgroundColor: colors.accent, borderColor: colors.accent }
                            : { backgroundColor: colors.card, borderColor: colors.cardBorder },
                        ]}
                      >
                        <Text
                          style={[
                            styles.formChipText,
                            isSelected
                              ? { color: colors.accentText, fontWeight: '700' }
                              : { color: colors.textSecondary },
                          ]}
                        >
                          {cat.nameUk}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  onPress={() => setIsCreateOpen(false)}
                  disabled={isSubmittingCreate}
                >
                  <Text style={[styles.modalCancelText, { color: colors.text }]}>
                    Скасувати
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSaveBtn,
                    { backgroundColor: colors.accent },
                    isSubmittingCreate && styles.btnDisabled,
                  ]}
                  onPress={handleSaveCreate}
                  disabled={isSubmittingCreate}
                >
                  {isSubmittingCreate ? (
                    <ActivityIndicator size="small" color={colors.accentText} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color={colors.accentText} />
                      <Text style={[styles.modalSaveText, { color: colors.accentText }]}>
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
    backgroundColor: '#0b1220',
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
    borderRadius: 16,
    borderWidth: 1,
  },
  searchBarLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  searchBarDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 4,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabActiveLight: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  tabActiveDark: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  tabInactiveLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  tabInactiveDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textPrimaryLight: {
    color: '#ffffff',
  },
  textPrimaryDark: {
    color: '#ffffff',
  },
  loaderContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
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
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    marginTop: 16,
    backgroundColor: '#2563eb',
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
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
    borderRadius: 8,
    borderWidth: 1,
  },
  muscleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  ownerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  ownerBadgeLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderColor: '#e2e8f0',
  },
  ownerBadgeDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderColor: '#334155',
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
  },
  globalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  globalBadgeLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  globalBadgeDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
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
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnBg: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
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
    borderRadius: 20,
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
    borderRadius: 14,
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
    borderRadius: 12,
    borderWidth: 1,
  },
  formChipLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  formChipDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  formChipActiveLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: '#2563eb',
  },
  formChipActiveDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderColor: '#60a5fa',
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
    height: 46,
    borderRadius: 16,
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
    gap: 4,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#2563eb',
  },
  webAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
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
    borderRadius: 12,
    borderWidth: 1,
  },
  customToggleActiveLight: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  customToggleActiveDark: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  customToggleInactiveLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  customToggleInactiveDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  customToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#2563eb',
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnOutlineLight: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  btnOutlineDark: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1d2939',
  },
  borderLight: {
    borderBottomColor: '#e2e8f0',
  },
  borderDark: {
    borderBottomColor: '#334155',
  },
  inputLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#0f172a',
  },
  inputDark: {
    backgroundColor: '#0b1220',
    borderColor: '#334155',
    color: '#f8fafc',
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
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
  },
  swipeDeleteActionBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 84,
    backgroundColor: '#dc2626',
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
  },
});
