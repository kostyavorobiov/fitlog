import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserAvatar } from './UserAvatar';

export interface WebTopNavbarProps {
  onLogoPress?: () => void;
  style?: any;
}

/**
 * WebTopNavbar: Matches Web version sticky top navbar (src/components/Navbar.tsx)
 * - Left: "Workout diary" text logo
 * - Right: Theme toggle button (Sun/Moon) + UserAvatar (or "Увійти" button)
 */
export const WebTopNavbar: React.FC<WebTopNavbarProps> = ({ onLogoPress, style }) => {
  const router = useRouter();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const handleLogoPress = () => {
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
      {/* Left: Pure Flat Text Logo "Workout diary" */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleLogoPress}
        style={styles.logoButton}
        accessibilityRole="button"
        accessibilityLabel="Workout diary - на головну"
      >
        <Text style={[styles.logoText, isDark ? styles.textDark : styles.textLight]}>
          Workout diary
        </Text>
      </TouchableOpacity>

      {/* Right Header Actions: Theme Switcher & User Avatar */}
      <View style={styles.rightActions}>
        {/* Theme Toggle Button (Square 36x36 with rounded-lg 8px) */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={toggleTheme}
          style={[
            styles.themeToggleBtn,
            isDark ? styles.themeToggleDark : styles.themeToggleLight,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          {isDark ? (
            <Ionicons name="sunny-outline" size={17} color="#d4d4d8" />
          ) : (
            <Ionicons name="moon-outline" size={17} color="#52525b" />
          )}
        </TouchableOpacity>

        {/* User Auth Section */}
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
            <Text style={[styles.loginBtnText, isDark ? styles.loginTextDark : styles.loginTextLight]}>
              Увійти
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  style?: any;
}

/**
 * SectionHeader: Matches Web page title row (border-b pb-4)
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  rightAction,
  style,
}) => {
  const { isDark } = useTheme();

  return (
    <View style={[styles.sectionRow, isDark ? styles.sectionBorderDark : styles.sectionBorderLight, style]}>
      <View style={styles.sectionTitleWrap}>
        <Text style={[styles.sectionTitle, isDark ? styles.textDark : styles.textLight]}>
          {title}
        </Text>
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
 * Header: Unified header component providing WebTopNavbar + SectionHeader
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
      {!hideTopNavbar && <WebTopNavbar onLogoPress={onLogoPress} />}
      {title ? (
        <View style={styles.sectionContainer}>
          <SectionHeader
            title={title}
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
    borderBottomColor: '#e4e4e7',
  },
  topNavbarDark: {
    backgroundColor: 'rgba(9, 9, 11, 0.95)',
    borderBottomColor: '#27272a',
  },
  logoButton: {
    paddingVertical: 6,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeToggleLight: {
    borderColor: '#e4e4e7',
    backgroundColor: '#f9fafb',
  },
  themeToggleDark: {
    borderColor: '#27272a',
    backgroundColor: '#18181b',
  },
  avatarContainer: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 1,
  },
  avatarContainerLight: {
    borderColor: '#e4e4e7',
  },
  avatarContainerDark: {
    borderColor: '#3f3f46',
  },
  loginBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  loginBtnLight: {
    backgroundColor: '#18181b',
  },
  loginBtnDark: {
    backgroundColor: '#f4f4f5',
  },
  loginBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loginTextLight: {
    color: '#ffffff',
  },
  loginTextDark: {
    color: '#09090b',
  },
  sectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  sectionBorderLight: {
    borderBottomColor: '#e4e4e7',
  },
  sectionBorderDark: {
    borderBottomColor: '#27272a',
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionAction: {
    alignItems: 'flex-end',
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
