import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, X, Check, ShieldCheck, Cloud, HardDrive, AlertCircle, LogOut } from 'lucide-react';
import { UserAvatar } from './UserAvatar';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({ isOpen, onClose }) => {
  const { user, loginWithGoogle, logout, isCloudConnected } = useAuth();
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Помилка авторизації Google');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail) return;
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await loginWithGoogle(customEmail, customName || customEmail.split('@')[0]);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Помилка входу');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 dark:bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        data-no-swipe="true"
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-2xl text-slate-900 dark:text-zinc-100"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB]/10 dark:bg-[#2563EB]/15 text-[#2563EB] dark:text-[#60A5FA] border border-[#2563EB]/20 dark:border-[#2563EB]/30">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Вхід в акаунт</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Синхронізація тренувань та бази</p>
          </div>
        </div>

        {/* Database Connection Status Badge */}
        <div className="mb-4">
          {isCloudConnected ? (
            <div className="flex items-center space-x-2 px-3.5 py-2.5 rounded-2xl bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] text-xs">
              <Cloud className="h-4 w-4 shrink-0" />
              <div>
                <span className="font-bold">Хмарна база: Supabase активна</span>
                <span className="block text-[11px] opacity-80">Авторизація через офіційний Google OAuth</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
              <HardDrive className="h-4 w-4 shrink-0" />
              <div>
                <span className="font-bold">Локальний режим (LocalStorage)</span>
                <span className="block text-[11px] opacity-80">Для хмари додайте ключі Supabase у Vercel / .env</span>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center space-x-2 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Current logged in user info */}
        {user && (
          <div className="mb-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <UserAvatar
                  image={user.image}
                  name={user.name}
                  size="md"
                />
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">{user.name}</span>
                    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20">
                      Активний
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">{user.email}</p>
                </div>
              </div>
              <Check className="h-5 w-5 text-[#22C55E]" />
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-1.5 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Вийти з цього акаунта</span>
            </button>
          </div>
        )}

        {/* Main Action: Google OAuth Button */}
        <div className="space-y-3">
          <button
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center space-x-3 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3.5 hover:bg-slate-50 dark:hover:bg-zinc-750 hover:border-slate-300 dark:hover:border-zinc-600 transition shadow-sm font-bold text-sm text-slate-900 dark:text-zinc-100 cursor-pointer"
          >
            <div className="flex h-5 w-5 items-center justify-center shrink-0">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            </div>
            <span>{isSubmitting ? 'Підключення...' : 'Продовжити через Google'}</span>
          </button>
        </div>

        {/* Custom email entry for fallback */}
        {!isCloudConnected && (
          <div className="mt-5 border-t border-slate-200 dark:border-zinc-800 pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2.5">
              Або вхід за Email (локальний режим)
            </p>
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <div>
                <input
                  type="email"
                  required
                  placeholder="ваш_email@gmail.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 text-base sm:text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Ваше ім'я (необов'язково)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full h-11 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 text-base sm:text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs active:scale-[0.98] transition cursor-pointer"
              >
                {isSubmitting ? 'Авторизація...' : 'Увійти в щоденник'}
              </button>
            </form>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center space-x-1.5 text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-[#22C55E]" />
          <span>Синхронізація тренувань та безпека даних</span>
        </div>
      </div>
    </div>
  );
};
