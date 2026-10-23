import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AuthService } from '../services/authService';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider as AppThemeProvider, useTheme as useAppTheme } from '../context/ThemeContext';
import { SwipeUndoProvider } from '../context/SwipeUndoContext';
import { CreateWorkoutProvider } from '../context/CreateWorkoutContext';
import { ScrollTabBarProvider } from '../context/ScrollTabBarContext';

// Ensure browser session can complete redirect for OAuth flows
WebBrowser.maybeCompleteAuthSession();

const OceanNavigationDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0B1220',
    card: '#1D2939',
    text: '#F8FAFC',
    border: '#334155',
    primary: '#2563EB',
  },
};

const OceanNavigationLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    border: '#E2E8F0',
    primary: '#2563EB',
  },
};

function RootNavigator() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { isDark } = useAppTheme();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inCallback = segments[0] === 'auth';

    if (!user && !inAuthGroup && !inCallback) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, isDark ? styles.bgDark : styles.bgLight]}>
        <View style={[styles.loadingLogoCircle, isDark ? styles.logoDark : styles.logoLight]}>
          <Ionicons name="barbell" size={40} color={isDark ? '#60A5FA' : '#2563EB'} />
        </View>
        <Text style={[styles.loadingTitle, isDark ? styles.textDark : styles.textLight]}>
          Workout Diary
        </Text>
        <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 12 }} />
      </View>
    );
  }

  return (
    <NavigationThemeProvider value={isDark ? OceanNavigationDarkTheme : OceanNavigationLightTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="workout/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="exercise/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="exercise/edit" options={{ headerShown: false }} />
        <Stack.Screen name="trainees" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: 'Не знайдено' }} />
      </Stack>

      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const subscription = Linking.addEventListener('url', async ({ url }) => {
      console.log('[RootLayout] Deep link received:', url);
      if (url && (url.includes('auth/callback') || url.includes('code=') || url.includes('access_token='))) {
        try {
          await AuthService.handleAuthCallbackUrl(url);
        } catch (e) {
          console.warn('[RootLayout] Error handling deep link auth:', e);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <AuthProvider>
            <ScrollTabBarProvider>
              <SwipeUndoProvider>
                <CreateWorkoutProvider>
                  <RootNavigator />
                </CreateWorkoutProvider>
              </SwipeUndoProvider>
            </ScrollTabBarProvider>
          </AuthProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bgLight: {
    backgroundColor: '#F8FAFC',
  },
  bgDark: {
    backgroundColor: '#0B1220',
  },
  loadingLogoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoLight: {
    backgroundColor: '#F1F5F9',
  },
  logoDark: {
    backgroundColor: '#1D2939',
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  textLight: {
    color: '#0F172A',
  },
  textDark: {
    color: '#F8FAFC',
  },
});
