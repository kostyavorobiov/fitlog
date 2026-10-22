import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserAvatar } from './UserAvatar';

export interface WebTopNavbarProps {
  title?: string;
  onLogoPress?: () => void;
  style?: any;
}

/**
 * WebTopNavbar: Matches Ocean Blue top navbar
 * - Left: Tab / Screen Title (e.g. "Тренування", "Аналітика", "Профіль")
 * - Right: UserAvatar (or "Увійти" button)
 * - Removed: "Workout diary / FitLog" brand name & Theme switcher
 */
export const WebTopNavbar: React.FC<WebTopNavbarProps> = ({ title, onLogoPress, style }) => {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark } = useTheme();

  const handleTitlePress = () => {
    if (onLogoPress) {
      onLogoPress();
    } else {
      router.push('/(tabs)');
    }
  };

  const handleAvatarPress = () => {
    router.push('/(tabs)/profile');
  };

  const handleLoginPress = () => {
    router.push('/(auth)/login');
  };

  return (
    <View
      style={[
        styles.topNavbar,
        isDark ? styles.topNavbarDark : styles.topNavbarLight,
        Platform.OS === 'web' && ({ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any),
        style,
      ]}
    >
      {/* Left: Dynamic Current Tab Title */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleTitlePress}
        style={styles.titleButton}
        accessibilityRole="header"
        accessibilityLabel={title || 'FitLog'}
      >
        <Text style={[styles.navTitleText, isDark ? styles.textDark : styles.textLight]} numberOfLines={1}>
          {title || 'FitLog'}
        </Text>
      </TouchableOpacity>

      {/* Right Header Actions: User Avatar only (Theme toggle removed) */}
      <View style={styles.rightActions}>
        {user ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAvatarPress}
            style={[
              styles.avatarContainer,
              isDark ? styles.avatarContainerDark : styles.avatarContainerLight,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Мій профіль"
          >
            <UserAvatar
              image={user.image}
              name={user.name}
              size="sm"
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLoginPress}
            style={[
              styles.loginBtn,
              isDark ? styles.loginBtnDark : styles.loginBtnLight,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Увійти"
          >
            <Text style={styles.loginBtnText}>
              Увійти
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export interface SectionHeaderProps {
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  style?: any;
}

/**
 * SectionHeader: Subtitle and action controls row (e.g. period selector or filters)
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  rightAction,
  style,
}) => {
  const { isDark } = useTheme();

  if (!title && !subtitle && !rightAction) return null;

  return (
    <View style={[styles.sectionRow, isDark ? styles.sectionBorderDark : styles.sectionBorderLight, style]}>
      <View style={styles.sectionTitleWrap}>
        {title ? (
          <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, isDark ? styles.subDark : styles.subLight]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAction ? <View style={styles.sectionAction}>{rightAction}</View> : null}
    </View>
  );
};

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  showAvatar?: boolean;
  onLogoPress?: () => void;
  hideTopNavbar?: boolean;
}

/**
 * Header: Unified header component providing WebTopNavbar with tab title + optional SectionHeader
 */
export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  rightAction,
  onLogoPress,
  hideTopNavbar = false,
}) => {
  return (
    <View style={styles.wrapper}>
      {!hideTopNavbar && <WebTopNavbar title={title} onLogoPress={onLogoPress} />}
      {subtitle || rightAction ? (
        <View style={styles.sectionContainer}>
          <SectionHeader
            subtitle={subtitle}
            rightAction={rightAction}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  topNavbar: {
    height: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  topNavbarLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomColor: '#E2E8F0',
  },
  topNavbarDark: {
    backgroundColor: 'rgba(11, 18, 32, 0.95)',
    borderBottomColor: '#334155',
  },
  titleButton: {
    paddingVertical: 6,
    maxWidth: '75%',
  },
  navTitleText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarContainer: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 1,
  },
  avatarContainerLight: {
    borderColor: '#E2E8F0',
  },
  avatarContainerDark: {
    borderColor: '#334155',
  },
  loginBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  loginBtnLight: {
    backgroundColor: '#2563EB',
  },
  loginBtnDark: {
    backgroundColor: '#2563EB',
  },
  loginBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionBorderLight: {
    borderBottomColor: '#E2E8F0',
  },
  sectionBorderDark: {
    borderBottomColor: '#334155',
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionAction: {
    flexShrink: 0,
  },
  textLight: {
    color: '#0F172A',
  },
  textDark: {
    color: '#F8FAFC',
  },
  subLight: {
    color: '#64748B',
  },
  subDark: {
    color: '#94A3B8',
  },
});
