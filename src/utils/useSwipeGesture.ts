import { useRef, useEffect, useState, useCallback, useMemo, RefObject } from 'react';

export interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // Minimum horizontal distance in px (default: 30)
  maxVerticalOffset?: number; // Max vertical offset before vertical scroll cancel (default: 55)
  maxDuration?: number; // Maximum swipe duration in ms (default: 800)
  edgeThreshold?: number; // Distance from screen edge for edge swipes (default: 50)
  disabled?: boolean;
}

export type SwipeRef<T extends HTMLElement> = RefObject<T | null> & ((instance: T | null) => void);

/**
 * useSwipeGesture Hook
 * Handles left/right swipe gestures scoped strictly to the referenced DOM element.
 * - Swipe Left  (finger moves left, deltaX < 0)  -> Next tab / Вперед
 * - Swipe Right (finger moves right, deltaX > 0) -> Prev tab / Назад
 *
 * Attaches touch listeners directly to `node` with { passive: false } on touchmove
 * to prevent mobile browser gesture cancellation (touchcancel) during horizontal swipes.
 * Never touches window or captures clicks outside the container.
 */
export function useSwipeGesture<T extends HTMLElement = HTMLDivElement>(
  options: SwipeOptions
): SwipeRef<T> {
  const [node, setNode] = useState<T | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const callbackRef = useCallback((el: T | null) => {
    setNode(el);
  }, []);

  const ref = useMemo(() => {
    const fn = (el: T | null) => callbackRef(el);
    Object.defineProperty(fn, 'current', {
      get: () => node,
      set: (el: T | null) => callbackRef(el),
      configurable: true,
      enumerable: true,
    });
    return fn as unknown as SwipeRef<T>;
  }, [callbackRef, node]);

  useEffect(() => {
    if (!node) return;

    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let startTime = 0;
    let isTracking = false;
    let isCancelled = false;
    let didTriggerInThisGesture = false;

    const shouldIgnoreTarget = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Element)) return false;

      // Do not initiate gestures on editable form inputs
      if (target.closest('input, textarea, select, [contenteditable="true"]')) {
        return true;
      }

      // Explicitly marked no-swipe containers or buttons
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

    const triggerSwipe = (deltaX: number) => {
      if (didTriggerInThisGesture) return;
      didTriggerInThisGesture = true;
      isTracking = false;

      if (deltaX < 0) {
        optionsRef.current.onSwipeLeft?.();
      } else {
        optionsRef.current.onSwipeRight?.();
      }
    };

    // --- Touch Handlers ---
    const handleTouchStart = (e: TouchEvent) => {
      if (optionsRef.current.disabled) return;
      if (e.touches.length !== 1) {
        isTracking = false;
        return;
      }

      if (shouldIgnoreTarget(e.target)) {
        isTracking = false;
        return;
      }

      const touch = e.touches[0];
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
      const maxVertical = optionsRef.current.maxVerticalOffset ?? 55;
      if (absY > maxVertical && absY > absX * 1.2) {
        isCancelled = true;
        return;
      }

      // Lock horizontal gesture: prevent iOS Chrome/Safari and Android from taking over with native navigation
      if (absX > absY && absX > 7) {
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

      const isFlick = duration < 350 && absX >= 20 && absX > absY;
      const threshold = optionsRef.current.threshold ?? 30;

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
        const isFlick = duration < 400 && absX >= 18 && absX > absY;
        const threshold = 22; // Forgiving recovery threshold on cancel

        if (duration <= maxDuration && (absX >= threshold || isFlick) && absX > absY) {
          triggerSwipe(deltaX);
        }
      }
      isTracking = false;
      isCancelled = true;
    };

    // --- Desktop Mouse Drag Handler ---
    const handleMouseDown = (e: MouseEvent) => {
      if (optionsRef.current.disabled) return;
      if (e.button !== 0) return;
      if (shouldIgnoreTarget(e.target)) return;

      startX = e.clientX;
      startY = e.clientY;
      currentX = startX;
      currentY = startY;
      startTime = Date.now();
      isTracking = true;
      isCancelled = false;
      didTriggerInThisGesture = false;

      const handleMouseMove = (moveEv: MouseEvent) => {
        if (!isTracking || isCancelled) return;
        currentX = moveEv.clientX;
        currentY = moveEv.clientY;

        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        const maxVertical = optionsRef.current.maxVerticalOffset ?? 55;
        if (absY > maxVertical && absY > absX * 1.2) {
          isCancelled = true;
        }
      };

      const handleMouseUp = (upEv: MouseEvent) => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        if (!isTracking || isCancelled) {
          isTracking = false;
          return;
        }
        isTracking = false;

        const duration = Date.now() - startTime;
        if (duration > (optionsRef.current.maxDuration ?? 800)) return;

        currentX = upEv.clientX;
        currentY = upEv.clientY;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        const isFlick = duration < 350 && absX >= 25 && absX > absY;
        const threshold = optionsRef.current.threshold ?? 35;

        if ((absX >= threshold || isFlick) && absX > absY) {
          triggerSwipe(deltaX);
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchmove', handleTouchMove, { passive: false });
    node.addEventListener('touchend', handleTouchEnd, { passive: true });
    node.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    node.addEventListener('mousedown', handleMouseDown);

    return () => {
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchmove', handleTouchMove);
      node.removeEventListener('touchend', handleTouchEnd);
      node.removeEventListener('touchcancel', handleTouchCancel);
      node.removeEventListener('mousedown', handleMouseDown);
    };
  }, [node]);

  return ref;
}
