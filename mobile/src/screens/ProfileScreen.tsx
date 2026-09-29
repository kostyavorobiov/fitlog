import React from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

export const ProfileScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, isDark ? styles.bgDark : styles.bgLight]}
    >
      <Header title="Профіль" subtitle="Налаштування облікового запису" />

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
              Користувач Workout Diary
            </Text>
            <Text style={[styles.userRole, isDark ? styles.subDark : styles.subLight]}>
              Роль: Атлет
            </Text>
          </View>
        </Card>

        {/* Options list */}
        <Card style={styles.menuCard}>
          <View style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={20} color={isDark ? '#e4e4e7' : '#27272a'} />
            <Text style={[styles.menuText, isDark ? styles.textDark : styles.textLight]}>
              Сповіщення
            </Text>
          </View>
          <View style={[styles.divider, isDark ? styles.borderDark : styles.borderLight]} />
          <View style={styles.menuItem}>
            <Ionicons name="cloud-outline" size={20} color={isDark ? '#e4e4e7' : '#27272a'} />
            <Text style={[styles.menuText, isDark ? styles.textDark : styles.textLight]}>
              Синхронізація з Supabase
            </Text>
          </View>
          <View style={[styles.divider, isDark ? styles.borderDark : styles.borderLight]} />
          <View style={styles.menuItem}>
            <Ionicons name="shield-checkmark-outline" size={20} color={isDark ? '#e4e4e7' : '#27272a'} />
            <Text style={[styles.menuText, isDark ? styles.textDark : styles.textLight]}>
              Безпека та конфіденційність
            </Text>
          </View>
        </Card>

        <Button title="Вийти" variant="outline" style={styles.logoutButton} />
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
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e4e4e7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
  },
  userRole: {
    fontSize: 13,
    marginTop: 2,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
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
