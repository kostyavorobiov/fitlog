import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { AuthService } from '../services/authService';
import { isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types/workout';

export const ProfileScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const isCloudConnected = isSupabaseConfigured();

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    AuthService.getCurrentUser().then(setUser);
    const unsubscribe = AuthService.onAuthStateChange(setUser);
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await AuthService.signOut();
    setUser(null);
    Alert.alert('Сесію завершено', 'Ви успішно вийшли з облікового запису.');
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
              <View style={[styles.roleBadge, isDark ? styles.badgeDark : styles.badgeLight]}>
                <Text style={[styles.roleText, isDark ? styles.badgeTextDark : styles.badgeTextLight]}>
                  Роль: {user?.role === 'coach' ? 'Тренер' : user?.role === 'admin' ? 'Адмін' : 'Атлет'}
                </Text>
              </View>
              {user?.profileCode && (
                <View style={[styles.codeBadge, isDark ? styles.badgeDark : styles.badgeLight]}>
                  <Text style={[styles.codeText, isDark ? styles.subDark : styles.subLight]}>
                    Код: {user.profileCode}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Card>

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
