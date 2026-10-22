import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { useAuth } from '../context/AuthContext';
import { useCreateWorkout } from '../context/CreateWorkoutContext';
import { WorkoutService } from '../services/workoutService';

export interface TabBarRoute {
  key: string;
  name: string;
  params?: any;
}

export interface TabBarDescriptor {
  options: {
    title?: string;
    tabBarLabel?: string | ((props: any) => React.ReactNode);
    tabBarAccessibilityLabel?: string;
    tabBarButtonTestID?: string;
    tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
    href?: string | null;
    [key: string]: any;
  };
  navigation?: any;
  route?: any;
  [key: string]: any;
}

export interface BottomTabBarProps {
  state?: {
    index: number;
    routes: TabBarRoute[];
    [key: string]: any;
  };
  descriptors?: Record<string, TabBarDescriptor>;
  navigation?: any;
  insets?: any;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const LiquidGlassTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
  activeTab,
  onTabChange,
}) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const { translateY } = useScrollTabBar();
  const { openCreateModal } = useCreateWorkout();
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);

  const isEditingOrViewingWorkout = segments.some(
    (s) => (s as string) === 'workout' || (s as string) === '[id]'
  );

  // Check if any in-progress workout exists (matches Web hasActiveWorkout indicator)
  useEffect(() => {
    if (!user?.id) {
      setHasActiveWorkout(false);
      return;
    }
    let isSubscribed = true;
    WorkoutService.getWorkouts(user.id).then((list) => {
      if (!isSubscribed) return;
      const inProg = list.some((w) => w.status === 'in_progress');
      setHasActiveWorkout(inProg);
    }).catch(() => {});

    return () => {
      isSubscribed = false;
    };
  }, [user?.id, state?.index, activeTab]);

  // Strictly filter to the 4 designated bottom navigation tabs in order:
  // 1. Тренування (index), 2. Аналітика (analytics) -- [+] -- 3. Вправи (exercises), 4. Профіль (profile)
  const BOTTOM_NAV_TABS = ['index', 'analytics', 'exercises', 'profile'];
  const visibleRoutes = state && descriptors
    ? BOTTOM_NAV_TABS
        .map((name) => state.routes.find((r) => r.name === name))
        .filter((r): r is TabBarRoute => Boolean(r && descriptors[r.key]))
    : [];

  const STANDALONE_ITEMS = [
    {
      name: 'index',
      label: 'Тренування',
      icon: (focused: boolean, color: string) => (
        <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={20} color={color} />
      ),
    },
    {
      name: 'analytics',
      label: 'Аналітика',
      icon: (focused: boolean, color: string) => (
        <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={20} color={color} />
      ),
    },
    {
      name: 'exercises',
      label: 'Вправи',
      icon: (focused: boolean, color: string) => (
        <Ionicons name={focused ? 'fitness' : 'fitness-outline'} size={20} color={color} />
      ),
    },
    {
      name: 'profile',
      label: 'Профіль',
      icon: (focused: boolean, color: string) => (
        <Ionicons name={focused ? 'person' : 'person-outline'} size={20} color={color} />
      ),
    },
  ];

  const renderStandaloneItem = (item: (typeof STANDALONE_ITEMS)[0]) => {
    const isFocused = (activeTab || 'index') === item.name;
    const activeColor = isDark ? '#60A5FA' : '#2563EB';
    const inactiveColor = isDark ? '#94A3B8' : '#64748B';
    const color = isFocused ? activeColor : inactiveColor;

    return (
      <TouchableOpacity
        key={item.name}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={item.label}
        onPress={() => onTabChange?.(item.name)}
        activeOpacity={0.7}
        style={[
          styles.tabButton,
          isFocused && (isDark ? styles.tabButtonActiveDark : styles.tabButtonActiveLight),
        ]}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      >
        <View style={styles.iconWrap}>
          {item.icon(isFocused, color)}
          {item.name === 'index' && hasActiveWorkout && !isFocused && (
            <View style={styles.amberBadgeDot} />
          )}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.tabLabel,
            { color },
            isFocused && styles.tabLabelFocused,
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const hasNativeGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  const renderTabItem = (route: TabBarRoute) => {
    if (!state || !descriptors) return null;
    const isFocused = state.routes[state.index]?.key === route.key;
    const { options } = descriptors[route.key];

    const label =
      options.tabBarLabel !== undefined
        ? options.tabBarLabel
        : options.title !== undefined
        ? options.title
        : route.name;

    const labelText = typeof label === 'string' ? label : route.name;

    const onPress = () => {
      const event = navigation?.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event?.defaultPrevented) {
        navigation?.navigate(route.name, route.params);
      }
    };

    const onLongPress = () => {
      navigation?.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };

    const activeColor = isDark ? '#60A5FA' : '#2563EB';
    const inactiveColor = isDark ? '#94A3B8' : '#64748B';
    const color = isFocused ? activeColor : inactiveColor;

    return (
      <TouchableOpacity
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel || labelText}
        testID={options.tabBarButtonTestID}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
        style={[
          styles.tabButton,
          isFocused && (isDark ? styles.tabButtonActiveDark : styles.tabButtonActiveLight),
        ]}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      >
        <View style={styles.iconWrap}>
          {options.tabBarIcon?.({
            focused: isFocused,
            color,
            size: 20,
          })}
          {route.name === 'index' && hasActiveWorkout && !isFocused && (
            <View style={styles.amberBadgeDot} />
          )}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.tabLabel,
            { color },
            isFocused && styles.tabLabelFocused,
          ]}
        >
          {labelText}
        </Text>
      </TouchableOpacity>
    );
  };

  const leftRoutes = visibleRoutes.slice(0, 2);
  const rightRoutes = visibleRoutes.slice(2);

  return (
    <Animated.View
      style={[
        styles.floatingContainer,
        {
          bottom: Math.max(insets.bottom, 12),
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        style={[
          styles.glassCard,
          isDark ? styles.glassCardDark : styles.glassCardLight,
        ]}
      >
        {/* Native Liquid Glass or Translucent Fallback Background */}
        {hasNativeGlass ? (
          <GlassView
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              isDark ? styles.fallbackBgDark : styles.fallbackBgLight,
              Platform.OS === 'web' && ({ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as any),
            ]}
          />
        )}

        {/* Tab Items Row with Central '+' Action Button */}
        <View style={styles.tabsRow}>
          {activeTab && onTabChange ? (
            <>
              {STANDALONE_ITEMS.slice(0, 2).map(renderStandaloneItem)}

              {/* Central '+' Create Workout Button (action only, round Ocean Blue accent) */}
              {!isEditingOrViewingWorkout && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openCreateModal()}
                  style={styles.centerAddBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Створити нове тренування"
                >
                  <Ionicons name="add" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              {STANDALONE_ITEMS.slice(2).map(renderStandaloneItem)}
            </>
          ) : (
            <>
              {leftRoutes.map(renderTabItem)}

              {/* Central '+' Create Workout Button (action only, round Ocean Blue accent) */}
              {!isEditingOrViewingWorkout && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openCreateModal()}
                  style={styles.centerAddBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Створити нове тренування"
                >
                  <Ionicons name="add" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              {rightRoutes.map(renderTabItem)}
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  glassCard: {
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    justifyContent: 'center',
  },
  glassCardLight: {
    borderColor: '#E2E8F0',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  glassCardDark: {
    borderColor: '#334155',
    backgroundColor: 'rgba(29, 41, 57, 0.92)',
  },
  fallbackBgLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  fallbackBgDark: {
    backgroundColor: 'rgba(29, 41, 57, 0.92)',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    height: '100%',
  },
  tabButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  centerAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  tabButtonActiveLight: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  tabButtonActiveDark: {
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amberBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#60A5FA',
  },
  tabLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  tabLabelFocused: {
    fontWeight: '700',
  },
});
