import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserAvatar } from './UserAvatar';
import {
  Copy,
  Check,
  Award,
  Users,
  Edit2,
  Save,
  Mail,
  Sun,
  Moon,
} from 'lucide-react';
import { UserRole } from '../types/workout';
import { StorageService } from '../services/storageService';

export const ProfileView: React.FC = () => {
  const { user, updateUserProfile, isAdmin, isCoach } = useAuth();
  const { theme, toggleTheme, setTheme, isDark } = useTheme();
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
    setTimeout(() => setCopied(false), 2000);
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

  const traineesCount = user.traineeIds?.length || 0;
  const coach = user.coachId ? StorageService.getUsers().find((u) => u.id === user.coachId) : null;

  const roleLabels: Record<UserRole, { title: string; color: string; bg: string; border: string }> = {
    admin: {
      title: 'Адміністратор',
      color: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-800',
    },
    coach: {
      title: 'Тренер',
      color: 'text-indigo-700 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      border: 'border-indigo-200 dark:border-indigo-800',
    },
    athlete: {
      title: 'Атлет',
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
  };

  const currentRoleInfo = roleLabels[user.role] || roleLabels.athlete;

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in pb-16">
      {/* Toast Alert */}
      {saveToast && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-fade-in">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Профіль користувача успішно оновлено!</span>
        </div>
      )}

      {/* Main Profile Card - Minimal Functional Flat */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar with Role Badge */}
          <div className="relative shrink-0">
            <UserAvatar
              src={user.image}
              alt={user.name}
              size="xl"
            />
            <div className={`absolute -bottom-1.5 -right-1.5 rounded border px-2 py-0.5 text-[10px] font-bold ${currentRoleInfo.bg} ${currentRoleInfo.border} ${currentRoleInfo.color}`}>
              {currentRoleInfo.title}
            </div>
          </div>

          {/* User Details */}
          <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {user.firstName || user.name} {user.lastName || ''}
                </h2>
                <div className="flex items-center justify-center sm:justify-start space-x-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{user.email}</span>
                </div>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setFirstName(user.firstName || '');
                    setLastName(user.lastName || '');
                    setSelectedRole(user.role);
                    setIsEditing(true);
                  }}
                  className="inline-flex items-center justify-center space-x-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer self-center sm:self-auto"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Редагувати профіль</span>
                </button>
              )}
            </div>

            {/* Profile ID Card */}
            <div className="pt-2">
              <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">Унікальний ID профілю:</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 select-all">
                  {user.profileCode || user.id}
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center space-x-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Скопіювати ID для прив'язки тренером"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Скопійовано!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Скопіювати ID</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                Цей ID використовується для зв'язку тренера з підопічним.
              </p>
            </div>
          </div>
        </div>

        {/* Edit Profile Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Редагування персональних даних
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Ім'я
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-base sm:text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Прізвище
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-base sm:text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Роль користувача
              </label>
              <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                {((isAdmin ? ['athlete', 'coach', 'admin'] : ['athlete', 'coach']) as UserRole[]).map((r) => {
                  const info = roleLabels[r];
                  const isCurrent = selectedRole === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRole(r)}
                      className={`rounded-lg p-2.5 text-xs font-semibold border transition-colors text-center cursor-pointer ${
                        isCurrent
                          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div>{info.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="h-9 px-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="submit"
                className="h-9 inline-flex items-center justify-center space-x-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-4 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Зберегти зміни</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Theme Settings Card */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>Тема інтерфейсу</span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Виберіть оформлення програми: світлу або темну тему (вибір зберігається автоматично)
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-0.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`inline-flex items-center space-x-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              !isDark
                ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            <span>Світла</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`inline-flex items-center space-x-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              isDark
                ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            <span>Темна</span>
          </button>
        </div>
      </div>

      {/* Role Privileges and Coach Connection Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Role Privileges Card */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2.5">
          <div className="flex items-center space-x-2 text-zinc-900 dark:text-zinc-100 font-bold text-xs uppercase tracking-wider">
            <Award className="h-4 w-4" />
            <span>Можливості ролі ({currentRoleInfo.title})</span>
          </div>
          <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
            <li className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Ведення щоденника тренувань і підходів</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>База вправ, історія ваг та персональні рекорди</span>
            </li>
            {isCoach && (
              <li className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                <span>Розділ «Підопічні»: складання планів та контроль</span>
              </li>
            )}
            {isAdmin && (
              <li className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span>Адмін-доступ: глобальне керування базою</span>
              </li>
            )}
          </ul>
        </div>

        {/* Coach / Trainee Relationship Status */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2.5">
          <div className="flex items-center space-x-2 text-zinc-900 dark:text-zinc-100 font-bold text-xs uppercase tracking-wider">
            <Users className="h-4 w-4" />
            <span>Тренерський статус</span>
          </div>

          {isCoach ? (
            <div className="space-y-2 text-xs">
              <p className="text-zinc-600 dark:text-zinc-400">
                Ви зареєстровані як <strong>Тренер</strong>. Ви можете додавати спортсменів за їхнім ID.
              </p>
              <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5 flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Прив'язаних підопічних:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{traineesCount}</span>
              </div>
            </div>
          ) : coach ? (
            <div className="space-y-2 text-xs">
              <p className="text-zinc-600 dark:text-zinc-400">Ваш призначений тренер:</p>
              <div className="flex items-center space-x-2.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2.5">
                <UserAvatar src={coach.image} alt={coach.name} size="sm" />
                <div>
                  <div className="font-bold text-zinc-900 dark:text-zinc-100">{coach.name}</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{coach.email}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
              <p>У вас немає призначеного тренера.</p>
              <p>
                Повідомте ваш ID <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{user.profileCode || user.id}</span> тренеру для прикріплення.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
