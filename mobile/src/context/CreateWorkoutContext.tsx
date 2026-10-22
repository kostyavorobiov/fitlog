import React, { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useAuth } from './AuthContext';
import { WorkoutService } from '../services/workoutService';
import { TemplateService, WorkoutTemplate } from '../services/templateService';
import { WorkoutPlan } from '../types/workout';
import { CreateWorkoutModal } from '../components/CreateWorkoutModal';
import { formatLocalDate } from '../utils/date';

interface CreateWorkoutContextType {
  openCreateModal: (options?: { initialDate?: string; onCreated?: () => void }) => void;
  closeCreateModal: () => void;
  isCreateModalVisible: boolean;
}

const CreateWorkoutContext = createContext<CreateWorkoutContextType | null>(null);

export const CreateWorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const router = useRouter();

  const [isVisible, setIsVisible] = useState(false);
  const [initialDate, setInitialDate] = useState<string>(formatLocalDate());
  const [isLoading, setIsLoading] = useState(false);
  const [onCreatedCallback, setOnCreatedCallback] = useState<(() => void) | undefined>();

  const openCreateModal = useCallback(
    (options?: { initialDate?: string; onCreated?: () => void }) => {
      setInitialDate(options?.initialDate || formatLocalDate());
      setOnCreatedCallback(() => options?.onCreated);
      setIsVisible(true);
    },
    []
  );

  const closeCreateModal = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleCreateSubmit = async (
    title: string,
    scheduledDate: string,
    notes: string,
    template?: WorkoutTemplate
  ) => {
    if (!user) {
      Alert.alert('Потрібна авторизація', 'Будь ласка, увійдіть у свій акаунт.');
      return;
    }

    setIsLoading(true);
    try {
      let newWorkout: WorkoutPlan;
      if (template) {
        newWorkout = TemplateService.createWorkoutFromTemplate(
          template,
          user.id,
          scheduledDate || formatLocalDate()
        );
        if (title.trim()) newWorkout.title = title.trim();
        if (notes.trim()) newWorkout.notes = notes.trim();
      } else {
        const workoutId = `wo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        newWorkout = {
          id: workoutId,
          userId: user.id,
          title: title.trim() || 'Нове тренування',
          scheduledDate: scheduledDate || formatLocalDate(),
          status: 'planned',
          notes: notes.trim(),
          createdAt: new Date().toISOString(),
          exercises: [],
        };
      }

      const success = await WorkoutService.saveWorkout(newWorkout);
      if (!success) {
        throw new Error('Не вдалося зберегти тренування');
      }

      setIsVisible(false);

      if (onCreatedCallback) {
        onCreatedCallback();
      }

      router.push({ pathname: '/workout/[id]', params: { id: newWorkout.id } });
    } catch (err) {
      console.error('[CreateWorkoutProvider] Error creating workout:', err);
      Alert.alert('Помилка', 'Не вдалося створити тренування');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CreateWorkoutContext.Provider
      value={{
        openCreateModal,
        closeCreateModal,
        isCreateModalVisible: isVisible,
      }}
    >
      {children}
      <CreateWorkoutModal
        visible={isVisible}
        initialDate={initialDate}
        onClose={closeCreateModal}
        onSubmit={handleCreateSubmit}
        isLoading={isLoading}
      />
    </CreateWorkoutContext.Provider>
  );
};

export const useCreateWorkout = () => {
  const context = useContext(CreateWorkoutContext);
  if (!context) {
    throw new Error('useCreateWorkout must be used within a CreateWorkoutProvider');
  }
  return context;
};
