import React, { useState, useEffect, useRef } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';

const PULL_THRESHOLD = 65; // Distance in px to trigger refresh
const MAX_PULL = 90; // Maximum distance indicator can travel

export const PullToRefresh: React.FC = () => {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isPullingRef = useRef(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const canPullRef = useRef(false);

  useEffect(() => {
    // Only run on touch-capable devices / mobile browsers
    if (typeof window === 'undefined' || !('ontouchstart' in window)) {
      return;
    }

    const isAtPageTop = () => {
      return window.scrollY <= 0 && document.documentElement.scrollTop <= 0;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return;
      if (e.touches.length !== 1) return;

      // Ignore touches starting in inputs, textareas, selects, or no-swipe areas
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [data-no-swipe], .no-swipe')) {
        canPullRef.current = false;
        return;
      }

      // Check if any scrollable parent is not at top
      let parent = target?.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        if (parent.scrollTop > 0 && (parent.classList.contains('overflow-y-auto') || parent.classList.contains('overflow-y-scroll'))) {
          canPullRef.current = false;
          return;
        }
        parent = parent.parentElement;
      }

      if (isAtPageTop()) {
        canPullRef.current = true;
        startYRef.current = e.touches[0].clientY;
        startXRef.current = e.touches[0].clientX;
        isPullingRef.current = false;
      } else {
        canPullRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!canPullRef.current || isRefreshing) return;
      if (e.touches.length !== 1) return;

      // Re-verify that page hasn't scrolled down
      if (!isAtPageTop()) {
        canPullRef.current = false;
        setPullY(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - startYRef.current;
      const deltaX = currentX - startXRef.current;

      // If finger is moving upwards (user wants to scroll down), let normal scroll take over
      if (deltaY <= 0) {
        canPullRef.current = false;
        setPullY(0);
        return;
      }

      // If predominantly horizontal, ignore (let horizontal gestures happen)
      if (Math.abs(deltaX) > deltaY) {
        canPullRef.current = false;
        setPullY(0);
        return;
      }

      // Active pull down at the top of the page
      if (deltaY > 5) {
        isPullingRef.current = true;
        // Prevent default overscroll bounce only when actively engaging custom pull-to-refresh
        if (e.cancelable) {
          e.preventDefault();
        }

        // Apply damping curve
        const dampedY = Math.min(MAX_PULL, deltaY * 0.45);
        setPullY(dampedY);
      }
    };

    const handleTouchEnd = () => {
      if (!isPullingRef.current) {
        canPullRef.current = false;
        setPullY(0);
        return;
      }

      isPullingRef.current = false;
      canPullRef.current = false;

      if (pullY >= PULL_THRESHOLD && !isRefreshing) {
        // Trigger page refresh
        setIsRefreshing(true);
        setPullY(52); // Keep indicator visible during refresh

        // Haptic feedback if supported
        try {
          if (navigator.vibrate) {
            navigator.vibrate(15);
          }
        } catch {
          // Ignore
        }

        // Reload the full page as requested: "Оновлюй повністю сторінку"
        setTimeout(() => {
          window.location.reload();
        }, 350);
      } else {
        // Snap back to top
        setPullY(0);
      }
    };

    const handleTouchCancel = () => {
      isPullingRef.current = false;
      canPullRef.current = false;
      if (!isRefreshing) {
        setPullY(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [pullY, isRefreshing]);

  if (pullY <= 0 && !isRefreshing) {
    return null;
  }

  const isReady = pullY >= PULL_THRESHOLD;
  const progress = Math.min(1, pullY / PULL_THRESHOLD);
  const rotation = progress * 180;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 flex justify-center pointer-events-none transition-transform duration-200 ease-out"
      style={{
        transform: `translateY(${pullY}px)`,
        transition: isPullingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
      }}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-md backdrop-blur-md transition-all duration-200 ${
          isReady || isRefreshing
            ? 'border-indigo-400/50 bg-indigo-50/95 dark:bg-indigo-950/90 text-indigo-600 dark:text-indigo-400'
            : 'border-zinc-200/80 dark:border-zinc-700/80 bg-white/95 dark:bg-zinc-900/95 text-zinc-600 dark:text-zinc-300'
        }`}
        style={{
          transform: `scale(${0.75 + progress * 0.25})`,
          opacity: Math.max(0.2, progress),
        }}
      >
        {isRefreshing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ArrowDown
            className="h-5 w-5 transition-transform duration-100"
            style={{
              transform: `rotate(${rotation}deg)`,
            }}
          />
        )}
      </div>
    </div>
  );
};
