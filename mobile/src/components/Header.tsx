import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { UserAvatar } from './UserAvatar';

export interface WebTopNavbarProps {
  title?: string;
  onLogoPress?: () => void;
  rightAction?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  showCoachStatus?: boolean;
  onCoachStatusPress?: () => void;
  showLogout?: boolean;
  onLogoutPress?: () => void;
  style?: any;
}

/**
 * WebTopNavbar: Matches Ocean Blue top navbar
 * - Left: Tab / Screen Title (e.g. "Тренування", "Аналітика", "Вправи", "Профіль")
 * - Right: Coach status icon, logout icon, custom action
 */
export const WebTopNavbar: React.FC<WebTopNavbarProps> = ({
  title,
  onLogoPress,
  rightAction,
  showBack = false,
  onBack,
  showCoachStatus = false,
  onCoachStatusPress,
  showLogout = false,
  onLogoutPress,
  style,
}) => {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const handleTitlePress = () => {
    if (onLogoPress) {
      onLogoPress();
    } else {
      router.push('/(tabs)');
    }
  };

  const handleBackPress = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View
      style={[
        styles.topNavbar,
        { backgroundColor: colors.bg, borderBottomColor: 'transparent' },
        Platform.OS === 'web' && ({ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any),
        style,
      ]}
    >
      {/* Left: Dynamic Current Tab Title + optional Back button */}
      <View style={styles.navLeft}>
        {showBack && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleBackPress}
            style={[styles.navBackBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleTitlePress}
          style={styles.titleButton}
          accessibilityRole="header"
          accessibilityLabel={title || 'FitLog'}
        >
          <Text style={[styles.navTitleText, { color: colors.text }]} numberOfLines={1}>
            {title || 'FitLog'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Right Header Actions: Coach status, Logout, and Custom actions */}
      <View style={styles.rightActions}>
        {showCoachStatus && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onCoachStatusPress}
            style={[styles.headerIconBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            accessibilityRole="button"
            accessibilityLabel="Підопічні"
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Ionicons name="people-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        )}
        {showLogout && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onLogoutPress}
            style={[styles.headerIconBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            accessibilityRole="button"
            accessibilityLabel="Вийти"
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        )}
        {rightAction ? rightAction : null}
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
  const { colors } = useTheme();

  if (!title && !subtitle && !rightAction) return null;

  return (
    <View style={[styles.sectionRow, style]}>
      <View style={styles.sectionTitleWrap}>
        {title ? (
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
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
  showBack?: boolean;
  onBack?: () => void;
  showCoachStatus?: boolean;
  onCoachStatusPress?: () => void;
  showLogout?: boolean;
  onLogoutPress?: () => void;
}

/**
 * Header: Unified header component providing WebTopNavbar with tab title + optional SectionHeader.
 * Stably fixed at the top of the screen to prevent scroll jitter and crashes.
 */
export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  rightAction,
  onLogoPress,
  hideTopNavbar = false,
  showBack = false,
  onBack,
  showCoachStatus = false,
  onCoachStatusPress,
  showLogout = false,
  onLogoutPress,
}) => {
  return (
    <View style={styles.wrapper}>
      {!hideTopNavbar && (
        <WebTopNavbar
          title={title}
          onLogoPress={onLogoPress}
          rightAction={!subtitle ? rightAction : undefined}
          showBack={showBack}
          onBack={onBack}
          showCoachStatus={showCoachStatus}
          onCoachStatusPress={onCoachStatusPress}
          showLogout={showLogout}
          onLogoutPress={onLogoutPress}
        />
      )}
      {subtitle ? (
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
    zIndex: 10,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerIconBtnLight: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  headerIconBtnDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderColor: '#334155',
  },
  topNavbar: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0,
  },
  topNavbarLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomColor: '#E2E8F0',
  },
  topNavbarDark: {
    backgroundColor: 'rgba(11, 18, 32, 0.95)',
    borderBottomColor: '#334155',
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  navBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleButton: {
    paddingVertical: 4,
    maxWidth: '85%',
  },
  navTitleText: {
    fontSize: 26,
    fontWeight: '800',
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
