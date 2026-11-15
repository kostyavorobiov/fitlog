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
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { ScreenGestureWrapper } from '../components/ScreenGestureWrapper';
import { Button } from '../components/Button';
import { ExerciseService } from '../services/exerciseService';
import { CategoryService } from '../services/categoryService';
import { useAuth } from '../context/AuthContext';
import { MUSCLE_GROUPS, MuscleGroup, Exercise, ExerciseCategory, DEFAULT_CATEGORIES } from '../types/workout';
import { setSavedActiveTab, getSavedActiveTab, TabName } from '../components/InstagramTabPager';

export const ExerciseEditScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string; name?: string; muscleGroup?: string; fromTab?: TabName }>();

  const sourceTab = (params.fromTab as TabName) || getSavedActiveTab() || 'exercises';
  const exerciseId = params.id as string | undefined;

  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<ExerciseCategory[]>(DEFAULT_CATEGORIES);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [name, setName] = useState(params.name || '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(
    (params.muscleGroup as MuscleGroup) === 'full_body' ? 'glutes' : ((params.muscleGroup as MuscleGroup) || 'chest')
  );
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    CategoryService.getCategories(user?.id).then(setCategories);
  }, [user?.id]);

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

  useEffect(() => {
    setSavedActiveTab(sourceTab);
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => {
      setSavedActiveTab(sourceTab);
      sub.remove();
    };
  }, [handleBack, sourceTab]);

  const handleSave = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert(t('common.error', 'Помилка'), t('exercises.name_required', 'Назва вправи не може бути порожньою'));
      return;
    }

    if (!exercise && !exerciseId) {
      Alert.alert(t('common.error', 'Помилка'), t('exercises.not_found', 'Вправу для редагування не знайдено'));
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
        Alert.alert(t('common.error', 'Помилка'), res.error || t('exercises.failed_to_update', 'Не вдалося оновити вправу'));
      }
    } catch (err: any) {
      Alert.alert(t('common.error', 'Помилка'), err?.message || t('exercises.failed_to_save', 'Помилка при збереженні вправи'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenGestureWrapper enableTabSwipe={false} enableBackSwipe={true} onBack={handleBack}>
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Top Header Bar matching WorkoutEditorScreen */}
        <View style={[styles.topBar, { backgroundColor: colors.bg, borderBottomWidth: 0 }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleBack}
            style={[styles.iconBtn, { backgroundColor: colors.subCard, borderColor: colors.subCardBorder, borderWidth: 1 }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.back', 'Назад')}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text numberOfLines={1} style={[styles.topBarTitle, { color: colors.text }]}>
              {t('exercises.edit_custom_title', 'Редагування власної вправи')}
            </Text>
            <Text style={[styles.topBarSub, { color: colors.textSecondary }]}>
              {t(`muscles.${muscleGroup}`, categories.find((c) => c.id === muscleGroup)?.nameUk || MUSCLE_GROUPS[muscleGroup]?.nameUk || t('common.category', 'Категорія'))}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              {t('common.loading', 'Завантаження вправи...')}
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
                <Text style={[styles.label, { color: colors.text }]}>
                  {t('exercises.name', 'Назва вправи')} *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.subCard, borderColor: colors.subCardBorder, color: colors.text },
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('exercises.name_placeholder', 'Введіть назву вправи...')}
                  placeholderTextColor={colors.textSecondary}
                  autoCorrect={false}
                  maxLength={100}
                />
              </View>

              {/* Muscle Group Chips */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {t('exercises.category_label', "Група м'язів / Категорія")} *
                </Text>
                <View style={styles.chipsWrap}>
                  {categories.map((cat) => {
                    const isSelected = muscleGroup === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setMuscleGroup(cat.id as MuscleGroup)}
                        activeOpacity={0.7}
                        style={[
                          styles.chip,
                          isSelected
                            ? { backgroundColor: colors.activeChipBg, borderColor: colors.activeChipBg }
                            : { backgroundColor: colors.subCard, borderColor: colors.subCardBorder },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected
                              ? { color: colors.activeChipText, fontWeight: '700' }
                              : { color: colors.text },
                          ]}
                        >
                          {t(`muscles.${cat.id}`, cat.nameUk)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Description Input */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {t('exercises.description_optional', 'Опис або нотатки (опціонально)')}
                </Text>
                <TextInput
                  style={[
                    styles.textArea,
                    { backgroundColor: colors.subCard, borderColor: colors.subCardBorder, color: colors.text },
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t('exercises.notes_placeholder', 'Додайте техніку виконання або нотатки...')}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Buttons */}
              <View style={styles.buttonsRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleBack}
                  style={[styles.cancelBtn, { backgroundColor: colors.subCard, borderColor: colors.subCardBorder, borderWidth: 1 }]}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.text }]}>
                    {t('common.cancel', 'Скасувати')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleSave}
                  disabled={!name.trim() || isSaving}
                  style={[
                    styles.saveBtn,
                    { backgroundColor: colors.primaryBtnBg },
                    (!name.trim() || isSaving) && { opacity: 0.6 },
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={colors.primaryBtnText} />
                  ) : (
                    <Text style={[styles.saveBtnText, { color: colors.primaryBtnText }]}>
                      {t('exercises.save_changes', 'Зберегти зміни')}
                    </Text>
                  )}
                </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  topBarSub: {
    fontSize: 12,
    marginTop: 2,
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
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 14,
    minHeight: 120,
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
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
  },
  chipTextActiveLight: {
    color: '#FFFFFF',
  },
  chipTextActiveDark: {
    color: '#FFFFFF',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1.2,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
