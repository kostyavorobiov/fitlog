import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthService } from '../../services/authService';

export default function AuthCallbackRoute() {
  const router = useRouter();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const verifyAndRedirect = async () => {
      try {
        const user = await AuthService.getCurrentUser();
        if (user) {
          router.replace('/(tabs)');
          return;
        }
      } catch (e) {
        console.warn('OAuth callback verification error:', e);
      }

      timeout = setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
    };

    verifyAndRedirect();

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0284c7" />
      <Text style={styles.text}>Авторизація через Google...</Text>
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
  },
});
