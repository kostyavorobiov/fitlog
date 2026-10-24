import React, { useState, useRef, useEffect } from 'react';
import { Trash2, ArrowLeftRight, Pencil } from 'lucide-react';
import { webSwipeCardManager } from '../utils/webSwipeCardManager';

interface MobileSwipeableExerciseCardProps {
  exerciseId?: string;
  onDelete: () => void;
  onChangeExercise?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
  stripeColor?: string;
  children: React.ReactNode;
}

const NORMAL_BTN_WIDTH = 52;
const GAP = 6;
const PADDING_RIGHT = 6;
const SNAP_THRESHOLD = 32;

export const MobileSwipeableExerciseCard: React.FC<MobileSwipeableExerciseCardProps> = ({
  exerciseId,
  onDelete,
  onChangeExercise,
  onEdit,
  disabled = false,
  stripeColor,
  children,
}) => {
  const cardId = exerciseId || 'ex_card';
  const hasFirstAction = Boolean(onChangeExercise || onEdit);
  const restingWidth = hasFirstAction
    ? NORMAL_BTN_WIDTH * 2 + GAP + PADDING_RIGHT
    : NORMAL_BTN_WIDTH + PADDING_RIGHT;

  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOpenRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const cardWidthRef = useRef<number>(380);
  const isMovingHorizontallyRef = useRef<boolean | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const hasMovedRef = useRef(false);
  const justSwipedRef = useRef(false);
  const isPastThresholdRef = useRef(false);

  // Auto-close if another card opens
  useEffect(() => {
    return webSwipeCardManager.subscribe((activeId) => {
      if (activeId !== cardId && isOpenRef.current) {
        isOpenRef.current = false;
        setOffsetX(0);
        isPastThresholdRef.current = false;
      }
    });
  }, [cardId]);

  // Clean up if unmounted while open
  useEffect(() => {
    return () => {
      if (webSwipeCardManager.getActiveId() === cardId) {
        webSwipeCardManager.setActive(null);
      }
    };
  }, [cardId]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || isDeleting) return;
    if (e.button !== 0) return; // Only primary mouse button or touch

    // Do not initiate swipe on input fields, buttons, or select dropdowns
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, button, a, [data-interactive]')) {
      hasMovedRef.current = false;
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    cardWidthRef.current = rect.width;

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    pointerIdRef.current = e.pointerId;
    isMovingHorizontallyRef.current = null;
    hasMovedRef.current = false;
    setIsDragging(false);
    isPastThresholdRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;

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

      const cardWidth = cardWidthRef.current || (typeof window !== 'undefined' ? window.innerWidth : 380);
      const quickDeleteThreshold = cardWidth * 0.55;

      // 1. If card is currently open: allow dragging right to close
      if (isOpenRef.current) {
        if (dx > 0) {
          const targetX = Math.min(0, -restingWidth + dx);
          setOffsetX(targetX);
        }
        return;
      }

      // 2. Closed card: swiping left
      if (dx < 0) {
        const clamped = Math.max(-cardWidth, dx);
        setOffsetX(clamped);

        const isOver = Math.abs(clamped) >= quickDeleteThreshold;
        if (isOver !== isPastThresholdRef.current) {
          isPastThresholdRef.current = isOver;
          if (isOver && typeof window !== 'undefined' && window.navigator?.vibrate) {
            try {
              window.navigator.vibrate(15);
            } catch {}
          }
        }
      }
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
        hasMovedRef.current = false;
      }, 150);

      const dx = e.clientX - startXRef.current;
      const cardWidth = cardWidthRef.current || (typeof window !== 'undefined' ? window.innerWidth : 380);
      const quickDeleteThreshold = cardWidth * 0.55;

      // 1. If card was already open
      if (isOpenRef.current) {
        if (dx > 28) {
          // Snap closed smoothly
          isOpenRef.current = false;
          setOffsetX(0);
          webSwipeCardManager.setActive(null);
        } else {
          // Snap back to resting open width
          setOffsetX(-restingWidth);
        }
        return;
      }

      // 2. Closed card swipe ending
      const pastHalfCard = -offsetX >= quickDeleteThreshold;

      if (pastHalfCard) {
        // Full swipe > 55%: snap to resting width smoothly and trigger single delete confirmation
        isOpenRef.current = false;
        setOffsetX(0);
        webSwipeCardManager.setActive(null);
        onDelete();
      } else if (offsetX < -SNAP_THRESHOLD) {
        // Snap open to resting width
        isOpenRef.current = true;
        setOffsetX(-restingWidth);
        webSwipeCardManager.setActive(cardId);
      } else {
        // Snap closed
        isOpenRef.current = false;
        setOffsetX(0);
        webSwipeCardManager.setActive(null);
      }
    } else {
      setIsDragging(false);
      isMovingHorizontallyRef.current = null;
      hasMovedRef.current = false;
    }
  };

  const handleChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    isOpenRef.current = false;
    setOffsetX(0);
    webSwipeCardManager.setActive(null);
    if (onChangeExercise) onChangeExercise();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    isOpenRef.current = false;
    setOffsetX(0);
    webSwipeCardManager.setActive(null);
    if (onEdit) onEdit();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    isOpenRef.current = false;
    setOffsetX(0);
    webSwipeCardManager.setActive(null);
    onDelete();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const isInteractive = Boolean(target?.closest('input, textarea, select, button, a, [data-interactive]'));

    if (isOpenRef.current) {
      e.stopPropagation();
      e.preventDefault();
      isOpenRef.current = false;
      setOffsetX(0);
      webSwipeCardManager.setActive(null);
      return;
    }

    if (justSwipedRef.current || hasMovedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    if (isInteractive) {
      return;
    }
  };

  const cardWidth = cardWidthRef.current || (typeof window !== 'undefined' ? window.innerWidth : 380);
  const quickDeleteThreshold = cardWidth * 0.55;
  const currentPull = -offsetX;
  const isPastHalf = currentPull >= quickDeleteThreshold;

  const stretchProgress = Math.min(
    1,
    Math.max(0, (currentPull - restingWidth) / Math.max(1, quickDeleteThreshold - restingWidth))
  );

  const firstBtnOpacity = isPastHalf ? 0 : Math.max(0, 1 - stretchProgress);
  const firstBtnScale = isPastHalf ? 0.7 : Math.max(0.7, 1 - stretchProgress * 0.3);

  const deleteBtnWidth = isPastHalf
    ? '100%'
    : currentPull > restingWidth
    ? `${NORMAL_BTN_WIDTH + (currentPull - restingWidth) + (hasFirstAction ? (NORMAL_BTN_WIDTH + GAP) * stretchProgress : 0)}px`
    : `${NORMAL_BTN_WIDTH}px`;

  return (
    <div
      data-no-swipe="true"
      data-swipe-card="true"
      style={{ touchAction: 'pan-y' }}
      className={`no-swipe relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#1d2939] shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-zinc-700 ${
        isDeleting
          ? 'max-h-0 opacity-0 -translate-x-full my-0 py-0 border-transparent overflow-hidden'
          : ''
      }`}
    >
      {/* Background Actions Row with full-height rounded buttons */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end z-0 py-1.5 pr-1.5 gap-1.5 overflow-hidden bg-transparent"
        style={{
          width: `${Math.max(restingWidth, currentPull)}px`,
          opacity: offsetX < -4 ? 1 : 0,
          pointerEvents: offsetX < -4 ? 'auto' : 'none',
          transition: isDragging
            ? 'none'
            : 'width 0.22s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.15s ease',
        }}
      >
        {/* Blue Change Exercise Button */}
        {onChangeExercise && (
          <div
            style={{
              opacity: firstBtnOpacity,
              transform: `scale(${firstBtnScale})`,
              display: isPastHalf ? 'none' : 'flex',
              transition: isDragging ? 'none' : 'opacity 0.18s ease, transform 0.18s ease',
              height: '100%',
            }}
          >
            <button
              type="button"
              onClick={handleChange}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-[52px] h-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer select-none touch-manipulation shrink-0"
              title="Змінити вправу"
              aria-label="Змінити вправу"
            >
              <ArrowLeftRight className="h-5 w-5 shrink-0" />
            </button>
          </div>
        )}

        {/* Blue Edit Exercise Button */}
        {onEdit && (
          <div
            style={{
              opacity: firstBtnOpacity,
              transform: `scale(${firstBtnScale})`,
              display: isPastHalf ? 'none' : 'flex',
              transition: isDragging ? 'none' : 'opacity 0.18s ease, transform 0.18s ease',
              height: '100%',
            }}
          >
            <button
              type="button"
              onClick={handleEdit}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-[52px] h-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer select-none touch-manipulation shrink-0"
              title="Редагувати вправу"
              aria-label="Редагувати вправу"
            >
              <Pencil className="h-5 w-5 shrink-0" />
            </button>
          </div>
        )}

        {/* Red Delete Button (stretches to full width when pulled past 50%) */}
        <div
          style={{
            width: deleteBtnWidth,
            height: '100%',
            transition: isDragging ? 'none' : 'width 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        >
          <button
            type="button"
            onClick={handleDelete}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full h-full rounded-xl bg-[#EF4444] hover:bg-rose-600 active:bg-rose-700 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer select-none touch-manipulation shrink-0"
            title="Видалити вправу"
            aria-label="Видалити вправу"
          >
            <Trash2 className="h-5 w-5 shrink-0" />
          </button>
        </div>
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
        className={`relative z-10 bg-white dark:bg-[#1d2939] h-full border-r border-transparent ${
          offsetX < 0
            ? 'border-slate-200 dark:border-zinc-800 shadow-[-3px_0_10px_rgba(0,0,0,0.06)] dark:shadow-[-3px_0_12px_rgba(0,0,0,0.4)]'
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
