import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useAppColorScheme } from '../context/ThemeContext';
import { UserAvatar } from './UserAvatar';

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  showAvatar?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  rightAction,
  showAvatar = true,
}) => {
  const isDark = useAppColorScheme() === 'dark';
  const router = useRouter();
  const { user } = useAuth();

  return (
    <View style={[styles.container, isDark ? styles.borderDark : styles.borderLight]}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, isDark ? styles.subDark : styles.subLight]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAction ? (
        <View style={styles.actionContainer}>{rightAction}</View>
      ) : showAvatar && user ? (
        <View style={styles.actionContainer}>
          <UserAvatar
            image={user.image}
            name={user.name}
            size="sm"
            onPress={() => router.push('/(tabs)/profile')}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  borderLight: {
    borderBottomColor: '#f4f4f5',
  },
  borderDark: {
    borderBottomColor: '#27272a',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  textLight: {
    color: '#09090b',
  },
  textDark: {
    color: '#fafafa',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  subLight: {
    color: '#71717a',
  },
  subDark: {
    color: '#a1a1aa',
  },
  actionContainer: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
