import { useRef, useEffect, RefObject } from 'react';

export interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // Minimum horizontal distance in px (default: 30)
  edgeThreshold?: number; // Distance from screen edge for edge swipe (default: 55)
  maxVerticalOffset?: number; // Max vertical offset before vertical scroll cancel (default: 50)
  maxDuration?: number; // Maximum swipe duration in ms (default: 800)
  disabled?: boolean;
}

/**
 * useSwipeGesture Hook
 * Handles left/right swipe gestures and edge-swipe-back across all mobile browsers (including iOS Chrome & Safari).
 * - Swipe Left  (finger moves left, deltaX < 0)  -> Next tab / Вперед
 * - Swipe Right (finger moves right, deltaX > 0) -> Prev tab / Назад
 *
 * Uses capture-phase window listeners and touchmove preventDefault to prevent iOS Chrome/Safari
 * from swallowing gestures with touchcancel, while preserving native vertical scrolling.
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
    let didTriggerInThisGesture = false;
    let swallowClickUntil = 0;

    const triggerSwipe = (deltaX: number) => {
      if (didTriggerInThisGesture) return;
      didTriggerInThisGesture = true;
      swallowClickUntil = Date.now() + 450;

      if (deltaX < 0) {
        optionsRef.current.onSwipeLeft?.();
      } else {
        optionsRef.current.onSwipeRight?.();
      }
    };

    const shouldIgnoreTarget = (target: EventTarget | null, startClientX: number): boolean => {
      if (!target || !(target instanceof Element)) return false;

      // Do not initiate gestures on editable form inputs
      if (target.closest('input, textarea, select, [contenteditable="true"]')) {
        return true;
      }

      // Modals/dialogs manage their own interactions
      if (target.closest('[role="dialog"], [data-modal="true"], .modal-content')) {
        return true;
      }

      // Explicitly marked no-swipe containers or buttons (e.g. bottom navigation bar)
      if (target.closest('[data-no-swipe], .no-swipe')) {
        return true;
      }

      // Containers with active horizontal scroll (e.g. horizontal muscle group chips)
      const scrollParent = target.closest('.overflow-x-auto, .overflow-x-scroll');
      if (scrollParent && scrollParent.scrollWidth > scrollParent.clientWidth) {
        return true;
      }

      return false;
    };

    // --- Touch Handlers (Mobile iOS Chrome, Safari & Android) ---
    const handleTouchStart = (e: TouchEvent) => {
      if (optionsRef.current.disabled) return;
      if (e.touches.length !== 1) {
        isTracking = false;
        return;
      }

      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
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
      didTriggerInThisGesture = false;
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
      const maxVertical = optionsRef.current.maxVerticalOffset ?? 50;
      if (absY > maxVertical && absY > absX * 1.25) {
        isCancelled = true;
        return;
      }

      // Lock horizontal gesture: prevent iOS Chrome/Safari from taking over with native navigation
      if (absX > absY && absX > 6) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isTracking || isCancelled) {
        isTracking = false;
        return;
      }
      isTracking = false;

      const duration = Date.now() - startTime;
      const maxDuration = optionsRef.current.maxDuration ?? 800;
      if (duration > maxDuration) return;

      const touch = e.changedTouches?.[0];
      if (touch) {
        currentX = touch.clientX;
        currentY = touch.clientY;
      }

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      const edgeThreshold = optionsRef.current.edgeThreshold ?? 55;
      const isEdge = startX <= edgeThreshold;
      const isFlick = duration < 350 && absX >= 20 && absX > absY;
      const threshold = isEdge ? 25 : (optionsRef.current.threshold ?? 30);

      if ((absX >= threshold || isFlick) && absX > absY) {
        triggerSwipe(deltaX);
      }
    };

    const handleTouchCancel = (e: TouchEvent) => {
      if (isTracking && !isCancelled) {
        const duration = Date.now() - startTime;
        const maxDuration = optionsRef.current.maxDuration ?? 800;
        const touch = e.changedTouches?.[0];
        if (touch) {
          currentX = touch.clientX;
          currentY = touch.clientY;
        }

        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const isFlick = duration < 400 && absX >= 20 && absX > absY;
        const threshold = 22; // Forgiving recovery threshold on cancel

        if (duration <= maxDuration && (absX >= threshold || isFlick) && absX > absY) {
          triggerSwipe(deltaX);
        }
      }
      isTracking = false;
      isCancelled = true;
    };

    // --- Pointer Handlers (Desktop Mouse Drag) ---
    const handlePointerDown = (e: PointerEvent) => {
      if (optionsRef.current.disabled) return;
      if (e.pointerType !== 'mouse' || e.button !== 0) return;

      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
        isTracking = false;
        return;
      }

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
      didTriggerInThisGesture = false;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isTracking || isCancelled || e.pointerType !== 'mouse') return;

      currentX = e.clientX;
      currentY = e.clientY;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      const maxVertical = optionsRef.current.maxVerticalOffset ?? 50;
      if (absY > maxVertical && absY > absX * 1.25) {
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
      const maxDuration = optionsRef.current.maxDuration ?? 800;
      if (duration > maxDuration) return;

      currentX = e.clientX;
      currentY = e.clientY;

      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      const edgeThreshold = optionsRef.current.edgeThreshold ?? 55;
      const isEdge = startX <= edgeThreshold;
      const isFlick = duration < 350 && absX >= 25 && absX > absY;
      const threshold = isEdge ? 30 : (optionsRef.current.threshold ?? 40);

      if ((absX >= threshold || isFlick) && absX > absY) {
        triggerSwipe(deltaX);
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

    // Attach listeners with capture: true on window
    window.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
    window.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
    window.addEventListener('touchend', handleTouchEnd, { capture: true, passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { capture: true, passive: true });

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointermove', handlePointerMove, { capture: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });

    window.addEventListener('click', handleWindowClickCapture, true);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart, { capture: true });
      window.removeEventListener('touchmove', handleTouchMove, { capture: true });
      window.removeEventListener('touchend', handleTouchEnd, { capture: true });
      window.removeEventListener('touchcancel', handleTouchCancel, { capture: true });

      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });

      window.removeEventListener('click', handleWindowClickCapture, true);
    };
  }, []);

  return ref;
}
