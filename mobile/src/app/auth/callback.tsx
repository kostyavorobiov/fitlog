import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { AuthService } from '../../services/authService';

export default function AuthCallbackRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
    access_token?: string;
    refresh_token?: string;
  }>();
  const [statusText, setStatusText] = useState('Авторизація через Google...');

  useEffect(() => {
    let isCancelled = false;

    const processAuth = async () => {
      try {
        // 1. Get raw initial/current URL if available
        let currentUrl: string | null = null;
        try {
          currentUrl = await Linking.getInitialURL();
        } catch {}

        console.log('[AuthCallbackRoute] Processing callback. currentUrl:', currentUrl, 'params:', params);

        // 2. Process callback via AuthService
        const result = await AuthService.handleAuthCallbackUrl(currentUrl || params);

        if (isCancelled) return;

        if (result.user) {
          setStatusText('Успішно! Переходимо до тренувань...');
          router.replace('/(tabs)');
          return;
        }

        if (result.error) {
          console.warn('[AuthCallbackRoute] Auth error:', result.error);
          setStatusText(result.error);
          setTimeout(() => {
            if (!isCancelled) router.replace('/(auth)/login');
          }, 1500);
          return;
        }

        // 3. Fallback: check if session is already established
        const user = await AuthService.getCurrentUser();
        if (user) {
          router.replace('/(tabs)');
          return;
        }

        setTimeout(() => {
          if (!isCancelled) router.replace('/(auth)/login');
        }, 1500);
      } catch (e: any) {
        console.warn('[AuthCallbackRoute] Callback verification error:', e);
        if (!isCancelled) {
          setStatusText(e?.message || 'Помилка авторизації');
          setTimeout(() => {
            if (!isCancelled) router.replace('/(auth)/login');
          }, 1500);
        }
      }
    };

    processAuth();

    return () => {
      isCancelled = true;
    };
  }, [params, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0284c7" />
      <Text style={styles.text}>{statusText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#09090b',
  },
  text: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '500',
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
