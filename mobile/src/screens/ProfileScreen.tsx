import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  useColorScheme,
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
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { TraineeService } from '../services/traineeService';
import { User } from '../types/workout';

export const ProfileScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const isCloudConnected = isSupabaseConfigured();
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();

  const isCoach = user?.role === 'coach' || user?.role === 'admin';
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [coachProfile, setCoachProfile] = useState<User | null>(null);
  const [coachCodeInput, setCoachCodeInput] = useState<string>('');
  const [isLinkingCoach, setIsLinkingCoach] = useState<boolean>(false);

  // If user is an athlete with a coach, fetch coach details
  useEffect(() => {
    if (!isCoach && user?.coachId) {
      TraineeService.getCoach(user.coachId).then((coach) => {
        setCoachProfile(coach);
      });
    } else {
      setCoachProfile(null);
    }
  }, [isCoach, user?.coachId]);

  const handleCopyCode = async () => {
    const code = user?.profileCode || user?.id || '';
    if (!code) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      } else {
        await Share.share({ message: code, title: 'Код тренера' });
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.warn('[handleCopyCode] Error:', e);
    }
  };

  const handleLinkCoach = async () => {
    const clean = coachCodeInput.trim();
    if (!clean) {
      Alert.alert('Помилка', 'Введіть код або email тренера');
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
        Alert.alert('Успішно', `Ви приєдналися до тренера ${coach.name}!`);
        setCoachCodeInput('');
        await refreshUser();
      } else {
        Alert.alert('Помилка', 'Не вдалося зберегти прив’язку до тренера');
      }
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Помилка при зв’язку з сервером');
    } finally {
      setIsLinkingCoach(false);
    }
  };

  const handleUnlinkCoach = () => {
    if (!user?.id || !user?.coachId) return;

    Alert.alert(
      'Відкріпитися від тренера?',
      'Ви впевнені, що хочете відкріпитися від поточного тренера?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Відкріпитися',
          style: 'destructive',
          onPress: async () => {
            const ok = await TraineeService.unlinkTrainee(user.coachId!, user.id);
            if (ok) {
              await refreshUser();
            } else {
              Alert.alert('Помилка', 'Не вдалося відкріпитися');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    await logout();
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}
    >
      <Header title="Профіль" subtitle="Обліковий запис та синхронізація" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <Card style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons
              name="person"
              size={36}
              color={isDark ? '#e4e4e7' : '#27272a'}
            />
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, isDark ? styles.textDark : styles.textLight]}>
              {user?.name || user?.email || 'Авторизований користувач'}
            </Text>
            <Text style={[styles.userRole, isDark ? styles.subDark : styles.subLight]}>
              {user?.email || 'Спільна сесія FitLog'}
            </Text>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.roleBadge,
                  isCoach
                    ? { backgroundColor: 'rgba(2, 132, 199, 0.12)', borderColor: '#0284c7' }
                    : (isDark ? styles.badgeDark : styles.badgeLight),
                ]}
              >
                <Text
                  style={[
                    styles.roleText,
                    isCoach ? { color: '#0284c7' } : (isDark ? styles.badgeTextDark : styles.badgeTextLight),
                  ]}
                >
                  Роль: {user?.role === 'coach' ? 'Тренер' : user?.role === 'admin' ? 'Адмін' : 'Атлет'}
                </Text>
              </View>

              {user?.profileCode && (
                <TouchableOpacity
                  style={[styles.codeBadge, isDark ? styles.badgeDark : styles.badgeLight]}
                  onPress={handleCopyCode}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.codeText, isDark ? styles.subDark : styles.subLight]}>
                    Код: {user.profileCode}
                  </Text>
                  <Ionicons
                    name={copiedCode ? 'checkmark' : 'copy-outline'}
                    size={12}
                    color={copiedCode ? '#10b981' : (isDark ? '#a1a1aa' : '#71717a')}
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Card>

        {/* Coach / Trainee Section */}
        {isCoach ? (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="people-outline" size={20} color="#0284c7" />
              <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
                Тренерський кабінет
              </Text>
            </View>
            <Text style={[styles.sectionDesc, isDark ? styles.subDark : styles.subLight]}>
              Складайте персональні плани тренувань для підопічних атлетів та відстежуйте їхні результати.
            </Text>
            <Button
              title="Перейти до підопічних"
              variant="primary"
              onPress={() => router.push('/(tabs)/trainees')}
              style={{ marginTop: 4 }}
            />
          </Card>
        ) : (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="fitness-outline" size={20} color="#10b981" />
              <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
                Ваш тренер
              </Text>
            </View>

            {user?.coachId && coachProfile ? (
              <View style={styles.coachAttachedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.coachName, isDark ? styles.textDark : styles.textLight]}>
                    {coachProfile.name}
                  </Text>
                  <Text style={[styles.coachEmail, isDark ? styles.subDark : styles.subLight]}>
                    {coachProfile.email || `Код: ${coachProfile.profileCode}`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.unlinkCoachBtn}
                  onPress={handleUnlinkCoach}
                  activeOpacity={0.7}
                >
                  <Text style={styles.unlinkCoachText}>Відкріпитись</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionDesc, isDark ? styles.subDark : styles.subLight]}>
                  Приєднайтесь до тренера, щоб отримувати індивідуальні плани тренувань.
                </Text>
                <View style={styles.linkCoachRow}>
                  <TextInput
                    style={[styles.coachInput, isDark ? styles.inputDark : styles.inputLight]}
                    placeholder="Введіть код тренера..."
                    placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
                    value={coachCodeInput}
                    onChangeText={setCoachCodeInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[styles.linkBtn, isLinkingCoach && styles.linkBtnDisabled]}
                    onPress={handleLinkCoach}
                    disabled={isLinkingCoach}
                    activeOpacity={0.8}
                  >
                    {isLinkingCoach ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.linkBtnText}>Приєднатись</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Card>
        )}

        {/* Backend Status Card */}
        <Card style={styles.menuCard}>
          <View style={styles.menuItem}>
            <Ionicons
              name={isCloudConnected ? 'cloud-done' : 'cloud-offline'}
              size={22}
              color={isCloudConnected ? '#10b981' : '#f59e0b'}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuText, isDark ? styles.textDark : styles.textLight]}>
                {isCloudConnected ? 'Хмарна база Supabase активна' : 'Офлайн режим (локальний кеш)'}
              </Text>
              <Text style={[styles.menuSub, isDark ? styles.subDark : styles.subLight]}>
                {isCloudConnected
                  ? 'Зміни в мобільному додатку синхронізуються з вебверсією'
                  : 'Налаштуйте EXPO_PUBLIC_SUPABASE_URL для прямого зв’язку'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, isDark ? styles.borderDark : styles.borderLight]} />

          <View style={styles.menuItem}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#10b981" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuText, isDark ? styles.textDark : styles.textLight]}>
                Безпека сесії
              </Text>
              <Text style={[styles.menuSub, isDark ? styles.subDark : styles.subLight]}>
                Секретні ключі захищені, використовується лише публічний anon токен
              </Text>
            </View>
          </View>
        </Card>

        {user ? (
          <Button
            title="Вийти з акаунту"
            variant="outline"
            onPress={handleSignOut}
            style={styles.logoutButton}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgLight: {
    backgroundColor: '#fafafa',
  },
  bgDark: {
    backgroundColor: '#09090b',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e4e4e7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
  },
  userRole: {
    fontSize: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeLight: {
    backgroundColor: '#f4f4f5',
    borderColor: '#e4e4e7',
  },
  badgeDark: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  codeText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  badgeTextLight: {
    color: '#18181b',
  },
  badgeTextDark: {
    color: '#f4f4f5',
  },
  sectionCard: {
    padding: 16,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  coachAttachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  coachName: {
    fontSize: 14,
    fontWeight: '600',
  },
  coachEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  unlinkCoachBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef444450',
  },
  unlinkCoachText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  linkCoachRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  coachInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    borderWidth: 1,
  },
  inputLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    color: '#09090b',
  },
  inputDark: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    color: '#fafafa',
  },
  linkBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBtnDisabled: {
    opacity: 0.6,
  },
  linkBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  divider: {
    borderBottomWidth: 1,
  },
  borderLight: {
    borderBottomColor: '#f4f4f5',
  },
  borderDark: {
    borderBottomColor: '#27272a',
  },
  logoutButton: {
    marginTop: 8,
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
