import React, { useState, useEffect, useMemo } from 'react';
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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Exercise, MuscleGroup, MUSCLE_GROUPS } from '../types/workout';
import { ExerciseService } from '../services/exerciseService';

interface ExerciseSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
  userId?: string;
}

const MUSCLE_FILTER_OPTIONS: { id: MuscleGroup | 'all'; label: string }[] = [
  { id: 'all', label: 'Всі' },
  { id: 'chest', label: 'Грудні' },
  { id: 'back', label: 'Спина' },
  { id: 'legs', label: 'Ноги' },
  { id: 'shoulders', label: 'Плечі' },
  { id: 'biceps', label: 'Біцепс' },
  { id: 'triceps', label: 'Тріцепс' },
  { id: 'full_body', label: 'Full body' },
  { id: 'other', label: 'Інше' },
];

export const ExerciseSelectorModal: React.FC<ExerciseSelectorModalProps> = ({
  visible,
  onClose,
  onSelectExercise,
  userId,
}) => {
  const isDark = useColorScheme() === 'dark';
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [isCreatingCustom, setIsCreatingCustom] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>('chest');

  useEffect(() => {
    if (visible) {
      loadExercises();
    }
  }, [visible, userId]);

  const loadExercises = async () => {
    setIsLoading(true);
    try {
      const list = await ExerciseService.getExercises(userId);
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
    if (!customName.trim()) {
      Alert.alert('Помилка', 'Введіть назву вправи');
      return;
    }

    const newEx: Exercise = {
      id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: userId || null,
      name: customName.trim(),
      muscleGroup: customMuscle,
      description: '',
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    const ok = await ExerciseService.createExercise(newEx);
    if (ok) {
      setExercises((prev) => [newEx, ...prev]);
      setIsCreatingCustom(false);
      setCustomName('');
      onSelectExercise(newEx);
    } else {
      Alert.alert('Помилка', 'Не вдалося створити вправу');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
        {/* Header */}
        <View style={[styles.header, isDark ? styles.borderDark : styles.borderLight]}>
          <Text style={[styles.headerTitle, isDark ? styles.textDark : styles.textLight]}>
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
            <Ionicons name="close" size={24} color={isDark ? '#fafafa' : '#09090b'} />
          </TouchableOpacity>
        </View>

        {isCreatingCustom ? (
          /* Create custom exercise form */
          <View style={styles.createForm}>
            <Text style={[styles.formLabel, isDark ? styles.textDark : styles.textLight]}>Назва вправи</Text>
            <TextInput
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="Наприклад: Жим штанги під кутом"
              placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
              value={customName}
              onChangeText={setCustomName}
              autoFocus
            />

            <Text style={[styles.formLabel, { marginTop: 14 }, isDark ? styles.textDark : styles.textLight]}>
              Група м'язів
            </Text>
            <View style={styles.muscleChipsWrap}>
              {MUSCLE_FILTER_OPTIONS.filter((o) => o.id !== 'all').map((opt) => {
                const isSel = customMuscle === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setCustomMuscle(opt.id as MuscleGroup)}
                    style={[
                      styles.muscleChip,
                      isSel
                        ? (isDark ? styles.muscleChipActiveDark : styles.muscleChipActiveLight)
                        : (isDark ? styles.muscleChipDark : styles.muscleChipLight),
                    ]}
                  >
                    <Text
                      style={[
                        styles.muscleChipText,
                        isSel
                          ? (isDark ? styles.muscleChipTextActiveDark : styles.muscleChipTextActiveLight)
                          : (isDark ? styles.textDark : styles.textLight),
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.saveCustomBtn, isDark ? styles.saveCustomBtnDark : styles.saveCustomBtnLight]}
              activeOpacity={0.8}
              onPress={handleCreateExercise}
            >
              <Text style={[styles.saveCustomBtnText, isDark ? styles.saveCustomBtnTextDark : styles.saveCustomBtnTextLight]}>
                Додати та обрати
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Exercise List View */
          <>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={[styles.searchBar, isDark ? styles.searchBarDark : styles.searchBarLight]}>
                <Ionicons name="search" size={18} color={isDark ? '#71717a' : '#a1a1aa'} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, isDark ? styles.textDark : styles.textLight]}
                  placeholder="Пошук вправи..."
                  placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={16} color={isDark ? '#71717a' : '#a1a1aa'} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Muscle Group Horizontal Scroll */}
            <View style={styles.filtersScrollContainer}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={MUSCLE_FILTER_OPTIONS}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.filterListContent}
                renderItem={({ item }) => {
                  const isSelected = selectedMuscle === item.id;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setSelectedMuscle(item.id)}
                      style={[
                        styles.filterTab,
                        isSelected
                          ? (isDark ? styles.filterTabActiveDark : styles.filterTabActiveLight)
                          : (isDark ? styles.filterTabDark : styles.filterTabLight),
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterTabText,
                          isSelected
                            ? (isDark ? styles.filterTabTextActiveDark : styles.filterTabTextActiveLight)
                            : (isDark ? styles.subDark : styles.subLight),
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            {/* Exercises List */}
            {isLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="small" color={isDark ? '#fafafa' : '#18181b'} />
                <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
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
                  const muscle = MUSCLE_GROUPS[item.muscleGroup] || MUSCLE_GROUPS.other;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={[styles.exerciseItem, isDark ? styles.exerciseItemDark : styles.exerciseItemLight]}
                      onPress={() => onSelectExercise(item)}
                    >
                      <View style={styles.exerciseItemLeft}>
                        <Text style={[styles.exerciseName, isDark ? styles.textDark : styles.textLight]} numberOfLines={2}>
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
                          {item.isDefault && (
                            <Text style={[styles.defaultBadge, isDark ? styles.subDark : styles.subLight]}>
                              Базова
                            </Text>
                          )}
                        </View>
                      </View>

                      <Ionicons name="add" size={20} color={isDark ? '#fafafa' : '#09090b'} />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="barbell-outline" size={40} color={isDark ? '#52525b' : '#d4d4d8'} />
                    <Text style={[styles.emptyTitle, isDark ? styles.textDark : styles.textLight]}>
                      Вправ не знайдено
                    </Text>
                    <Text style={[styles.emptySub, isDark ? styles.subDark : styles.subLight]}>
                      Спробуйте інший пошуковий запит або створіть власну вправу.
                    </Text>
                    <TouchableOpacity
                      style={[styles.addCustomBtn, isDark ? styles.addCustomBtnDark : styles.addCustomBtnLight]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setCustomName(searchQuery);
                        setIsCreatingCustom(true);
                      }}
                    >
                      <Ionicons name="add" size={16} color={isDark ? '#09090b' : '#ffffff'} />
                      <Text style={[styles.addCustomBtnText, isDark ? styles.addCustomBtnTextDark : styles.addCustomBtnTextLight]}>
                        Створити власну вправу
                      </Text>
                    </TouchableOpacity>
                  </View>
                }
                ListFooterComponent={
                  filteredExercises.length > 0 ? (
                    <TouchableOpacity
                      style={[styles.footerCustomBtn, isDark ? styles.borderDark : styles.borderLight]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setCustomName(searchQuery);
                        setIsCreatingCustom(true);
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={isDark ? '#a1a1aa' : '#71717a'} />
                      <Text style={[styles.footerCustomBtnText, isDark ? styles.textDark : styles.textLight]}>
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
    backgroundColor: '#09090b',
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
    borderRadius: 12,
  },
  searchBarLight: {
    backgroundColor: '#f4f4f5',
  },
  searchBarDark: {
    backgroundColor: '#18181b',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
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
    backgroundColor: '#f4f4f5',
    borderColor: '#e4e4e7',
  },
  filterTabDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  filterTabActiveLight: {
    backgroundColor: '#18181b',
    borderColor: '#18181b',
  },
  filterTabActiveDark: {
    backgroundColor: '#f4f4f5',
    borderColor: '#f4f4f5',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterTabTextActiveLight: {
    color: '#ffffff',
  },
  filterTabTextActiveDark: {
    color: '#09090b',
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
    borderRadius: 12,
    borderWidth: 1,
  },
  exerciseItemLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e7',
  },
  exerciseItemDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
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
    borderRadius: 6,
    borderWidth: 1,
  },
  muscleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  defaultBadge: {
    fontSize: 11,
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
    borderRadius: 8,
    marginTop: 4,
  },
  addCustomBtnLight: {
    backgroundColor: '#18181b',
  },
  addCustomBtnDark: {
    backgroundColor: '#f4f4f5',
  },
  addCustomBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addCustomBtnTextLight: {
    color: '#ffffff',
  },
  addCustomBtnTextDark: {
    color: '#09090b',
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
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
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
  muscleChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  muscleChipLight: {
    backgroundColor: '#f4f4f5',
    borderColor: '#e4e4e7',
  },
  muscleChipDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  muscleChipActiveLight: {
    backgroundColor: '#18181b',
    borderColor: '#18181b',
  },
  muscleChipActiveDark: {
    backgroundColor: '#f4f4f5',
    borderColor: '#f4f4f5',
  },
  muscleChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  muscleChipTextActiveLight: {
    color: '#ffffff',
  },
  muscleChipTextActiveDark: {
    color: '#09090b',
  },
  saveCustomBtn: {
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveCustomBtnLight: {
    backgroundColor: '#18181b',
  },
  saveCustomBtnDark: {
    backgroundColor: '#f4f4f5',
  },
  saveCustomBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveCustomBtnTextLight: {
    color: '#ffffff',
  },
  saveCustomBtnTextDark: {
    color: '#09090b',
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
  borderLight: {
    borderColor: '#e4e4e7',
  },
  borderDark: {
    borderColor: '#27272a',
  },
});
