import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { LiquidGlassTabBar } from '../../components/LiquidGlassTabBar';
import { ScrollTabBarProvider } from '../../context/ScrollTabBarContext';

export default function TabLayout() {
  const { user } = useAuth();
  const isTrainer = user?.role === 'coach' || user?.role === 'admin';

  return (
    <ScrollTabBarProvider>
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
          name="trainees"
          options={{
            title: 'Підопічні',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
            href: isTrainer ? '/(tabs)/trainees' : null,
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
          name="profile"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="exercises"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </ScrollTabBarProvider>
  );
}
