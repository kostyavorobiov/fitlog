import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { WorkoutPlan, User } from './types/workout';
import { StorageService, generateId } from './services/storageService';
import { TemplateService, WorkoutTemplate } from './services/templateService';
import { Navbar } from './components/Navbar';
import { WorkoutListView } from './components/WorkoutListView';
import { WorkoutEditor } from './components/WorkoutEditor';
import { WorkoutHistoryView } from './components/WorkoutHistoryView';
import { ExerciseCatalogView } from './components/ExerciseCatalogView';
import { AnalyticsView } from './components/AnalyticsView';
import { ProfileView } from './components/ProfileView';
import { TraineesView } from './components/TraineesView';
import { CreateWorkoutModal } from './components/CreateWorkoutModal';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { PullToRefresh } from './components/PullToRefresh';

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
  const handleCreateNewWorkout = (
    title: string,
    scheduledDate: string,
    template?: WorkoutTemplate
  ) => {
    if (!user) return;
    setEditingTrainee(null);
    let newWorkout: WorkoutPlan;
    if (template) {
      newWorkout = TemplateService.createWorkoutFromTemplate(
        template,
        user.id,
        scheduledDate
      );
      if (title.trim()) newWorkout.title = title.trim();
    } else {
      newWorkout = {
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
    }
    StorageService.saveWorkout(newWorkout);
    setActiveWorkout(newWorkout);
    setWorkoutViewMode('editor');
    setCurrentTab('editor');
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0b1220] text-[#0f172a] dark:text-[#f8fafc]">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#e2e8f0] dark:border-[#334155] border-t-[#2563eb] dark:border-t-[#60a5fa]" />
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] font-mono">Завантаження щоденника...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1220] text-[#0f172a] dark:text-[#f8fafc] flex flex-col transition-colors duration-150">
      {/* Pull To Refresh for mobile Web */}
      <PullToRefresh />

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
        isEditingWorkout={currentTab === 'editor' && workoutViewMode === 'editor' && Boolean(activeWorkout)}
        workoutTitle={activeWorkout?.title}
        onCreateWorkout={() => setIsCreateModalOpen(true)}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8">
        {currentTab === 'editor' && user && (
          <div>
            {workoutViewMode === 'editor' && activeWorkout ? (
              <WorkoutEditor
                workout={activeWorkout}
                userId={user.id}
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
            onBack={() => setCurrentTab('profile')}
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
          <AnalyticsView
            userId={user.id}
            onSelectWorkout={(workout) => {
              handleSelectWorkout(workout);
              setCurrentTab('editor');
            }}
          />
        )}

        {currentTab === 'profile' && user && (
          <ProfileView
            onOpenTrainees={() => setCurrentTab('trainees')}
          />
        )}
      </main>

      {/* Create Workout Modal */}
      <CreateWorkoutModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateNewWorkout}
        userId={user?.id}
      />



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
      <LanguageProvider>
        <AuthProvider>
          <MainContent />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
