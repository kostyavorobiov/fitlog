import React, { useState, useRef } from 'react';
import { Trash2, ArrowLeftRight } from 'lucide-react';

interface MobileSwipeableExerciseCardProps {
  exerciseId?: string;
  onDelete: () => void;
  onChangeExercise?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const ACTION_BTN_WIDTH = 76;
const TOTAL_SWIPE_WIDTH = ACTION_BTN_WIDTH * 2;
const SWIPE_THRESHOLD = 36;

export const MobileSwipeableExerciseCard: React.FC<MobileSwipeableExerciseCardProps> = ({
  onDelete,
  onChangeExercise,
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
      const base = isOpenRef.current ? -TOTAL_SWIPE_WIDTH : 0;
      const targetX = base + dx;
      const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 380;
      // Clamp between -screenWidth and 0
      const clamped = Math.max(-screenWidth, Math.min(0, targetX));
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

      const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 380;
      const pastHalfScreen = -offsetX > screenWidth * 0.5;

      if (pastHalfScreen) {
        // Fast swipe > 50%: trigger standard delete confirmation
        isOpenRef.current = false;
        setOffsetX(0);
        onDelete();
      } else if (offsetX < -SWIPE_THRESHOLD) {
        // Snap open revealing actions
        isOpenRef.current = true;
        setOffsetX(-TOTAL_SWIPE_WIDTH);
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
    e.preventDefault();
    isOpenRef.current = false;
    setOffsetX(0);
    onDelete();
  };

  const handleChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isOpenRef.current = false;
    setOffsetX(0);
    onChangeExercise?.();
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

  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 380;
  const halfScreen = screenWidth * 0.5;
  const isPastHalf = -offsetX > halfScreen;
  const stretchProgress = Math.max(0, Math.min(1, (-offsetX - TOTAL_SWIPE_WIDTH) / Math.max(1, halfScreen - TOTAL_SWIPE_WIDTH)));
  const changeBtnOpacity = isPastHalf ? 0 : Math.max(0, 1 - stretchProgress);

  return (
    <div
      data-no-swipe="true"
      className={`no-swipe relative overflow-hidden rounded-2xl transition-all duration-200 ${
        isDeleting
          ? 'max-h-0 opacity-0 -translate-x-full my-0 py-0 overflow-hidden'
          : 'max-h-[3000px]'
      }`}
    >
      {/* Background Actions: Change Exercise (Blue Pill) & Delete Exercise (Red Pill) */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end z-0 px-2 gap-2 overflow-hidden bg-rose-600/90 dark:bg-rose-700/90"
        style={{
          width: `${Math.max(TOTAL_SWIPE_WIDTH, -offsetX)}px`,
          opacity: offsetX < -4 ? 1 : 0,
          pointerEvents: offsetX < -4 ? 'auto' : 'none',
          transition: isDragging
            ? 'none'
            : 'width 0.22s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.15s ease',
        }}
      >
        {/* Blue Pill Change Exercise Button (fades out as user swipes past 50%) */}
        {onChangeExercise && (
          <button
            type="button"
            onClick={handleChange}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              opacity: changeBtnOpacity,
              display: isPastHalf ? 'none' : 'flex',
              transition: 'opacity 0.18s ease',
            }}
            className="h-10 px-3.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer select-none touch-manipulation shrink-0"
            title="Змінити вправу"
            aria-label="Змінити вправу"
          >
            <ArrowLeftRight className="h-4 w-4 shrink-0" />
            <span className="truncate">Змінити</span>
          </button>
        )}

        {/* Red Pill Delete Button (smoothly stretches when past 50%) */}
        <button
          type="button"
          onClick={handleDelete}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            flex: isPastHalf ? 1 : 'none',
            transition: 'all 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
          className="h-10 px-4 rounded-full bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer select-none touch-manipulation shrink-0"
          title="Видалити вправу"
          aria-label="Видалити вправу"
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          <span className="truncate">Видалити</span>
        </button>
      </div>

      {/* Foreground Swipeable Card */}
      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging
            ? 'none'
            : 'transform 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)',
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
