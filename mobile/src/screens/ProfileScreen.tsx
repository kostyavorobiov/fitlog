import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { TraineeService } from '../services/traineeService';
import { setSavedActiveTab } from '../components/InstagramTabPager';
import {
  User,
  UserRole,
  DEFAULT_REPS_RANGES,
  Gender,
  ActivityLevel,
  NutritionGoal,
} from '../types/workout';
import {
  calculateNutrition,
  calculateAge,
  sortRepRanges,
  validateNewRepRange,
} from '../utils/nutrition';

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 1.2, label: '1.2 — Мінімальний', desc: 'Сидячий спосіб життя, мінімум руху' },
  { value: 1.375, label: '1.375 — Низький', desc: 'Легкі тренування 1-3 рази на тиждень' },
  { value: 1.55, label: '1.55 — Помірний', desc: 'Тренування 3-5 разів на тиждень' },
  { value: 1.725, label: '1.725 — Високий', desc: 'Важкі тренування 6-7 разів на тиждень' },
  { value: 1.9, label: '1.9 — Екстремальний', desc: 'Дуже важка щоденна фізична праця або 2 тренування на день' },
];

const GOAL_OPTIONS: { value: NutritionGoal; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'weight_loss', label: 'Схуднення', icon: 'trending-down-outline' },
  { value: 'maintenance', label: 'Підтримка ваги', icon: 'remove-outline' },
  { value: 'weight_gain', label: 'Набір ваги', icon: 'trending-up-outline' },
];

