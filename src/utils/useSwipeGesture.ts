import { useRef, useEffect, RefObject } from 'react';

export interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // Minimum horizontal distance in px (default: 60)
  maxVerticalOffset?: number; // Maximum allowed vertical movement before gesture is considered vertical scroll (default: 45)
  maxDuration?: number; // Maximum swipe duration in ms (default: 500)
  disabled?: boolean;
}

/**
 * useSwipeGesture Hook
 * Handles left/right swipe gestures without interfering with native vertical scrolling.
 * - Swipe Left  (finger moves left)  -> Next / Вперед
 * - Swipe Right (finger moves right) -> Prev / Назад
 *
 * Guaranteed not to block vertical scrolling (passive listeners, early cancellation on vertical movement).
 * Automatically ignores touches originating on interactive controls (inputs, buttons, horizontal scrollers).
 */
export function useSwipeGesture<T extends HTMLElement = HTMLDivElement>(
  options: SwipeOptions
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isTracking = false;
    let isCancelled = false;

    const shouldIgnoreTarget = (target: EventTarget | null, isEdge: boolean): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      // Never hijack active text inputs
      if (target.closest('input, textarea, select')) return true;
      // Modals/dialogs manage their own interactions
      if (target.closest('[role="dialog"]')) return true;
      // Explicitly marked no-swipe or horizontal scroll
      if (target.closest('[data-no-swipe], .no-swipe, .overflow-x-auto')) return true;

      // If it's an edge swipe (touch started within 45px of screen edge), allow it
      if (isEdge) return false;

      // Ignore touches starting directly on buttons or links
      if (target.closest('button, a, [role="button"]')) return true;

      return false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (optionsRef.current.disabled) return;
      if (e.touches.length !== 1) {
        isTracking = false;
        return;
      }

      const touch = e.touches[0];
      const isEdge = touch.clientX <= 45;

      if (shouldIgnoreTarget(e.target, isEdge)) {
        isTracking = false;
        return;
      }

      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      isTracking = true;
      isCancelled = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTracking || isCancelled) return;
      if (e.touches.length !== 1) {
        isCancelled = true;
        return;
      }

      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const maxVertical = optionsRef.current.maxVerticalOffset ?? 45;

      // If user moved vertically more than maxVertical AND vertical movement dominates,
      // this is unmistakably a normal page scroll. Cancel gesture immediately.
      if (Math.abs(deltaY) > maxVertical && Math.abs(deltaY) > Math.abs(deltaX)) {
        isCancelled = true;
        return;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isTracking || isCancelled) {
        isTracking = false;
        return;
      }
      isTracking = false;

      const duration = Date.now() - startTime;
      const maxDuration = optionsRef.current.maxDuration ?? 500;
      if (duration > maxDuration) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const threshold = optionsRef.current.threshold ?? 60;

      // Require threshold and horizontal angle dominance (deltaX > 1.5 * deltaY)
      if (Math.abs(deltaX) >= threshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) {
          // Swipe Left -> Next / Вперед
          optionsRef.current.onSwipeLeft?.();
        } else {
          // Swipe Right -> Prev / Назад
          optionsRef.current.onSwipeRight?.();
        }
      }
    };

    const handleTouchCancel = () => {
      isTracking = false;
      isCancelled = true;
    };

    // Use passive: true so browser vertical scrolling is 100% unblocked and smooth
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, []);

  return ref;
}
