import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Copy,
  Check,
  ShieldAlert,
  Award,
  Users,
  Edit2,
  Save,
  X,
  Mail,
  Calendar,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { UserRole } from '../types/workout';
import { StorageService } from '../services/storageService';

export const ProfileView: React.FC = () => {
  const { user, updateUserProfile, isAdmin, isCoach } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role || 'athlete');
  const [saveToast, setSaveToast] = useState(false);

  if (!user) return null;

  const handleCopyId = () => {
    const idToCopy = user.profileCode || user.id;
    navigator.clipboard.writeText(idToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: selectedRole,
    });
    setIsEditing(false);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  // Trainees count if coach
  const traineesCount = user.traineeIds?.length || 0;

  // Coach name if athlete
  const coach = user.coachId ? StorageService.getUsers().find((u) => u.id === user.coachId) : null;

  const roleLabels: Record<UserRole, { title: string; color: string; bg: string; border: string }> = {
    admin: {
      title: 'Адміністратор',
      color: 'text-rose-400',
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/30',
    },
    coach: {
      title: 'Тренер',
      color: 'text-amber-400',
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/30',
    },
    athlete: {
      title: 'Атлет',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/30',
    },
  };

  const currentRoleInfo = roleLabels[user.role] || roleLabels.athlete;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Toast Alert */}
      {saveToast && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/80 p-3.5 flex items-center space-x-2 text-emerald-300 text-xs font-semibold animate-fade-in shadow-xl backdrop-blur-md">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Профіль користувача успішно оновлено!</span>
        </div>
      )}

      {/* Main Glassmorphism Profile Card */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with role ring */}
          <div className="relative group">
            <img
              src={user.image}
              alt={user.name}
              className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl border-2 border-white/20 object-cover shadow-2xl ring-4 ring-amber-500/20"
            />
            <div className={`absolute -bottom-2 -right-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold border shadow-lg ${currentRoleInfo.bg} ${currentRoleInfo.border} ${currentRoleInfo.color}`}>
              {currentRoleInfo.title}
            </div>
          </div>

          {/* User Details */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {user.firstName || user.name} {user.lastName || ''}
                </h2>
                <div className="flex items-center justify-center sm:justify-start space-x-2 text-xs text-slate-400 mt-1">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  <span>{user.email}</span>
                </div>
              </div>

              {!isEditing && (
                <button
                  onClick={() => {
                    setFirstName(user.firstName || '');
                    setLastName(user.lastName || '');
                    setSelectedRole(user.role);
                    setIsEditing(true);
                  }}
                  className="inline-flex items-center justify-center space-x-1.5 rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition shadow-sm"
                >
                  <Edit2 className="h-3.5 w-3.5 text-amber-400" />
                  <span>Редагувати профіль</span>
                </button>
              )}
            </div>

            {/* Profile ID Card (CRITICAL REQUIREMENT) */}
            <div className="pt-3">
              <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs">
                <span className="text-slate-400 font-medium">Унікальний ID профілю:</span>
                <span className="font-mono text-sm sm:text-base font-extrabold text-amber-400 tracking-wider">
                  {user.profileCode || user.id}
                </span>
                <button
                  onClick={handleCopyId}
                  className="ml-1 inline-flex items-center space-x-1 rounded-lg bg-amber-500/20 border border-amber-500/40 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 active:scale-95 transition"
                  title="Скопіювати ID для прив'язки тренером"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Скопійовано!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-amber-400" />
                      <span>Скопіювати ID</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Цей унікальний ID використовується для прив'язки підопічного до тренера та розподілу ролей.
              </p>
            </div>
          </div>
        </div>

        {/* Edit Profile Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-6 pt-6 border-t border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Edit2 className="h-4 w-4 text-amber-400" />
              <span>Редагування персональних даних</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Ім'я
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Костянтин"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Прізвище
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Воробйов"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Призначення ролі
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['athlete', 'coach', 'admin'] as UserRole[]).map((r) => {
                  const info = roleLabels[r];
                  const isCurrent = selectedRole === r;
                  const isRestrictedAdmin = r === 'admin' && user.email.toLowerCase() !== 'kvorobiov9@gmail.com';
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={isRestrictedAdmin}
                      onClick={() => setSelectedRole(r)}
                      className={`rounded-xl p-2.5 text-xs font-bold border transition text-center ${
                        isCurrent
                          ? `${info.bg} ${info.border} ${info.color} ring-1 ring-amber-400/50`
                          : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white'
                      } ${isRestrictedAdmin ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div>{info.title}</div>
                      {isRestrictedAdmin && (
                        <div className="text-[9px] text-slate-500 mt-0.5">kvorobiov9 only</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Скасувати
              </button>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center space-x-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400 transition"
              >
                <Save className="h-4 w-4" />
                <span>Зберегти зміни</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Role specific blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Role Privileges Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur-md space-y-3">
          <div className="flex items-center space-x-2 text-white font-bold text-sm">
            <Award className="h-4 w-4 text-amber-400" />
            <span>Ваші права та можливості ({currentRoleInfo.title})</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-2">
            <li className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Ведення персонального щоденника тренувань і підходів</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Доступ до глобальної бази вправ та історії ваг</span>
            </li>
            {isCoach && (
              <li className="flex items-center space-x-2 text-amber-300 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>Розділ «Підопічні»: створення тренувальних планів та контроль</span>
              </li>
            )}
            {isAdmin && (
              <li className="flex items-center space-x-2 text-rose-300 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                <span>Адмін-меню: керування глобальною базою вправ (створення та видалення)</span>
              </li>
            )}
          </ul>
        </div>

        {/* Coach / Trainee Relationship Status */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur-md space-y-3">
          <div className="flex items-center space-x-2 text-white font-bold text-sm">
            <Users className="h-4 w-4 text-indigo-400" />
            <span>Тренерський статус</span>
          </div>

          {isCoach ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-300">
                Ви зареєстровані як <strong className="text-amber-400">Тренер</strong>. Ви можете додавати підопічних за їхнім кодом профілю та планувати для них тренування.
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-3 text-xs flex items-center justify-between">
                <span className="text-slate-400">Прив'язаних підопічних:</span>
                <span className="font-mono text-sm font-bold text-white">{traineesCount}</span>
              </div>
            </div>
          ) : coach ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-300">
                Ваш призначений тренер:
              </p>
              <div className="flex items-center space-x-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                <img
                  src={coach.image}
                  alt={coach.name}
                  className="h-9 w-9 rounded-full object-cover border border-amber-500/40"
                />
                <div>
                  <div className="text-xs font-bold text-white">{coach.name}</div>
                  <div className="text-[11px] text-slate-400">{coach.email}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-slate-400">
              <p>У вас ще немає призначеного тренера.</p>
              <p>
                Повідомте свій ID <strong className="text-amber-400 font-mono">{user.profileCode || user.id}</strong> вашому тренеру, щоб він міг додати вас до підопічних і складати персональні плани!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