export const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const { user, logout, refreshUser, updateUserProfile, isAdmin, isCoach } = useAuth();
  const { theme, isDark, setTheme } = useTheme();
  const { handleScroll } = useScrollTabBar();

  // Keep active tab on profile whenever this screen is focused
  useFocusEffect(
    useCallback(() => {
      setSavedActiveTab('profile');
    }, [])
  );

  // Coach modal state
  const [isCoachModalVisible, setIsCoachModalVisible] = useState(false);

  // Profile edit state
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role || 'athlete');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Nutrition & body edit state
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

  // Coach connection state
  const [coachProfile, setCoachProfile] = useState<User | null>(null);
  const [coachCodeInput, setCoachCodeInput] = useState('');
  const [isLinkingCoach, setIsLinkingCoach] = useState(false);
  const [traineesCount, setTraineesCount] = useState<number>(0);

  // Rep ranges state (sorted)
  const [repRanges, setRepRanges] = useState<string[]>(() => {
    return user?.customRepRanges && user.customRepRanges.length > 0
      ? sortRepRanges(user.customRepRanges)
      : sortRepRanges([...DEFAULT_REPS_RANGES]);
  });
  const [newRepRangeInput, setNewRepRangeInput] = useState('');

  // Synchronize form when user loads/changes
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

      if (user.customRepRanges && user.customRepRanges.length > 0) {
        setRepRanges(sortRepRanges(user.customRepRanges));
      }
    }
  }, [user]);

  // Real-time nutrition plan based on user profile
  const nutritionPlan = useMemo(() => {
    return calculateNutrition(user);
  }, [user]);

  // Live calculation for the edit form
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

  const handleBirthDateChange = (val: string) => {
    setBirthDate(val);
    const calculated = calculateAge(val);
    if (calculated) {
      setAge(String(calculated));
    }
  };

  const handleAddRepRange = async () => {
    const check = validateNewRepRange(repRanges, newRepRangeInput);
    if (!check.isValid) {
      Alert.alert('Помилка', check.error || 'Некоректний діапазон повторень');
      return;
    }
    const updated = sortRepRanges([...repRanges, check.formatted!]);
    setRepRanges(updated);
    setNewRepRangeInput('');
    await updateUserProfile({ customRepRanges: updated });
  };

  const handleRemoveRepRange = async (rangeToRemove: string) => {
    if (repRanges.length <= 1) {
      Alert.alert('Увага', 'Потрібно залишити щонайменше один діапазон повторень');
      return;
    }
    const updated = sortRepRanges(repRanges.filter((r) => r !== rangeToRemove));
    setRepRanges(updated);
    await updateUserProfile({ customRepRanges: updated });
  };

  const handleResetRepRanges = async () => {
    const defaults = sortRepRanges([...DEFAULT_REPS_RANGES]);
    setRepRanges(defaults);
    await updateUserProfile({ customRepRanges: defaults });
  };

  // Load coach profile or trainees count
  const loadCoachOrTrainees = useCallback(async () => {
    if (!user) return;
    if (isCoach) {
      try {
        const trainees = await TraineeService.getTrainees(user.id);
        setTraineesCount(trainees.length);
      } catch {}
    } else if (user.coachId) {
      try {
        const coach = await TraineeService.getCoach(user.coachId);
        setCoachProfile(coach);
      } catch {}
    } else {
      setCoachProfile(null);
    }
  }, [user, isCoach]);

  useEffect(() => {
    loadCoachOrTrainees();
  }, [loadCoachOrTrainees]);

  // Copy unique ID to clipboard / share
  const handleCopyCode = async () => {
    const code = user?.profileCode || user?.id || '';
    if (!code) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      } else {
        await Share.share({ message: code, title: 'Мій ID у Workout Diary' });
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.warn('[handleCopyCode] Error:', e);
    }
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      const numWeight = weight ? parseFloat(weight.replace(',', '.')) : undefined;
      const numHeight = height ? parseFloat(height.replace(',', '.')) : undefined;
      const numAge = age ? parseInt(age, 10) : calculateAge(birthDate) || undefined;
      const numAdj = calorieAdjustmentPercent ? parseFloat(calorieAdjustmentPercent.replace(',', '.')) : 0;
      const numProt = proteinPerKg ? parseFloat(proteinPerKg.replace(',', '.')) : undefined;
      const numFat = fatPerKg ? parseFloat(fatPerKg.replace(',', '.')) : undefined;

      await updateUserProfile({
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
      Alert.alert('Успішно', 'Профіль користувача оновлено!');
    } catch {
      Alert.alert('Помилка', 'Не вдалося зберегти зміни профілю');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Athlete links to coach
  const handleLinkCoach = async () => {
    const clean = coachCodeInput.trim();
    if (!clean) {
      Alert.alert('Помилка', 'Введіть ID, код або email тренера');
      return;
    }
    if (!user?.id) return;

    setIsLinkingCoach(true);
    try {
      const coach = await TraineeService.findProfileByCodeOrEmail(clean);
      if (!coach) {
        Alert.alert('Не знайдено', `Тренера з кодом "${clean}" не знайдено`);
        return;
      }

      if (coach.id === user.id) {
        Alert.alert('Помилка', 'Ви не можете призначити себе своїм тренером');
        return;
      }

      const ok = await TraineeService.assignCoach(user.id, coach.id);
      if (ok) {
        setCoachCodeInput('');
        Alert.alert('Успішно', `Ви приєдналися до тренера ${coach.name}!`);
        await refreshUser();
        await loadCoachOrTrainees();
      } else {
        Alert.alert('Помилка', 'Не вдалося зберегти прив’язку до тренера');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Помилка при зв’язку з сервером');
    } finally {
      setIsLinkingCoach(false);
    }
  };

  // Athlete unlinks from coach
  const handleUnlinkCoach = () => {
    if (!user?.id || !user?.coachId) return;

    Alert.alert(
      'Відкріпитися від тренера?',
      'Ви впевнені, що хочете відкріпитися від призначеного тренера?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Відкріпитися',
          style: 'destructive',
          onPress: async () => {
            const ok = await TraineeService.unlinkTrainee(user.coachId!, user.id);
            if (ok) {
              await refreshUser();
              setCoachProfile(null);
              Alert.alert('Успішно', 'Тренера успішно відкріплено');
            } else {
              Alert.alert('Помилка', 'Не вдалося відкріпитися від тренера');
            }
          },
        },
      ]
    );
  };

  // Logout with confirmation
  const handleLogout = () => {
    Alert.alert(
      'Вийти з акаунта?',
      'Ви дійсно бажаєте завершити сесію на цьому пристрої?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Вийти',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
        <Header title="Профіль" showAvatar={false} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
            Завантаження профілю...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Role info styling
  const roleMeta: Record<
    UserRole,
    { title: string; color: string; bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }
  > = {
    admin: {
      title: 'Адміністратор',
      color: '#ef4444',
      bg: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)',
      border: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
      icon: 'shield-checkmark',
    },
    coach: {
      title: 'Тренер',
      color: isDark ? '#60a5fa' : '#2563eb',
      bg: isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.08)',
      border: isDark ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.25)',
      icon: 'ribbon-outline',
    },
    athlete: {
      title: 'Атлет',
      color: isDark ? '#34d399' : '#059669',
      bg: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.08)',
      border: isDark ? 'rgba(52, 211, 153, 0.35)' : 'rgba(16, 185, 129, 0.25)',
      icon: 'fitness-outline',
    },
  };
  const currentRole = roleMeta[user.role] || roleMeta.athlete;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
      {/* Top Navbar with Coach Status (only for coaches/admins) and Logout icons */}
      <Header
        title="Профіль"
        showAvatar={false}
        showCoachStatus={isCoach}
        onCoachStatusPress={() => setIsCoachModalVisible(true)}
        showLogout={true}
        onLogoutPress={handleLogout}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* 1. Main Profile Card (Email removed) */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeaderRow}>
            {/* Clean prominent UserAvatar */}
            <View style={styles.avatarWrap}>
              <UserAvatar
                image={user.image}
                name={user.name}
                size="xl"
              />
            </View>

            {/* Basic user info: Name, role badge (NO EMAIL) */}
            <View style={styles.profileInfoWrap}>
              <View style={styles.nameAndRoleWrap}>
                <Text style={[styles.userName, isDark ? styles.textDark : styles.textLight]} numberOfLines={1}>
                  {user.firstName || user.name} {user.lastName || ''}
                </Text>
                <View style={[styles.rolePillBadge, { backgroundColor: currentRole.bg, borderColor: currentRole.border }]}>
                  <Ionicons name={currentRole.icon} size={13} color={currentRole.color} />
                  <Text style={[styles.rolePillText, { color: currentRole.color }]}>
                    {currentRole.title}
                  </Text>
                </View>
              </View>

              {!isEditing && (
                <TouchableOpacity
                  style={[styles.editProfileBtn, isDark ? styles.btnOutlineDark : styles.btnOutlineLight]}
                  onPress={() => setIsEditing(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={14} color={isDark ? '#f8fafc' : '#0f172a'} />
                  <Text style={[styles.editProfileBtnText, isDark ? styles.textDark : styles.textLight]}>
                    Редагувати профіль
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Profile Edit Form */}
          {isEditing && (
            <View style={[styles.editForm, isDark ? styles.borderTopDark : styles.borderTopLight]}>
              <Text style={[styles.formTitle, isDark ? styles.subDark : styles.subLight]}>
                Редагування персональних даних та цілей
              </Text>

              {/* Names */}
              <View style={styles.rowTwoInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                    Ім'я
                  </Text>
                  <TextInput
                    style={[styles.inputField, isDark ? styles.inputDark : styles.inputLight]}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Ім'я"
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                    Прізвище
                  </Text>
                  <TextInput
                    style={[styles.inputField, isDark ? styles.inputDark : styles.inputLight]}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Прізвище"
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                  />
                </View>
              </View>

              {/* Role Picker */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                  Роль користувача
                </Text>
                <View style={styles.rolePickerRow}>
                  {((isAdmin ? ['athlete', 'coach', 'admin'] : ['athlete', 'coach']) as UserRole[]).map((r) => {
                    const active = selectedRole === r;
                    const meta = roleMeta[r];
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setSelectedRole(r)}
                        style={[
                          styles.roleOptionBtn,
                          isDark ? styles.roleOptionDark : styles.roleOptionLight,
                          active && (isDark ? styles.roleOptionActiveDark : styles.roleOptionActiveLight),
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleOptionText,
                            active ? (isDark ? styles.textDark : styles.textLight) : (isDark ? styles.subDark : styles.subLight),
                            active && { fontWeight: '700' },
                          ]}
                        >
                          {meta.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Gender */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                  Стать
                </Text>
                <View style={styles.rolePickerRow}>
                  {(['male', 'female'] as Gender[]).map((g) => {
                    const active = gender === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        onPress={() => setGender(g)}
                        style={[
                          styles.roleOptionBtn,
                          isDark ? styles.roleOptionDark : styles.roleOptionLight,
                          active && (isDark ? styles.roleOptionActiveDark : styles.roleOptionActiveLight),
                        ]}
                      >
                        <Ionicons
                          name={g === 'male' ? 'male' : 'female'}
                          size={14}
                          color={active ? '#2563EB' : isDark ? '#94A3B8' : '#64748B'}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.roleOptionText,
                            active ? (isDark ? styles.textDark : styles.textLight) : (isDark ? styles.subDark : styles.subLight),
                            active && { fontWeight: '700' },
                          ]}
                        >
                          {g === 'male' ? 'Чоловіча' : 'Жіноча'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Birth Date & Age */}
              <View style={styles.rowTwoInputs}>
                <View style={[styles.inputGroup, { flex: 1.2 }]}>
                  <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                    Дата народження
                  </Text>
                  <TextInput
                    style={[styles.inputField, isDark ? styles.inputDark : styles.inputLight]}
                    value={birthDate}
                    onChangeText={handleBirthDateChange}
                    placeholder="РРРР-ММ-ДД"
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                    autoCapitalize="none"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 0.8 }]}>
                  <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                    Вік (років)
                  </Text>
                  <TextInput
                    style={[styles.inputField, isDark ? styles.inputDark : styles.inputLight]}
                    value={age}
                    onChangeText={setAge}
                    placeholder="Вік"
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Weight & Height */}
              <View style={styles.rowTwoInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                    Вага (кг)
                  </Text>
                  <TextInput
                    style={[styles.inputField, isDark ? styles.inputDark : styles.inputLight]}
                    value={weight}
                    onChangeText={setWeight}
                    placeholder="Напр. 75.5"
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                    Зріст (см)
                  </Text>
                  <TextInput
                    style={[styles.inputField, isDark ? styles.inputDark : styles.inputLight]}
                    value={height}
                    onChangeText={setHeight}
                    placeholder="Напр. 180"
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Activity Level */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                  Рівень фізичної активності
                </Text>
                <View style={{ gap: 6 }}>
                  {ACTIVITY_OPTIONS.map((opt) => {
                    const active = activityLevel === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setActivityLevel(opt.value)}
                        style={[
                          styles.activityOptionCard,
                          isDark ? styles.roleOptionDark : styles.roleOptionLight,
                          active && (isDark ? styles.roleOptionActiveDark : styles.roleOptionActiveLight),
                        ]}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.activityOptionTitle,
                              active ? (isDark ? styles.textDark : styles.textLight) : (isDark ? styles.subDark : styles.subLight),
                              active && { fontWeight: '700' },
                            ]}
                          >
                            {opt.label}
                          </Text>
                          <Text style={[styles.activityOptionDesc, isDark ? styles.subDark : styles.subLight]}>
                            {opt.desc}
                          </Text>
                        </View>
                        {active && <Ionicons name="checkmark-circle" size={18} color="#2563EB" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Goal */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                  Ціль
                </Text>
                <View style={styles.rolePickerRow}>
                  {GOAL_OPTIONS.map((g) => {
                    const active = goal === g.value;
                    return (
                      <TouchableOpacity
                        key={g.value}
                        onPress={() => setGoal(g.value)}
                        style={[
                          styles.roleOptionBtn,
                          isDark ? styles.roleOptionDark : styles.roleOptionLight,
                          active && (isDark ? styles.roleOptionActiveDark : styles.roleOptionActiveLight),
                        ]}
                      >
                        <Ionicons
                          name={g.icon}
                          size={13}
                          color={active ? '#2563EB' : isDark ? '#94A3B8' : '#64748B'}
                          style={{ marginRight: 3 }}
                        />
                        <Text
                          style={[
                            styles.roleOptionText,
                            active ? (isDark ? styles.textDark : styles.textLight) : (isDark ? styles.subDark : styles.subLight),
                            active && { fontWeight: '700' },
                          ]}
                          numberOfLines={1}
                        >
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Calorie Deficit / Surplus % (ONLY if weight loss or weight gain) */}
              {goal !== 'maintenance' && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                    {goal === 'weight_loss' ? 'Дефіцит калорій (%)' : 'Профіцит калорій (%)'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      style={[styles.inputField, { flex: 1 }, isDark ? styles.inputDark : styles.inputLight]}
                      value={calorieAdjustmentPercent}
                      onChangeText={setCalorieAdjustmentPercent}
                      placeholder="Напр. 15"
                      placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                      keyboardType="numeric"
                    />
                    {/* Quick percentage chips */}
                    {['10', '15', '20'].map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setCalorieAdjustmentPercent(p)}
                        style={[
                          styles.percentChip,
                          calorieAdjustmentPercent === p && styles.percentChipActive,
                          isDark ? styles.chipDark : styles.chipLight,
                        ]}
                      >
                        <Text
                          style={[
                            styles.percentChipText,
                            calorieAdjustmentPercent === p && { color: '#ffffff', fontWeight: '700' },
                            isDark ? styles.textDark : styles.textLight,
                          ]}
                        >
                          {p}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Protein & Fat per kg */}
              <View style={styles.rowTwoInputs}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                    Білки (г/кг)
                  </Text>
                  <TextInput
                    style={[styles.inputField, isDark ? styles.inputDark : styles.inputLight]}
                    value={proteinPerKg}
                    onChangeText={setProteinPerKg}
                    placeholder="2.0"
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                    Жири (г/кг)
                  </Text>
                  <TextInput
                    style={[styles.inputField, isDark ? styles.inputDark : styles.inputLight]}
                    value={fatPerKg}
                    onChangeText={setFatPerKg}
                    placeholder="1.0"
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Auto Carbs Preview & Live Validation */}
              <View style={[styles.livePreviewCard, isDark ? styles.livePreviewDark : styles.livePreviewLight]}>
                <View style={styles.livePreviewRow}>
                  <Text style={[styles.livePreviewLabel, isDark ? styles.subDark : styles.subLight]}>
                    Вуглеводи (розраховуються авто):
                  </Text>
                  <Text style={[styles.livePreviewVal, isDark ? styles.textDark : styles.textLight]}>
                    {liveFormNutrition.carbsGrams} г/день ({liveFormNutrition.carbsPerKg} г/кг)
                  </Text>
                </View>

                {liveFormNutrition.validationError && (
                  <View style={styles.validationErrorBox}>
                    <Ionicons name="warning-outline" size={14} color="#ef4444" />
                    <Text style={styles.validationErrorText}>
                      {liveFormNutrition.validationError}
                    </Text>
                  </View>
                )}
              </View>

              {/* Form Action Buttons */}
              <View style={styles.formActionsRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, isDark ? styles.btnOutlineDark : styles.btnOutlineLight]}
                  onPress={() => setIsEditing(false)}
                  disabled={isSavingProfile}
                >
                  <Text style={[styles.cancelBtnText, isDark ? styles.textDark : styles.textLight]}>
                    Скасувати
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    isSavingProfile && styles.btnDisabled,
                  ]}
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                      <Text style={styles.saveBtnText}>
                        Зберегти зміни
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Unique Profile ID & Copy */}
          <View style={[styles.profileIdRow, isDark ? styles.borderTopDark : styles.borderTopLight]}>
            <View style={styles.idTextGroup}>
              <Text style={[styles.idLabel, isDark ? styles.subDark : styles.subLight]}>
                Унікальний ID профілю:
              </Text>
              <Text style={[styles.idValue, isDark ? styles.textDark : styles.textLight]}>
                {user.profileCode || user.id}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.copyBtn, isDark ? styles.copyBtnDark : styles.copyBtnLight]}
              onPress={handleCopyCode}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copiedCode ? 'checkmark' : 'copy-outline'}
                size={14}
                color={copiedCode ? '#22c55e' : (isDark ? '#f8fafc' : '#0f172a')}
              />
              <Text
                style={[
                  styles.copyBtnText,
                  copiedCode ? { color: '#22c55e' } : (isDark ? styles.textDark : styles.textLight),
                ]}
              >
                {copiedCode ? 'Скопійовано' : 'Копіювати ID'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* 2. Compact Nutrition Results Card: Immediately after Main Profile Card */}
        <Card style={styles.nutritionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <View style={styles.sectionIconRow}>
                <Ionicons name="flame-outline" size={18} color="#f97316" />
                <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
                  Ккалорії, білки, жири та вуглеводи
                </Text>
              </View>
              {nutritionPlan.isComplete && (
                <Text style={[styles.sectionSubtitle, isDark ? styles.subDark : styles.subLight]}>
                  BMR: {nutritionPlan.bmr} ккал · TDEE: {nutritionPlan.tdee} ккал
                </Text>
              )}
            </View>
          </View>

          {nutritionPlan.isComplete ? (
            <View style={{ gap: 10 }}>
              {/* 4 Metric Boxes */}
              <View style={styles.nutritionGrid}>
                {/* Calories */}
                <View style={[styles.nutritionBox, isDark ? styles.nutriBoxDark : styles.nutriBoxLight]}>
                  <View style={styles.nutriIconHeader}>
                    <Ionicons name="flame" size={15} color="#f97316" />
                    <Text style={[styles.nutriLabel, isDark ? styles.subDark : styles.subLight]}>
                      Калорії
                    </Text>
                  </View>
                  <Text style={[styles.nutriVal, { color: '#f97316' }]}>
                    {nutritionPlan.targetCalories}
                  </Text>
                  <Text style={[styles.nutriSub, isDark ? styles.subDark : styles.subLight]}>
                    ккал / день
                  </Text>
                </View>

                {/* Protein */}
                <View style={[styles.nutritionBox, isDark ? styles.nutriBoxDark : styles.nutriBoxLight]}>
                  <View style={styles.nutriIconHeader}>
                    <Ionicons name="barbell-outline" size={15} color="#f43f5e" />
                    <Text style={[styles.nutriLabel, isDark ? styles.subDark : styles.subLight]}>
                      Білки
                    </Text>
                  </View>
                  <Text style={[styles.nutriVal, { color: '#f43f5e' }]}>
                    {nutritionPlan.proteinGrams}г
                  </Text>
                  <Text style={[styles.nutriSub, isDark ? styles.subDark : styles.subLight]}>
                    {nutritionPlan.proteinPerKg} г/кг
                  </Text>
                </View>

                {/* Fat */}
                <View style={[styles.nutritionBox, isDark ? styles.nutriBoxDark : styles.nutriBoxLight]}>
                  <View style={styles.nutriIconHeader}>
                    <Ionicons name="water-outline" size={15} color="#eab308" />
                    <Text style={[styles.nutriLabel, isDark ? styles.subDark : styles.subLight]}>
                      Жири
                    </Text>
                  </View>
                  <Text style={[styles.nutriVal, { color: '#eab308' }]}>
                    {nutritionPlan.fatGrams}г
                  </Text>
                  <Text style={[styles.nutriSub, isDark ? styles.subDark : styles.subLight]}>
                    {nutritionPlan.fatPerKg} г/кг
                  </Text>
                </View>

                {/* Carbs */}
                <View style={[styles.nutritionBox, isDark ? styles.nutriBoxDark : styles.nutriBoxLight]}>
                  <View style={styles.nutriIconHeader}>
                    <Ionicons name="leaf-outline" size={15} color="#0ea5e9" />
                    <Text style={[styles.nutriLabel, isDark ? styles.subDark : styles.subLight]}>
                      Вуглеводи
                    </Text>
                  </View>
                  <Text style={[styles.nutriVal, { color: '#0ea5e9' }]}>
                    {nutritionPlan.carbsGrams}г
                  </Text>
                  <Text style={[styles.nutriSub, isDark ? styles.subDark : styles.subLight]}>
                    {nutritionPlan.carbsPerKg} г/кг
                  </Text>
                </View>
              </View>

              {nutritionPlan.validationError && (
                <View style={styles.validationErrorBox}>
                  <Ionicons name="warning-outline" size={15} color="#ef4444" />
                  <Text style={styles.validationErrorText}>
                    {nutritionPlan.validationError}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyNutritionPrompt}>
              <Ionicons name="information-circle-outline" size={24} color="#2563EB" />
              <Text style={[styles.emptyPromptText, isDark ? styles.subDark : styles.subLight]}>
                Заповніть параметри профілю (стать, вік, вагу, зріст, активність, ціль та БЖВ) для автоматичного розрахунку норм за формулою Mifflin–St Jeor.
              </Text>
              {!isEditing && (
                <TouchableOpacity
                  style={styles.fillProfileBtn}
                  onPress={() => setIsEditing(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.fillProfileBtnText}>Заповнити профіль</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Card>

        {/* 3. Coach / Trainee Connection (only shown for athletes without top coach navbar icon) */}
        {!isCoach && (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionIconRow}>
              <Ionicons name="people-outline" size={18} color={isDark ? '#60a5fa' : '#2563eb'} />
              <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
                Ваш тренер
              </Text>
            </View>

            {user.coachId && coachProfile ? (
              <View style={styles.coachStatusContent}>
                <View style={styles.coachHeaderRow}>
                  <Text style={[styles.coachLabel, isDark ? styles.subDark : styles.subLight]}>
                    Ваш призначений тренер:
                  </Text>
                  <TouchableOpacity onPress={handleUnlinkCoach} activeOpacity={0.7}>
                    <Text style={styles.unlinkText}>Відкріпитися</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.coachCardInner, isDark ? styles.inputDark : styles.inputLight]}>
                  <UserAvatar image={coachProfile.image} name={coachProfile.name} size="md" />
                  <View style={styles.coachInfoText}>
                    <Text style={[styles.coachName, isDark ? styles.textDark : styles.textLight]}>
                      {coachProfile.name}
                    </Text>
                    <Text style={[styles.coachEmail, isDark ? styles.subDark : styles.subLight]}>
                      {coachProfile.email}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.coachStatusContent}>
                <Text style={[styles.coachStatusDesc, isDark ? styles.subDark : styles.subLight]}>
                  У вас немає призначеного тренера. Повідомте ваш персональний код тренеру або прикріпіться за його кодом:
                </Text>

                <View style={styles.linkCoachRow}>
                  <TextInput
                    style={[styles.linkCoachInput, isDark ? styles.inputDark : styles.inputLight]}
                    placeholder="Введіть код тренера..."
                    placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                    value={coachCodeInput}
                    onChangeText={setCoachCodeInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[
                      styles.linkCoachBtn,
                      isLinkingCoach && styles.btnDisabled,
                    ]}
                    onPress={handleLinkCoach}
                    disabled={isLinkingCoach}
                  >
                    {isLinkingCoach ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.linkCoachBtnText}>
                        Прикріпитися
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Card>
        )}

        {/* 4. Rep Ranges Settings Card (Auto-sorted, duplicate/overlap validated, fixed tab switching) */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <View style={styles.sectionIconRow}>
                <Ionicons
                  name="repeat-outline"
                  size={18}
                  color={isDark ? '#60a5fa' : '#2563eb'}
                />
                <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
                  Діапазони повторень
                </Text>
              </View>
              <Text style={[styles.sectionSubtitle, isDark ? styles.subDark : styles.subLight]}>
                Автоматично впорядковані діапазони підходів для швидкого вибору під час тренувань
              </Text>
            </View>
          </View>

          {/* Current Ranges Pills */}
          <View style={styles.rangesPillsContainer}>
            {repRanges.map((rng) => (
              <View
                key={rng}
                style={[styles.rangePill, isDark ? styles.rangePillDark : styles.rangePillLight]}
              >
                <Text style={[styles.rangePillText, isDark ? styles.textDark : styles.textLight]}>
                  {rng}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemoveRepRange(rng)}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  style={styles.rangeDeleteBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Add New Range Row */}
          <View style={styles.addRangeRow}>
            <TextInput
              style={[styles.addRangeInput, isDark ? styles.inputDark : styles.inputLight]}
              placeholder="Напр. 12-15 або 20+"
              placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
              value={newRepRangeInput}
              onChangeText={setNewRepRangeInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleAddRepRange}
            />
            <TouchableOpacity
              style={[styles.addRangeBtn, !newRepRangeInput.trim() && styles.btnDisabled]}
              onPress={handleAddRepRange}
              disabled={!newRepRangeInput.trim()}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text style={styles.addRangeBtnText}>Додати</Text>
            </TouchableOpacity>
          </View>

          {/* Reset to Defaults */}
          <TouchableOpacity
            style={styles.resetRangesBtn}
            onPress={handleResetRepRanges}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={14} color={isDark ? '#94a3b8' : '#64748b'} />
            <Text style={[styles.resetRangesBtnText, isDark ? styles.subDark : styles.subLight]}>
              Скинути до стандартних
            </Text>
          </TouchableOpacity>
        </Card>

        {/* 5. Theme Settings Card: MOVED TO VERY BOTTOM OF PAGE */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <View style={styles.sectionIconRow}>
                <Ionicons
                  name={isDark ? 'moon-outline' : 'sunny-outline'}
                  size={18}
                  color={isDark ? '#f59e0b' : '#d97706'}
                />
                <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
                  Тема інтерфейсу
                </Text>
              </View>
              <Text style={[styles.sectionSubtitle, isDark ? styles.subDark : styles.subLight]}>
                Виберіть оформлення: світлу або темну тему (зберігається автоматично)
              </Text>
            </View>
          </View>

          {/* Segmented Light / Dark Switcher */}
          <View style={[styles.themeSegmentContainer, isDark ? styles.themeSegmentDark : styles.themeSegmentLight]}>
            <TouchableOpacity
              style={[
                styles.themeSegmentBtn,
                !isDark && styles.themeSegmentActiveLight,
              ]}
              onPress={() => setTheme('light')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="sunny-outline"
                size={16}
                color={!isDark ? '#2563eb' : (isDark ? '#94a3b8' : '#64748b')}
              />
              <Text
                style={[
                  styles.themeSegmentBtnText,
                  !isDark ? styles.themeSegmentTextActiveLight : styles.themeSegmentTextInactive,
                ]}
              >
                Світла
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeSegmentBtn,
                isDark && styles.themeSegmentActiveDark,
              ]}
              onPress={() => setTheme('dark')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="moon-outline"
                size={16}
                color={isDark ? '#60a5fa' : '#64748b'}
              />
              <Text
                style={[
                  styles.themeSegmentBtnText,
                  isDark ? styles.themeSegmentTextActiveDark : styles.themeSegmentTextInactive,
                ]}
              >
                Темна
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>

      {/* Coach Status Info Modal */}
      <Modal
        visible={isCoachModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCoachModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark ? styles.modalDark : styles.modalLight]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="ribbon-outline" size={22} color="#2563EB" />
                <Text style={[styles.modalTitle, isDark ? styles.textDark : styles.textLight]}>
                  Тренерський статус
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsCoachModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDesc, isDark ? styles.subDark : styles.subLight]}>
              Ви зареєстровані як <Text style={{ fontWeight: '700', color: isDark ? '#60A5FA' : '#2563EB' }}>Тренер</Text>.
              Ви маєте повний доступ до тренувальних програм і статистики підопічних.
            </Text>

            {/* Code */}
            <View style={[styles.coachCodeBox, isDark ? styles.inputDark : styles.inputLight]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.coachCodeLabel, isDark ? styles.subDark : styles.subLight]}>
                  Ваш код тренера:
                </Text>
                <Text style={[styles.coachCodeVal, isDark ? styles.textDark : styles.textLight]}>
                  {user.profileCode || user.id}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.copyBtn, isDark ? styles.copyBtnDark : styles.copyBtnLight]}
                onPress={handleCopyCode}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={copiedCode ? 'checkmark' : 'copy-outline'}
                  size={14}
                  color={copiedCode ? '#22c55e' : (isDark ? '#f8fafc' : '#0f172a')}
                />
                <Text
                  style={[
                    styles.copyBtnText,
                    copiedCode ? { color: '#22c55e' } : (isDark ? styles.textDark : styles.textLight),
                  ]}
                >
                  {copiedCode ? 'Скопійовано' : 'Копіювати'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Trainees count */}
            <View style={[styles.traineesStatRow, isDark ? styles.inputDark : styles.inputLight]}>
              <Text style={[styles.traineesStatLabel, isDark ? styles.subDark : styles.subLight]}>
                Кількість підопічних:
              </Text>
              <Text style={[styles.traineesStatValue, isDark ? styles.textDark : styles.textLight]}>
                {traineesCount}
              </Text>
            </View>

            {/* Open Trainees Button */}
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => {
                setIsCoachModalVisible(false);
                router.push('/trainees');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="list-outline" size={18} color="#ffffff" />
              <Text style={styles.modalPrimaryBtnText}>Перейти до підопічних</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 110,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  profileCard: {
    padding: 16,
    gap: 14,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarWrap: {
    position: 'relative',
    alignSelf: 'center',
  },
  nameAndRoleWrap: {
    gap: 6,
    alignItems: 'flex-start',
  },
  rolePillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  profileInfoWrap: {
    flex: 1,
    gap: 6,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    marginTop: 6,
    borderWidth: 1,
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editForm: {
    paddingTop: 12,
    gap: 10,
  },
  formTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowTwoInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputField: {
    height: 42,
    borderRadius: 14,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 9,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  roleOptionText: {
    fontSize: 12,
  },
  roleOptionLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  roleOptionDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  roleOptionActiveLight: {
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  roleOptionActiveDark: {
    borderColor: '#60a5fa',
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  activityOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  activityOptionTitle: {
    fontSize: 13,
  },
  activityOptionDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  percentChip: {
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  percentChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  chipDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
  },
  livePreviewCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    marginTop: 4,
  },
  livePreviewLight: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  livePreviewDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  livePreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  livePreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  livePreviewVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  validationErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  validationErrorText: {
    flex: 1,
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1.5,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#2563eb',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  profileIdRow: {
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  idTextGroup: {
    flex: 1,
  },
  idLabel: {
    fontSize: 11,
  },
  idValue: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  copyBtnLight: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
  },
  copyBtnDark: {
    borderColor: '#334155',
    backgroundColor: '#263140',
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nutritionCard: {
    padding: 16,
    gap: 12,
  },
  nutritionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  nutritionBox: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  nutriBoxLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  nutriBoxDark: {
    backgroundColor: '#172233',
    borderColor: '#26354a',
  },
  nutriIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  nutriLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  nutriVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  nutriSub: {
    fontSize: 10,
  },
  emptyNutritionPrompt: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 8,
  },
  emptyPromptText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  fillProfileBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    marginTop: 4,
  },
  fillProfileBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    padding: 16,
    borderRadius: 18,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitleWrap: {
    gap: 4,
  },
  sectionIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  themeSegmentContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 4,
    gap: 4,
  },
  themeSegmentLight: {
    backgroundColor: '#f1f5f9',
  },
  themeSegmentDark: {
    backgroundColor: '#263140',
  },
  themeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    gap: 6,
    borderRadius: 14,
  },
  themeSegmentActiveLight: {
    backgroundColor: '#ffffff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  themeSegmentActiveDark: {
    backgroundColor: '#1d2939',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  themeSegmentBtnText: {
    fontSize: 13,
  },
  themeSegmentTextActiveLight: {
    color: '#2563eb',
    fontWeight: '700',
  },
  themeSegmentTextActiveDark: {
    color: '#60a5fa',
    fontWeight: '700',
  },
  themeSegmentTextInactive: {
    color: '#64748b',
    fontWeight: '600',
  },
  coachStatusContent: {
    gap: 10,
  },
  coachStatusDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  traineesStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  traineesStatLabel: {
    fontSize: 13,
  },
  traineesStatValue: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  coachHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coachLabel: {
    fontSize: 12,
  },
  unlinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  coachCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
  },
  coachInfoText: {
    flex: 1,
    gap: 2,
  },
  coachName: {
    fontSize: 14,
    fontWeight: '700',
  },
  coachEmail: {
    fontSize: 11,
  },
  linkCoachRow: {
    flexDirection: 'row',
    gap: 8,
  },
  linkCoachInput: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    paddingHorizontal: 12,
    fontSize: 13,
    borderWidth: 1,
  },
  linkCoachBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  linkCoachBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  btnOutlineLight: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  btnOutlineDark: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1d2939',
  },
  borderTopLight: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  borderTopDark: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  inputLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#0f172a',
  },
  inputDark: {
    backgroundColor: '#0b1220',
    borderColor: '#334155',
    color: '#f8fafc',
  },
  bgLight: {
    backgroundColor: '#f8fafc',
  },
  bgDark: {
    backgroundColor: '#0b1220',
  },
  textLight: {
    color: '#0f172a',
  },
  textDark: {
    color: '#f8fafc',
  },
  subLight: {
    color: '#64748b',
  },
  subDark: {
    color: '#94a3b8',
  },
  rangesPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  rangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  rangePillLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  rangePillDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  rangePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rangeDeleteBtn: {
    padding: 1,
  },
  addRangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  addRangeInput: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  addRangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 14,
  },
  addRangeBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  resetRangesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginTop: 2,
  },
  resetRangesBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 22,
    padding: 20,
    gap: 16,
    borderWidth: 1,
  },
  modalLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  modalDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  coachCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  coachCodeLabel: {
    fontSize: 11,
  },
  coachCodeVal: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  modalPrimaryBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 4,
  },
  modalPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
