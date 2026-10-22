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
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuthModal,
  hasActiveWorkout = false,
}) => {
  const { user, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const isDark = theme === 'dark';

  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const lastNavSelectTime = useRef(0);

  // Handle mobile navbar auto-hide on scroll
  useEffect(() => {
    let ticking = false;
    let suppressHideUntil = 0;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
          const diff = currentScrollY - lastScrollY.current;

          // Always visible at the very top of page
          if (currentScrollY <= 25) {
            setIsNavVisible(true);
          } else if (diff > 8) {
            // Scrolling down the page (swiping up) -> hide navbar
            if (Date.now() >= suppressHideUntil) {
              setIsNavVisible(false);
            }
          } else if (diff < -8) {
            // Scrolling up the page (swiping down) -> immediately show navbar
            setIsNavVisible(true);
          }

          lastScrollY.current = Math.max(0, currentScrollY);
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleShowNavbar = () => {
      setIsNavVisible(true);
      suppressHideUntil = Date.now() + 800;
    };

    const handleFocusChange = () => {
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

  return (
    <>
      {/* Top Header - Liquid Glass with Mobile Auto-Hide */}
      <header
        data-no-swipe="true"
        className={`sticky top-0 z-40 w-full border-b border-[#e2e8f0]/80 dark:border-[#334155]/80 bg-[#f8fafc]/85 dark:bg-[#0b1220]/85 backdrop-blur-xl transition-all duration-300 ease-in-out ${isNavVisible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none md:translate-y-0 md:opacity-100 md:pointer-events-auto'
          }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2">
            {/* Pure Flat Text Logo */}
            <div
              className="flex items-center cursor-pointer select-none py-1 shrink-0"
              onTouchStart={() => handleNavSelect('editor')}
              onPointerDown={(e) => {
                if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('editor');
              }}
              onClick={() => handleNavSelect('editor')}
            >
              <span className="text-base sm:text-lg font-bold tracking-tight text-[#0f172a] dark:text-[#f8fafc] hover:text-[#2563eb] dark:hover:text-[#60a5fa] transition-colors">
                Your workout diary
              </span>
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
                className={`relative flex items-center space-x-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${currentTab === 'editor'
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
                className={`flex items-center space-x-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${currentTab === 'history'
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
                className={`flex items-center space-x-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${currentTab === 'analytics'
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
                className={`flex items-center space-x-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${currentTab === 'catalog'
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
                  className={`flex items-center space-x-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${currentTab === 'trainees'
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
              {/* Language Switcher */}
              <div className="flex items-center rounded-full border border-[#e2e8f0] dark:border-[#334155] bg-[#f1f5f9] dark:bg-[#1d2939] p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => setLanguage('uk')}
                  className={`h-7 px-2 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${language === 'uk'
                    ? 'bg-[#2563eb] text-white'
                    : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                    }`}
                  title="Українська"
                >
                  УКР
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`h-7 px-2 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${language === 'en'
                    ? 'bg-[#2563eb] text-white'
                    : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                    }`}
                  title="English"
                >
                  ENG
                </button>
              </div>

              {/* Theme Toggle Button — round */}
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
                className="h-9 w-9 rounded-full border border-[#e2e8f0] dark:border-[#334155] bg-[#f1f5f9] dark:bg-[#1d2939] flex items-center justify-center text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#60a5fa] hover:bg-[#e2e8f0] dark:hover:bg-[#263140] transition-colors cursor-pointer"
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
                    className={`relative flex items-center justify-center rounded-full p-0.5 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 active:scale-95 ${currentTab === 'profile'
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

      {/* Mobile Bottom Navigation Bar — pill style */}
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
        {/* Тренування */}
        <button
          type="button"
          onTouchStart={() => handleNavSelect('editor')}
          onPointerDown={(e) => { if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('editor'); }}
          onClick={() => handleNavSelect('editor')}
          className={`relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 min-w-[52px] ${currentTab === 'editor'
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

        {/* Календар */}
        <button
          type="button"
          onTouchStart={() => handleNavSelect('history')}
          onPointerDown={(e) => { if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('history'); }}
          onClick={() => handleNavSelect('history')}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 min-w-[52px] ${currentTab === 'history'
            ? 'bg-[#2563eb] text-white shadow-sm font-bold'
            : 'text-[#64748b] dark:text-[#94a3b8]'
            }`}
        >
          <Calendar className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[9px] font-semibold leading-none">Календар</span>
        </button>

        {/* Аналітика */}
        <button
          type="button"
          onTouchStart={() => handleNavSelect('analytics')}
          onPointerDown={(e) => { if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('analytics'); }}
          onClick={() => handleNavSelect('analytics')}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 min-w-[52px] ${currentTab === 'analytics'
            ? 'bg-[#2563eb] text-white shadow-sm font-bold'
            : 'text-[#64748b] dark:text-[#94a3b8]'
            }`}
        >
          <BarChart2 className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[9px] font-semibold leading-none">Аналітика</span>
        </button>

        {/* Вправи */}
        <button
          type="button"
          onTouchStart={() => handleNavSelect('catalog')}
          onPointerDown={(e) => { if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('catalog'); }}
          onClick={() => handleNavSelect('catalog')}
          className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 min-w-[52px] ${currentTab === 'catalog'
            ? 'bg-[#2563eb] text-white shadow-sm font-bold'
            : 'text-[#64748b] dark:text-[#94a3b8]'
            }`}
        >
          <BookOpen className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[9px] font-semibold leading-none">Вправи</span>
        </button>

        {/* Підопічні (тільки для тренерів/адмінів) */}
        {(user?.role === 'coach' || isAdmin) && (
          <button
            type="button"
            onTouchStart={() => handleNavSelect('trainees')}
            onPointerDown={(e) => { if (e.button === 0 || e.pointerType === 'touch') handleNavSelect('trainees'); }}
            onClick={() => handleNavSelect('trainees')}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 min-w-[52px] ${currentTab === 'trainees'
              ? 'bg-[#2563eb] text-white shadow-sm font-bold'
              : 'text-[#64748b] dark:text-[#94a3b8]'
              }`}
          >
            <Users className="h-[18px] w-[18px] shrink-0" />
            <span className="text-[9px] font-semibold leading-none">Підопічні</span>
          </button>
        )}
      </nav >
    </>
  );
};
