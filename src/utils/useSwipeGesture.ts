import { useRef, useEffect, RefObject } from 'react';

export interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // Minimum horizontal distance in px (default: 45)
  edgeThreshold?: number; // Distance from left edge to qualify as edge swipe (default: 50)
  maxVerticalOffset?: number; // Vertical offset threshold for vertical scroll cancellation (default: 55)
  maxDuration?: number; // Maximum swipe duration in ms (default: 650)
  disabled?: boolean;
}

/**
 * useSwipeGesture Hook
 * Handles left/right swipe gestures and edge-swipe-back without interfering with native vertical scrolling.
 * - Swipe Left  (finger moves left, deltaX < 0)  -> Next tab / Вперед
 * - Swipe Right (finger moves right, deltaX > 0) -> Prev tab / Назад
 *
 * Attaches to window so navigation gestures work across the full viewport and through conditional renders.
 * Guarantees native vertical scrolling is never blocked (passive touch listeners, early vertical cancel).
 * Suppresses accidental click events following a completed swipe.
 */
export function useSwipeGesture<T extends HTMLElement = HTMLDivElement>(
  options: SwipeOptions
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let startTime = 0;
    let isTracking = false;
    let isCancelled = false;
    let swallowClickUntil = 0;

    const shouldIgnoreTarget = (target: EventTarget | null, startClientX: number): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;

      const edgeThreshold = optionsRef.current.edgeThreshold ?? 50;
      const isEdge = startClientX <= edgeThreshold;

      // Edge swipes (swiping from the left edge to go back) take precedence
      if (isEdge) return false;

      // Do not initiate gestures on editable form inputs
      if (target.closest('input, textarea, select, [contenteditable="true"]')) {
        return true;
      }

      // Modals/dialogs manage their own interactions; also pause if a dialog is open
      if (target.closest('[role="dialog"], [data-modal="true"], .modal-content')) {
        return true;
      }
      if (document.querySelector('[role="dialog"]')) {
        return true;
      }

      // Explicitly marked no-swipe containers or buttons (e.g. bottom navigation tabs)
      if (target.closest('[data-no-swipe], .no-swipe')) {
        return true;
      }

      // Containers with active horizontal scroll (e.g. horizontal chips list)
      const scrollParent = target.closest('.overflow-x-auto, .overflow-x-scroll');
      if (scrollParent && scrollParent.scrollWidth > scrollParent.clientWidth) {
        return true;
      }

      return false;
    };

    // --- Touch Handlers (Mobile iOS / Android) ---
    const handleTouchStart = (e: TouchEvent) => {
      if (optionsRef.current.disabled) return;
      if (e.touches.length !== 1) {
        isTracking = false;
        return;
      }

      const touch = e.touches[0];
      if (shouldIgnoreTarget(e.target, touch.clientX)) {
        isTracking = false;
        return;
      }

      startX = touch.clientX;
      startY = touch.clientY;
      currentX = startX;
      currentY = startY;
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
      currentX = touch.clientX;
      currentY = touch.clientY;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // If user is predominantly scrolling vertically, cancel horizontal gesture
      const maxVertical = optionsRef.current.maxVerticalOffset ?? 55;
      if (absY > maxVertical && absY > absX * 1.3) {
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
      const maxDuration = optionsRef.current.maxDuration ?? 650;
      if (duration > maxDuration) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      currentX = touch.clientX;
      currentY = touch.clientY;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      const edgeThreshold = optionsRef.current.edgeThreshold ?? 50;
      const isEdge = startX <= edgeThreshold;
      const threshold = isEdge ? 35 : (optionsRef.current.threshold ?? 45);

      // Require threshold distance and horizontal angle dominance
      if (absX >= threshold && absX > absY * 1.15) {
        // Suppress any accidental click that fires on touch release
        swallowClickUntil = Date.now() + 400;

        if (deltaX < 0) {
          // Swipe Left -> Next tab / Вперед
          optionsRef.current.onSwipeLeft?.();
        } else {
          // Swipe Right -> Prev tab / Назад
          optionsRef.current.onSwipeRight?.();
        }
      }
    };

    const handleTouchCancel = () => {
      isTracking = false;
      isCancelled = true;
    };

    // --- Pointer Handlers (Desktop Mouse Drag / DevTools) ---
    const handlePointerDown = (e: PointerEvent) => {
      if (optionsRef.current.disabled) return;
      // Only handle mouse clicks (touch is handled natively by touch events)
      if (e.pointerType !== 'mouse' || e.button !== 0) return;

      if (shouldIgnoreTarget(e.target, e.clientX)) {
        isTracking = false;
        return;
      }

      startX = e.clientX;
      startY = e.clientY;
      currentX = startX;
      currentY = startY;
      startTime = Date.now();
      isTracking = true;
      isCancelled = false;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isTracking || isCancelled || e.pointerType !== 'mouse') return;

      currentX = e.clientX;
      currentY = e.clientY;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      const maxVertical = optionsRef.current.maxVerticalOffset ?? 55;
      if (absY > maxVertical && absY > absX * 1.3) {
        isCancelled = true;
        return;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isTracking || isCancelled || e.pointerType !== 'mouse') {
        isTracking = false;
        return;
      }
      isTracking = false;

      const duration = Date.now() - startTime;
      const maxDuration = optionsRef.current.maxDuration ?? 650;
      if (duration > maxDuration) return;

      currentX = e.clientX;
      currentY = e.clientY;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      const edgeThreshold = optionsRef.current.edgeThreshold ?? 50;
      const isEdge = startX <= edgeThreshold;
      const threshold = isEdge ? 40 : (optionsRef.current.threshold ?? 55);

      if (absX >= threshold && absX > absY * 1.15) {
        swallowClickUntil = Date.now() + 400;

        if (deltaX < 0) {
          optionsRef.current.onSwipeLeft?.();
        } else {
          optionsRef.current.onSwipeRight?.();
        }
      }
    };

    // --- Click Interceptor during Capturing Phase ---
    const handleWindowClickCapture = (e: MouseEvent) => {
      if (Date.now() < swallowClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    };

    // Bind passive touch listeners to window
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    // Bind pointer listeners for desktop mouse drag support
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    // Capture-phase click listener to suppress accidental clicks after swipe
    window.addEventListener('click', handleWindowClickCapture, true);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);

      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      window.removeEventListener('click', handleWindowClickCapture, true);
    };
  }, []);

  return ref;
}
