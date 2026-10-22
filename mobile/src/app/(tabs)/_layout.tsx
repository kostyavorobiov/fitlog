import React, { useMemo } from 'react';
import { Tabs, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { LiquidGlassTabBar } from '../../components/LiquidGlassTabBar';
import { ScrollTabBarProvider } from '../../context/ScrollTabBarContext';
import { ScreenGestureWrapper } from '../../components/ScreenGestureWrapper';

export default function TabLayout() {
  const { user, isAdmin } = useAuth();
  const isTrainer = user?.role === 'coach' || isAdmin;
  const segments = useSegments();

  const currentTab = segments[1] || 'index';

  const tabOrder = useMemo(() => {
    return isTrainer
      ? ['index', 'calendar', 'analytics', 'exercises', 'trainees']
      : ['index', 'calendar', 'analytics', 'exercises'];
  }, [isTrainer]);

  return (
    <ScrollTabBarProvider>
      <ScreenGestureWrapper
        currentTab={currentTab}
        tabOrder={tabOrder}
        enableTabSwipe={currentTab !== 'profile'}
        enableBackSwipe={currentTab === 'profile'}
      >
        <Tabs
          tabBar={(props) => <LiquidGlassTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
          }}
        >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Тренування',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="barbell-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Календар',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Аналітика',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="exercises"
          options={{
            title: 'Вправи',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="trainees"
          options={{
            title: 'Підопічні',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
            href: isTrainer ? '/(tabs)/trainees' : null,
          }}
          listeners={{
            tabPress: (e) => {
              if (!isTrainer) {
                e.preventDefault();
              }
            },
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
      </Tabs>
      </ScreenGestureWrapper>
    </ScrollTabBarProvider>
  );
}
