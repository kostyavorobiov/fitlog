import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Dumbbell,
  Calendar,
  BookOpen,
  Activity,
  User,
  LogOut,
  Sparkles,
  Users,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'editor' | 'history' | 'trainees' | 'catalog' | 'analytics' | 'profile';
  onSelectTab: (tab: 'editor' | 'history' | 'trainees' | 'catalog' | 'analytics' | 'profile') => void;
  onOpenAuthModal: () => void;
  hasActiveWorkout: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuthModal,
  hasActiveWorkout,
}) => {
  const { user, logout, isCoach, isAdmin } = useAuth();
  const [userDropdown, setUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdown(false);
      }
    };
    if (userDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userDropdown]);

  return (
    <>
      {/* Top Header - Minimal Flat */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between">
            {/* Pure Flat Text Logo (Requirement 3: Workout diary) */}
            <div
              className="flex items-center cursor-pointer select-none py-1"
              onClick={() => onSelectTab('editor')}
            >
              <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-100 hover:text-white transition-colors">
                Workout diary
              </span>
            </div>

            {/* Desktop Navigation Tabs - Flat Style */}
            <nav className="hidden md:flex items-center space-x-1">
              <button
                type="button"
                onClick={() => onSelectTab('editor')}
                className={`relative flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  currentTab === 'editor'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                }`}
              >
                <Dumbbell className="h-4 w-4" />
                <span>Тренування</span>
                {hasActiveWorkout && currentTab !== 'editor' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('history')}
                className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  currentTab === 'history'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                }`}
              >
                <Calendar className="h-4 w-4" />
                <span>Календар</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('analytics')}
                className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  currentTab === 'analytics'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>Аналітика</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('catalog')}
                className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  currentTab === 'catalog'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>Вправи</span>
              </button>

              {(isCoach || isAdmin) && (
                <button
                  type="button"
                  onClick={() => onSelectTab('trainees')}
                  className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    currentTab === 'trainees'
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>Підопічні</span>
                </button>
              )}
            </nav>

            {/* User Auth Section - ONLY circular avatar (Requirement 4) */}
            <div className="relative flex items-center" ref={dropdownRef}>
              {user ? (
                <div>
                  {/* Clickable round avatar with subtle affordance and min 44px tap target */}
                  <button
                    type="button"
                    onClick={() => setUserDropdown((prev) => !prev)}
                    className={`relative flex items-center justify-center rounded-full p-0.5 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-400 active:scale-95 ${
                      currentTab === 'profile' || userDropdown
                        ? 'border-zinc-200 ring-2 ring-zinc-700'
                        : 'border-zinc-700 hover:border-zinc-400'
                    }`}
                    style={{ minWidth: '44px', minHeight: '44px' }}
                    title="Профіль користувача"
                    aria-label="Профіль користувача"
                    aria-expanded={userDropdown}
                  >
                    <img
                      src={user.image}
                      alt={user.name}
                      className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover bg-zinc-800"
                    />
                  </button>

                  {/* Clean Flat Dropdown Menu */}
                  {userDropdown && (
                    <div className="absolute right-0 top-12 sm:top-14 z-50 w-64 rounded-xl border border-zinc-800 bg-zinc-900 p-2 shadow-xl animate-fade-in">
                      {/* User Info Header */}
                      <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                        <p className="text-xs font-semibold text-zinc-100 truncate">
                          {user.firstName || user.name} {user.lastName || ''}
                        </p>
                        <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
                          ID: {user.profileCode || user.id}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdown(false);
                          onSelectTab('profile');
                        }}
                        className="w-full flex items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
                      >
                        <User className="h-4 w-4 text-zinc-400" />
                        <span>Мій профіль</span>
                      </button>

                      {(isCoach || isAdmin) && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdown(false);
                            onSelectTab('trainees');
                          }}
                          className="w-full flex items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
                        >
                          <Users className="h-4 w-4 text-zinc-400" />
                          <span>Підопічні (Тренер)</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdown(false);
                          onOpenAuthModal();
                        }}
                        className="w-full flex items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                      >
                        <Sparkles className="h-4 w-4 text-zinc-400" />
                        <span>Змінити акаунт</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdown(false);
                          logout();
                        }}
                        className="w-full flex items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors border-t border-zinc-800/80 mt-1 pt-2"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Вийти</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="rounded-lg bg-zinc-100 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-white transition-colors"
                >
                  Увійти
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Modern Mobile Bottom Navigation Bar - Flat Minimal with Safe-Area Inset */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950 border-t border-zinc-800 px-2 py-1.5 flex items-center justify-around"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={() => onSelectTab('editor')}
          className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors min-h-[44px] min-w-[48px] ${
            currentTab === 'editor'
              ? 'text-zinc-100 font-bold bg-zinc-900 border border-zinc-800'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Dumbbell className="h-5 w-5 mb-0.5" />
          <span className="text-[10px]">Тренування</span>
          {hasActiveWorkout && currentTab !== 'editor' && (
            <span className="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('history')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors min-h-[44px] min-w-[48px] ${
            currentTab === 'history'
              ? 'text-zinc-100 font-bold bg-zinc-900 border border-zinc-800'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Calendar className="h-5 w-5 mb-0.5" />
          <span className="text-[10px]">Календар</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('analytics')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors min-h-[44px] min-w-[48px] ${
            currentTab === 'analytics'
              ? 'text-zinc-100 font-bold bg-zinc-900 border border-zinc-800'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Activity className="h-5 w-5 mb-0.5" />
          <span className="text-[10px]">Аналітика</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('catalog')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors min-h-[44px] min-w-[48px] ${
            currentTab === 'catalog'
              ? 'text-zinc-100 font-bold bg-zinc-900 border border-zinc-800'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BookOpen className="h-5 w-5 mb-0.5" />
          <span className="text-[10px]">Вправи</span>
        </button>

        {(isCoach || isAdmin) && (
          <button
            type="button"
            onClick={() => onSelectTab('trainees')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors min-h-[44px] min-w-[48px] ${
              currentTab === 'trainees'
                ? 'text-zinc-100 font-bold bg-zinc-900 border border-zinc-800'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="h-5 w-5 mb-0.5" />
            <span className="text-[10px]">Підопічні</span>
          </button>
        )}
      </nav>
    </>
  );
};
