/**
 * useSwipeBack
 * Detects a right-swipe gesture starting from the left edge (first 40px)
 * and calls the provided callback. Used on fullscreen pages (Chat, Calculator)
 * to navigate back without a button on mobile.
 */
import { useEffect, useRef } from 'react';

export function useSwipeBack(onSwipeBack: () => void, enabled = true) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      // Only trigger if touch starts within 40px of the left edge
      if (touch.clientX <= 40) {
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
      } else {
        touchStartX.current = null;
        touchStartY.current = null;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - (touchStartY.current ?? 0));

      // Swipe right: deltaX > 60px, mostly horizontal (not a scroll)
      if (deltaX > 60 && deltaY < 80) {
        onSwipeBack();
      }

      touchStartX.current = null;
      touchStartY.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeBack, enabled]);
}
