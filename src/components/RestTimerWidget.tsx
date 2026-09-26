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

  // Minimized Floating Pill (Non-intrusive on mobile)
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={`fixed bottom-32 sm:bottom-6 right-3 sm:right-6 z-40 flex items-center space-x-2 rounded-full px-3.5 py-2 shadow-2xl border transition active:scale-95 ${
          secondsLeft === 0
            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold animate-bounce'
            : isRunning
            ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-amber-500/30'
            : 'bg-slate-900/95 text-slate-200 border-slate-700 hover:border-slate-500'
        }`}
        title="Відкрити таймер відпочинку"
      >
        <Timer className="h-4 w-4 shrink-0" />
        <span className="font-mono text-xs sm:text-sm font-bold">{formatTime(secondsLeft)}</span>
      </button>
    );
  }

  // Expanded Floating Card (Adaptive positioning)
  return (
    <div className="fixed bottom-32 sm:bottom-6 right-3 sm:right-6 z-40 w-[calc(100vw-24px)] max-w-xs sm:w-72 rounded-2xl border border-slate-700 bg-slate-900/98 p-3.5 sm:p-4 shadow-2xl backdrop-blur-md animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
          <Timer className="h-4 w-4 text-amber-400" />
          <span>Відпочинок</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="rounded p-1 text-slate-400 hover:text-white transition"
            title={soundEnabled ? 'Вимкнути звук' : 'Увімкнути звук'}
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-slate-500" />
            )}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="rounded p-1 text-slate-400 hover:text-white transition"
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
              ? 'text-emerald-400 animate-bounce'
              : isRunning
              ? 'text-amber-400'
              : 'text-slate-100'
          }`}
        >
          {formatTime(secondsLeft)}
        </div>
        {/* Progress Bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full transition-all duration-300 ${
              secondsLeft === 0 ? 'bg-emerald-400' : 'bg-amber-500'
            }`}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center space-x-1.5">
        <button
          onClick={() => addTime(-15)}
          className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-300 hover:bg-slate-700 active:scale-95 transition"
          title="-15 сек"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={toggleRunning}
          className={`flex-1 flex items-center justify-center space-x-1.5 rounded-lg py-2 text-xs font-bold transition shadow-md active:scale-95 ${
            isRunning
              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
              : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
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
          className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-300 hover:bg-slate-700 active:scale-95 transition"
          title="Скинути"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => addTime(15)}
          className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-300 hover:bg-slate-700 active:scale-95 transition"
          title="+15 сек"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Quick Presets */}
      <div className="mt-2.5 flex items-center justify-between border-t border-slate-800 pt-2 text-[10px] sm:text-[11px] text-slate-400">
        <span className="font-medium text-slate-400">Час:</span>
        <div className="flex space-x-1">
          {[45, 60, 90, 120, 180].map((sec) => (
            <button
              key={sec}
              onClick={() => handleStartPreset(sec)}
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold transition active:scale-95 ${
                targetSeconds === sec
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {sec < 60 ? `${sec}с` : `${sec / 60}хв`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
