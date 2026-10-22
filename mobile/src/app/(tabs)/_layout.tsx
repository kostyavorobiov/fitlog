import React, { useMemo } from 'react';
import { Tabs, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LiquidGlassTabBar } from '../../components/LiquidGlassTabBar';
import { ScrollTabBarProvider } from '../../context/ScrollTabBarContext';
import { ScreenGestureWrapper } from '../../components/ScreenGestureWrapper';

export default function TabLayout() {
  const segments = useSegments();
  const currentTab = segments[1] || 'index';

  const tabOrder = useMemo(() => {
    return ['index', 'analytics', 'exercises', 'profile'];
  }, []);

  const isNestedScreen = currentTab === 'trainees' || currentTab === 'calendar';

  return (
    <ScrollTabBarProvider>
      <ScreenGestureWrapper
        currentTab={currentTab}
        tabOrder={tabOrder}
        enableTabSwipe={!isNestedScreen}
        enableBackSwipe={isNestedScreen}
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
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="analytics"
            options={{
              title: 'Аналітика',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="exercises"
            options={{
              title: 'Вправи',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'fitness' : 'fitness-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Профіль',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="calendar"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="trainees"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </ScreenGestureWrapper>
    </ScrollTabBarProvider>
  );
}
