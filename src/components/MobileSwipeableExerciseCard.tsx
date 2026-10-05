import React, { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';

interface MobileSwipeableExerciseCardProps {
  exerciseId?: string;
  onDelete: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const BUTTON_WIDTH = 88;
const SWIPE_THRESHOLD = 36;

export const MobileSwipeableExerciseCard: React.FC<MobileSwipeableExerciseCardProps> = ({
  onDelete,
  disabled = false,
  children,
}) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isOpenRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isMovingHorizontallyRef = useRef<boolean | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const hasMovedRef = useRef(false);
  const justSwipedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || isDeleting) return;
    if (e.button !== 0) return; // Only primary mouse button or touch

    // Do not initiate swipe on input fields, buttons, or select dropdowns
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, button, a, [data-interactive]')) {
      return;
    }

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    pointerIdRef.current = e.pointerId;
    isMovingHorizontallyRef.current = null;
    hasMovedRef.current = false;
    setIsDragging(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    if (isMovingHorizontallyRef.current === false) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Detect intention on first significant movement
    if (isMovingHorizontallyRef.current === null) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) {
        // Vertical movement detected -> allow native scroll
        isMovingHorizontallyRef.current = false;
        return;
      }
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
        // Horizontal movement detected -> take over gesture
        isMovingHorizontallyRef.current = true;
        setIsDragging(true);
        hasMovedRef.current = true;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
      }
    }

    if (isMovingHorizontallyRef.current === true) {
      e.stopPropagation();
      const base = isOpenRef.current ? -BUTTON_WIDTH : 0;
      const targetX = base + dx;
      // Clamp between -BUTTON_WIDTH - 25 and 0
      const clamped = Math.max(-BUTTON_WIDTH - 25, Math.min(0, targetX));
      setOffsetX(clamped);
    }
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (isMovingHorizontallyRef.current === true) {
      setIsDragging(false);
      isMovingHorizontallyRef.current = null;
      justSwipedRef.current = true;
      setTimeout(() => {
        justSwipedRef.current = false;
      }, 150);

      if (offsetX < -SWIPE_THRESHOLD) {
        // Snap open revealing delete button
        isOpenRef.current = true;
        setOffsetX(-BUTTON_WIDTH);
      } else {
        // Snap back to closed state
        isOpenRef.current = false;
        setOffsetX(0);
      }
    } else {
      setIsDragging(false);
      isMovingHorizontallyRef.current = null;
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (justSwipedRef.current || hasMovedRef.current || isOpenRef.current) {
      e.stopPropagation();
      e.preventDefault();
      if (isOpenRef.current) {
        isOpenRef.current = false;
        setOffsetX(0);
      }
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
        className="absolute inset-y-0 right-0 bg-rose-600 dark:bg-rose-600 flex items-center justify-end z-0"
        style={{
          width: `${Math.max(BUTTON_WIDTH, -offsetX)}px`,
          opacity: offsetX < -4 ? 1 : 0,
          transition: isDragging
            ? 'none'
            : 'width 0.25s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.15s ease',
        }}
      >
        <button
          type="button"
          onClick={handleDelete}
          className="w-[88px] h-full flex flex-col items-center justify-center gap-1.5 text-white font-bold text-xs hover:bg-rose-700 active:bg-rose-800 transition-colors cursor-pointer select-none"
          title="Видалити вправу"
          aria-label="Видалити вправу"
        >
          <Trash2
            className="h-5 w-5 transition-transform"
            style={{
              transform: `scale(${Math.min(1, Math.max(0.7, -offsetX / BUTTON_WIDTH))})`,
            }}
          />
          <span
            style={{
              opacity: Math.min(1, Math.max(0.6, -offsetX / BUTTON_WIDTH)),
            }}
          >
            Видалити
          </span>
        </button>
      </div>

      {/* Foreground Swipeable Card */}
      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging
            ? 'none'
            : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
          touchAction: 'pan-y',
          userSelect: isDragging ? 'none' : 'auto',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClickCapture={handleCardClick}
        className={`relative z-10 bg-white dark:bg-zinc-900 h-full border-r border-transparent ${
          offsetX < 0
            ? 'border-zinc-200 dark:border-zinc-800 shadow-[-3px_0_10px_rgba(0,0,0,0.06)] dark:shadow-[-3px_0_12px_rgba(0,0,0,0.4)]'
            : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
};
