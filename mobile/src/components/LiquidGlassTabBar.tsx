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
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../context/ThemeContext';
import { useScrollTabBar } from '../context/ScrollTabBarContext';
import { useAuth } from '../context/AuthContext';
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
  state: {
    index: number;
    routes: TabBarRoute[];
    [key: string]: any;
  };
  descriptors: Record<string, TabBarDescriptor>;
  navigation: any;
  insets?: any;
}

export const LiquidGlassTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { translateY } = useScrollTabBar();
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);

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
  }, [user?.id, state.index]);

  // Filter out hidden routes (e.g. href: null)
  const visibleRoutes = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    return options.href !== null;
  });

  const hasNativeGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

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

        {/* Tab Items Row */}
        <View style={styles.tabsRow}>
          {visibleRoutes.map((route) => {
            const isFocused = state.routes[state.index].key === route.key;
            const { options } = descriptors[route.key];

            const label =
              options.tabBarLabel !== undefined
                ? options.tabBarLabel
                : options.title !== undefined
                ? options.title
                : route.name;

            const labelText = typeof label === 'string' ? label : route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            // Colors exactly mirroring Web: text-zinc-950 dark:text-zinc-100 / text-zinc-500 dark:text-zinc-400
            const activeColor = isDark ? '#fafafa' : '#09090b';
            const inactiveColor = isDark ? '#a1a1aa' : '#71717a';
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
          })}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 100,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  glassCard: {
    height: 56,
    // Web mobile version rounded-2xl (16px); legacy borderRadius: 32
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    justifyContent: 'center',
  },
  glassCardLight: {
    borderColor: 'rgba(255, 255, 255, 0.65)',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  glassCardDark: {
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(24, 24, 27, 0.85)',
  },
  fallbackBgLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  fallbackBgDark: {
    backgroundColor: 'rgba(24, 24, 27, 0.88)',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    height: '100%',
  },
  tabButton: {
    flex: 1,
    height: 46,
    // Web rounded-xl (12px)
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    paddingHorizontal: 2,
    marginHorizontal: 1,
  },
  tabButtonActiveLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  tabButtonActiveDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
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
    backgroundColor: '#f59e0b',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  tabLabelFocused: {
    fontWeight: '700',
  },
});
