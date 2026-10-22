import React, { useState, useRef } from 'react';
import { Trash2, ArrowLeftRight } from 'lucide-react';

interface MobileSwipeableExerciseCardProps {
  exerciseId?: string;
  onDelete: () => void;
  onChangeExercise?: () => void;
  disabled?: boolean;
  stripeColor?: string;
  children: React.ReactNode;
}

const ACTION_BTN_WIDTH = 54;
const TOTAL_SWIPE_WIDTH = 120; // 54 * 2 + gap + padding
const SWIPE_THRESHOLD = 32;

export const MobileSwipeableExerciseCard: React.FC<MobileSwipeableExerciseCardProps> = ({
  onDelete,
  onChangeExercise,
  disabled = false,
  stripeColor,
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
        isOpenRef.current = true;
        setOffsetX(-TOTAL_SWIPE_WIDTH);
      } else {
        isOpenRef.current = false;
        setOffsetX(0);
      }
    } else {
      setIsDragging(false);
      isMovingHorizontallyRef.current = null;
    }
  };

  const handleChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    isOpenRef.current = false;
    setOffsetX(0);
    if (onChangeExercise) onChangeExercise();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    isOpenRef.current = false;
    setOffsetX(0);
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
      {/* Background Actions: Change Exercise (Blue) & Delete Exercise (Red) without extra underlay */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end z-0 p-1.5 gap-1.5 overflow-hidden bg-transparent"
        style={{
          width: `${Math.max(TOTAL_SWIPE_WIDTH, -offsetX)}px`,
          opacity: offsetX < -4 ? 1 : 0,
          pointerEvents: offsetX < -4 ? 'auto' : 'none',
          transition: isDragging
            ? 'none'
            : 'width 0.22s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.15s ease',
        }}
      >
        {/* Blue Change Exercise Button (icons only, full height) */}
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
            className="w-[52px] h-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer select-none touch-manipulation shrink-0"
            title="Змінити вправу"
            aria-label="Змінити вправу"
          >
            <ArrowLeftRight className="h-5 w-5 shrink-0" />
          </button>
        )}

        {/* Red Delete Button (icons only, full height, stretches past 50%) */}
        <button
          type="button"
          onClick={handleDelete}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: isPastHalf ? '100%' : '52px',
            transition: 'all 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
          className="h-full rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer select-none touch-manipulation shrink-0"
          title="Видалити вправу"
          aria-label="Видалити вправу"
        >
          <Trash2 className="h-5 w-5 shrink-0" />
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
        className={`relative z-10 bg-white dark:bg-[#1D2939] rounded-2xl border border-zinc-200 dark:border-[#334155] overflow-hidden ${
          offsetX < 0
            ? 'shadow-[-3px_0_10px_rgba(0,0,0,0.06)] dark:shadow-[-3px_0_12px_rgba(0,0,0,0.4)]'
            : ''
        }`}
      >
        {stripeColor && (
          <div
            className="absolute left-0 top-0 bottom-0 w-2 z-20 pointer-events-none rounded-l-2xl"
            style={{ backgroundColor: stripeColor }}
          />
        )}
        {children}
      </div>
    </div>
  );
};
