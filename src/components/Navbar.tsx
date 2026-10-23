import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Activity,
  BarChart2,
  Dumbbell,
  BookOpen,
  Users,
  Sun,
  Moon,
  Plus,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { UserAvatar } from './UserAvatar';

interface NavbarProps {
  currentTab: 'editor' | 'history' | 'trainees' | 'catalog' | 'analytics' | 'profile';
  onSelectTab: (
    tab: 'editor' | 'history' | 'trainees' | 'catalog' | 'analytics' | 'profile'
  ) => void;
  onOpenAuthModal: () => void;
  hasActiveWorkout?: boolean;
  isEditingWorkout?: boolean;
  workoutTitle?: string;
  onCreateWorkout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuthModal,
  hasActiveWorkout = false,
  isEditingWorkout = false,
  workoutTitle,
  onCreateWorkout,
}) => {
  const { user, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const isDark = theme === 'dark';

  const [isNavVisible, setIsNavVisible] = useState(true);
  const isNavVisibleRef = useRef(true);
  const lastScrollY = useRef(0);
  const lastNavSelectTime = useRef(0);

  // Handle mobile navbar auto-hide on scroll with hysteresis and jitter suppression
  useEffect(() => {
    let ticking = false;
    let suppressHideUntil = 0;
    let accumulatedDelta = 0;
    let lastToggleTime = 0;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
          const diff = currentScrollY - lastScrollY.current;
          const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

          // Always visible at the very top of page
          if (currentScrollY <= 25) {
            if (!isNavVisibleRef.current) {
              isNavVisibleRef.current = true;
              setIsNavVisible(true);
            }
            accumulatedDelta = 0;
            lastScrollY.current = Math.max(0, currentScrollY);
            ticking = false;
            return;
          }

          // Prevent rubber-band bounce at bottom in iOS Safari / Chrome from showing navbar
          if (maxScrollY > 0 && currentScrollY >= maxScrollY - 15) {
            lastScrollY.current = currentScrollY;
            ticking = false;
            return;
          }

          const now = Date.now();
          const canToggle = now - lastToggleTime >= 220;

          if (diff > 8) {
            // Scrolling down the page (swiping up) -> hide navbar
            if (accumulatedDelta < 0) accumulatedDelta = 0;
            accumulatedDelta += diff;

            if (isNavVisibleRef.current && canToggle && accumulatedDelta >= 22 && now >= suppressHideUntil) {
              isNavVisibleRef.current = false;
              setIsNavVisible(false);
              lastToggleTime = now;
            }
          } else if (diff < -8) {
            // Scrolling up the page (swiping down) -> show navbar
            if (accumulatedDelta > 0) accumulatedDelta = 0;
            accumulatedDelta += diff;

            if (!isNavVisibleRef.current && canToggle && accumulatedDelta <= -18) {
              isNavVisibleRef.current = true;
              setIsNavVisible(true);
              lastToggleTime = now;
            }
          }

          lastScrollY.current = Math.max(0, currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleShowNavbar = () => {
      isNavVisibleRef.current = true;
      setIsNavVisible(true);
      suppressHideUntil = Date.now() + 800;
    };

    const handleFocusChange = () => {
      isNavVisibleRef.current = true;
      setIsNavVisible(true);
      suppressHideUntil = Date.now() + 1000;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('show-navbar', handleShowNavbar);
    window.addEventListener('focusin', handleFocusChange);
    window.addEventListener('focusout', handleFocusChange);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('show-navbar', handleShowNavbar);
      window.removeEventListener('focusin', handleFocusChange);
      window.removeEventListener('focusout', handleFocusChange);
    };
  }, []);

  const handleNavSelect = (
    tab: 'editor' | 'history' | 'trainees' | 'catalog' | 'analytics' | 'profile'
  ) => {
    const now = Date.now();
    // If any input or element is focused, blur it immediately so keyboard collapses smoothly
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsNavVisible(true);

    if (now - lastNavSelectTime.current < 250 && currentTab === tab) {
      return;
    }
    lastNavSelectTime.current = now;

    onSelectTab(tab);
  };

  const currentTabTitle = (() => {
    if (isEditingWorkout) {
      return '';
    }
    switch (currentTab) {
      case 'editor':
        return 'Тренування';
      case 'analytics':
        return 'Аналітика';
      case 'catalog':
        return 'База вправ';
      case 'history':
        return 'Календар';
      case 'trainees':
        return 'Підопічні';
      case 'profile':
        return 'Профіль';
      default:
        return 'Тренування';
    }
  })();

  return (
    <>
      {/* Top Header - Liquid Glass with Mobile Auto-Hide */}
      <header
        data-no-swipe="true"
        className={`sticky top-0 z-40 w-full border-b border-[#e2e8f0]/80 dark:border-[#334155]/80 bg-[#f8fafc]/85 dark:bg-[#0b1220]/85 backdrop-blur-xl transition-all duration-300 ease-in-out ${isEditingWorkout || currentTab === 'analytics' ? 'hidden md:block' : ''} ${isNavVisible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none md:translate-y-0 md:opacity-100 md:pointer-events-auto'
          }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2">
            {/* Header Title: Dynamic Tab Title on Mobile, Logo on Desktop */}
            <div className="flex items-center min-w-0 py-1 shrink-0">
              <h1 className="md:hidden text-[26px] font-bold tracking-tight text-[#0f172a] dark:text-[#f8fafc] truncate">
                {currentTabTitle}
              </h1>
              <div
                className="hidden md:flex items-center cursor-pointer select-none py-1 shrink-0"
                onTouchStart={() => handleNavSelect('editor')}
                onPointerDown={(e) => {
                  if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('editor');
                }}
                onClick={() => handleNavSelect('editor')}
              >
                <span className="text-[26px] font-bold tracking-tight text-[#0f172a] dark:text-[#f8fafc] hover:text-[#2563eb] dark:hover:text-[#60a5fa] transition-colors">
                  FitLog
                </span>
              </div>
            </div>

            {/* Desktop Navigation Tabs - Flat Style */}
            <nav className="hidden md:flex items-center space-x-1">
              <button
                type="button"
                onTouchStart={() => handleNavSelect('editor')}
                onPointerDown={(e) => {
                  if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('editor');
                }}
                onClick={() => handleNavSelect('editor')}
                className={`relative flex items-center space-x-2 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${currentTab === 'editor'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#1d2939]'
                  }`}
              >
                <Dumbbell className="h-4 w-4" />
                <span>Тренування</span>
                {hasActiveWorkout && currentTab !== 'editor' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />
                )}
              </button>

              <button
                type="button"
                onTouchStart={() => handleNavSelect('history')}
                onPointerDown={(e) => {
                  if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('history');
                }}
                onClick={() => handleNavSelect('history')}
                className={`flex items-center space-x-2 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${currentTab === 'history'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#1d2939]'
                  }`}
              >
                <Calendar className="h-4 w-4" />
                <span>Календар</span>
              </button>

              <button
                type="button"
                onTouchStart={() => handleNavSelect('analytics')}
                onPointerDown={(e) => {
                  if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('analytics');
                }}
                onClick={() => handleNavSelect('analytics')}
                className={`flex items-center space-x-2 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${currentTab === 'analytics'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#1d2939]'
                  }`}
              >
                <Activity className="h-4 w-4" />
                <span>Аналітика</span>
              </button>

              <button
                type="button"
                onTouchStart={() => handleNavSelect('catalog')}
                onPointerDown={(e) => {
                  if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('catalog');
                }}
                onClick={() => handleNavSelect('catalog')}
                className={`flex items-center space-x-2 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${currentTab === 'catalog'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#1d2939]'
                  }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>Вправи</span>
              </button>

              {(user?.role === 'coach' || isAdmin) && (
                <button
                  type="button"
                  onTouchStart={() => handleNavSelect('trainees')}
                  onPointerDown={(e) => {
                    if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('trainees');
                  }}
                  onClick={() => handleNavSelect('trainees')}
                  className={`flex items-center space-x-2 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${currentTab === 'trainees'
                    ? 'bg-[#2563eb] text-white shadow-sm'
                    : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#1d2939]'
                    }`}
                >
                  <Users className="h-4 w-4" />
                  <span>Підопічні</span>
                </button>
              )}
            </nav>

            {/* Right Header Actions: Language + Theme + User Avatar */}
            <div className="flex items-center space-x-1.5 shrink-0">

              {/* Theme Toggle Button — round (desktop only, hidden on mobile) */}
              <button
                type="button"
                onTouchStart={() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
                onPointerDown={() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
                onClick={toggleTheme}
                className="hidden md:flex h-9 w-9 rounded-full border border-[#e2e8f0] dark:border-[#334155] bg-[#f1f5f9] dark:bg-[#1d2939] items-center justify-center text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#60a5fa] hover:bg-[#e2e8f0] dark:hover:bg-[#263140] transition-colors cursor-pointer"
                title={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
                aria-label={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* User Auth Section */}
              <div className="flex items-center">
                {user ? (
                  <button
                    type="button"
                    onTouchStart={() => handleNavSelect('profile')}
                    onPointerDown={(e) => {
                      if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('profile');
                    }}
                    onClick={() => handleNavSelect('profile')}
                    className={`hidden md:flex relative items-center justify-center rounded-full p-0.5 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 active:scale-95 ${currentTab === 'profile'
                      ? 'border-[#2563eb] ring-2 ring-[#2563eb]/30'
                      : 'border-[#e2e8f0] dark:border-[#334155] hover:border-[#2563eb]'
                      }`}
                    style={{ minWidth: '40px', minHeight: '40px' }}
                    title="Мій профіль"
                    aria-label="Мій профіль"
                  >
                    <UserAvatar
                      src={user.image}
                      alt={user.name}
                      size="sm"
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onTouchStart={() => {
                      if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                      }
                      onOpenAuthModal();
                    }}
                    onPointerDown={(e) => {
                      if (e.button === 0 || e.pointerType === 'touch') {
                        if (document.activeElement instanceof HTMLElement) {
                          document.activeElement.blur();
                        }
                        onOpenAuthModal();
                      }
                    }}
                    onClick={() => {
                      if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                      }
                      onOpenAuthModal();
                    }}
                    className="rounded-xl bg-[#2563eb] text-white hover:bg-[#1d4ed8] px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    Увійти
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar — pill style with central '+' button */}
      <nav
        data-no-swipe="true"
        aria-label="Mobile Navigation"
        className={`md:hidden fixed bottom-4 inset-x-4 max-w-sm mx-auto z-40 rounded-full bg-white/95 dark:bg-[#1d2939]/95 border border-[#e2e8f0] dark:border-[#334155] shadow-lg px-2 py-1.5 flex items-center justify-around transition-all duration-300 ease-in-out backdrop-blur-xl ${isNavVisible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-28 opacity-0 pointer-events-none'
          }`}
        style={{
          marginBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* 1. Тренування */}
        <button
          type="button"
          onTouchStart={() => handleNavSelect('editor')}
          onPointerDown={(e) => { if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('editor'); }}
          onClick={() => handleNavSelect('editor')}
          className={`relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 min-w-[50px] ${currentTab === 'editor'
            ? 'bg-[#2563eb] text-white shadow-sm font-bold'
            : 'text-[#64748b] dark:text-[#94a3b8]'
            }`}
        >
          <Dumbbell className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[9px] font-semibold leading-none">Тренування</span>
          {hasActiveWorkout && currentTab !== 'editor' && (
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />
          )}
        </button>

        {/* 2. Аналітика */}
        <button
          type="button"
          onTouchStart={() => handleNavSelect('analytics')}
          onPointerDown={(e) => { if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('analytics'); }}
          onClick={() => handleNavSelect('analytics')}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 min-w-[50px] ${currentTab === 'analytics'
            ? 'bg-[#2563eb] text-white shadow-sm font-bold'
            : 'text-[#64748b] dark:text-[#94a3b8]'
            }`}
        >
          <BarChart2 className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[9px] font-semibold leading-none">Аналітика</span>
        </button>

        {/* Central '+' Create Workout Button (accent, circular, Ocean Blue, hidden when viewing/editing a workout) */}
        {!isEditingWorkout && (
          <button
            type="button"
            onClick={onCreateWorkout}
            className="w-11 h-11 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white flex items-center justify-center shadow-lg shadow-[#2563eb]/40 active:scale-95 transition-all cursor-pointer shrink-0 border border-white/25 dark:border-[#38bdf8]/30 mx-1"
            title="Створити нове тренування"
            aria-label="Створити нове тренування"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
        )}

        {/* 3. Вправи */}
        <button
          type="button"
          onTouchStart={() => handleNavSelect('catalog')}
          onPointerDown={(e) => { if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('catalog'); }}
          onClick={() => handleNavSelect('catalog')}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 min-w-[50px] ${currentTab === 'catalog'
            ? 'bg-[#2563eb] text-white shadow-sm font-bold'
            : 'text-[#64748b] dark:text-[#94a3b8]'
            }`}
        >
          <BookOpen className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[9px] font-semibold leading-none">Вправи</span>
        </button>

        {/* 4. Профіль */}
        <button
          type="button"
          onTouchStart={() => handleNavSelect('profile')}
          onPointerDown={(e) => { if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('profile'); }}
          onClick={() => handleNavSelect('profile')}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 min-w-[50px] ${currentTab === 'profile'
            ? 'bg-[#2563eb] text-white shadow-sm font-bold'
            : 'text-[#64748b] dark:text-[#94a3b8]'
            }`}
        >
          <UserIcon className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[9px] font-semibold leading-none">Профіль</span>
        </button>
      </nav>
    </>
  );
};
