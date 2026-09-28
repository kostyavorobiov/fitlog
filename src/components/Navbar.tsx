import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserAvatar } from './UserAvatar';
import {
  Dumbbell,
  Calendar,
  BookOpen,
  Activity,
  User,
  LogOut,
  Sparkles,
  Users,
  Sun,
  Moon,
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
  const { theme, toggleTheme, isDark } = useTheme();
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
      {/* Top Header - Minimal Functional Flat */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2">
            {/* Pure Flat Text Logo */}
            <div
              className="flex items-center cursor-pointer select-none py-1 shrink-0"
              onClick={() => onSelectTab('editor')}
            >
              <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 hover:text-zinc-700 dark:hover:text-white transition-colors">
                Workout diary
              </span>
            </div>

            {/* Desktop Navigation Tabs - Flat Style */}
            <nav className="hidden md:flex items-center space-x-1">
              <button
                type="button"
                onClick={() => onSelectTab('editor')}
                className={`relative flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  currentTab === 'editor'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <Dumbbell className="h-4 w-4" />
                <span>Тренування</span>
                {hasActiveWorkout && currentTab !== 'editor' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('history')}
                className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  currentTab === 'history'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <Calendar className="h-4 w-4" />
                <span>Календар</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('analytics')}
                className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  currentTab === 'analytics'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>Аналітика</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('catalog')}
                className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  currentTab === 'catalog'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>Вправи</span>
              </button>

              {(isCoach || isAdmin) && (
                <button
                  type="button"
                  onClick={() => onSelectTab('trainees')}
                  className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    currentTab === 'trainees'
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>Підопічні</span>
                </button>
              )}
            </nav>

            {/* Right Header Actions: Theme Switcher & User Avatar */}
            <div className="flex items-center space-x-2 shrink-0">
              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                className="h-9 w-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
                aria-label={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* User Auth Section */}
              <div className="relative flex items-center" ref={dropdownRef}>
                {user ? (
                  <div>
                    {/* Clickable round avatar with min 44px tap target on mobile */}
                    <button
                      type="button"
                      onClick={() => setUserDropdown((prev) => !prev)}
                      className={`relative flex items-center justify-center rounded-full p-0.5 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-400 active:scale-95 ${
                        currentTab === 'profile' || userDropdown
                          ? 'border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-300 dark:ring-zinc-700'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                      }`}
                      style={{ minWidth: '40px', minHeight: '40px' }}
                      title="Профіль користувача"
                      aria-label="Профіль користувача"
                      aria-expanded={userDropdown}
                    >
                      <UserAvatar
                        src={user.image}
                        alt={user.name}
                        size="sm"
                      />
                    </button>

                    {/* Clean Minimal Flat Dropdown Menu */}
                    {userDropdown && (
                      <div className="absolute right-0 top-12 sm:top-14 z-50 w-64 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 shadow-xl animate-fade-in">
                        {/* User Info Header */}
                        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {user.firstName || user.name} {user.lastName || ''}
                          </p>
                          <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            ID: {user.profileCode || user.id}
                          </p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{user.email}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdown(false);
                            onSelectTab('profile');
                          }}
                          className="w-full flex items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
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
                            className="w-full flex items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                          >
                            <Users className="h-4 w-4 text-zinc-400" />
                            <span>Підопічні (Тренер)</span>
                          </button>
                        )}

                        {/* Theme Toggle within Menu */}
                        <button
                          type="button"
                          onClick={() => {
                            toggleTheme();
                          }}
                          className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          <div className="flex items-center space-x-2">
                            {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-zinc-600" />}
                            <span>Тема</span>
                          </div>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                            {isDark ? 'Темна' : 'Світла'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdown(false);
                            onOpenAuthModal();
                          }}
                          className="w-full flex items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
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
                          className="w-full flex items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 transition-colors border-t border-zinc-100 dark:border-zinc-800 mt-1 pt-2 cursor-pointer"
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
                    className="rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3.5 py-1.5 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
                  >
                    Увійти
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Modern Mobile Bottom Navigation Bar - Flat Minimal with Safe-Area Inset */}
      <nav
        data-no-swipe="true"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 px-2 py-1.5 flex items-center justify-around transition-colors"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={() => onSelectTab('editor')}
          className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] cursor-pointer ${
            currentTab === 'editor'
              ? 'text-zinc-950 dark:text-zinc-100 font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Dumbbell className="h-5 w-5 mb-0.5" />
          <span className="text-[10px]">Тренування</span>
          {hasActiveWorkout && currentTab !== 'editor' && (
            <span className="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-amber-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('history')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] cursor-pointer ${
            currentTab === 'history'
              ? 'text-zinc-950 dark:text-zinc-100 font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Calendar className="h-5 w-5 mb-0.5" />
          <span className="text-[10px]">Календар</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('analytics')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] cursor-pointer ${
            currentTab === 'analytics'
              ? 'text-zinc-950 dark:text-zinc-100 font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Activity className="h-5 w-5 mb-0.5" />
          <span className="text-[10px]">Аналітика</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('catalog')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] cursor-pointer ${
            currentTab === 'catalog'
              ? 'text-zinc-950 dark:text-zinc-100 font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <BookOpen className="h-5 w-5 mb-0.5" />
          <span className="text-[10px]">Вправи</span>
        </button>

        {(isCoach || isAdmin) && (
          <button
            type="button"
            onClick={() => onSelectTab('trainees')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] cursor-pointer ${
              currentTab === 'trainees'
                ? 'text-zinc-950 dark:text-zinc-100 font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
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
