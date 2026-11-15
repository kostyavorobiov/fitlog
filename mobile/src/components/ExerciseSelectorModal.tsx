import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Exercise, MuscleGroup, MUSCLE_GROUPS, ExerciseCategory, DEFAULT_CATEGORIES, getMuscleGroupInfo } from '../types/workout';
import { ExerciseService } from '../services/exerciseService';
import { CategoryService } from '../services/categoryService';

interface ExerciseSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
  userId?: string;
  traineeId?: string;
}

export const ExerciseSelectorModal: React.FC<ExerciseSelectorModalProps> = ({
  visible,
  onClose,
  onSelectExercise,
  userId,
  traineeId,
}) => {
  const { colors, isDark } = useTheme();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<ExerciseCategory[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [isCreatingCustom, setIsCreatingCustom] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>('chest');
  const [isSubmittingCustom, setIsSubmittingCustom] = useState<boolean>(false);
  const isSubmittingCustomRef = useRef<boolean>(false);

  useEffect(() => {
    if (visible) {
      loadExercises();
      CategoryService.getCategories(userId).then(setCategories);
    }
  }, [visible, userId, traineeId]);

  useEffect(() => {
    const unsub = CategoryService.subscribe(setCategories);
    return () => unsub();
  }, []);

  const loadExercises = async () => {
    setIsLoading(true);
    try {
      const list = await ExerciseService.getExercises(userId, traineeId);
      setExercises(list);
    } catch (err) {
      console.warn('[ExerciseSelectorModal] Failed to load exercises:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return exercises.filter((ex) => {
      const matchesSearch = !q || ex.name.toLowerCase().includes(q);
      const matchesMuscle = selectedMuscle === 'all' || ex.muscleGroup === selectedMuscle;
      return matchesSearch && matchesMuscle;
    });
  }, [exercises, searchQuery, selectedMuscle]);

  const handleCreateExercise = async () => {
    const cleanName = customName.trim();
    if (!cleanName) {
      Alert.alert('Помилка', 'Введіть назву вправи');
      return;
    }

    if (isSubmittingCustomRef.current) return;
    isSubmittingCustomRef.current = true;
    setIsSubmittingCustom(true);

    try {
      const newEx: Exercise = {
        id: `custom_ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: userId || null,
        name: cleanName,
        muscleGroup: customMuscle,
        description: '',
        isDefault: false,
        createdAt: new Date().toISOString(),
      };

      // 1. Primary write to DB & local cache
      const ok = await ExerciseService.createExercise(newEx);
      if (ok) {
        setExercises((prev) => [newEx, ...prev.filter((e) => e.id !== newEx.id)]);
        setIsCreatingCustom(false);
        setCustomName('');

        // 2. Secondary operation: select exercise
        try {
          onSelectExercise(newEx);
        } catch (selectErr) {
          console.warn('[ExerciseSelectorModal] Failed to select newly created exercise:', selectErr);
        }
      } else {
        Alert.alert('Помилка', 'Не вдалося створити вправу');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося створити вправу');
    } finally {
      setIsSubmittingCustom(false);
      isSubmittingCustomRef.current = false;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isCreatingCustom ? 'Нова вправа' : 'Вибір вправи'}
          </Text>
          <TouchableOpacity
            style={styles.closeBtn}
            activeOpacity={0.7}
            onPress={() => {
              if (isCreatingCustom) {
                setIsCreatingCustom(false);
              } else {
                onClose();
              }
            }}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {isCreatingCustom ? (
          /* Create custom exercise form */
          <View style={styles.createForm}>
            <Text style={[styles.formLabel, { color: colors.text }]}>Назва вправи</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.text }]}
              placeholder="Наприклад: Жим штанги під кутом"
              placeholderTextColor={colors.textSecondary}
              value={customName}
              onChangeText={setCustomName}
              autoFocus
            />

            <Text style={[styles.formLabel, { marginTop: 14, color: colors.text }]}>
              Група м'язів
            </Text>
            <View style={styles.muscleChipsWrap}>
              {categories.map((opt) => {
                const isSel = customMuscle === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setCustomMuscle(opt.id as MuscleGroup)}
                    style={[
                      styles.muscleChip,
                      isSel
                        ? { backgroundColor: colors.accent, borderColor: colors.accent }
                        : { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    ]}
                  >
                    <Text
                      style={[
                        styles.muscleChipText,
                        isSel
                          ? { color: colors.accentText, fontWeight: '700' }
                          : { color: colors.textSecondary },
                      ]}
                    >
                      {opt.nameUk}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.saveCustomBtn,
                { backgroundColor: colors.accent },
                isSubmittingCustom && { opacity: 0.6 },
              ]}
              activeOpacity={0.8}
              disabled={isSubmittingCustom}
              onPress={handleCreateExercise}
            >
              {isSubmittingCustom ? (
                <ActivityIndicator size="small" color={colors.accentText} />
              ) : (
                <Text style={[styles.saveCustomBtnText, { color: colors.accentText }]}>
                  Додати та обрати
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* Exercise List View */
          <>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Пошук вправи..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Exercise Categories Wrapped Container */}
            <View style={styles.categoriesWrapContainer}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSelectedMuscle('all')}
                style={[
                  styles.filterTab,
                  selectedMuscle === 'all'
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    selectedMuscle === 'all'
                      ? { color: colors.accentText, fontWeight: '700' }
                      : { color: colors.textSecondary },
                  ]}
                >
                  Всі
                </Text>
              </TouchableOpacity>

              {categories.map((cat) => {
                const isSelected = selectedMuscle === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    activeOpacity={0.7}
                    onPress={() => setSelectedMuscle(cat.id)}
                    style={[
                      styles.filterTab,
                      isSelected
                        ? { backgroundColor: colors.accent, borderColor: colors.accent }
                        : { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterTabText,
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

            {/* Exercises List */}
            {isLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Завантаження вправ...
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredExercises}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const muscle = getMuscleGroupInfo(item.muscleGroup, categories);
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={[styles.exerciseItem, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}
                      onPress={() => onSelectExercise(item)}
                    >
                      <View style={styles.exerciseItemLeft}>
                        <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <View style={styles.exerciseMetaRow}>
                          <View
                            style={[
                              styles.muscleBadge,
                              { backgroundColor: muscle.badgeBg, borderColor: muscle.badgeBorder },
                            ]}
                          >
                            <Text style={[styles.muscleBadgeText, { color: muscle.color }]}>
                              {muscle.nameUk}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Ionicons name="add" size={20} color={colors.accent} />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="barbell-outline" size={40} color={colors.textSecondary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      Вправ не знайдено
                    </Text>
                    <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                      Спробуйте інший пошуковий запит або створіть власну вправу.
                    </Text>
                    <TouchableOpacity
                      style={[styles.addCustomBtn, { backgroundColor: colors.accent }]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setCustomName(searchQuery);
                        setIsCreatingCustom(true);
                      }}
                    >
                      <Ionicons name="add" size={16} color={colors.accentText} />
                      <Text style={[styles.addCustomBtnText, { color: colors.accentText }]}>
                        Створити власну вправу
                      </Text>
                    </TouchableOpacity>
                  </View>
                }
                ListFooterComponent={
                  filteredExercises.length > 0 ? (
                    <TouchableOpacity
                      style={[styles.footerCustomBtn, { borderColor: colors.cardBorder }]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setCustomName(searchQuery);
                        setIsCreatingCustom(true);
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
                      <Text style={[styles.footerCustomBtnText, { color: colors.text }]}>
                        Не знайшли вправу? Створити власну
                      </Text>
                    </TouchableOpacity>
                  ) : null
                }
              />
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgLight: {
    backgroundColor: '#ffffff',
  },
  bgDark: {
    backgroundColor: '#0b1220',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
    borderRadius: 20,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 14,
  },
  searchBarLight: {
    backgroundColor: '#f1f5f9',
  },
  searchBarDark: {
    backgroundColor: '#1d2939',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  categoriesWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  filtersScrollContainer: {
    paddingVertical: 6,
  },
  filterListContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterTabLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  filterTabDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  filterTabActiveLight: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterTabActiveDark: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterTabTextActiveLight: {
    color: '#ffffff',
  },
  filterTabTextActiveDark: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 8,
    gap: 8,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  exerciseItemLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  exerciseItemDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  exerciseItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  exerciseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  muscleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  muscleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ownerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
  },
  ownerBadgeLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  ownerBadgeDark: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563eb',
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
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 4,
  },
  addCustomBtnLight: {
    backgroundColor: '#2563eb',
  },
  addCustomBtnDark: {
    backgroundColor: '#2563eb',
  },
  addCustomBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addCustomBtnTextLight: {
    color: '#ffffff',
  },
  addCustomBtnTextDark: {
    color: '#ffffff',
  },
  footerCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
  },
  footerCustomBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  createForm: {
    padding: 16,
    gap: 8,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  inputLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    color: '#0f172a',
  },
  inputDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
    color: '#f8fafc',
  },
  muscleChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  muscleChipLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  muscleChipDark: {
    backgroundColor: '#1d2939',
    borderColor: '#334155',
  },
  muscleChipActiveLight: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  muscleChipActiveDark: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  muscleChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  muscleChipTextActiveLight: {
    color: '#ffffff',
  },
  muscleChipTextActiveDark: {
    color: '#ffffff',
  },
  saveCustomBtn: {
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveCustomBtnLight: {
    backgroundColor: '#2563eb',
  },
  saveCustomBtnDark: {
    backgroundColor: '#2563eb',
  },
  saveCustomBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveCustomBtnTextLight: {
    color: '#ffffff',
  },
  saveCustomBtnTextDark: {
    color: '#ffffff',
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
  borderLight: {
    borderColor: '#e2e8f0',
  },
  borderDark: {
    borderColor: '#334155',
  },
});
