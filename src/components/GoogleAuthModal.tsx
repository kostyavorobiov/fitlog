import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, X, Check, ShieldCheck, User as UserIcon } from 'lucide-react';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({ isOpen, onClose }) => {
  const { user, loginWithGoogle, switchUser, allUsers } = useAuth();
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleQuickLogin = async (email: string, name: string) => {
    setIsSubmitting(true);
    await loginWithGoogle(email, name);
    setIsSubmitting(false);
    onClose();
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail) return;
    setIsSubmitting(true);
    await loginWithGoogle(customEmail, customName || customEmail.split('@')[0]);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/20">
            <LogIn className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Вхід через Google OAuth</h3>
            <p className="text-xs text-slate-400">Синхронізація тренувань та персональної бази</p>
          </div>
        </div>

        {/* Current logged in user info */}
        {user && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src={user.image}
                alt={user.name}
                className="h-10 w-10 rounded-full border border-emerald-500/40 object-cover"
              />
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-sm font-semibold text-white">{user.name}</span>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    Активний
                  </span>
                </div>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
            </div>
            <Check className="h-5 w-5 text-emerald-400" />
          </div>
        )}

        {/* Quick 1-tap Google Login */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Швидкий вхід за обліковим записом
          </p>

          <button
            onClick={() => handleQuickLogin('kvorobiov9@gmail.com', 'Костянтин Воробйов')}
            disabled={isSubmitting}
            className="w-full flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/80 p-3 hover:bg-slate-700 hover:border-amber-500/50 transition group"
          >
            <div className="flex items-center space-x-3">
              {/* Google G icon */}
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow">
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
              <div className="text-left">
                <div className="text-sm font-semibold text-white group-hover:text-amber-400 transition">
                  Костянтин Воробйов
                </div>
                <div className="text-xs text-slate-400">kvorobiov9@gmail.com</div>
              </div>
            </div>
            <span className="text-xs text-amber-400 font-medium">Увійти →</span>
          </button>

          {/* Switch existing stored users */}
          {allUsers.length > 1 && (
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Збережені профілі
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {allUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      switchUser(u.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition ${
                      user?.id === u.id
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800/40 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <UserIcon className="h-3.5 w-3.5" />
                      <span>{u.name} ({u.email})</span>
                    </div>
                    {user?.id === u.id && <span>✓ Активний</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Custom email entry */}
        <div className="mt-6 border-t border-slate-800 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Або введіть інший Google Email
          </p>
          <form onSubmit={handleCustomSubmit} className="space-y-3">
            <div>
              <input
                type="email"
                required
                placeholder="ваш_email@gmail.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Ім'я атлета (необов'язково)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-orange-400 transition shadow-lg shadow-amber-500/20"
            >
              {isSubmitting ? 'Авторизація...' : 'Увійти в щоденник'}
            </button>
          </form>
        </div>

        <div className="mt-4 flex items-center justify-center space-x-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Безпечна авторизація з персональним сховищем тренувань</span>
        </div>
      </div>
    </div>
  );
};
