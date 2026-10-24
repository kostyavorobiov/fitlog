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
  style?: any;
}

/**
 * WebTopNavbar: Matches Ocean Blue top navbar
 * - Left: Tab / Screen Title (e.g. "Тренування", "Аналітика", "Вправи", "Профіль")
 * - Profile button moved into bottom navbar (old button removed from top)
 */
export const WebTopNavbar: React.FC<WebTopNavbarProps> = ({
  title,
  onLogoPress,
  rightAction,
  showBack = false,
  onBack,
  style,
}) => {
  const router = useRouter();
  const { isDark } = useTheme();

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
        isDark ? styles.topNavbarDark : styles.topNavbarLight,
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
            style={styles.navBackBtn}
            accessibilityRole="button"
            accessibilityLabel="Назад"
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#F8FAFC' : '#0F172A'} />
          </TouchableOpacity>
        )}
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
      </View>

      {/* Right Header Actions: Custom action if passed (Profile moved to bottom navbar) */}
      <View style={styles.rightActions}>
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
  showBack?: boolean;
  onBack?: () => void;
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
  showBack = false,
  onBack,
}) => {
  const { isDark } = useTheme();
  const { headerAnim } = useScrollTabBar();
  const [measuredHeight, setMeasuredHeight] = useState(subtitle ? 100 : 56);

  const marginTop = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -measuredHeight],
  });

  const opacity = headerAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.2, 0],
  });

  return (
    <Animated.View
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - measuredHeight) > 2) {
          setMeasuredHeight(h);
        }
      }}
      style={[
        styles.wrapper,
        {
          marginTop,
          opacity,
          overflow: 'hidden',
        },
      ]}
    >
      {!hideTopNavbar && (
        <WebTopNavbar
          title={title}
          onLogoPress={onLogoPress}
          rightAction={!subtitle ? rightAction : undefined}
          showBack={showBack}
          onBack={onBack}
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
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  topNavbar: {
    height: 56,
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
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  navBackBtn: {
    padding: 6,
    marginLeft: -6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleButton: {
    paddingVertical: 4,
    maxWidth: '85%',
  },
  navTitleText: {
    fontSize: 26,
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
