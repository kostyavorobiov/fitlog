import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { WorkoutService } from '../services/workoutService';
import { ExerciseService } from '../services/exerciseService';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { WorkoutPlan, Exercise } from '../types/workout';


export const WorkoutsScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const isCloudConnected = isSupabaseConfigured();
  const { user } = useAuth();

  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const userId = user?.id || 'demo_user';
      const [fetchedWorkouts, fetchedExercises] = await Promise.all([
        WorkoutService.getWorkouts(userId),
        ExerciseService.getExercises(userId),
      ]);

      setWorkouts(fetchedWorkouts);
      setExercises(fetchedExercises);
    } catch (e) {
      console.warn('Error loading data in WorkoutsScreen:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // Test action: creates a real workout plan and syncs to Supabase / local storage
  const handleCreateTestWorkout = async () => {
    setIsCreating(true);
    try {
      const userId = user?.id || 'demo_user';
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const workoutId = `m_wo_${Date.now()}`;
      const exerciseId = exercises[0]?.id || 'def_ex_1';
      const exerciseName = exercises[0]?.name || 'Жим штанги лежачи';
      const muscleGroup = exercises[0]?.muscleGroup || 'chest';

      const testWorkout: WorkoutPlan = {
        id: workoutId,
        userId,
        title: `Мобільне тренування (${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        scheduledDate: dateStr,
        status: 'planned',
        notes: 'Створено з мобільного застосунку React Native + Expo',
        createdAt: now.toISOString(),
        exercises: [
          {
            id: `m_we_${Date.now()}_1`,
            workoutPlanId: workoutId,
            exerciseId,
            exerciseName,
            muscleGroup,
            order: 1,
            setCount: 3,
            targetRepsRange: '8-12',
            notes: 'Тестова вправа',
            sets: [
              {
                id: `m_ws_${Date.now()}_1`,
                workoutExerciseId: `m_we_${Date.now()}_1`,
                setNumber: 1,
                targetRepsRange: '8-12',
                weight: 60,
                actualReps: 10,
                completedAt: now.toISOString(),
                notes: 'Розминка',
                isWarmup: false,
              },
              {
                id: `m_ws_${Date.now()}_2`,
                workoutExerciseId: `m_we_${Date.now()}_1`,
                setNumber: 2,
                targetRepsRange: '8-12',
                weight: 70,
                actualReps: 8,
                completedAt: now.toISOString(),
                notes: '',
                isWarmup: false,
              },
            ],
          },
        ],
      };

      const success = await WorkoutService.saveWorkout(testWorkout);
      if (success) {
        await loadData();
        Alert.alert(
          'Успішно',
          isCloudConnected
            ? 'Тестове тренування збережено в Supabase і доступне у вебверсії!'
            : 'Тестове тренування збережено локально в кеш!'
        );
      } else {
        Alert.alert('Помилка', 'Не вдалося зберегти тренування');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося створити тренування');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    const userId = user?.id || 'demo_user';
    await WorkoutService.deleteWorkout(userId, id);
    await loadData();
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}
    >
      <Header
        title="Тренування"
        subtitle="Workout Diary Mobile"
        rightAction={
          <Button
            title="+ Тестове"
            variant="primary"
            loading={isCreating}
            onPress={handleCreateTestWorkout}
            style={styles.addButton}
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Backend / Cloud Status Banner */}
        <Card style={styles.bannerCard}>
          <View style={styles.bannerRow}>
            <View
              style={[
                styles.bannerIcon,
                isCloudConnected ? styles.iconCloudConnected : styles.iconCloudOffline,
              ]}
            >
              <Ionicons
                name={isCloudConnected ? 'cloud-done-outline' : 'cloud-offline-outline'}
                size={24}
                color={isCloudConnected ? '#10b981' : '#f59e0b'}
              />
            </View>
            <View style={styles.bannerText}>
              <View style={styles.statusBadgeRow}>
                <Text style={[styles.bannerTitle, isDark ? styles.textDark : styles.textLight]}>
                  {isCloudConnected ? 'Supabase Backend підключено' : 'Автономний режим (Offline)'}
                </Text>
                <View
                  style={[
                    styles.statusIndicator,
                    { backgroundColor: isCloudConnected ? '#10b981' : '#f59e0b' },
                  ]}
                />
              </View>
              <Text style={[styles.bannerSub, isDark ? styles.subDark : styles.subLight]}>
                {isCloudConnected
                  ? `Спільна база даних PostgreSQL • Користувач: ${user?.name || user?.email || 'Авторизований'}`
                  : 'Дані зберігаються в AsyncStorage локально'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Card style={styles.statBox}>
            <Text style={[styles.statValue, isDark ? styles.textDark : styles.textLight]}>
              {workouts.length}
            </Text>
            <Text style={[styles.statLabel, isDark ? styles.subDark : styles.subLight]}>
              Тренувань
            </Text>
          </Card>
          <Card style={styles.statBox}>
            <Text style={[styles.statValue, isDark ? styles.textDark : styles.textLight]}>
              {exercises.length}
            </Text>
            <Text style={[styles.statLabel, isDark ? styles.subDark : styles.subLight]}>
              Вправ у базі
            </Text>
          </Card>
        </View>

        {/* Loading Indicator */}
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={isDark ? '#fafafa' : '#18181b'} />
            <Text style={[styles.loaderText, isDark ? styles.subDark : styles.subLight]}>
              Завантаження даних з backend...
            </Text>
          </View>
        ) : workouts.length === 0 ? (
          /* Empty State */
          <Card style={styles.emptyCard}>
            <Ionicons
              name="calendar-outline"
              size={40}
              color={isDark ? '#71717a' : '#a1a1aa'}
              style={styles.emptyIcon}
            />
            <Text style={[styles.emptyTitle, isDark ? styles.textDark : styles.textLight]}>
              Тренувань поки немає
            </Text>
            <Text style={[styles.emptyDesc, isDark ? styles.subDark : styles.subLight]}>
              Натисніть «+ Тестове», щоб створити перше тренування з мобільного застосунку та перевірити синхронізацію з вебверсією.
            </Text>
            <Button
              title="Створити тестове тренування"
              variant="primary"
              loading={isCreating}
              onPress={handleCreateTestWorkout}
              style={{ marginTop: 16 }}
            />
          </Card>
        ) : (
          /* Workouts List */
          <View style={styles.listContainer}>
            <View style={styles.listHeader}>
              <Text style={[styles.listTitle, isDark ? styles.textDark : styles.textLight]}>
                Список тренувань ({workouts.length})
              </Text>
              <Button
                title="Оновити"
                variant="outline"
                onPress={loadData}
                style={styles.refreshButton}
              />
            </View>

            {workouts.map((w) => (
              <Card key={w.id} style={styles.workoutItemCard}>
                <View style={styles.workoutTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.workoutTitle, isDark ? styles.textDark : styles.textLight]}>
                      {w.title}
                    </Text>
                    <Text style={[styles.workoutDate, isDark ? styles.subDark : styles.subLight]}>
                      📅 {w.scheduledDate} • {w.exercises?.length || 0} вправ
                    </Text>
                  </View>
                  <Button
                    title="Видалити"
                    variant="danger"
                    onPress={() => handleDeleteWorkout(w.id)}
                    style={styles.deleteButton}
                  />
                </View>

                {w.exercises && w.exercises.length > 0 && (
                  <View style={styles.exercisesPreview}>
                    {w.exercises.slice(0, 3).map((ex, exIdx) => (
                      <View key={ex.id || exIdx} style={styles.exRow}>
                        <Text style={[styles.exName, isDark ? styles.textDark : styles.textLight]}>
                          • {ex.exerciseName || 'Вправа'}
                        </Text>
                        <Text style={[styles.exSets, isDark ? styles.subDark : styles.subLight]}>
                          {ex.sets?.length || 0} сетів
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
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
  refreshButton: {
    height: 32,
    paddingHorizontal: 10,
  },
  deleteButton: {
    height: 30,
    paddingHorizontal: 8,
  },
  bannerCard: {
    padding: 16,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCloudConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  iconCloudOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  bannerText: {
    flex: 1,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  bannerSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  loaderContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 13,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  listContainer: {
    gap: 12,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  workoutItemCard: {
    padding: 14,
    gap: 10,
  },
  workoutTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  workoutTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  workoutDate: {
    fontSize: 12,
    marginTop: 2,
  },
  exercisesPreview: {
    borderTopWidth: 1,
    borderTopColor: '#27272a20',
    paddingTop: 8,
    gap: 4,
  },
  exRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exName: {
    fontSize: 13,
  },
  exSets: {
    fontSize: 12,
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
