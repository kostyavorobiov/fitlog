import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
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

  // Mobile OAuth Bridge: If redirected to web from OAuth on a mobile device/webview, bridge back to mobile app
  const [mobileAuthUrl, setMobileAuthUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const hasAuthTokens = hash.includes('access_token=') || search.includes('code=');
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (hasAuthTokens && isMobile) {
        const target = `fitlog://auth/callback${hash}${search ? (hash ? '&' : '?') + search.slice(1) : ''}`;
        setMobileAuthUrl(target);
        // Automatically attempt deep link redirect to return to the mobile app
        window.location.replace(target);
      }
    } catch (e) {
      console.warn('[MobileOAuthBridge] Error:', e);
    }
  }, []);

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

      {/* Mobile OAuth Return Banner */}
      {mobileAuthUrl && (
        <aside
          role="region"
          aria-label="Повернення в мобільний застосунок"
          className="fixed top-0 inset-x-0 z-[100] px-4 py-3 bg-[#2563eb] text-white flex items-center justify-between shadow-2xl animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-xs sm:text-sm font-semibold">
              Успішно авторизовано! Поверніться в додаток:
            </span>
          </div>
          <a
            href={mobileAuthUrl}
            className="px-4 py-2 bg-white text-[#2563eb] font-bold text-xs rounded-xl shadow active:scale-95 transition-transform"
          >
            Відкрити додаток
          </a>
        </aside>
      )}

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
