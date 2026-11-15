import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { useCreateWorkout } from '../context/CreateWorkoutContext';
import { WorkoutService } from '../services/workoutService';

export interface TabBarRoute {
  key: string;
  name: string;
  params?: object;
}

export interface TabBarDescriptor {
  options: {
    tabBarLabel?: string | ((props: { focused: boolean; color: string; position: any }) => React.ReactNode);
    title?: string;
    tabBarAccessibilityLabel?: string;
    tabBarButtonTestID?: string;
    tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
  };
}

export interface BottomTabBarProps {
  state?: {
    index: number;
    routes: TabBarRoute[];
  };
  descriptors?: Record<string, TabBarDescriptor>;
  navigation?: {
    emit: (event: { type: string; target: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
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
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const { translateY } = useScrollTabBar();
  const { openCreateModal } = useCreateWorkout();
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);

  const isEditingOrViewingWorkout = segments.some(
    (s) => (s as string) === 'workout' || (s as string) === '[id]'
  );

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

  const STANDALONE_ITEMS = [
    {
      name: 'index',
      label: 'Тренування',
      icon: (focused: boolean, color: string) => (
        <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={22} color={color} />
      ),
    },
    {
      name: 'analytics',
      label: 'Аналітика',
      icon: (focused: boolean, color: string) => (
        <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={22} color={color} />
      ),
    },
    {
      name: 'exercises',
      label: 'Вправи',
      icon: (focused: boolean, color: string) => (
        <Ionicons name={focused ? 'heart' : 'heart-outline'} size={22} color={color} />
      ),
    },
    {
      name: 'profile',
      label: 'Профіль',
      icon: (focused: boolean, color: string) => (
        <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
      ),
    },
  ];

  const currentTab = activeTab || 'index';

  const renderStandaloneItem = (item: (typeof STANDALONE_ITEMS)[0]) => {
    const isFocused = currentTab === item.name;
    const color = isFocused ? colors.text : colors.textSecondary;

    return (
      <TouchableOpacity
        key={item.name}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={item.label}
        onPress={() => onTabChange?.(item.name)}
        activeOpacity={0.7}
        style={styles.tabButton}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      >
        {isFocused && (
          <View style={[styles.activeIndicator, { backgroundColor: colors.accent }]} />
        )}
        <View style={styles.iconWrap}>
          {item.icon(isFocused, color)}
          {item.name === 'index' && hasActiveWorkout && !isFocused && (
            <View style={[styles.badgeDot, { backgroundColor: colors.accent }]} />
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

  const BOTTOM_NAV_TABS = ['index', 'analytics', 'exercises', 'profile'];
  const visibleRoutes = state && descriptors
    ? BOTTOM_NAV_TABS
        .map((name) => state.routes.find((r) => r.name === name))
        .filter((r): r is TabBarRoute => Boolean(r && descriptors[r.key]))
    : [];

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

    const color = isFocused ? colors.text : colors.textSecondary;

    return (
      <TouchableOpacity
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel || labelText}
        testID={options.tabBarButtonTestID}
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.tabButton}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      >
        {isFocused && (
          <View style={[styles.activeIndicator, { backgroundColor: colors.accent }]} />
        )}
        <View style={styles.iconWrap}>
          {options.tabBarIcon ? (
            options.tabBarIcon({
              focused: isFocused,
              color,
              size: 22,
            })
          ) : (
            <Ionicons name="apps-outline" size={22} color={color} />
          )}
          {route.name === 'index' && hasActiveWorkout && !isFocused && (
            <View style={[styles.badgeDot, { backgroundColor: colors.accent }]} />
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
        styles.bottomBarContainer,
        {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          paddingBottom: Math.max(insets.bottom, 12),
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.tabsRow}>
        {activeTab && onTabChange ? (
          <>
            {STANDALONE_ITEMS.slice(0, 2).map(renderStandaloneItem)}

            {/* Central '+' Create Workout Button with surrounding circular notch */}
            {!isEditingOrViewingWorkout && (
              <View style={[styles.centerNotch, { backgroundColor: colors.tabBarBg }]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openCreateModal()}
                  style={[
                    styles.centerAddBtn,
                    {
                      backgroundColor: colors.centerButtonBg,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Створити нове тренування"
                >
                  <Ionicons name="add" size={28} color={colors.centerButtonIcon} />
                </TouchableOpacity>
              </View>
            )}

            {STANDALONE_ITEMS.slice(2).map(renderStandaloneItem)}
          </>
        ) : (
          <>
            {leftRoutes.map(renderTabItem)}

            {/* Central '+' Create Workout Button with surrounding circular notch */}
            {!isEditingOrViewingWorkout && (
              <View style={[styles.centerNotch, { backgroundColor: colors.tabBarBg }]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => openCreateModal()}
                  style={[
                    styles.centerAddBtn,
                    {
                      backgroundColor: colors.centerButtonBg,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Створити нове тренування"
                >
                  <Ionicons name="add" size={28} color={colors.centerButtonIcon} />
                </TouchableOpacity>
              </View>
            )}

            {rightRoutes.map(renderTabItem)}
          </>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bottomBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    borderTopWidth: 1,
    paddingTop: 8,
    overflow: 'visible',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    height: 52,
    overflow: 'visible',
  },
  tabButton: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    gap: 3,
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    width: 30,
    height: 3.5,
    borderRadius: 2,
  },
  centerNotch: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    zIndex: 10,
  },
  centerAddBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  tabLabelFocused: {
    fontWeight: '700',
  },
});
