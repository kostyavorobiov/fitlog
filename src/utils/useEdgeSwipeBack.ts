import { useEffect, useRef } from 'react';

interface UseEdgeSwipeBackOptions {
  onBack?: () => void;
  disabled?: boolean;
  edgeThreshold?: number; // Distance in px from left edge to start swipe (default: 40)
  minDistance?: number;   // Minimum horizontal distance in px (default: 45)
  maxDuration?: number;   // Maximum swipe duration in ms (default: 650)
}

/**
 * useEdgeSwipeBack Hook
 * Listens on window for a touch starting at the very left edge of the screen (<= edgeThreshold)
 * and swiping rightwards (dx >= minDistance), simulating native iOS / Android back navigation.
 */
export function useEdgeSwipeBack({
  onBack,
  disabled = false,
  edgeThreshold = 40,
  minDistance = 45,
  maxDuration = 650,
}: UseEdgeSwipeBackOptions) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isTracking = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (disabledRef.current || !onBackRef.current) return;
      if (e.touches.length !== 1) {
        isTracking = false;
        return;
      }

      // Do not trigger if touching active editable form fields
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) {
        isTracking = false;
        return;
      }

      const touch = e.touches[0];
      // Only initiate if touch starts close to the left screen edge
      if (touch.clientX <= edgeThreshold) {
        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        isTracking = true;
      } else {
        isTracking = false;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isTracking || disabledRef.current || !onBackRef.current) {
        isTracking = false;
        return;
      }
      isTracking = false;

      const touch = e.changedTouches?.[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dt = Date.now() - startTime;

      // Must be a predominantly rightward swipe from the edge within max duration
      if (
        dx >= minDistance &&
        Math.abs(dx) > Math.abs(dy) * 1.3 &&
        dt <= maxDuration
      ) {
        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
          try {
            window.navigator.vibrate(10);
          } catch {}
        }
        onBackRef.current();
      }
    };

    const handleTouchCancel = () => {
      isTracking = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [edgeThreshold, minDistance, maxDuration]);
}
