import React, { useState, useEffect, useMemo } from 'react';
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
  Sun,
  Moon,
  Loader2,
  Repeat,
  ShieldCheck,
  Dumbbell,
  Plus,
  X,
  RotateCcw,
  Flame,
  AlertTriangle,
  Info,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import {
  User,
  UserRole,
  DEFAULT_REPS_RANGES,
  Gender,
  ActivityLevel,
  NutritionGoal,
} from '../types/workout';
import { StorageService } from '../services/storageService';
import { CloudStorageService } from '../services/cloudStorageService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  calculateNutrition,
  calculateAge,
  sortRepRanges,
  validateNewRepRange,
} from '../utils/nutrition';

interface ProfileViewProps {
  onOpenTrainees?: () => void;
}

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 1.2, label: '1.2 — Мінімальний', desc: 'Сидячий спосіб життя' },
  { value: 1.375, label: '1.375 — Низький', desc: 'Тренування 1-3 рази на тиждень' },
  { value: 1.55, label: '1.55 — Помірний', desc: 'Тренування 3-5 разів на тиждень' },
  { value: 1.725, label: '1.725 — Високий', desc: 'Важкі тренування 6-7 разів на тиждень' },
  { value: 1.9, label: '1.9 — Екстремальний', desc: 'Дуже важка щоденна фізична праця або 2 тренування на день' },
];

const GOAL_OPTIONS: { value: NutritionGoal; label: string; icon: React.ReactNode }[] = [
  { value: 'weight_loss', label: 'Схуднення', icon: <TrendingDown className="h-3.5 w-3.5" /> },
  { value: 'maintenance', label: 'Підтримка ваги', icon: <Minus className="h-3.5 w-3.5" /> },
  { value: 'weight_gain', label: 'Набір ваги', icon: <TrendingUp className="h-3.5 w-3.5" /> },
];

