import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ScreenGestureWrapper } from '../components/ScreenGestureWrapper';
import { Button } from '../components/Button';
import { ExerciseService } from '../services/exerciseService';
import { useAuth } from '../context/AuthContext';
import { MUSCLE_GROUPS, MuscleGroup, Exercise } from '../types/workout';
import { setSavedActiveTab, getSavedActiveTab, TabName } from '../components/InstagramTabPager';

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

export const ExerciseEditScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; name?: string; muscleGroup?: string; fromTab?: TabName }>();

  const sourceTab = (params.fromTab as TabName) || getSavedActiveTab() || 'exercises';
  const exerciseId = params.id as string | undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [name, setName] = useState(params.name || '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(
    (params.muscleGroup as MuscleGroup) || 'chest'
  );
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load exercise details
  useEffect(() => {
    let isMounted = true;
    const fetchExercise = async () => {
      if (!exerciseId) {
        setIsLoading(false);
        return;
      }
      try {
        const exercises = await ExerciseService.getExercises(user?.id);
        const found = exercises.find((e) => e.id === exerciseId);
        if (isMounted) {
          if (found) {
            setExercise(found);
            setName(found.name);
            setMuscleGroup(found.muscleGroup);
            setDescription(found.description || '');
          }
          setIsLoading(false);
        }
      } catch (e) {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchExercise();
    return () => {
      isMounted = false;
    };
  }, [exerciseId, user?.id]);

  const handleBack = useCallback(() => {
    setSavedActiveTab(sourceTab);
    router.back();
  }, [router, sourceTab]);

  const handleSave = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Помилка', 'Назва вправи не може бути порожньою');
      return;
    }

    if (!exercise && !exerciseId) {
      Alert.alert('Помилка', 'Вправу для редагування не знайдено');
      return;
    }

    setIsSaving(true);
    try {
      const updated: Exercise = {
        id: exercise?.id || exerciseId!,
        userId: exercise?.userId || user?.id || null,
        name: cleanName,
        muscleGroup,
        description: description.trim(),
        isDefault: exercise?.isDefault || false,
        createdAt: exercise?.createdAt || new Date().toISOString(),
      };

      const res = await ExerciseService.updateExercise(updated, user?.id);
      if (res.success) {
        setSavedActiveTab(sourceTab);
        router.back();
      } else {
        Alert.alert('Помилка', res.error || 'Не вдалося оновити вправу');
      }
    } catch (err: any) {
      Alert.alert('Помилка', err?.message || 'Помилка при збереженні вправи');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenGestureWrapper enableTabSwipe={false} enableBackSwipe={true} onBack={handleBack}>
      <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
        {/* Top Header Bar matching WorkoutEditorScreen */}
        <View style={[styles.topBar, isDark ? styles.borderDark : styles.borderLight]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleBack}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <Ionicons name="arrow-back" size={22} color={isDark ? '#F8FAFC' : '#0F172A'} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text numberOfLines={1} style={[styles.topBarTitle, isDark ? styles.textDark : styles.textLight]}>
              Редагування власної вправи
            </Text>
            <Text style={[styles.topBarSub, isDark ? styles.subDark : styles.subLight]}>
              {MUSCLE_GROUPS[muscleGroup]?.nameUk || 'Категорія'}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={isDark ? '#60a5fa' : '#2563eb'} />
            <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
              Завантаження вправи...
            </Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Exercise Name Input */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, isDark ? styles.textDark : styles.textLight]}>
                  Назва вправи *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    isDark ? styles.inputDark : styles.inputLight,
                    isDark ? styles.textDark : styles.textLight,
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Введіть назву вправи..."
                  placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
                  autoCorrect={false}
                  maxLength={100}
                />
              </View>

              {/* Muscle Group Chips */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, isDark ? styles.textDark : styles.textLight]}>
                  Група м'язів / Категорія *
                </Text>
                <View style={styles.chipsWrap}>
                  {MUSCLE_ORDER.map((groupKey) => {
                    const isSelected = muscleGroup === groupKey;
                    return (
                      <TouchableOpacity
                        key={groupKey}
                        onPress={() => setMuscleGroup(groupKey)}
                        activeOpacity={0.7}
                        style={[
                          styles.chip,
                          isSelected
                            ? isDark
                              ? styles.chipActiveDark
                              : styles.chipActiveLight
                            : isDark
                            ? styles.chipInactiveDark
                            : styles.chipInactiveLight,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected
                              ? isDark
                                ? styles.chipTextActiveDark
                                : styles.chipTextActiveLight
                              : isDark
                              ? styles.subDark
                              : styles.subLight,
                          ]}
                        >
                          {MUSCLE_GROUPS[groupKey]?.nameUk || groupKey}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Description Input */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, isDark ? styles.textDark : styles.textLight]}>
                  Опис або нотатки (опціонально)
                </Text>
                <TextInput
                  style={[
                    styles.textArea,
                    isDark ? styles.inputDark : styles.inputLight,
                    isDark ? styles.textDark : styles.textLight,
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Додайте техніку виконання або нотатки..."
                  placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Buttons */}
              <View style={styles.buttonsRow}>
                <Button
                  title="Скасувати"
                  variant="outline"
                  onPress={handleBack}
                  style={styles.cancelBtn}
                />
                <Button
                  title="Зберегти зміни"
                  onPress={handleSave}
                  loading={isSaving}
                  disabled={!name.trim()}
                  style={styles.saveBtn}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
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
    borderBottomColor: '#E2E8F0',
  },
  borderDark: {
    borderBottomColor: '#334155',
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 40,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 90,
  },
  inputLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  inputDark: {
    backgroundColor: '#1D2939',
    borderColor: '#334155',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipActiveLight: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipActiveDark: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  chipInactiveLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  chipInactiveDark: {
    backgroundColor: '#1D2939',
    borderColor: '#334155',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActiveLight: {
    color: '#FFFFFF',
  },
  chipTextActiveDark: {
    color: '#FFFFFF',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 2,
  },
});
