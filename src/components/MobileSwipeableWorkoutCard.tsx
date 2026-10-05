import React, { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';

interface MobileSwipeableWorkoutCardProps {
  workoutId: string;
  onDelete: () => void;
  children: React.ReactNode;
}

const BUTTON_WIDTH = 88;
const SWIPE_THRESHOLD = 40;

export const MobileSwipeableWorkoutCard: React.FC<MobileSwipeableWorkoutCardProps> = ({
  onDelete,
  children,
}) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isOpenRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, button, [data-no-swipe], .no-swipe')) {
      isHorizontalRef.current = false;
      return;
    }

    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isHorizontalRef.current === false) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - startXRef.current;
    const dy = currentY - startYRef.current;

    // Detect horizontal intention on first significant movement
    if (isHorizontalRef.current === null) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) {
        isHorizontalRef.current = false;
        return;
      }
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 7) {
        isHorizontalRef.current = true;
        setIsDragging(true);
      }
    }

    if (isHorizontalRef.current === true) {
      e.stopPropagation();
      const base = isOpenRef.current ? -BUTTON_WIDTH : 0;
      const targetX = base + dx;
      const clamped = Math.max(-BUTTON_WIDTH - 20, Math.min(0, targetX));
      setOffsetX(clamped);
    }
  };

  const handleTouchEnd = () => {
    if (isHorizontalRef.current !== true) {
      return;
    }

    setIsDragging(false);
    isHorizontalRef.current = null;

    if (offsetX < -SWIPE_THRESHOLD) {
      isOpenRef.current = true;
      setOffsetX(-BUTTON_WIDTH);
    } else {
      isOpenRef.current = false;
      setOffsetX(0);
    }
  };

  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => {
      onDelete();
      setIsDeleting(false);
      isOpenRef.current = false;
      setOffsetX(0);
    }, 220);
  };

  const handleCardClick = () => {
    if (isOpenRef.current) {
      isOpenRef.current = false;
      setOffsetX(0);
    }
  };

  return (
    <div
      data-no-swipe="true"
      className={`no-swipe relative overflow-hidden rounded-xl transition-all duration-200 ${
        isDeleting
          ? 'max-h-0 opacity-0 -translate-x-full my-0 py-0 overflow-hidden'
          : 'max-h-[3000px]'
      }`}
    >
      {/* Background Delete Action Button */}
      <div
        className="absolute inset-y-0 right-0 w-[88px] bg-rose-600 dark:bg-rose-600 flex items-center justify-center z-0 rounded-r-xl"
        style={{
          opacity: offsetX < -8 ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-white font-bold text-xs active:bg-rose-700 transition-colors cursor-pointer select-none"
          title="Видалити тренування"
          aria-label="Видалити тренування"
        >
          <Trash2 className="h-5 w-5" />
          <span>Видалити</span>
        </button>
      </div>

      {/* Foreground Swipeable Card */}
      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging
            ? 'none'
            : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
        className="relative z-10 bg-white dark:bg-zinc-900 rounded-xl"
      >
        {children}
      </div>
    </div>
  );
};
