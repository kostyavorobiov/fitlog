import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkoutPlan } from './types/workout';
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
import { RestTimerWidget } from './components/RestTimerWidget';
import { Dumbbell } from 'lucide-react';

const MainContent: React.FC = () => {
  const { user, isLoading, isCoach, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<
    'editor' | 'history' | 'trainees' | 'catalog' | 'analytics' | 'profile'
  >('editor');
  const [workoutViewMode, setWorkoutViewMode] = useState<'list' | 'editor'>('list');
  const [activeWorkout, setActiveWorkout] = useState<WorkoutPlan | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [timerTriggerCount, setTimerTriggerCount] = useState(0);

  // Helper to create a fresh workout
  const handleCreateNewWorkout = (title: string, scheduledDate: string) => {
    if (!user) return;
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
    setActiveWorkout(workout);
    setWorkoutViewMode('editor');
  };

  const handleSelectWorkoutFromHistory = (workout: WorkoutPlan) => {
    setActiveWorkout(workout);
    setWorkoutViewMode('editor');
    setCurrentTab('editor');
  };

  const handleDeleteWorkout = (deletedId: string) => {
    if (!user) return;
    StorageService.deleteWorkout(deletedId);
    if (activeWorkout?.id === deletedId) {
      setActiveWorkout(null);
      setWorkoutViewMode('list');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-xs text-slate-400 font-mono">Завантаження щоденника...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-black">
      {/* Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'editor') {
            setWorkoutViewMode('list');
          }
        }}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        hasActiveWorkout={Boolean(activeWorkout && activeWorkout.status === 'in_progress')}
      />

      {/* Main View Container (with bottom padding for mobile tab bar) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8">
        {currentTab === 'editor' && user && (
          <div>
            {workoutViewMode === 'editor' && activeWorkout ? (
              <WorkoutEditor
                workout={activeWorkout}
                userId={activeWorkout.userId || user.id}
                onSave={(saved) => setActiveWorkout(saved)}
                onTriggerRestTimer={() => setTimerTriggerCount((prev) => prev + 1)}
                onDeleteWorkout={handleDeleteWorkout}
                onBack={() => setWorkoutViewMode('list')}
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
              setCurrentTab('editor');
              setWorkoutViewMode('list');
            }}
            onDeleteWorkout={handleDeleteWorkout}
          />
        )}

        {currentTab === 'trainees' && user && (isCoach || isAdmin) && (
          <TraineesView
            coach={user}
            onOpenWorkoutEditor={(traineeWorkout) => {
              setActiveWorkout(traineeWorkout);
              setWorkoutViewMode('editor');
              setCurrentTab('editor');
            }}
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

      {/* Floating Rest Timer */}
      <RestTimerWidget autoStartTrigger={timerTriggerCount} />

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
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
