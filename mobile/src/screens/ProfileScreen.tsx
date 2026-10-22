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
import { User, UserRole } from '../types/workout';

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
  const roleMeta: Record<UserRole, { title: string; color: string; bg: string }> = {
    admin: {
      title: 'Адміністратор',
      color: '#ef4444',
      bg: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
    },
    coach: {
      title: 'Тренер',
      color: isDark ? '#60a5fa' : '#2563eb',
      bg: isDark ? 'rgba(37, 99, 235, 0.25)' : 'rgba(37, 99, 235, 0.1)',
    },
    athlete: {
      title: 'Атлет',
      color: isDark ? '#60a5fa' : '#2563eb',
      bg: isDark ? 'rgba(96, 165, 250, 0.15)' : 'rgba(37, 99, 235, 0.08)',
    },
  };
  const currentRole = roleMeta[user.role] || roleMeta.athlete;

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
                <Ionicons name="mail-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} />
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
                  placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
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
                  placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
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

        {/* 3. Coach / Trainee Relationship Status */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionIconRow}>
            <Ionicons name="people-outline" size={18} color={isDark ? '#60a5fa' : '#2563eb'} />
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

        {/* 4. Logout Button */}
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
    bottom: -6,
    left: -4,
    right: -4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    marginTop: 6,
    borderWidth: 1,
  },
  editProfileBtnLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  editProfileBtnDark: {
    backgroundColor: '#263140',
    borderColor: '#334155',
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
    paddingVertical: 9,
    borderRadius: 14,
    alignItems: 'center',
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
  formActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
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
    fontFamily: 'monospace',
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
  idSubtext: {
    fontSize: 11,
    lineHeight: 16,
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
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
  },
  goToTraineesBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
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
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 14,
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
});