export const ProfileView: React.FC<ProfileViewProps> = ({ onOpenTrainees }) => {
  const { user, updateUserProfile, isAdmin, isCoach } = useAuth();
  const { theme, setTheme, isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role || 'athlete');
  const [gender, setGender] = useState<Gender | undefined>(user?.gender);
  const [birthDate, setBirthDate] = useState<string>(user?.birthDate || '');
  const [age, setAge] = useState<string>(
    user?.age ? String(user.age) : user?.birthDate && calculateAge(user.birthDate) ? String(calculateAge(user.birthDate)) : ''
  );
  const [weight, setWeight] = useState<string>(user?.weight ? String(user.weight) : '');
  const [height, setHeight] = useState<string>(user?.height ? String(user.height) : '');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(user?.activityLevel || 1.2);
  const [goal, setGoal] = useState<NutritionGoal>(user?.goal || 'maintenance');
  const [calorieAdjustmentPercent, setCalorieAdjustmentPercent] = useState<string>(
    user?.calorieAdjustmentPercent !== undefined ? String(user.calorieAdjustmentPercent) : '15'
  );
  const [proteinPerKg, setProteinPerKg] = useState<string>(
    user?.proteinPerKg !== undefined ? String(user.proteinPerKg) : '2.0'
  );
  const [fatPerKg, setFatPerKg] = useState<string>(
    user?.fatPerKg !== undefined ? String(user.fatPerKg) : '1.0'
  );

  const [saveToast, setSaveToast] = useState(false);
  const [coachInputCode, setCoachInputCode] = useState('');
  const [isLinkingCoach, setIsLinkingCoach] = useState(false);
  const [coachToast, setCoachToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Rep ranges state (sorted)
  const [repRanges, setRepRanges] = useState<string[]>(() => {
    return user?.customRepRanges && user.customRepRanges.length > 0
      ? sortRepRanges(user.customRepRanges)
      : sortRepRanges([...DEFAULT_REPS_RANGES]);
  });
  const [newRepRangeInput, setNewRepRangeInput] = useState('');
  const [repRangeError, setRepRangeError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.customRepRanges && user.customRepRanges.length > 0) {
      setRepRanges(sortRepRanges(user.customRepRanges));
    }
  }, [user?.customRepRanges]);

  // Synchronize state when user changes
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setSelectedRole(user.role);
      setGender(user.gender);
      setBirthDate(user.birthDate || '');
      setAge(
        user.age ? String(user.age) : user.birthDate && calculateAge(user.birthDate) ? String(calculateAge(user.birthDate)) : ''
      );
      setWeight(user.weight ? String(user.weight) : '');
      setHeight(user.height ? String(user.height) : '');
      setActivityLevel(user.activityLevel || 1.2);
      setGoal(user.goal || 'maintenance');
      setCalorieAdjustmentPercent(
        user.calorieAdjustmentPercent !== undefined ? String(user.calorieAdjustmentPercent) : '15'
      );
      setProteinPerKg(user.proteinPerKg !== undefined ? String(user.proteinPerKg) : '2.0');
      setFatPerKg(user.fatPerKg !== undefined ? String(user.fatPerKg) : '1.0');
    }
  }, [user]);

  // Real-time nutrition plan from saved user profile
  const nutritionPlan = useMemo(() => {
    return calculateNutrition(user);
  }, [user]);

  // Live preview for edit form
  const liveFormNutrition = useMemo(() => {
    const numWeight = parseFloat(weight.replace(',', '.')) || 0;
    const numHeight = parseFloat(height.replace(',', '.')) || 0;
    const numAge = parseInt(age, 10) || calculateAge(birthDate) || 0;
    const numAdj = parseFloat(calorieAdjustmentPercent.replace(',', '.')) || 0;
    const numProt = parseFloat(proteinPerKg.replace(',', '.')) || 0;
    const numFat = parseFloat(fatPerKg.replace(',', '.')) || 0;

    return calculateNutrition({
      gender,
      weight: numWeight,
      height: numHeight,
      age: numAge,
      activityLevel,
      goal,
      calorieAdjustmentPercent: goal === 'maintenance' ? 0 : numAdj,
      proteinPerKg: numProt,
      fatPerKg: numFat,
    });
  }, [gender, weight, height, age, birthDate, activityLevel, goal, calorieAdjustmentPercent, proteinPerKg, fatPerKg]);

  const handleAddRepRange = () => {
    setRepRangeError(null);
    const check = validateNewRepRange(repRanges, newRepRangeInput);
    if (!check.isValid) {
      setRepRangeError(check.error || 'Некоректний діапазон повторень');
      return;
    }
    const updated = sortRepRanges([...repRanges, check.formatted!]);
    setRepRanges(updated);
    setNewRepRangeInput('');
    updateUserProfile({ customRepRanges: updated });
  };

  const handleRemoveRepRange = (rangeToRemove: string) => {
    if (repRanges.length <= 1) return;
    const updated = sortRepRanges(repRanges.filter((r) => r !== rangeToRemove));
    setRepRanges(updated);
    updateUserProfile({ customRepRanges: updated });
  };

  const handleResetRepRanges = () => {
    const defaults = sortRepRanges([...DEFAULT_REPS_RANGES]);
    setRepRanges(defaults);
    updateUserProfile({ customRepRanges: defaults });
  };

  if (!user) return null;

  const handleCopyId = () => {
    const idToCopy = user.profileCode || user.id;
    navigator.clipboard.writeText(idToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const numWeight = weight ? parseFloat(weight.replace(',', '.')) : undefined;
    const numHeight = height ? parseFloat(height.replace(',', '.')) : undefined;
    const numAge = age ? parseInt(age, 10) : calculateAge(birthDate) || undefined;
    const numAdj = calorieAdjustmentPercent ? parseFloat(calorieAdjustmentPercent.replace(',', '.')) : 0;
    const numProt = proteinPerKg ? parseFloat(proteinPerKg.replace(',', '.')) : undefined;
    const numFat = fatPerKg ? parseFloat(fatPerKg.replace(',', '.')) : undefined;

    updateUserProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: selectedRole,
      gender,
      birthDate: birthDate.trim() || undefined,
      age: numAge,
      weight: numWeight,
      height: numHeight,
      activityLevel,
      goal,
      calorieAdjustmentPercent: goal === 'maintenance' ? 0 : numAdj,
      proteinPerKg: numProt,
      fatPerKg: numFat,
    });
    setIsEditing(false);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  // Trainees count & Coach sync
  const traineesCount = StorageService.getTrainees(user.id).length;
  const coach = user.coachId ? StorageService.getUserById(user.coachId) : null;

  const handleLinkCoach = async () => {
    const code = coachInputCode.trim();
    if (!code) return;
    setIsLinkingCoach(true);
    setCoachToast(null);

    try {
      const res = await StorageService.assignCoachToAthlete(user.id, code);
      if (res.success && res.coach) {
        updateUserProfile({ coachId: res.coach.id });
        setCoachToast({ text: `Успішно приєднано до тренера: ${res.coach.name}`, type: 'success' });
        setCoachInputCode('');
      } else {
        setCoachToast({ text: res.message || 'Не вдалося знайти тренера', type: 'error' });
      }
    } catch {
      setCoachToast({ text: 'Помилка під час приєднання', type: 'error' });
    } finally {
      setIsLinkingCoach(false);
    }
  };

  const handleUnlinkCoach = async () => {
    if (!user.coachId) return;
    if (!confirm('Ви дійсно бажаєте відкріпитися від тренера?')) return;

    setIsLinkingCoach(true);
    try {
      await StorageService.removeTrainee(user.coachId, user.id);
      updateUserProfile({ coachId: null });
    } catch {
      alert('Помилка під час відкріплення від тренера');
    } finally {
      setIsLinkingCoach(false);
    }
  };

  const roleLabels: Record<UserRole, { title: string; color: string; bg: string; border: string }> = {
    admin: {
      title: 'Адміністратор',
      color: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-800',
    },
    coach: {
      title: 'Тренер',
      color: 'text-[#2563EB] dark:text-[#60A5FA]',
      bg: 'bg-[#2563EB]/10',
      border: 'border-[#2563EB]/30',
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
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in pb-20">
      {/* Toast Alert */}
      {saveToast && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-fade-in">
          <Check className="h-4 w-4 text-[#22C55E] shrink-0" />
          <span>Профіль користувача успішно оновлено!</span>
        </div>
      )}

      {/* 1. Main Profile Card (EMAIL REMOVED) */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="shrink-0">
            <UserAvatar
              src={user.image}
              alt={user.name}
              size="xl"
            />
          </div>

          {/* User Details (NO EMAIL) */}
          <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                    {user.firstName || user.name} {user.lastName || ''}
                  </h2>
                  <span className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-0.5 text-xs font-bold ${currentRoleInfo.bg} ${currentRoleInfo.border} ${currentRoleInfo.color}`}>
                    {user.role === 'admin' ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : user.role === 'coach' ? (
                      <Users className="h-3.5 w-3.5" />
                    ) : (
                      <Dumbbell className="h-3.5 w-3.5" />
                    )}
                    <span>{currentRoleInfo.title}</span>
                  </span>
                </div>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center justify-center space-x-1.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer self-center sm:self-auto shadow-2xs"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Редагувати профіль</span>
                </button>
              )}
            </div>

            {/* Profile ID Card */}
            <div className="pt-2">
              <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3.5 py-2 text-xs">
                <span className="text-slate-500 dark:text-zinc-400 font-medium">Унікальний ID профілю:</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 select-all">
                  {user.profileCode || user.id}
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center space-x-1 rounded-xl border border-slate-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-2xs"
                  title="Скопіювати ID для прив'язки тренером"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-[#22C55E]" />
                      <span className="text-[#22C55E] font-bold">Скопійовано!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Скопіювати ID</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Profile Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Редагування персональних даних та цілей
            </h3>

            {/* Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Ім'я
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3.5 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Прізвище
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3.5 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                />
              </div>
            </div>

            {/* Role & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Роль користувача
                </label>
                <div className="flex gap-2">
                  {(['athlete', 'coach'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRole(r)}
                      className={`flex-1 h-9 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        selectedRole === r
                          ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA] font-bold'
                          : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {roleLabels[r].title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Стать
                </label>
                <div className="flex gap-2">
                  {(['male', 'female'] as Gender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`flex-1 h-9 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        gender === g
                          ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA] font-bold'
                          : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {g === 'male' ? 'Чоловіча' : 'Жіноча'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Birth date, age, weight, height */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Дата народження
                </label>
                <input
                  type="text"
                  placeholder="РРРР-ММ-ДД"
                  value={birthDate}
                  onChange={(e) => {
                    setBirthDate(e.target.value);
                    const calc = calculateAge(e.target.value);
                    if (calc) setAge(String(calc));
                  }}
                  className="w-full h-10 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Вік (років)
                </label>
                <input
                  type="number"
                  placeholder="Вік"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Вага (кг)
                </label>
                <input
                  type="text"
                  placeholder="Напр. 75"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Зріст (см)
                </label>
                <input
                  type="text"
                  placeholder="Напр. 180"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full h-10 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                />
              </div>
            </div>

            {/* Activity Level */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Рівень фізичної активності
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ACTIVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setActivityLevel(opt.value)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      activityLevel === opt.value
                        ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA] font-bold'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Goal & Deficit/Surplus % */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Ціль
                </label>
                <div className="flex gap-2">
                  {GOAL_OPTIONS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGoal(g.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        goal === g.value
                          ? 'border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB] dark:text-[#60A5FA] font-bold'
                          : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {g.icon}
                      <span>{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {goal !== 'maintenance' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    {goal === 'weight_loss' ? 'Дефіцит калорій (%)' : 'Профіцит калорій (%)'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="15"
                      value={calorieAdjustmentPercent}
                      onChange={(e) => setCalorieAdjustmentPercent(e.target.value)}
                      className="flex-1 h-9 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                    />
                    {['10', '15', '20'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCalorieAdjustmentPercent(p)}
                        className={`px-2.5 h-9 rounded-xl border text-xs cursor-pointer ${
                          calorieAdjustmentPercent === p
                            ? 'bg-[#2563EB] text-white border-[#2563EB] font-bold'
                            : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center text-xs text-slate-400">
                  Підтримка поточної ваги без дефіциту/профіциту
                </div>
              )}
            </div>

            {/* Protein, Fat, Carbs preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Білки (г/кг)
                  </label>
                  <input
                    type="text"
                    placeholder="2.0"
                    value={proteinPerKg}
                    onChange={(e) => setProteinPerKg(e.target.value)}
                    className="w-full h-10 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Жири (г/кг)
                  </label>
                  <input
                    type="text"
                    placeholder="1.0"
                    value={fatPerKg}
                    onChange={(e) => setFatPerKg(e.target.value)}
                    className="w-full h-10 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                  />
                </div>
              </div>

              {/* Live preview */}
              <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-3 flex flex-col justify-center">
                <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex justify-between">
                  <span>Вуглеводи (авто):</span>
                  <span className="font-bold text-[#2563EB] dark:text-[#60A5FA]">
                    {liveFormNutrition.carbsGrams} г/день ({liveFormNutrition.carbsPerKg} г/кг)
                  </span>
                </div>
                {liveFormNutrition.validationError && (
                  <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>{liveFormNutrition.validationError}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="submit"
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Зберегти зміни</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. Compact Nutrition Results Card: Immediately after Main Profile Card */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                Ккалорії, білки, жири та вуглеводи
              </h3>
              {nutritionPlan.isComplete && (
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  BMR: {nutritionPlan.bmr} ккал · TDEE: {nutritionPlan.tdee} ккал
                </p>
              )}
            </div>
          </div>
        </div>

        {nutritionPlan.isComplete ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Calories */}
              <div className="rounded-xl border border-orange-200 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/20 p-3 text-center">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-0.5">Калорії</div>
                <div className="text-lg font-black text-orange-600 dark:text-orange-400">
                  {nutritionPlan.targetCalories}
                </div>
                <div className="text-[10px] text-slate-400">ккал / день</div>
              </div>

              {/* Proteins */}
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 p-3 text-center">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-0.5">Білки</div>
                <div className="text-lg font-black text-rose-600 dark:text-rose-400">
                  {nutritionPlan.proteinGrams}г
                </div>
                <div className="text-[10px] text-slate-400">{nutritionPlan.proteinPerKg} г/кг</div>
              </div>

              {/* Fats */}
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 p-3 text-center">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-0.5">Жири</div>
                <div className="text-lg font-black text-amber-600 dark:text-amber-400">
                  {nutritionPlan.fatGrams}г
                </div>
                <div className="text-[10px] text-slate-400">{nutritionPlan.fatPerKg} г/кг</div>
              </div>

              {/* Carbs */}
              <div className="rounded-xl border border-sky-200 dark:border-sky-900/40 bg-sky-50/40 dark:bg-sky-950/20 p-3 text-center">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-0.5">Вуглеводи</div>
                <div className="text-lg font-black text-sky-600 dark:text-sky-400">
                  {nutritionPlan.carbsGrams}г
                </div>
                <div className="text-[10px] text-slate-400">{nutritionPlan.carbsPerKg} г/кг</div>
              </div>
            </div>

            {nutritionPlan.validationError && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-2.5 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{nutritionPlan.validationError}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-4 text-center space-y-2">
            <Info className="h-5 w-5 text-[#2563EB] mx-auto" />
            <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-md mx-auto">
              Заповніть параметри профілю (стать, вік, вагу, зріст, активність, ціль та норми БЖВ) для автоматичного розрахунку норм за формулою Mifflin–St Jeor.
            </p>
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <span>Заповнити параметри</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Athlete Coach Connection Card (for athletes) */}
      {!isCoach && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-zinc-100 font-bold text-xs uppercase tracking-wider">
            <Users className="h-4 w-4" />
            <span>Ваш тренер</span>
          </div>

          {user.coachId ? (
            coach ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <p className="text-slate-600 dark:text-zinc-400">Ваш призначений тренер:</p>
                  <button
                    type="button"
                    onClick={handleUnlinkCoach}
                    disabled={isLinkingCoach}
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {isLinkingCoach ? 'Відкріплення...' : 'Відкріпитися'}
                  </button>
                </div>
                <div className="flex items-center space-x-2.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-3">
                  <UserAvatar src={coach.image} alt={coach.name} size="sm" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-zinc-100">{coach.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400">{coach.email}</div>
                  </div>
                </div>
              </div>
            ) : null
          ) : (
            <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-3">
              <p>У вас немає призначеного тренера. Повідомте ваш персональний код тренеру або прикріпіться за його кодом:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Введіть код або email тренера"
                  value={coachInputCode}
                  onChange={(e) => setCoachInputCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isLinkingCoach) handleLinkCoach();
                  }}
                  className="flex-1 h-9 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                />
                <button
                  type="button"
                  onClick={handleLinkCoach}
                  disabled={isLinkingCoach || !coachInputCode.trim()}
                  className="h-9 px-4 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer shrink-0 disabled:opacity-50 inline-flex items-center space-x-1"
                >
                  {isLinkingCoach ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>Прикріпитися</span>
                </button>
              </div>
              {coachToast && (
                <p className={`text-[11px] font-medium ${coachToast.type === 'success' ? 'text-[#22C55E]' : 'text-rose-600 dark:text-rose-400'}`}>
                  {coachToast.text}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Rep Ranges Settings Card (Auto-sorted, duplicate/overlap validated) */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#60A5FA]">
            <Repeat className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Діапазони повторень
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Автоматично впорядковані діапазони підходів для швидкого вибору під час тренувань
            </p>
          </div>
        </div>

        {/* Current ranges */}
        <div className="flex flex-wrap gap-2 pt-1">
          {repRanges.map((rng) => (
            <span
              key={rng}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/80 text-xs font-semibold text-slate-800 dark:text-zinc-200 shadow-2xs"
            >
              <span>{rng}</span>
              <button
                type="button"
                onClick={() => handleRemoveRepRange(rng)}
                className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                title="Видалити діапазон"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>

        {/* Add new range row */}
        <div className="space-y-1 pt-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Напр. 12-15 або 20+"
              value={newRepRangeInput}
              onChange={(e) => {
                setNewRepRangeInput(e.target.value);
                setRepRangeError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddRepRange();
                }
              }}
              className="flex-1 h-9 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3.5 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
            />
            <button
              type="button"
              onClick={handleAddRepRange}
              disabled={!newRepRangeInput.trim()}
              className="h-9 px-4 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold shadow-xs active:scale-[0.98] transition-all cursor-pointer shrink-0 disabled:opacity-50 inline-flex items-center justify-center space-x-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Додати</span>
            </button>
          </div>
          {repRangeError && (
            <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{repRangeError}</p>
          )}
        </div>

        {/* Reset button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleResetRepRanges}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Скинути до стандартних</span>
          </button>
        </div>
      </div>

      {/* 5. Theme Settings Card: MOVED TO VERY BOTTOM OF PAGE */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center space-x-2">
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>Тема інтерфейсу</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Виберіть оформлення програми: світлу або темну тему (вибір зберігається автоматично)
          </p>
        </div>

        <div className="inline-flex bg-[#eef2f6] dark:bg-zinc-800/80 p-1 rounded-2xl self-start sm:self-auto gap-1">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`inline-flex items-center space-x-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              !isDark
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            <span>Світла</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`inline-flex items-center space-x-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              isDark
                ? 'bg-zinc-900 text-zinc-100 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            <span>Темна</span>
          </button>
        </div>
      </div>
    </div>
  );
};
