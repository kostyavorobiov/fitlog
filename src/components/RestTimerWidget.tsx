import React, { useState, useEffect } from 'react';
import { Timer, Play, Pause, RotateCcw, Plus, Minus, Volume2, VolumeX, X, Minimize2, Maximize2 } from 'lucide-react';
import { playBeep, playTimerDone } from '../utils/audio';

interface RestTimerWidgetProps {
  initialSeconds?: number;
  autoStartTrigger?: number; // changes trigger timer start
}

export const RestTimerWidget: React.FC<RestTimerWidgetProps> = ({
  autoStartTrigger,
}) => {
  const [targetSeconds, setTargetSeconds] = useState(90);
  const [secondsLeft, setSecondsLeft] = useState(90);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(true); // Minimized by default for clean mobile screen

  // Auto start and expand when autoStartTrigger increments (set completed)
  useEffect(() => {
    if (autoStartTrigger && autoStartTrigger > 0) {
      setSecondsLeft(targetSeconds);
      setIsRunning(true);
      setIsMinimized(false);
      if (soundEnabled) playBeep(587.33, 0.1);
    }
  }, [autoStartTrigger]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 4 && prev > 1 && soundEnabled) {
            playBeep(440, 0.08); // countdown tick
          }
          if (prev <= 1) {
            if (soundEnabled) playTimerDone();
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, secondsLeft, soundEnabled]);

  const handleStartPreset = (sec: number) => {
    setTargetSeconds(sec);
    setSecondsLeft(sec);
    setIsRunning(true);
    if (soundEnabled) playBeep(659.25, 0.1);
  };

  const toggleRunning = () => {
    if (secondsLeft === 0) {
      setSecondsLeft(targetSeconds);
      setIsRunning(true);
    } else {
      setIsRunning(!isRunning);
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(targetSeconds);
  };

  const addTime = (delta: number) => {
    setSecondsLeft((prev) => Math.max(0, prev + delta));
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = targetSeconds > 0 ? ((targetSeconds - secondsLeft) / targetSeconds) * 100 : 0;

  // Minimized Floating Pill (Non-intrusive on mobile, positioned above bottom nav)
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={`fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-40 flex items-center space-x-2 rounded-full px-3.5 py-2 shadow-lg border transition active:scale-95 ${
          secondsLeft === 0
            ? 'bg-emerald-600 text-white border-emerald-500 font-bold animate-bounce'
            : isRunning
            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-bold'
            : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
        }`}
        title="Відкрити таймер відпочинку"
      >
        <Timer className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="font-mono text-xs sm:text-sm font-semibold">{formatTime(secondsLeft)}</span>
      </button>
    );
  }

  // Expanded Floating Card (Adaptive positioning above bottom nav)
  return (
    <div data-no-swipe="true" className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-40 w-[calc(100vw-24px)] max-w-xs sm:w-72 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 shadow-2xl text-zinc-900 dark:text-zinc-100 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
          <Timer className="h-4 w-4 text-amber-500" />
          <span>Відпочинок</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
            title={soundEnabled ? 'Вимкнути звук' : 'Увімкнути звук'}
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-zinc-400" />
            )}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
            title="Згорнути"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Timer Display */}
      <div className="my-2.5 text-center">
        <div
          className={`font-mono text-3xl sm:text-4xl font-extrabold tracking-tight ${
            secondsLeft === 0
              ? 'text-emerald-600 dark:text-emerald-400 animate-bounce'
              : 'text-zinc-900 dark:text-zinc-100'
          }`}
        >
          {formatTime(secondsLeft)}
        </div>
        {/* Progress Bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full transition-all duration-300 ${
              secondsLeft === 0 ? 'bg-emerald-500' : 'bg-zinc-900 dark:bg-zinc-100'
            }`}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center space-x-1.5">
        <button
          onClick={() => addTime(-15)}
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 transition"
          title="-15 сек"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={toggleRunning}
          className="flex-1 flex items-center justify-center space-x-1.5 rounded-xl py-2 text-xs font-semibold transition active:scale-95 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
        >
          {isRunning ? (
            <>
              <Pause className="h-3.5 w-3.5" />
              <span>Пауза</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              <span>{secondsLeft === 0 ? 'Заново' : 'Старт'}</span>
            </>
          )}
        </button>

        <button
          onClick={resetTimer}
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 transition"
          title="Скинути"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => addTime(15)}
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-95 transition"
          title="+15 сек"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Quick Presets */}
      <div className="mt-2.5 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-2 text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="font-medium">Час:</span>
        <div className="flex items-center space-x-1">
          {[45, 60, 90, 120, 180].map((sec) => (
            <button
              key={sec}
              onClick={() => handleStartPreset(sec)}
              className={`rounded-lg px-1.5 py-0.5 font-mono text-[10px] font-semibold transition active:scale-95 border ${
                targetSeconds === sec
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                  : 'bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {sec < 60 ? `${sec}с` : `${sec / 60}хв`}
            </button>
          ))}
          <input
            type="number"
            min="5"
            max="600"
            step="5"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="сек"
            value={targetSeconds}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val > 0) {
                setTargetSeconds(val);
                setSecondsLeft(val);
              }
            }}
            className="w-11 h-5 text-center font-mono text-[10px] font-bold rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none"
            title="Власний час у секундах"
          />
        </div>
      </div>
    </div>
  );
};
