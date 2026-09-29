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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { TraineeService } from '../services/traineeService';
import { ExerciseService } from '../services/exerciseService';
import { User, UserRole, Exercise, MuscleGroup, MUSCLE_GROUPS } from '../types/workout';

export const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const { user, logout, refreshUser, updateUserProfile, isAdmin, isCoach } = useAuth();
  const { theme, isDark, setTheme } = useTheme();
  const { handleScroll } = useScrollTabBar();

  // Profile edit state
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role || 'athlete');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Coach connection state
  const [coachProfile, setCoachProfile] = useState<User | null>(null);
  const [coachCodeInput, setCoachCodeInput] = useState('');
  const [isLinkingCoach, setIsLinkingCoach] = useState(false);
  const [traineesCount, setTraineesCount] = useState<number>(0);

  // Admin menu state (for global exercises)
  const [globalExercises, setGlobalExercises] = useState<Exercise[]>([]);
  const [isLoadingGlobalEx, setIsLoadingGlobalEx] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [newGlobalName, setNewGlobalName] = useState('');
  const [newGlobalMuscle, setNewGlobalMuscle] = useState<MuscleGroup>('chest');
  const [isAddingGlobal, setIsAddingGlobal] = useState(false);
  const [editingGlobalId, setEditingGlobalId] = useState<string | null>(null);
  const [editingGlobalName, setEditingGlobalName] = useState('');
  const [editingGlobalMuscle, setEditingGlobalMuscle] = useState<MuscleGroup>('chest');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Synchronize form when user loads/changes
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setSelectedRole(user.role);
    }
  }, [user]);

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

  // Load global exercises if admin
  const loadGlobalExercises = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingGlobalEx(true);
    try {
      const list = await ExerciseService.getGlobalExercises();
      setGlobalExercises(list);
    } catch (e) {
      console.warn('[ProfileScreen.loadGlobalExercises] Error:', e);
    } finally {
      setIsLoadingGlobalEx(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadGlobalExercises();
    }
  }, [isAdmin, loadGlobalExercises]);

  // Filtered global exercises for admin list
  const filteredGlobalExercises = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    if (!q) return globalExercises;
    return globalExercises.filter((e) => e.name.toLowerCase().includes(q));
  }, [globalExercises, adminSearch]);

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

  // Save profile changes (first name, last name, role)
  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      await updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: selectedRole,
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

  // Admin: Create new global exercise (NO equipment!)
  const handleAddGlobalExercise = async () => {
    const clean = newGlobalName.trim();
    if (!clean) {
      Alert.alert('Помилка', 'Введіть назву вправи');
      return;
    }

    setIsAddingGlobal(true);
    try {
      const res = await ExerciseService.createGlobalExercise({
        name: clean,
        muscleGroup: newGlobalMuscle,
      });

      if (res.success && res.exercise) {
        setNewGlobalName('');
        await loadGlobalExercises();
        Alert.alert('Успішно', `Вправу «${clean}» додано до глобальної бази!`);
      } else {
        Alert.alert('Помилка', res.error || 'Не вдалося створити глобальну вправу');
      }
    } finally {
      setIsAddingGlobal(false);
    }
  };

  // Admin: Start editing global exercise
  const handleStartEditGlobal = (ex: Exercise) => {
    setEditingGlobalId(ex.id);
    setEditingGlobalName(ex.name);
    setEditingGlobalMuscle(ex.muscleGroup || 'chest');
  };

  // Admin: Save edited global exercise
  const handleSaveEditGlobal = async (ex: Exercise) => {
    const clean = editingGlobalName.trim();
    if (!clean) {
      Alert.alert('Помилка', 'Назва вправи не може бути порожньою');
      return;
    }

    setIsSavingEdit(true);
    try {
      const updated: Exercise = {
        ...ex,
        name: clean,
        muscleGroup: editingGlobalMuscle,
        userId: null,
        isDefault: true,
      };

      const res = await ExerciseService.updateExercise(updated, user?.id, true);
      if (res.success) {
        setEditingGlobalId(null);
        await loadGlobalExercises();
        Alert.alert('Успішно', `Вправу «${clean}» оновлено!`);
      } else {
        Alert.alert('Помилка', res.error || 'Не вдалося оновити вправу');
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Admin: Delete global exercise
  const handleDeleteGlobal = (ex: Exercise) => {
    Alert.alert(
      'Видалити з глобальної бази?',
      `Ви впевнені, що хочете видалити «${ex.name}»? Вона зникне з загального каталогу для всіх користувачів.`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            const ok = await ExerciseService.deleteExercise(ex.id, user?.id, true);
            if (ok) {
              await loadGlobalExercises();
              Alert.alert('Успішно', `Вправу «${ex.name}» видалено`);
            } else {
              Alert.alert('Помилка', 'Не вдалося видалити вправу');
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
          <ActivityIndicator size="large" color={isDark ? '#fafafa' : '#18181b'} />
          <Text style={[styles.loadingText, isDark ? styles.subDark : styles.subLight]}>
            Завантаження профілю...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Role info styling
  const roleMeta: Record<UserRole, { title: string; color: string; bg: string }> = {
    admin: {
      title: 'Адміністратор',
      color: '#f43f5e',
      bg: isDark ? 'rgba(244, 63, 94, 0.15)' : '#ffe4e6',
    },
    coach: {
      title: 'Тренер',
      color: '#6366f1',
      bg: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
    },
    athlete: {
      title: 'Атлет',
      color: '#10b981',
      bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
    },
  };
  const currentRole = roleMeta[user.role] || roleMeta.athlete;

  const muscleOptions: MuscleGroup[] = [
    'chest',
    'back',
    'legs',
    'shoulders',
    'biceps',
    'triceps',
    'full_body',
    'other',
  ];

  return (
    <SafeAreaView edges={['top']} style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}>
      <Header
        title="Профіль"
        subtitle="Обліковий запис та налаштування"
        showAvatar={false}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* 1. Main Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeaderRow}>
            {/* UserAvatar with WD theme fallback */}
            <View style={styles.avatarWrap}>
              <UserAvatar
                image={user.image}
                name={user.name}
                size="xl"
              />
              <View style={[styles.roleBadge, { backgroundColor: currentRole.bg }]}>
                <Text style={[styles.roleBadgeText, { color: currentRole.color }]}>
                  {currentRole.title}
                </Text>
              </View>
            </View>

            {/* Basic user info: Name, email */}
            <View style={styles.profileInfoWrap}>
              <Text style={[styles.userName, isDark ? styles.textDark : styles.textLight]} numberOfLines={1}>
                {user.firstName || user.name} {user.lastName || ''}
              </Text>
              <View style={styles.emailRow}>
                <Ionicons name="mail-outline" size={14} color={isDark ? '#a1a1aa' : '#71717a'} />
                <Text style={[styles.userEmail, isDark ? styles.subDark : styles.subLight]} numberOfLines={1}>
                  {user.email || 'Немає email'}
                </Text>
              </View>

              {!isEditing && (
                <TouchableOpacity
                  style={[styles.editProfileBtn, isDark ? styles.btnOutlineDark : styles.btnOutlineLight]}
                  onPress={() => setIsEditing(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={14} color={isDark ? '#fafafa' : '#09090b'} />
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
                Редагування персональних даних
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                  Ім'я
                </Text>
                <TextInput
                  style={[styles.inputField, isDark ? styles.inputDark : styles.inputLight]}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Ім'я"
                  placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isDark ? styles.textDark : styles.textLight]}>
                  Прізвище
                </Text>
                <TextInput
                  style={[styles.inputField, isDark ? styles.inputDark : styles.inputLight]}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Прізвище"
                  placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                />
              </View>

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
                    isDark ? styles.saveBtnDark : styles.saveBtnLight,
                    isSavingProfile && styles.btnDisabled,
                  ]}
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator size="small" color={isDark ? '#09090b' : '#ffffff'} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={16} color={isDark ? '#09090b' : '#ffffff'} />
                      <Text style={[styles.saveBtnText, isDark ? styles.saveBtnTextDark : styles.saveBtnTextLight]}>
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
                color={copiedCode ? '#10b981' : (isDark ? '#fafafa' : '#09090b')}
              />
              <Text
                style={[
                  styles.copyBtnText,
                  copiedCode ? { color: '#10b981' } : (isDark ? styles.textDark : styles.textLight),
                ]}
              >
                {copiedCode ? 'Скопійовано' : 'Копіювати ID'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.idSubtext, isDark ? styles.subDark : styles.subLight]}>
            Цей ID використовується для зв'язку тренера з підопічним.
          </Text>
        </Card>

        {/* 2. Theme Settings Card */}
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
                color={!isDark ? '#09090b' : (isDark ? '#a1a1aa' : '#71717a')}
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
                color={isDark ? '#ffffff' : '#71717a'}
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

        {/* 3. Coach / Trainee Relationship Status */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionIconRow}>
            <Ionicons name="people-outline" size={18} color="#6366f1" />
            <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
              Тренерський статус
            </Text>
          </View>

          {isCoach ? (
            <View style={styles.coachStatusContent}>
              <Text style={[styles.coachStatusDesc, isDark ? styles.subDark : styles.subLight]}>
                Ви зареєстровані як <Text style={{ fontWeight: '700' }}>Тренер</Text>. Ви можете створювати та вести тренувальні плани підопічних.
              </Text>

              <View style={[styles.traineesStatRow, isDark ? styles.inputDark : styles.inputLight]}>
                <Text style={[styles.traineesStatLabel, isDark ? styles.subDark : styles.subLight]}>
                  Прив'язаних підопічних:
                </Text>
                <Text style={[styles.traineesStatValue, isDark ? styles.textDark : styles.textLight]}>
                  {traineesCount}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.goToTraineesBtn}
                onPress={() => router.push('/(tabs)/trainees')}
                activeOpacity={0.8}
              >
                <Ionicons name="list-outline" size={16} color="#ffffff" />
                <Text style={styles.goToTraineesBtnText}>Відкрити список підопічних</Text>
              </TouchableOpacity>
            </View>
          ) : user.coachId && coachProfile ? (
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
                  placeholder="Введіть код або email тренера..."
                  placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                  value={coachCodeInput}
                  onChangeText={setCoachCodeInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[
                    styles.linkCoachBtn,
                    isDark ? styles.linkCoachBtnDark : styles.linkCoachBtnLight,
                    isLinkingCoach && styles.btnDisabled,
                  ]}
                  onPress={handleLinkCoach}
                  disabled={isLinkingCoach}
                >
                  {isLinkingCoach ? (
                    <ActivityIndicator size="small" color={isDark ? '#09090b' : '#ffffff'} />
                  ) : (
                    <Text style={[styles.linkCoachBtnText, isDark ? styles.linkCoachBtnTextDark : styles.linkCoachBtnTextLight]}>
                      Прикріпитися
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>

        {/* 4. Admin Menu: Global Exercises (Visible ONLY for Administrators) */}
        {isAdmin && (
          <Card style={[styles.adminCard, isDark ? styles.adminCardDark : styles.adminCardLight]}>
            <View style={styles.adminHeaderRow}>
              <View style={styles.adminBadgeIcon}>
                <Ionicons name="shield-checkmark" size={18} color="#a855f7" />
              </View>
              <View style={styles.adminTitleWrap}>
                <View style={styles.adminTitleBadgeRow}>
                  <Text style={[styles.adminTitle, isDark ? styles.textDark : styles.textLight]}>
                    Меню адміністратора
                  </Text>
                  <View style={styles.adminRolePill}>
                    <Text style={styles.adminRolePillText}>Лише для адміна</Text>
                  </View>
                </View>
                <Text style={[styles.adminSub, isDark ? styles.subDark : styles.subLight]}>
                  Глобальне керування базою вправ (без equipment)
                </Text>
              </View>
            </View>

            {/* Add New Global Exercise Form */}
            <View style={[styles.addGlobalForm, isDark ? styles.borderTopDark : styles.borderTopLight]}>
              <Text style={[styles.addGlobalTitle, isDark ? styles.textDark : styles.textLight]}>
                Додати вправу в глобальну базу:
              </Text>

              <TextInput
                style={[styles.addGlobalInput, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="Назва вправи (наприклад: Жим штанги лежачи)"
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                value={newGlobalName}
                onChangeText={setNewGlobalName}
              />

              <Text style={[styles.muscleGroupLabel, isDark ? styles.subDark : styles.subLight]}>
                Категорія / М'язова група:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.muscleScroll}>
                {muscleOptions.map((g) => {
                  const active = newGlobalMuscle === g;
                  const info = MUSCLE_GROUPS[g];
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setNewGlobalMuscle(g)}
                      style={[
                        styles.muscleChip,
                        isDark ? styles.muscleChipDark : styles.muscleChipLight,
                        active && (isDark ? styles.muscleChipActiveDark : styles.muscleChipActiveLight),
                      ]}
                    >
                      <Text
                        style={[
                          styles.muscleChipText,
                          active ? (isDark ? styles.textDark : styles.textLight) : (isDark ? styles.subDark : styles.subLight),
                          active && { fontWeight: '700' },
                        ]}
                      >
                        {info.nameUk}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.addGlobalBtn, isAddingGlobal && styles.btnDisabled]}
                onPress={handleAddGlobalExercise}
                disabled={isAddingGlobal}
              >
                {isAddingGlobal ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="add" size={18} color="#ffffff" />
                    <Text style={styles.addGlobalBtnText}>Додати в глобальну базу</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Global Exercises List */}
            <View style={[styles.globalListContainer, isDark ? styles.borderTopDark : styles.borderTopLight]}>
              <View style={styles.listHeaderRow}>
                <Text style={[styles.listHeaderTitle, isDark ? styles.textDark : styles.textLight]}>
                  Глобальні вправи ({globalExercises.length}):
                </Text>
              </View>

              <TextInput
                style={[styles.searchInput, isDark ? styles.inputDark : styles.inputLight]}
                placeholder="Пошук глобальних вправ..."
                placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                value={adminSearch}
                onChangeText={setAdminSearch}
              />

              {isLoadingGlobalEx ? (
                <ActivityIndicator size="small" color="#a855f7" style={{ marginVertical: 16 }} />
              ) : (
                <View style={styles.exercisesListWrap}>
                  {filteredGlobalExercises.map((ex) => {
                    const isEditingThis = editingGlobalId === ex.id;
                    const mg = MUSCLE_GROUPS[ex.muscleGroup] || MUSCLE_GROUPS.other;

                    if (isEditingThis) {
                      return (
                        <View
                          key={ex.id}
                          style={[styles.editExCard, isDark ? styles.inputDark : styles.inputLight]}
                        >
                          <TextInput
                            style={[styles.editExInput, isDark ? styles.textDark : styles.textLight]}
                            value={editingGlobalName}
                            onChangeText={setEditingGlobalName}
                            placeholder="Назва вправи..."
                            placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                          />
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.muscleScroll}>
                            {muscleOptions.map((g) => {
                              const active = editingGlobalMuscle === g;
                              return (
                                <TouchableOpacity
                                  key={g}
                                  onPress={() => setEditingGlobalMuscle(g)}
                                  style={[
                                    styles.muscleChip,
                                    isDark ? styles.muscleChipDark : styles.muscleChipLight,
                                    active && (isDark ? styles.muscleChipActiveDark : styles.muscleChipActiveLight),
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.muscleChipText,
                                      active ? (isDark ? styles.textDark : styles.textLight) : (isDark ? styles.subDark : styles.subLight),
                                      active && { fontWeight: '700' },
                                    ]}
                                  >
                                    {MUSCLE_GROUPS[g].nameUk}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>

                          <View style={styles.editExActionsRow}>
                            <TouchableOpacity
                              onPress={() => setEditingGlobalId(null)}
                              style={[styles.cancelEditBtn, isDark ? styles.btnOutlineDark : styles.btnOutlineLight]}
                              disabled={isSavingEdit}
                            >
                              <Text style={[styles.cancelBtnText, isDark ? styles.textDark : styles.textLight]}>
                                Скасувати
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleSaveEditGlobal(ex)}
                              style={[
                                styles.saveEditBtn,
                                isDark ? styles.saveEditBtnDark : styles.saveEditBtnLight,
                                isSavingEdit && styles.btnDisabled,
                              ]}
                              disabled={isSavingEdit}
                            >
                              {isSavingEdit ? (
                                <ActivityIndicator size="small" color={isDark ? '#09090b' : '#ffffff'} />
                              ) : (
                                <Text style={[styles.saveBtnText, isDark ? styles.saveBtnTextDark : styles.saveBtnTextLight]}>
                                  Зберегти
                                </Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }

                    return (
                      <View
                        key={ex.id}
                        style={[styles.globalExItem, isDark ? styles.borderTopDark : styles.borderTopLight]}
                      >
                        <View style={styles.globalExTextWrap}>
                          <Text style={[styles.globalExName, isDark ? styles.textDark : styles.textLight]}>
                            {ex.name}
                          </Text>
                          <View style={[styles.muscleBadge, { backgroundColor: mg.badgeBg }]}>
                            <Text style={[styles.muscleBadgeText, { color: mg.color }]}>
                              {mg.nameUk}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.globalExButtonsRow}>
                          <TouchableOpacity
                            onPress={() => handleStartEditGlobal(ex)}
                            style={styles.iconBtn}
                          >
                            <Ionicons name="pencil-outline" size={16} color={isDark ? '#a1a1aa' : '#71717a'} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleDeleteGlobal(ex)}
                            style={styles.iconBtn}
                          >
                            <Ionicons name="trash-outline" size={16} color="#f43f5e" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </Card>
        )}

        {/* 5. Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#f43f5e" />
          <Text style={styles.logoutBtnText}>Вийти з акаунта</Text>
        </TouchableOpacity>
      </ScrollView>
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
  },
  roleBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  profileInfoWrap: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userEmail: {
    fontSize: 12,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
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
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputField: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  roleOptionText: {
    fontSize: 12,
  },
  roleOptionLight: {
    backgroundColor: '#f4f4f5',
    borderColor: '#e4e4e7',
  },
  roleOptionDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  roleOptionActiveLight: {
    borderColor: '#09090b',
    backgroundColor: '#e4e4e7',
  },
  roleOptionActiveDark: {
    borderColor: '#fafafa',
    backgroundColor: '#27272a',
  },
  formActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1.5,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
  },
  saveBtnLight: {
    backgroundColor: '#18181b',
  },
  saveBtnDark: {
    backgroundColor: '#f4f4f5',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtnTextLight: {
    color: '#ffffff',
  },
  saveBtnTextDark: {
    color: '#09090b',
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
    fontFamily: 'monospace',
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  copyBtnLight: {
    borderColor: '#e4e4e7',
    backgroundColor: '#ffffff',
  },
  copyBtnDark: {
    borderColor: '#27272a',
    backgroundColor: '#18181b',
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  idSubtext: {
    fontSize: 11,
    lineHeight: 16,
  },
  sectionCard: {
    padding: 16,
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
    borderRadius: 10,
    padding: 4,
    gap: 4,
    borderWidth: 1,
  },
  themeSegmentLight: {
    backgroundColor: '#f4f4f5',
    borderColor: '#e4e4e7',
  },
  themeSegmentDark: {
    backgroundColor: '#09090b',
    borderColor: '#27272a',
  },
  themeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: 8,
  },
  themeSegmentActiveLight: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  themeSegmentActiveDark: {
    backgroundColor: '#27272a',
  },
  themeSegmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeSegmentTextActiveLight: {
    color: '#09090b',
  },
  themeSegmentTextActiveDark: {
    color: '#ffffff',
  },
  themeSegmentTextInactive: {
    color: '#71717a',
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
    padding: 10,
    borderRadius: 8,
  },
  traineesStatLabel: {
    fontSize: 13,
  },
  traineesStatValue: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  goToTraineesBtn: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  goToTraineesBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
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
    color: '#f43f5e',
  },
  coachCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 8,
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
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  linkCoachBtn: {
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCoachBtnLight: {
    backgroundColor: '#18181b',
  },
  linkCoachBtnDark: {
    backgroundColor: '#f4f4f5',
  },
  linkCoachBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  linkCoachBtnTextLight: {
    color: '#ffffff',
  },
  linkCoachBtnTextDark: {
    color: '#09090b',
  },
  adminCard: {
    padding: 16,
    gap: 14,
    borderWidth: 1,
  },
  adminCardLight: {
    borderColor: '#e9d5ff',
  },
  adminCardDark: {
    borderColor: '#581c87',
  },
  adminHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adminBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTitleWrap: {
    flex: 1,
    gap: 2,
  },
  adminTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  adminRolePill: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminRolePillText: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '700',
  },
  adminSub: {
    fontSize: 11,
  },
  addGlobalForm: {
    paddingTop: 12,
    gap: 8,
  },
  addGlobalTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  addGlobalInput: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  muscleGroupLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  muscleScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  muscleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
  },
  muscleChipLight: {
    backgroundColor: '#f4f4f5',
    borderColor: '#e4e4e7',
  },
  muscleChipDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
  },
  muscleChipActiveLight: {
    backgroundColor: '#e0e7ff',
    borderColor: '#6366f1',
  },
  muscleChipActiveDark: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#818cf8',
  },
  muscleChipText: {
    fontSize: 11,
  },
  addGlobalBtn: {
    backgroundColor: '#09090b',
    height: 40,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  addGlobalBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  globalListContainer: {
    paddingTop: 12,
    gap: 10,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchInput: {
    height: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 12,
  },
  exercisesListWrap: {
    gap: 8,
  },
  globalExItem: {
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  globalExTextWrap: {
    flex: 1,
    gap: 4,
  },
  globalExName: {
    fontSize: 13,
    fontWeight: '600',
  },
  muscleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  muscleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  globalExButtonsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
  editExCard: {
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginVertical: 4,
  },
  editExInput: {
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: '#6366f1',
    fontSize: 13,
    paddingHorizontal: 4,
  },
  editExActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveEditBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveEditBtnLight: {
    backgroundColor: '#18181b',
  },
  saveEditBtnDark: {
    backgroundColor: '#f4f4f5',
  },
  logoutBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutBtnText: {
    color: '#f43f5e',
    fontSize: 14,
    fontWeight: '700',
  },
  btnOutlineLight: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    backgroundColor: '#ffffff',
  },
  btnOutlineDark: {
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
  },
  borderTopLight: {
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
  },
  borderTopDark: {
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  inputLight: {
    backgroundColor: '#f4f4f5',
    color: '#09090b',
  },
  inputDark: {
    backgroundColor: '#18181b',
    color: '#fafafa',
  },
  bgLight: {
    backgroundColor: '#f8fafc',
  },
  bgDark: {
    backgroundColor: '#09090b',
  },
  textLight: {
    color: '#09090b',
  },
  textDark: {
    color: '#fafafa',
  },
  subLight: {
    color: '#71717a',
  },
  subDark: {
    color: '#a1a1aa',
  },
});
