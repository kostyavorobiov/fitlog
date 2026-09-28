import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { WorkoutPlan, User } from './types/workout';
import { StorageService, generateId } from './services/storageService';
import { Navbar } from './components/Navbar';
import { WorkoutListView } from './components/WorkoutListView';
import { WorkoutEditor } from './components/WorkoutEditor';
import { WorkoutHistoryView } from './components/WorkoutHistoryView';
import { ExerciseCatalogView } from './components/ExerciseCatalogView';
import { AnalyticsView } from './components/AnalyticsView';
import { ProfileView } from './components/ProfileView';
import { TraineesView } from './components/TraineesView';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { useSwipeGesture } from './utils/useSwipeGesture';

const MainContent: React.FC = () => {
  const { user, isLoading, isCoach, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<
    'editor' | 'history' | 'trainees' | 'catalog' | 'analytics' | 'profile'
  >('editor');
  const [workoutViewMode, setWorkoutViewMode] = useState<'list' | 'editor'>('list');
  const [activeWorkout, setActiveWorkout] = useState<WorkoutPlan | null>(null);
  const [editingTrainee, setEditingTrainee] = useState<User | null>(null);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('trainee');
    } catch {
      return null;
    }
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Restore trainee reference if activeWorkout belongs to a trainee
  useEffect(() => {
    if (activeWorkout && user && activeWorkout.userId && activeWorkout.userId !== user.id) {
      const trainees = StorageService.getTrainees(user.id);
      const matched = trainees.find((t) => t.id === activeWorkout.userId);
      if (matched) {
        setEditingTrainee(matched);
        setSelectedTraineeId(matched.id);
      }
    }
  }, [activeWorkout, user]);

  // Helper to create a fresh workout
  const handleCreateNewWorkout = (title: string, scheduledDate: string) => {
    if (!user) return;
    setEditingTrainee(null);
    const newWorkout: WorkoutPlan = {
      id: generateId('workout'),
      userId: user.id,
      title: title.trim(),
      scheduledDate,
      status: 'in_progress',
      completedAt: null,
      notes: '',
      createdAt: new Date().toISOString(),
      exercises: [],
    };
    StorageService.saveWorkout(newWorkout);
    setActiveWorkout(newWorkout);
    setWorkoutViewMode('editor');
  };

  const handleSelectWorkout = (workout: WorkoutPlan) => {
    setEditingTrainee(null);
    setActiveWorkout(workout);
    setWorkoutViewMode('editor');
  };

  const handleSelectWorkoutFromHistory = (workout: WorkoutPlan) => {
    setEditingTrainee(null);
    setActiveWorkout(workout);
    setWorkoutViewMode('editor');
    setCurrentTab('editor');
  };

  // Trainee Plan creation and editing handler
  const handleOpenTraineeWorkout = (traineeWorkout: WorkoutPlan, trainee: User) => {
    setEditingTrainee(trainee);
    setSelectedTraineeId(trainee.id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('trainee', trainee.id);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.error(e);
    }
    setActiveWorkout(traineeWorkout);
    setWorkoutViewMode('editor');
    setCurrentTab('editor');
  };

  // Handle returning from WorkoutEditor back to appropriate context
  const handleBackFromWorkout = () => {
    if (editingTrainee) {
      // Crucial UX requirement: Return to that trainee's workouts!
      setCurrentTab('trainees');
      setActiveWorkout(null);
      setWorkoutViewMode('list');
    } else {
      setWorkoutViewMode('list');
      setActiveWorkout(null);
    }
  };

  const handleDeleteWorkout = (deletedId: string) => {
    if (!user) return;
    StorageService.deleteWorkout(deletedId);
    if (activeWorkout?.id === deletedId) {
      if (editingTrainee) {
        setCurrentTab('trainees');
        setActiveWorkout(null);
        setWorkoutViewMode('list');
      } else {
        setActiveWorkout(null);
        setWorkoutViewMode('list');
      }
    }
  };

  const navTabs: ('editor' | 'history' | 'analytics' | 'catalog' | 'trainees')[] = [
    'editor',
    'history',
    'analytics',
    'catalog',
  ];
  if (user?.role === 'coach' || isAdmin) {
    navTabs.push('trainees');
  }

  const handleSwipeLeft = () => {
    if (workoutViewMode === 'editor') return;
    if (currentTab === 'profile') return;
    const currentIndex = navTabs.indexOf(currentTab as any);
    if (currentIndex >= 0 && currentIndex < navTabs.length - 1) {
      const nextTab = navTabs[currentIndex + 1];
      setCurrentTab(nextTab);
      if (nextTab === 'editor') {
        setEditingTrainee(null);
        setWorkoutViewMode('list');
      }
    }
  };

  const handleSwipeRight = () => {
    if (workoutViewMode === 'editor') {
      handleBackFromWorkout();
      return;
    }
    if (currentTab === 'profile') {
      setCurrentTab('editor');
      setWorkoutViewMode('list');
      return;
    }
    const currentIndex = navTabs.indexOf(currentTab as any);
    if (currentIndex > 0) {
      const prevTab = navTabs[currentIndex - 1];
      setCurrentTab(prevTab);
      if (prevTab === 'editor') {
        setEditingTrainee(null);
        setWorkoutViewMode('list');
      }
    }
  };

  const swipeRef = useSwipeGesture<HTMLElement>({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">Завантаження щоденника...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors duration-150">
      {/* Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'editor') {
            setEditingTrainee(null);
            setWorkoutViewMode('list');
          }
        }}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        hasActiveWorkout={Boolean(activeWorkout && activeWorkout.status === 'in_progress')}
      />

      {/* Main View Container */}
      <main
        ref={swipeRef}
        className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8 touch-pan-y"
      >
        {currentTab === 'editor' && user && (
          <div>
            {workoutViewMode === 'editor' && activeWorkout ? (
              <WorkoutEditor
                workout={activeWorkout}
                userId={activeWorkout.userId || user.id}
                traineeName={editingTrainee ? (editingTrainee.name || editingTrainee.email) : undefined}
                onSave={(saved) => setActiveWorkout(saved)}
                onDeleteWorkout={handleDeleteWorkout}
                onBack={handleBackFromWorkout}
              />
            ) : (
              <WorkoutListView
                userId={user.id}
                onSelectWorkout={handleSelectWorkout}
                onCreateWorkout={handleCreateNewWorkout}
                onDeleteWorkout={handleDeleteWorkout}
              />
            )}
          </div>
        )}

        {currentTab === 'history' && user && (
          <WorkoutHistoryView
            userId={user.id}
            onSelectWorkout={handleSelectWorkoutFromHistory}
            onCreateWorkout={handleCreateNewWorkout}
            onCreateNew={() => {
              setEditingTrainee(null);
              setCurrentTab('editor');
              setWorkoutViewMode('list');
            }}
            onDeleteWorkout={handleDeleteWorkout}
          />
        )}

        {currentTab === 'trainees' && user && (user.role === 'coach' || isAdmin) && (
          <TraineesView
            coach={user}
            selectedTraineeId={selectedTraineeId}
            onSelectTraineeId={(id) => {
              setSelectedTraineeId(id);
              try {
                const url = new URL(window.location.href);
                if (id) {
                  url.searchParams.set('trainee', id);
                } else {
                  url.searchParams.delete('trainee');
                }
                window.history.replaceState({}, '', url.toString());
              } catch (e) {
                console.error(e);
              }
            }}
            onOpenWorkoutEditor={handleOpenTraineeWorkout}
          />
        )}

        {currentTab === 'catalog' && user && (
          <ExerciseCatalogView userId={user.id} />
        )}

        {currentTab === 'analytics' && user && (
          <AnalyticsView userId={user.id} />
        )}

        {currentTab === 'profile' && user && (
          <ProfileView />
        )}
      </main>

      {/* Google Auth Modal */}
      <GoogleAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
