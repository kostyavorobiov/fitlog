import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ExerciseService } from '../services/exerciseService';
import { AuthService } from '../services/authService';
import { MUSCLE_GROUPS, MuscleGroup, Exercise, User } from '../types/workout';

export const ExercisesScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';

  const [user, setUser] = useState<User | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const loadExercises = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await AuthService.getCurrentUser();
      setUser(currentUser);
      const list = await ExerciseService.getExercises(currentUser?.id || undefined);
      setExercises(list);
    } catch (e) {
      console.warn('Error loading exercises:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const filteredExercises = useMemo(() => {
    if (selectedMuscle === 'all') return exercises;
    return exercises.filter((e) => e.muscleGroup === selectedMuscle);
  }, [exercises, selectedMuscle]);

  const handleCreateTestCustomExercise = async () => {
    setIsCreating(true);
    try {
      const now = new Date();
      const customId = `m_custom_${Date.now()}`;
      const group: MuscleGroup = selectedMuscle === 'all' ? 'chest' : selectedMuscle;

      const newEx: Exercise = {
        id: customId,
        userId: user?.id || null,
        name: `Власна вправа (${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        muscleGroup: group,
        description: 'Створено через мобільний клієнт FitLog',
        isDefault: false,
        createdAt: now.toISOString(),
      };

      const success = await ExerciseService.createExercise(newEx);
      if (success) {
        await loadExercises();
        Alert.alert('Успішно', 'Вправу додано до бази вправ!');
      } else {
        Alert.alert('Помилка', 'Не вдалося створити вправу');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Помилка при створенні');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    await ExerciseService.deleteExercise(exerciseId);
    await loadExercises();
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
          <Button
            title="+ Створити"
            variant="primary"
            loading={isCreating}
            onPress={handleCreateTestCustomExercise}
            style={styles.addButton}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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

          {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((groupKey) => {
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
                  {MUSCLE_GROUPS[groupKey].nameUk} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Exercises List */}
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={isDark ? '#fafafa' : '#18181b'} />
          </View>
        ) : filteredExercises.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={[styles.emptyTitle, isDark ? styles.textDark : styles.textLight]}>
              Вправ не знайдено
            </Text>
            <Button
              title="Додати вправу"
              variant="outline"
              loading={isCreating}
              onPress={handleCreateTestCustomExercise}
              style={{ marginTop: 12 }}
            />
          </Card>
        ) : (
          <View style={styles.grid}>
            {filteredExercises.map((ex) => (
              <Card key={ex.id} style={styles.exCard}>
                <View style={styles.exCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exTitle, isDark ? styles.textDark : styles.textLight]}>
                      {ex.name}
                    </Text>
                    <Text style={[styles.exGroup, isDark ? styles.subDark : styles.subLight]}>
                      {MUSCLE_GROUPS[ex.muscleGroup]?.nameUk || ex.muscleGroup}
                    </Text>
                  </View>
                  {!ex.isDefault && (
                    <Button
                      title="Видалити"
                      variant="danger"
                      onPress={() => handleDeleteExercise(ex.id)}
                      style={styles.exDeleteButton}
                    />
                  )}
                </View>
                {ex.description ? (
                  <Text style={[styles.exDesc, isDark ? styles.subDark : styles.subLight]} numberOfLines={2}>
                    {ex.description}
                  </Text>
                ) : null}
              </Card>
            ))}
          </View>
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
    backgroundColor: '#fafafa',
  },
  bgDark: {
    backgroundColor: '#09090b',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  addButton: {
    height: 36,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabsContainer: {
    gap: 8,
    paddingVertical: 4,
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
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    gap: 10,
  },
  exCard: {
    padding: 12,
    gap: 6,
  },
  exCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  exTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  exGroup: {
    fontSize: 11,
    marginTop: 2,
  },
  exDeleteButton: {
    height: 28,
    paddingHorizontal: 8,
  },
  exDesc: {
    fontSize: 12,
    lineHeight: 16,
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
});
