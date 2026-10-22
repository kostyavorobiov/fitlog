import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Exercise, MUSCLE_GROUPS } from '../types/workout';
import { StorageService } from '../services/storageService';
import { calculate1RM } from '../utils/workout';
import {
  ChevronLeft,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Dumbbell,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

export type HistoryTimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'All';
export type HistoryMetricType = 'max_weight' | 'volume' | 'est_1rm';

interface ExerciseHistoryModalProps {
  exercise: Exercise | null;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ChartPoint {
  date: string;
  displayDate: string;
  timestamp: number;
  value: number;
  maxWeight: number;
  volume: number;
  est1RM: number;
  setsCount: number;
  workoutTitle: string;
}

export const ExerciseHistoryModal: React.FC<ExerciseHistoryModalProps> = ({
  exercise,
  userId,
  isOpen,
  onClose,
}) => {
  const [timeRange, setTimeRange] = useState<HistoryTimeRange>('3M');
  const [metricType, setMetricType] = useState<HistoryMetricType>('max_weight');
  const [activeTooltipIdx, setActiveTooltipIdx] = useState<number | null>(null);
  const [expandedSessionIdx, setExpandedSessionIdx] = useState<number | null>(null);

  // Lock body scroll safely
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Load past performances
  const rawHistory = useMemo(() => {
    if (!exercise) return [];
    try {
      return StorageService.getAllPastPerformances(userId, exercise.id);
    } catch (e) {
      console.error('Failed to load exercise history:', e);
      return [];
    }
  }, [userId, exercise?.id]);

  // Format date helper: YYYY-MM-DD -> DD.MM / DD.MM.YYYY
  const parseDate = (dStr: string): Date => {
    if (!dStr) return new Date();
    const parts = dStr.split('T')[0].split('-').map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(dStr);
  };

  const formatShortDate = (date: Date): string => {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${d}/${m}`;
  };

  const formatLongDateUk = (date: Date): string => {
    const months = [
      'січ', 'лют', 'бер', 'квіт', 'трав', 'черв',
      'лип', 'серп', 'вер', 'жовт', 'лист', 'груд',
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Process and sort all history data chronologically
  const allPoints: ChartPoint[] = useMemo(() => {
    return rawHistory
      .map((h) => {
        const dt = parseDate(h.date);
        let maxWeight = 0;
        let volume = 0;
        let best1RM = 0;
        let setsCount = 0;

        (h.sets || []).forEach((s) => {
          const w = Number(s.weight) || 0;
          const r = Number(s.actualReps) || 0;
          if (w > maxWeight) maxWeight = w;
          if (w > 0 && r > 0) {
            volume += w * r;
            const cur1RM = calculate1RM(w, r);
            if (cur1RM > best1RM) best1RM = cur1RM;
          }
          setsCount += 1;
        });

        if (maxWeight === 0 && h.maxWeight) maxWeight = h.maxWeight;
        if (volume === 0 && h.totalVolume) volume = h.totalVolume;
        if (best1RM === 0 && maxWeight > 0) best1RM = maxWeight;

        let metricVal = maxWeight;
        if (metricType === 'volume') {
          metricVal = Math.round((volume / 1000) * 10) / 10; // in tons
        } else if (metricType === 'est_1rm') {
          metricVal = Math.round(best1RM * 10) / 10;
        }

        return {
          date: h.date,
          displayDate: formatShortDate(dt),
          timestamp: dt.getTime(),
          value: metricVal,
          maxWeight,
          volume,
          est1RM: Math.round(best1RM * 10) / 10,
          setsCount,
          workoutTitle: h.workoutTitle || 'Тренування',
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [rawHistory, metricType]);

  // Filter points by selected time range
  const filteredPoints = useMemo(() => {
    if (timeRange === 'All' || allPoints.length === 0) return allPoints;
    const now = Date.now();
    let durationDays = 90;
    if (timeRange === '1W') durationDays = 7;
    if (timeRange === '1M') durationDays = 30;
    if (timeRange === '3M') durationDays = 90;
    if (timeRange === '6M') durationDays = 180;
    if (timeRange === '1Y') durationDays = 365;

    const cutoff = now - durationDays * 86400000;
    const filtered = allPoints.filter((p) => p.timestamp >= cutoff);
    return filtered.length > 0 ? filtered : allPoints.slice(-5);
  }, [allPoints, timeRange]);

  // Calculate All-Time Personal Records
  const personalRecords = useMemo(() => {
    let heaviestWeight = 0;
    let heaviestDate = '';
    let highestVolume = 0;
    let highestVolumeDate = '';
    let best1RM = 0;
    let best1RMDate = '';
    let totalSetsAllTime = 0;

    allPoints.forEach((p) => {
      if (p.maxWeight > heaviestWeight) {
        heaviestWeight = p.maxWeight;
        heaviestDate = p.date;
      }
      if (p.volume > highestVolume) {
        highestVolume = p.volume;
        highestVolumeDate = p.date;
      }
      if (p.est1RM > best1RM) {
        best1RM = p.est1RM;
        best1RMDate = p.date;
      }
      totalSetsAllTime += p.setsCount;
    });

    return {
      heaviestWeight,
      heaviestDate: heaviestDate ? formatLongDateUk(parseDate(heaviestDate)) : '—',
      highestVolume,
      highestVolumeTons: Math.round((highestVolume / 1000) * 10) / 10,
      highestVolumeDate: highestVolumeDate ? formatLongDateUk(parseDate(highestVolumeDate)) : '—',
      best1RM,
      best1RMDate: best1RMDate ? formatLongDateUk(parseDate(best1RMDate)) : '—',
      totalSetsAllTime,
    };
  }, [allPoints]);

  // Period-specific Stats
  const periodStats = useMemo(() => {
    if (filteredPoints.length === 0) {
      return {
        avgValue: 0,
        dateRangeText: 'Немає даних',
        personalBest: personalRecords.heaviestWeight,
        best1RM: personalRecords.best1RM,
        totalSets: 0,
        deltaText: '0.0 кг',
        deltaType: 'neutral' as 'up' | 'down' | 'neutral',
        isNewPrInPeriod: false,
      };
    }

    const sumVal = filteredPoints.reduce((acc, p) => acc + p.value, 0);
    const avgValue = Math.round((sumVal / filteredPoints.length) * 10) / 10;

    const firstDate = parseDate(filteredPoints[0].date);
    const lastDate = parseDate(filteredPoints[filteredPoints.length - 1].date);
    const dateRangeText =
      filteredPoints.length === 1
        ? formatLongDateUk(firstDate)
        : `${formatLongDateUk(firstDate)} — ${formatLongDateUk(lastDate)}`;

    let maxWeightInPeriod = 0;
    let max1RMInPeriod = 0;
    let totalSetsInPeriod = 0;

    filteredPoints.forEach((p) => {
      if (p.maxWeight > maxWeightInPeriod) maxWeightInPeriod = p.maxWeight;
      if (p.est1RM > max1RMInPeriod) max1RMInPeriod = p.est1RM;
      totalSetsInPeriod += p.setsCount;
    });

    // Delta from last session
    let deltaText = '0.0 кг від попереднього тренування';
    let deltaType: 'up' | 'down' | 'neutral' = 'neutral';

    if (allPoints.length >= 2) {
      const last = allPoints[allPoints.length - 1];
      const prev = allPoints[allPoints.length - 2];
      const diff = Math.round((last.value - prev.value) * 10) / 10;
      const unit = metricType === 'volume' ? 'т' : 'кг';

      if (diff > 0) {
        deltaText = `+${diff} ${unit} від попереднього тренування`;
        deltaType = 'up';
      } else if (diff < 0) {
        deltaText = `${diff} ${unit} від попереднього тренування`;
        deltaType = 'down';
      } else {
        deltaText = `0.0 ${unit} від попереднього тренування`;
        deltaType = 'neutral';
      }
    }

    const isNewPrInPeriod =
      personalRecords.heaviestWeight > 0 &&
      maxWeightInPeriod >= personalRecords.heaviestWeight &&
      filteredPoints.some((p) => p.date === personalRecords.heaviestDate);

    return {
      avgValue,
      dateRangeText,
      personalBest: personalRecords.heaviestWeight,
      best1RM: personalRecords.best1RM,
      totalSets: totalSetsInPeriod,
      deltaText,
      deltaType,
      isNewPrInPeriod,
    };
  }, [filteredPoints, allPoints, personalRecords, metricType]);

  // Last 5 Sessions for the table
  const last5Sessions = useMemo(() => {
    return rawHistory
      .slice()
      .reverse()
      .slice(0, 5)
      .map((h) => {
        let maxWeight = 0;
        let volume = 0;
        let count = 0;

        (h.sets || []).forEach((s) => {
          const w = Number(s.weight) || 0;
          const r = Number(s.actualReps) || 0;
          if (w > maxWeight) maxWeight = w;
          if (w > 0 && r > 0) volume += w * r;
          count += 1;
        });

        if (maxWeight === 0 && h.maxWeight) maxWeight = h.maxWeight;
        if (volume === 0 && h.totalVolume) volume = h.totalVolume;

        return {
          workoutId: h.workoutId,
          workoutTitle: h.workoutTitle || 'Тренування',
          date: h.date,
          displayDate: formatShortDate(parseDate(h.date)),
          setsCount: count,
          maxWeight,
          volumeTons: Math.round((volume / 1000) * 10) / 10,
          sets: h.sets || [],
        };
      });
  }, [rawHistory]);

  if (!isOpen || !exercise) return null;

  const muscleInfo = MUSCLE_GROUPS[exercise.muscleGroup] || MUSCLE_GROUPS.full_body;

  // Chart Rendering Math
  const chartW = 380;
  const chartH = 190;
  const padLeft = 40;
  const padRight = 15;
  const padTop = 15;
  const padBottom = 28;
  const innerW = chartW - padLeft - padRight;
  const innerH = chartH - padTop - padBottom;

  const values = filteredPoints.map((p) => p.value);
  let minVal = values.length > 0 ? Math.min(...values) : 0;
  let maxVal = values.length > 0 ? Math.max(...values) : 100;

  if (minVal === maxVal) {
    minVal = Math.max(0, minVal - 10);
    maxVal = maxVal + 10;
  }
  const valRange = maxVal - minVal || 1;

  // Compute (x, y) for each point
  const svgPoints = filteredPoints.map((p, idx) => {
    const x =
      filteredPoints.length === 1
        ? padLeft + innerW / 2
        : padLeft + (idx / (filteredPoints.length - 1)) * innerW;
    const y = padTop + innerH - ((p.value - minVal) / valRange) * innerH;
    return { ...p, x, y };
  });

  // Build smooth cubic Bezier curve
  let curvePath = '';
  let fillPath = '';

  if (svgPoints.length === 1) {
    curvePath = `M ${padLeft} ${svgPoints[0].y} L ${chartW - padRight} ${svgPoints[0].y}`;
    fillPath = `M ${padLeft} ${svgPoints[0].y} L ${chartW - padRight} ${svgPoints[0].y} L ${chartW - padRight} ${chartH - padBottom} L ${padLeft} ${chartH - padBottom} Z`;
  } else if (svgPoints.length >= 2) {
    curvePath = `M ${svgPoints[0].x} ${svgPoints[0].y}`;
    for (let i = 0; i < svgPoints.length - 1; i++) {
      const p0 = svgPoints[i === 0 ? 0 : i - 1];
      const p1 = svgPoints[i];
      const p2 = svgPoints[i + 1];
      const p3 = svgPoints[i + 2 < svgPoints.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 5;
      const cp1y = p1.y + (p2.y - p0.y) / 5;
      const cp2x = p2.x - (p3.x - p1.x) / 5;
      const cp2y = p2.y - (p3.y - p1.y) / 5;

      curvePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    fillPath = `${curvePath} L ${svgPoints[svgPoints.length - 1].x} ${chartH - padBottom} L ${svgPoints[0].x} ${chartH - padBottom} Z`;
  }

  // Generate 4 horizontal ticks
  const ticksCount = 4;
  const yTicks = Array.from({ length: ticksCount }).map((_, i) => {
    const val = minVal + (i / (ticksCount - 1)) * valRange;
    const y = padTop + innerH - (i / (ticksCount - 1)) * innerH;
    return { val: Math.round(val), y };
  });

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      data-no-swipe="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md animate-fade-in md:p-4 overflow-y-auto"
    >
      <div className="relative w-full h-full md:h-auto md:max-h-[92vh] md:max-w-xl md:rounded-3xl border-0 md:border border-[#e2e8f0] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#0b1220] shadow-2xl overflow-y-auto flex flex-col text-[#0f172a] dark:text-[#f8fafc]">
        {/* 1. Sticky Top Navigation Header */}
        <div className="sticky top-0 z-30 bg-[#f8fafc]/90 dark:bg-[#0b1220]/90 backdrop-blur-xl border-b border-[#e2e8f0]/80 dark:border-[#334155]/80 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white dark:bg-[#1d2939] border border-[#e2e8f0] dark:border-[#334155] flex items-center justify-center text-[#0f172a] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#263140] transition-colors cursor-pointer shrink-0 shadow-xs"
            aria-label="Назад"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0 text-center">
            <h2 className="text-base sm:text-lg font-bold truncate tracking-tight">
              {exercise.name}
            </h2>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8]">
                {muscleInfo.nameUk}
              </span>
            </div>
          </div>

          <div className="w-9" />
        </div>

        {/* 2. Scrollable Body Content */}
        <div className="flex-1 p-4 sm:p-5 space-y-4">
          {/* Time Range Selector: 1W | 1M | 3M | 6M | 1Y | All */}
          <div className="w-full bg-[#f1f5f9] dark:bg-[#182232] dark:bg-[#1e293b] p-1 rounded-2xl flex items-center gap-1 border border-[#e2e8f0] dark:border-[#334155]">
            {(
              [
                { key: '1W', label: '1Т' },
                { key: '1M', label: '1М' },
                { key: '3M', label: '3М' },
                { key: '6M', label: '6М' },
                { key: '1Y', label: '1Р' },
                { key: 'All', label: 'Все' },
              ] as const
            ).map((t) => {
              const isActive = timeRange === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTimeRange(t.key)}
                  className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-[#1d2939] text-[#2563eb] dark:text-[#60a5fa] font-bold shadow-xs'
                      : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Metric Selector: Max Weight | Total Volume | Est. 1RM */}
          <div className="w-full bg-[#f1f5f9] dark:bg-[#182232] dark:bg-[#1e293b] p-1 rounded-2xl flex items-center gap-1 border border-[#e2e8f0] dark:border-[#334155]">
            {(
              [
                { key: 'max_weight', label: 'Макс. вага' },
                { key: 'volume', label: 'Тоннаж' },
                { key: 'est_1rm', label: 'Розрахунковий 1ПМ' },
              ] as const
            ).map((m) => {
              const isActive = metricType === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetricType(m.key)}
                  className={`flex-1 py-2 text-center text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-[#1d2939] text-[#2563eb] dark:text-[#60a5fa] font-bold shadow-xs'
                      : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Average Value Above Chart */}
          <div className="pt-1">
            <span className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
              Середнє
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-3xl font-extrabold tracking-tight">
                {periodStats.avgValue}
              </span>
              <span className="text-sm font-semibold text-[#64748b] dark:text-[#94a3b8]">
                {metricType === 'volume' ? 'т' : 'кг'}
              </span>
            </div>
            <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
              {periodStats.dateRangeText}
            </p>
          </div>

          {/* Interactive Bezier Area Chart */}
          <div className="w-full rounded-2xl sm:rounded-3xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-3 sm:p-4 shadow-xs relative">
            {filteredPoints.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4">
                <Dumbbell className="w-8 h-8 text-[#94a3b8] mb-2 opacity-50" />
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                  Немає даних за обраний період
                </p>
              </div>
            ) : (
              <div className="relative w-full overflow-hidden">
                <svg
                  viewBox={`0 0 ${chartW} ${chartH}`}
                  className="w-full h-auto select-none"
                  style={{ maxHeight: '200px' }}
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines and Y Labels */}
                  {yTicks.map((t, idx) => (
                    <g key={idx}>
                      <line
                        x1={padLeft}
                        y1={t.y}
                        x2={chartW - padRight}
                        y2={t.y}
                        stroke="currentColor"
                        strokeDasharray="3 3"
                        className="text-slate-200 dark:text-[#334155]/60"
                        strokeWidth="1"
                      />
                      <text
                        x={padLeft - 6}
                        y={t.y + 3.5}
                        textAnchor="end"
                        className="text-[10px] fill-[#94a3b8] font-mono"
                      >
                        {t.val}
                      </text>
                    </g>
                  ))}

                  {/* Gradient Area Fill */}
                  {fillPath && <path d={fillPath} fill="url(#chartGradient)" />}

                  {/* Smooth Bezier Line */}
                  {curvePath && (
                    <path
                      d={curvePath}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Dots at Data Points */}
                  {svgPoints.map((p, idx) => (
                    <g key={idx}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={activeTooltipIdx === idx ? 6 : 4}
                        fill="#ffffff"
                        stroke="#2563eb"
                        strokeWidth={activeTooltipIdx === idx ? 3 : 2}
                        className="cursor-pointer transition-all"
                        onClick={() =>
                          setActiveTooltipIdx(activeTooltipIdx === idx ? null : idx)
                        }
                      />
                      {/* X Axis Date Label */}
                      <text
                        x={p.x}
                        y={chartH - 8}
                        textAnchor="middle"
                        className="text-[9px] fill-[#94a3b8] font-mono"
                      >
                        {p.displayDate}
                      </text>
                    </g>
                  ))}
                </svg>

                {/* Active Tooltip Popover */}
                {activeTooltipIdx !== null && svgPoints[activeTooltipIdx] && (
                  <div className="mt-2 p-2.5 rounded-xl bg-[#f1f5f9] dark:bg-[#263140] border border-[#e2e8f0] dark:border-[#334155] text-xs space-y-1 flex items-center justify-between">
                    <div>
                      <span className="font-bold">
                        {svgPoints[activeTooltipIdx].displayDate}
                      </span>
                      <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] ml-2">
                        {svgPoints[activeTooltipIdx].workoutTitle}
                      </span>
                    </div>
                    <div className="font-bold text-[#2563eb] dark:text-[#60a5fa] font-mono">
                      {svgPoints[activeTooltipIdx].value}{' '}
                      {metricType === 'volume' ? 'т' : 'кг'} (
                      {svgPoints[activeTooltipIdx].setsCount} підх.)
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3 Metric Summary Cards in a Row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Personal Best */}
            <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-3 text-center space-y-1 shadow-xs">
              <div className="flex items-center justify-center text-amber-500">
                <Trophy className="w-4 h-4" />
              </div>
              <div className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                {periodStats.personalBest > 0 ? `${periodStats.personalBest} кг` : '—'}
              </div>
              <div className="text-[10px] text-[#64748b] dark:text-[#94a3b8] truncate">
                Рекорд (PR)
              </div>
            </div>

            {/* Est. 1RM */}
            <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-3 text-center space-y-1 shadow-xs">
              <div className="flex items-center justify-center text-[#2563eb] dark:text-[#60a5fa]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                {periodStats.best1RM > 0 ? `${periodStats.best1RM} кг` : '—'}
              </div>
              <div className="text-[10px] text-[#64748b] dark:text-[#94a3b8] truncate">
                Розрахунковий 1ПМ
              </div>
            </div>

            {/* Total Sets */}
            <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-3 text-center space-y-1 shadow-xs">
              <div className="flex items-center justify-center text-emerald-500">
                <Dumbbell className="w-4 h-4" />
              </div>
              <div className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                {periodStats.totalSets}
              </div>
              <div className="text-[10px] text-[#64748b] dark:text-[#94a3b8] truncate">
                Всього підходів
              </div>
            </div>
          </div>

          {/* Comparison Delta Banner */}
          <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-3 flex items-center gap-2.5 shadow-xs">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                periodStats.deltaType === 'up'
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : periodStats.deltaType === 'down'
                  ? 'bg-rose-500/15 text-rose-500'
                  : 'bg-slate-500/15 text-slate-500'
              }`}
            >
              {periodStats.deltaType === 'up' ? (
                <TrendingUp className="w-4 h-4" />
              ) : periodStats.deltaType === 'down' ? (
                <TrendingDown className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
            </div>
            <span className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc]">
              {periodStats.deltaText}
            </span>
          </div>

          {/* Personal Records Card */}
          <div className="rounded-2xl sm:rounded-3xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-4 sm:p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm sm:text-base font-bold">Особисті рекорди</h3>
            </div>

            <div className="space-y-3 divide-y divide-[#e2e8f0] dark:divide-[#334155]/60">
              {/* Heaviest Weight */}
              <div className="pt-2 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                    Максимальна вага
                  </div>
                  <div className="text-base sm:text-lg font-extrabold tracking-tight mt-0.5">
                    {personalRecords.heaviestWeight > 0
                      ? `${personalRecords.heaviestWeight} кг`
                      : '—'}
                  </div>
                </div>
                <div className="text-xs text-[#64748b] dark:text-[#94a3b8] font-mono">
                  {personalRecords.heaviestDate}
                </div>
              </div>

              {/* Highest Volume */}
              <div className="pt-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                    Найбільший тоннаж сесії
                  </div>
                  <div className="text-base sm:text-lg font-extrabold tracking-tight mt-0.5">
                    {personalRecords.highestVolume > 0
                      ? `${personalRecords.highestVolumeTons} т`
                      : '—'}
                  </div>
                </div>
                <div className="text-xs text-[#64748b] dark:text-[#94a3b8] font-mono">
                  {personalRecords.highestVolumeDate}
                </div>
              </div>

              {/* Best Est. 1RM */}
              <div className="pt-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                    Кращий розрахунковий 1ПМ
                  </div>
                  <div className="text-base sm:text-lg font-extrabold tracking-tight mt-0.5">
                    {personalRecords.best1RM > 0 ? `${personalRecords.best1RM} кг` : '—'}
                  </div>
                </div>
                <div className="text-xs text-[#64748b] dark:text-[#94a3b8] font-mono">
                  {personalRecords.best1RMDate}
                </div>
              </div>
            </div>
          </div>

          {/* Insights / Progress Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] px-1">
              Аналітика прогресу
            </h3>

            {/* Progress Card */}
            <div className="rounded-2xl sm:rounded-3xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#182232] dark:bg-[#1d2939] p-4 sm:p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
                <h4 className="text-sm font-bold">Прогрес</h4>
              </div>

              <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                Ви тренували цю вправу{' '}
                <strong className="text-[#0f172a] dark:text-[#f8fafc]">
                  {filteredPoints.length}
                </strong>{' '}
                {filteredPoints.length === 1
                  ? 'раз'
                  : filteredPoints.length >= 2 && filteredPoints.length <= 4
                  ? 'рази'
                  : 'разів'}{' '}
                за цей період.
              </p>

              {/* Last 5 Sessions Table */}
              <div className="pt-2">
                <div className="text-xs font-bold mb-2">Останні 5 тренувань</div>

                {last5Sessions.length === 0 ? (
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                    Ще немає записів
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {/* Header */}
                    <div className="grid grid-cols-4 gap-2 text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] pb-1 border-b border-[#e2e8f0] dark:border-[#334155]/60">
                      <div>Дата</div>
                      <div className="text-center">Підходи</div>
                      <div className="text-right">Макс. вага</div>
                      <div className="text-right">Тоннаж</div>
                    </div>

                    {/* Rows */}
                    {last5Sessions.map((session, sIdx) => {
                      const isExpanded = expandedSessionIdx === sIdx;
                      return (
                        <div key={sIdx} className="space-y-1.5">
                          <div
                            onClick={() =>
                              setExpandedSessionIdx(isExpanded ? null : sIdx)
                            }
                            className="grid grid-cols-4 gap-2 py-1.5 text-xs font-mono items-center cursor-pointer hover:bg-[#f1f5f9] dark:hover:bg-[#263140]/60 px-1 rounded-lg transition-colors"
                          >
                            <div className="font-semibold text-[#0f172a] dark:text-[#f8fafc] flex items-center gap-1">
                              <span>{session.displayDate}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3 text-[#94a3b8]" />
                              ) : (
                                <ChevronDown className="w-3 h-3 text-[#94a3b8]" />
                              )}
                            </div>
                            <div className="text-center font-bold">
                              {session.setsCount}
                            </div>
                            <div className="text-right font-bold">
                              {session.maxWeight > 0 ? `${session.maxWeight} кг` : '—'}
                            </div>
                            <div className="text-right text-[#64748b] dark:text-[#94a3b8]">
                              {session.volumeTons > 0 ? `${session.volumeTons} т` : '0'}
                            </div>
                          </div>

                          {/* Expanded Sets Details */}
                          {isExpanded && session.sets.length > 0 && (
                            <div className="pl-2 pr-1 py-1.5 bg-[#f1f5f9] dark:bg-[#263140]/60 rounded-xl space-y-1 text-[11px]">
                              <div className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase">
                                Виконані підходи:
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                {session.sets.map((set, setIdx) => (
                                  <div
                                    key={setIdx}
                                    className="p-1.5 rounded-lg bg-white dark:bg-[#1d2939] border border-[#e2e8f0] dark:border-[#334155] text-center"
                                  >
                                    <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                                      Сет {set.setNumber || setIdx + 1}
                                    </span>
                                    <div className="font-bold text-xs mt-0.5">
                                      {set.weight} кг × {set.actualReps}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Achievement Card */}
            {periodStats.isNewPrInPeriod && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 p-4 flex items-center gap-3">
                <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-amber-600 dark:text-amber-400">
                    Особистий рекорд!
                  </div>
                  <div className="text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                    Ви встановили новий рекорд у цій вправі за поточний період!
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
